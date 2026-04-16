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
import type { DatabaseClient, SqlExecutor, QueryResult, ApiRequestContext } from './src/api/types/subscription-contract.js';

// --- 配置 ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = Number(process.env.PLUGIN_PORT || 3001);
const SUB2API_BASE_URL = process.env.SUB2API_BASE_URL || 'http://localhost:8080';
const SUB2API_ADMIN_TOKEN = process.env.SUB2API_ADMIN_TOKEN || '';
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
  const sessionService = new PluginSessionService(authClient, sessionStore);

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
    resetService,
  });

  // 5. 初始化 Express
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
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

  // 8. Vite dev middleware（开发模式下服务前端）
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

  // 9. 注册定时任务
  if (SUB2API_ADMIN_TOKEN) {
    await registerBeehearsJobs({
      databaseClient,
      sub2ApiBaseUrl: SUB2API_BASE_URL,
      sub2ApiAdminToken: SUB2API_ADMIN_TOKEN,
      sub2ApiJobSubscriptionsPath: '/api/v1/admin/subscriptions',
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
