export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: ApiErrorPayload | null;
};

export type ApiHandlerResult<T> = {
  status: number;
  headers?: Record<string, string>;
  body: ApiEnvelope<T>;
};

export type ApiRequestContext = {
  headers: Headers;
  params: Record<string, string | undefined>;
  query: URLSearchParams;
  body?: unknown;
  cookies?: Record<string, string | undefined>;
};

export type QueryResult<Row> = {
  rows: Row[];
  rowCount: number;
};

export interface SqlExecutor {
  query<Row>(sql: string, params?: readonly unknown[]): Promise<QueryResult<Row>>;
}

export interface DatabaseClient extends SqlExecutor {
  transaction<T>(callback: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

export type Sub2ApiEnvelope<T> = {
  code: number;
  message: string;
  data: T;
};

export type Sub2ApiGroup = {
  id: number;
  name: string;
  platform?: string | null;
  daily_limit_usd?: number | null;
};

export type RawSub2ApiSubscription = {
  id: number;
  user_id: number;
  group_id: number;
  expires_at: string;
  daily_usage_usd: number;
  group?: Sub2ApiGroup | null;
};

export type Sub2ApiSubscription = {
  id: number;
  user_id: number;
  plan_name: string;
  platform: string;
  daily_quota: number;
  current_used: number;
  expires_at: string;
};

export type Sub2ApiCurrentUser = {
  id: number;
  email?: string;
  username?: string;
  nickname?: string;
};

export type SubscriptionExtensionRecord = {
  id: number;
  user_id: number;
  sub2api_subscription_id: number;
  balance_carry: number;
  reset_count_30d: number;
  reset_window_start: string;
  reset_count_weekly: number;
  reset_week_start: string;
  extra_days_deducted: number;
  created_at: string;
  updated_at: string;
};

export type RolloverSettingRecord = {
  id: number;
  user_id: number;
  sub2api_subscription_id: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type RolloverHistoryRecord = {
  rolled_at: string;
  quota_before: number;
  carry_amount: number;
  quota_after: number;
};

export type ResetHistoryRecord = {
  id: number;
  user_id: number;
  sub2api_subscription_id: number;
  reset_at: string;
  days_deducted: number;
  expires_before: string;
  expires_after: string;
  reset_count_used: number;
  created_at: string;
};

export type SubscriptionHistoryRecord =
  | {
      event_type: 'rollover';
      event_at: string;
      quota_before: number;
      carry_amount: number;
      quota_after: number;
    }
  | {
      event_type: 'reset';
      event_at: string;
      days_deducted: number;
      expires_before: string;
      expires_after: string;
      reset_count_used: number;
    };

export type SubscriptionSummary = {
  id: number;
  plan_name: string;
  category: string;
  daily_quota: number;
  current_used: number;
  carry_open: number;
  balance_carry: number;
  available_quota: number;
  expires_at: string;
  virtual_expires_at: string;
  rollover_enabled: boolean;
  reset_quota_weekly: number;
  reset_quota_30d: number;
  extra_days_deducted: number;
};

export function classifyPlanCategory(planName: string, platform?: string | null): string {
  const normalizedPlatform = (platform ?? '').trim().toLowerCase();
  if (normalizedPlatform === 'anthropic') return 'Claude';
  if (normalizedPlatform === 'openai') return 'OpenAI';
  if (normalizedPlatform === 'gemini') return 'Gemini';

  const lower = planName.toLowerCase();
  if (lower.includes('claude') || lower.includes('anthropic')) return 'Claude';
  if (lower.includes('gpt') || lower.includes('openai') || lower.includes('chatgpt') || lower.includes('o1') || lower.includes('o3') || lower.includes('o4')) return 'OpenAI';
  if (lower.includes('gemini') || lower.includes('google')) return 'Gemini';
  return 'Other';
}

export type ResetQuotaSummary = {
  id: number;
  reset_count_30d: number;
  reset_count_weekly: number;
  reset_quota_30d: number;
  reset_quota_weekly: number;
  extra_days_deducted: number;
  virtual_expires_at: string;
  can_reset: boolean;
};

export type ToggleRolloverRequest = {
  enabled: boolean;
};

export type ToggleRolloverResponse = {
  id: number;
  rollover_enabled: boolean;
  updated_at: string;
};

export type ResetSubscriptionResponse = {
  id: number;
  balance_carry: number;
  extra_days_deducted: number;
  expires_at: string;
  virtual_expires_at: string;
  reset_quota_weekly: number;
  reset_quota_30d: number;
};

export type NormalizedResetState = {
  reset_count_30d: number;
  reset_window_start: string;
  reset_count_weekly: number;
  reset_week_start: string;
};

export type OwnedSubscriptionSnapshot = {
  base: Sub2ApiSubscription;
  extension: SubscriptionExtensionRecord;
  rolloverSetting: RolloverSettingRecord | null;
  summary: SubscriptionSummary;
};

export type CarryFirstQuotaBreakdown = {
  carry_open: number;
  carry_remaining: number;
  daily_remaining: number;
  available_total: number;
  total_quota: number;
};

export type RouteDefinition = {
  method: 'GET' | 'POST';
  path: string;
  handle: (context: ApiRequestContext) => Promise<ApiHandlerResult<unknown>>;
};

export class PluginApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'PluginApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function buildSuccessResult<T>(
  data: T,
  status = 200,
  headers?: Record<string, string>,
): ApiHandlerResult<T> {
  return {
    status,
    headers,
    body: {
      success: true,
      data,
      error: null,
    },
  };
}

export function buildErrorResult(
  error: unknown,
  fallbackStatus: number,
  fallbackCode: string,
  fallbackMessage: string,
): ApiHandlerResult<null> {
  if (error instanceof PluginApiError) {
    return {
      status: error.status,
      body: {
        success: false,
        data: null,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
    };
  }

  return {
    status: fallbackStatus,
    body: {
      success: false,
      data: null,
      error: {
        code: fallbackCode,
        message: fallbackMessage,
      },
    },
  };
}

export function requirePositiveInteger(rawValue: string | undefined, fieldName: string): number {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new PluginApiError(400, 'VALIDATION_ERROR', `${fieldName} must be a positive integer`);
  }
  return value;
}

export function parseHistoryLimit(rawValue: string | null): number {
  if (rawValue === null || rawValue === '') {
    return 10;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0 || value > 50) {
    throw new PluginApiError(
      400,
      'VALIDATION_ERROR',
      'limit must be an integer between 1 and 50',
    );
  }

  return value;
}

export function parseToggleRequest(body: unknown): ToggleRolloverRequest {
  if (!body || typeof body !== 'object' || typeof (body as { enabled?: unknown }).enabled !== 'boolean') {
    throw new PluginApiError(
      400,
      'VALIDATION_ERROR',
      'enabled must be provided as a boolean',
    );
  }

  return {
    enabled: (body as { enabled: boolean }).enabled,
  };
}

export function mapSub2ApiSubscription(raw: RawSub2ApiSubscription): Sub2ApiSubscription {
  return {
    id: raw.id,
    user_id: raw.user_id,
    plan_name: raw.group?.name ?? `Subscription #${raw.id}`,
    platform: raw.group?.platform ?? '',
    daily_quota: Number(raw.group?.daily_limit_usd ?? 0),
    current_used: Number(raw.daily_usage_usd ?? 0),
    expires_at: raw.expires_at,
  };
}

export function createDefaultExtension(
  userId: number,
  subscriptionId: number,
  now: Date,
): SubscriptionExtensionRecord {
  const weekStart = startOfResetWeek(now).toISOString();
  const nowIso = now.toISOString();

  return {
    id: 0,
    user_id: userId,
    sub2api_subscription_id: subscriptionId,
    balance_carry: 0,
    reset_count_30d: 0,
    reset_window_start: nowIso,
    reset_count_weekly: 0,
    reset_week_start: weekStart,
    extra_days_deducted: 0,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

export function normalizeResetState(
  extension: SubscriptionExtensionRecord,
  now: Date,
): NormalizedResetState {
  const resetWindowStart = parseDate(extension.reset_window_start);
  const resetWeekStart = parseDate(extension.reset_week_start);
  const currentWeekStart = startOfResetWeek(now);

  const resetCount30d =
    now.getTime() - resetWindowStart.getTime() >= 30 * 24 * 60 * 60 * 1000
      ? 0
      : extension.reset_count_30d;

  const resetCountWeekly = resetWeekStart.getTime() < currentWeekStart.getTime()
    ? 0
    : extension.reset_count_weekly;

  return {
    reset_count_30d: resetCount30d,
    reset_window_start:
      resetCount30d === 0 ? now.toISOString() : resetWindowStart.toISOString(),
    reset_count_weekly: resetCountWeekly,
    reset_week_start:
      resetCountWeekly === 0 ? currentWeekStart.toISOString() : resetWeekStart.toISOString(),
  };
}

export function calculateCarryFirstQuota(
  dailyQuota: number,
  balanceCarry: number,
  currentUsed: number,
): CarryFirstQuotaBreakdown {
  const carryOpen = Number(balanceCarry);
  const used = Number(currentUsed);
  const daily = Number(dailyQuota);
  const carryRemaining = Math.max(carryOpen - used, 0);
  const usedAfterCarry = Math.max(used - carryOpen, 0);
  const dailyRemaining = Math.max(daily - usedAfterCarry, 0);

  return {
    carry_open: carryOpen,
    carry_remaining: carryRemaining,
    daily_remaining: dailyRemaining,
    available_total: carryRemaining + dailyRemaining,
    total_quota: carryOpen + daily,
  };
}

export function calculateResetQuota30d(resetCount30d: number) {
  return Math.max(0, 3 - resetCount30d);
}

export function calculateResetQuotaWeekly(resetCountWeekly: number) {
  return Math.max(0, 1 - resetCountWeekly);
}

export function calculateVirtualExpiresAt(expiresAt: string, _extraDaysDeducted: number) {
  return expiresAt;
}

export function hasResettableVirtualExpiry(virtualExpiresAt: string, now: Date) {
  const minimumAllowedExpiry = now.getTime() + 24 * 60 * 60 * 1000;
  return parseDate(virtualExpiresAt).getTime() > minimumAllowedExpiry;
}

export function startOfResetWeek(date: Date) {
  const offsetMs = 8 * 60 * 60 * 1000;
  const utc8 = new Date(date.getTime() + offsetMs);
  const weekDay = utc8.getUTCDay();
  utc8.setUTCHours(0, 0, 0, 0);
  utc8.setUTCDate(utc8.getUTCDate() - weekDay);
  return new Date(utc8.getTime() - offsetMs);
}

export function parseDate(value: string | Date) {
  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new PluginApiError(500, 'UPSTREAM_ERROR', `Invalid date value: ${value}`);
  }

  return parsed;
}
