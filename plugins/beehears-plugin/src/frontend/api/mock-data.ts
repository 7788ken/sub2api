import type {
  ResetQuotaSummary,
  RolloverHistoryRecord,
  SubscriptionSummary,
} from '../types/subscriptions';

const now = new Date();
const future = (days: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export const MOCK_SUBSCRIPTIONS: SubscriptionSummary[] = [
  {
    id: 1001,
    plan_name: 'Pro Plan',
    daily_quota: 200,
    current_used: 74,
    balance_carry: 45,
    available_quota: 171,
    expires_at: future(60),
    virtual_expires_at: future(58),
    rollover_enabled: true,
    reset_quota_weekly: 1,
    reset_quota_30d: 2,
  },
  {
    id: 1002,
    plan_name: 'Starter Plan',
    daily_quota: 50,
    current_used: 50,
    balance_carry: 0,
    available_quota: 0,
    expires_at: future(30),
    virtual_expires_at: future(30),
    rollover_enabled: false,
    reset_quota_weekly: 1,
    reset_quota_30d: 3,
  },
  {
    id: 1003,
    plan_name: 'Enterprise Plan',
    daily_quota: 1000,
    current_used: 328,
    balance_carry: 120,
    available_quota: 792,
    expires_at: future(90),
    virtual_expires_at: future(87),
    rollover_enabled: true,
    reset_quota_weekly: 0,
    reset_quota_30d: 1,
  },
];

export const MOCK_ROLLOVER_HISTORY: RolloverHistoryRecord[] = [
  { rolled_at: future(-1), quota_before: 45, carry_amount: 45, quota_after: 245 },
  { rolled_at: future(-2), quota_before: 30, carry_amount: 30, quota_after: 230 },
  { rolled_at: future(-3), quota_before: 68, carry_amount: 68, quota_after: 268 },
  { rolled_at: future(-4), quota_before: 12, carry_amount: 12, quota_after: 212 },
  { rolled_at: future(-5), quota_before: 55, carry_amount: 55, quota_after: 255 },
];

export function mockResetQuota(id: number): ResetQuotaSummary {
  const sub = MOCK_SUBSCRIPTIONS.find((s) => s.id === id);
  return {
    id,
    reset_count_30d: 3 - (sub?.reset_quota_30d ?? 0),
    reset_count_weekly: 1 - (sub?.reset_quota_weekly ?? 0),
    reset_quota_30d: sub?.reset_quota_30d ?? 0,
    reset_quota_weekly: sub?.reset_quota_weekly ?? 0,
    can_reset: (sub?.reset_quota_weekly ?? 0) > 0 && (sub?.reset_quota_30d ?? 0) > 0,
  };
}
