/**
 * beehears-plugin 本地开发服务器
 * 提供 API 后端 + React 前端 (Vite dev middleware)
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// pg 默认将 NUMERIC 类型返回为字符串，这会导致 JS 的 + 运算符做字符串拼接而非数值加法。
// OID 1700 = NUMERIC
pg.types.setTypeParser(1700, parseFloat);

// --- 插件源码导入 ---
import { createSubscriptionRoutes } from './src/api/routes/subscriptions.js';
import { Sub2ApiAuthClient } from './src/api/services/sub2api-auth-client.js';
import { Sub2ApiSubscriptionClient } from './src/api/services/sub2api-subscription-client.js';
import { SubscriptionMergeService } from './src/api/services/subscription-merge-service.js';
import { SubscriptionResetService } from './src/api/services/subscription-reset-service.js';
import { SubscriptionExtensionRepository } from './src/api/repositories/subscription-extension-repo.js';
import { RolloverSettingsRepository } from './src/api/repositories/rollover-settings-repo.js';
import { RolloverHistoryRepository } from './src/api/repositories/rollover-history-repo.js';
import { ResetHistoryRepository } from './src/api/repositories/reset-history-repo.js';
import { PluginSessionService } from './src/backend/session/plugin-session-service.js';
import { InMemoryPluginSessionStore } from './src/backend/session/plugin-session.js';
import { registerBeehearsJobs } from './src/jobs/scheduler.js';
import { PluginApiError, type DatabaseClient, type SqlExecutor, type QueryResult, type ApiRequestContext } from './src/api/types/subscription-contract.js';

// --- 配置 ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = Number(process.env.PLUGIN_PORT || 3001);
const SUB2API_BASE_URL = process.env.SUB2API_BASE_URL || 'http://localhost:8080';
const SUB2API_ADMIN_TOKEN = process.env.SUB2API_ADMIN_TOKEN || '';
const SUB2API_JOB_ROLLOVER_TOKEN = process.env.SUB2API_JOB_ROLLOVER_TOKEN || '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const BETA_PASSWORD = process.env.BETA_PASSWORD || '';
const SESSION_TTL_MS = parsePositiveInt(process.env.PLUGIN_SESSION_TTL_MS, 5 * 60 * 1000);
const BETA_RATE_LIMIT_WINDOW_MS = parsePositiveInt(
  process.env.BETA_RATE_LIMIT_WINDOW_MS,
  5 * 60 * 1000,
);
const BETA_RATE_LIMIT_MAX_ATTEMPTS = parsePositiveInt(
  process.env.BETA_RATE_LIMIT_MAX_ATTEMPTS,
  8,
);
const DEFAULT_ALLOWED_ORIGINS = [
  'https://plugin1.beehears.com',
  'https://coding.beehears.com',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];
const ALLOWED_ORIGINS = new Set(
  parseCsv(process.env.PLUGIN_ALLOWED_ORIGINS).length > 0
    ? parseCsv(process.env.PLUGIN_ALLOWED_ORIGINS)
    : DEFAULT_ALLOWED_ORIGINS,
);
const ADMIN_USER_IDS = new Set(
  (process.env.ADMIN_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean).map(Number),
);
const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'sub2api',
  password: process.env.DB_PASSWORD || 'sub2api',
  database: process.env.DB_NAME || 'sub2api',
};

// --- DatabaseClient 适配器 (pg -> 插件接口) ---
class PgDatabaseClient implements DatabaseClient {
  constructor(private pool: pg.Pool) {}

  async query<Row>(sql: string, params?: readonly unknown[]): Promise<QueryResult<Row>> {
    const result = await this.pool.query(sql, params as unknown[]);
    return { rows: result.rows as Row[], rowCount: result.rowCount ?? 0 };
  }

  async transaction<T>(callback: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const txExecutor: SqlExecutor = {
        async query<Row>(sql: string, params?: readonly unknown[]): Promise<QueryResult<Row>> {
          const result = await client.query(sql, params as unknown[]);
          return { rows: result.rows as Row[], rowCount: result.rowCount ?? 0 };
        },
      };
      const result = await callback(txExecutor);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

// --- Express -> ApiRequestContext 转换 ---
function toApiContext(req: express.Request): ApiRequestContext {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(', '));
  }

  const url = new URL(req.originalUrl, `http://${req.headers.host || 'localhost'}`);

  return {
    headers,
    params: req.params as Record<string, string | undefined>,
    query: url.searchParams,
    body: req.body,
    cookies: req.cookies as Record<string, string | undefined>,
  };
}

type AdminSubscriptionsPage = {
  total?: number;
  items?: unknown[];
};

type AdminSubscriptionsResponse = {
  data?: AdminSubscriptionsPage | unknown[];
};

type AdminStatsPayload = {
  totalSubscriptions: number;
  validSubscriptions: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const betaAttemptBuckets = new Map<string, RateLimitBucket>();

function parseCsv(value?: string): string[] {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  const value = Number(rawValue);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) {
    return true;
  }
  return ALLOWED_ORIGINS.has(origin);
}

function getClientIp(req: express.Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0];
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function consumeBetaAttempt(key: string) {
  const now = Date.now();
  const existing = betaAttemptBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    betaAttemptBuckets.set(key, {
      count: 1,
      resetAt: now + BETA_RATE_LIMIT_WINDOW_MS,
    });
    return {
      limited: false,
      retryAfterSeconds: Math.ceil(BETA_RATE_LIMIT_WINDOW_MS / 1000),
    };
  }

  if (existing.count >= BETA_RATE_LIMIT_MAX_ATTEMPTS) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  betaAttemptBuckets.set(key, existing);
  return {
    limited: false,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

function resetBetaAttempts(key: string) {
  betaAttemptBuckets.delete(key);
}

function getAdminSubscriptionTotal(payload: AdminSubscriptionsResponse): number {
  if (Array.isArray(payload.data)) {
    return payload.data.length;
  }

  if (payload.data && typeof payload.data === 'object') {
    const page = payload.data as AdminSubscriptionsPage;
    if (typeof page.total === 'number' && Number.isFinite(page.total) && page.total >= 0) {
      return page.total;
    }
    if (Array.isArray(page.items)) {
      return page.items.length;
    }
  }

  return 0;
}

async function fetchAdminSubscriptionTotal(
  baseUrl: string,
  adminToken: string,
  status?: string,
): Promise<number> {
  const adminUrl = new URL('/api/v1/admin/subscriptions', baseUrl);
  adminUrl.searchParams.set('page', '1');
  adminUrl.searchParams.set('page_size', '1');
  if (status) {
    adminUrl.searchParams.set('status', status);
  }

  const adminRes = await fetch(adminUrl, {
    headers: { 'x-api-key': adminToken },
  });
  if (!adminRes.ok) {
    return 0;
  }

  const payload = (await adminRes.json()) as AdminSubscriptionsResponse;
  return getAdminSubscriptionTotal(payload);
}

// --- 主函数 ---
async function main() {
  // 1. 初始化数据库连接
  const pool = new pg.Pool(DB_CONFIG);
  await pool.query('SELECT 1');
  console.log('[plugin] ✓ PostgreSQL connected');

  // 2. 执行建表脚本
  const initSql = readFileSync(join(__dirname, 'db', 'init.sql'), 'utf-8');
  await pool.query(initSql);
  console.log('[plugin] ✓ Database tables ready');

  const databaseClient = new PgDatabaseClient(pool);

  // 3. 组装依赖
  const authClient = new Sub2ApiAuthClient({ baseUrl: SUB2API_BASE_URL });
  const subscriptionClient = new Sub2ApiSubscriptionClient({
    baseUrl: SUB2API_BASE_URL,
    adminToken: SUB2API_ADMIN_TOKEN || undefined,
  });
  const sessionStore = new InMemoryPluginSessionStore();
  const sessionService = new PluginSessionService(authClient, sessionStore, {
    sessionTtlMs: SESSION_TTL_MS,
    secureCookie: IS_PRODUCTION,
    requireBetaAccess: Boolean(BETA_PASSWORD),
  });

  const extensionRepo = new SubscriptionExtensionRepository();
  const rolloverSettingsRepo = new RolloverSettingsRepository();
  const rolloverHistoryRepo = new RolloverHistoryRepository();
  const resetHistoryRepo = new ResetHistoryRepository();

  const mergeService = new SubscriptionMergeService(
    databaseClient,
    subscriptionClient,
    extensionRepo,
    rolloverSettingsRepo,
  );

  const resetService = new SubscriptionResetService(
    databaseClient,
    mergeService,
    subscriptionClient,
    extensionRepo,
    resetHistoryRepo,
  );

  // 4. 创建路由
  const routes = createSubscriptionRoutes({
    databaseClient,
    sessionService,
    mergeService,
    rolloverSettingsRepository: rolloverSettingsRepo,
    rolloverHistoryRepository: rolloverHistoryRepo,
    resetHistoryRepository: resetHistoryRepo,
    resetService,
  });

  // 5. 初始化 Express
  const app = express();
  app.set('trust proxy', 1);
  app.use(cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  }));
  app.use(cookieParser());
  app.use(express.json());

  // 6. 注册 API 路由
  for (const route of routes) {
    const method = route.method.toLowerCase() as 'get' | 'post';
    app[method](route.path, async (req: express.Request, res: express.Response) => {
      try {
        const context = toApiContext(req);
        const result = await route.handle(context);

        if (result.status >= 400) {
          console.error(`[plugin] ${route.method} ${route.path} → ${result.status}`, JSON.stringify(result.body));
        }

        if (result.headers) {
          for (const [key, value] of Object.entries(result.headers)) {
            res.setHeader(key, value);
          }
        }
        res.status(result.status).json(result.body);
      } catch (err) {
        console.error(`[plugin] Route error ${route.method} ${route.path}:`, err);
        res.status(500).json({
          success: false,
          data: null,
          error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
        });
      }
    });
    console.log(`[plugin]   ${route.method.padEnd(4)} ${route.path}`);
  }

  // 7. 健康检查
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'beehears-plugin' });
  });

  // 7.1 查询内测门禁状态
  app.get('/api/beta/status', async (req: express.Request, res: express.Response) => {
    try {
      const context = toApiContext(req);
      const session = await sessionService.requireSession(context);

      if (session.responseHeaders) {
        for (const [key, value] of Object.entries(session.responseHeaders)) {
          res.setHeader(key, value);
        }
      }

      const required = Boolean(BETA_PASSWORD);
      if (required && session.session.betaUnlockedAt) {
        await sessionService.clearBetaUnlocked(session.sessionId);
      }

      res.json({
        success: true,
        data: {
          required,
          unlocked: !required,
        },
        error: null,
      });
    } catch (err) {
      if (err instanceof Error) {
        console.error('[plugin] beta status error:', err);
      }
      res.status(401).json({
        success: false,
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
  });

  // 7.2 内测密码验证
  app.post('/api/beta/verify', async (req: express.Request, res: express.Response) => {
    try {
      const context = toApiContext(req);
      const session = await sessionService.requireSession(context);
      const limitKey = `${session.session.userId}:${getClientIp(req)}`;
      const { password } = req.body as { password?: string };

      if (session.responseHeaders) {
        for (const [key, value] of Object.entries(session.responseHeaders)) {
          res.setHeader(key, value);
        }
      }

      if (!BETA_PASSWORD) {
        res.json({ success: true, data: null, error: null });
        return;
      }

      const rateLimit = consumeBetaAttempt(limitKey);
      if (rateLimit.limited) {
        res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
        res.status(429).json({
          success: false,
          data: null,
          error: { code: 'RATE_LIMITED', message: 'Too many attempts' },
        });
        return;
      }

      if (password !== BETA_PASSWORD) {
        res.status(403).json({
          success: false,
          data: null,
          error: { code: 'WRONG_PASSWORD', message: 'Wrong password' },
        });
        return;
      }

      await sessionService.markBetaUnlocked(session.sessionId);
      resetBetaAttempts(limitKey);
      res.json({ success: true, data: null, error: null });
    } catch (err) {
      if (err instanceof Error) {
        console.error('[plugin] beta verify error:', err);
      }
      res.status(401).json({
        success: false,
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
  });

  // 7.3 管理员统计（有效订阅 / 全站订阅）
  app.get('/api/admin/stats', async (req: express.Request, res: express.Response) => {
    try {
      const context = toApiContext(req);
      const session = await sessionService.requireSession(context);
      sessionService.assertBetaAccess(session);
      if (!ADMIN_USER_IDS.has(session.session.userId)) {
        res.status(403).json({ success: false, data: null, error: { code: 'FORBIDDEN', message: 'Admin only' } });
        return;
      }
      if (session.responseHeaders) {
        for (const [key, value] of Object.entries(session.responseHeaders)) {
          res.setHeader(key, value);
        }
      }
      const stats: AdminStatsPayload = {
        totalSubscriptions: 0,
        validSubscriptions: 0,
      };
      if (SUB2API_ADMIN_TOKEN) {
        const [totalSubscriptions, validSubscriptions] = await Promise.all([
          fetchAdminSubscriptionTotal(SUB2API_BASE_URL, SUB2API_ADMIN_TOKEN),
          fetchAdminSubscriptionTotal(SUB2API_BASE_URL, SUB2API_ADMIN_TOKEN, 'active'),
        ]);
        stats.totalSubscriptions = totalSubscriptions;
        stats.validSubscriptions = validSubscriptions;
      }
      res.json({ success: true, data: stats, error: null });
    } catch (err) {
      console.error('[plugin] admin stats error:', err);
      if (err instanceof PluginApiError) {
        res.status(err.status).json({
          success: false,
          data: null,
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
          },
        });
        return;
      }
      res.status(500).json({ success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'Failed to load admin stats' } });
    }
  });

  // 8. 前端资源托管：开发环境走 Vite middleware，生产环境只走构建产物
  if (!IS_PRODUCTION) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('[plugin] ✓ Vite dev middleware attached');
    } catch (err) {
      console.warn('[plugin] ⚠ Vite dev middleware not available, serving static files');
      app.use(express.static(join(__dirname, 'dist', 'frontend')));
      app.get('*', (_req, res) => {
        res.sendFile(join(__dirname, 'dist', 'frontend', 'index.html'));
      });
    }
  } else {
    app.use(express.static(join(__dirname, 'dist', 'frontend')));
    app.get('*', (_req, res) => {
      res.sendFile(join(__dirname, 'dist', 'frontend', 'index.html'));
    });
    console.log('[plugin] ✓ Static frontend serving enabled');
  }

  // 9. 注册定时任务
  if (SUB2API_ADMIN_TOKEN) {
    await registerBeehearsJobs({
      databaseClient,
      sub2ApiBaseUrl: SUB2API_BASE_URL,
      sub2ApiAdminToken: SUB2API_ADMIN_TOKEN,
      sub2ApiJobRolloverToken: SUB2API_JOB_ROLLOVER_TOKEN || undefined,
      sub2ApiJobSubscriptionsPath: '/api/v1/admin/subscriptions',
      sub2ApiJobRolloverSnapshotPath: '/api/v1/admin/subscriptions/usage-rollover-snapshot',
    });
    console.log('[plugin] ✓ Cron jobs registered');
  } else {
    console.log('[plugin] ⚠ SUB2API_ADMIN_TOKEN not set, cron jobs disabled');
  }

  // 10. 启动服务器
  app.listen(PORT, () => {
    console.log('');
    console.log(`[plugin] ╔══════════════════════════════════════════╗`);
    console.log(`[plugin] ║  BeeHears Plugin running on port ${PORT}   ║`);
    console.log(`[plugin] ╠══════════════════════════════════════════╣`);
    console.log(`[plugin] ║  Frontend:  http://localhost:${PORT}        ║`);
    console.log(`[plugin] ║  API:       http://localhost:${PORT}/api    ║`);
    console.log(`[plugin] ║  Health:    http://localhost:${PORT}/health ║`);
    console.log(`[plugin] ║  Sub2API:   ${SUB2API_BASE_URL.padEnd(28)}║`);
    console.log(`[plugin] ╚══════════════════════════════════════════╝`);
  });
}

main().catch((err) => {
  console.error('[plugin] Fatal:', err);
  process.exit(1);
});
