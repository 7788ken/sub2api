import type {
  ResetQuotaSummary,
  SubscriptionHistoryRecord,
  SubscriptionSummary,
} from '../types/subscriptions';
import { getPlanCategory } from '../utils/plan-icons';

const now = new Date();
const future = (days: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

function mock(base: Omit<SubscriptionSummary, 'category'>): SubscriptionSummary {
  return { ...base, category: getPlanCategory(base.plan_name) ?? 'Other' };
}

export const MOCK_SUBSCRIPTIONS: SubscriptionSummary[] = [
  mock({
    id: 1001,
    plan_name: 'Claude Sonnet',
    daily_quota: 200,
    current_used: 74,
    carry_open: 45,
    balance_carry: 0,
    available_quota: 171,
    expires_at: future(60),
    virtual_expires_at: future(58),
    is_expired: false,
    rollover_enabled: true,
    reset_quota_weekly: 1,
    reset_quota_30d: 2,
  }),
  mock({
    id: 1002,
    plan_name: 'GPT-4o',
    daily_quota: 50,
    current_used: 50,
    carry_open: 0,
    balance_carry: 0,
    available_quota: 0,
    expires_at: future(30),
    virtual_expires_at: future(30),
    is_expired: false,
    rollover_enabled: false,
    reset_quota_weekly: 1,
    reset_quota_30d: 3,
  }),
  mock({
    id: 1003,
    plan_name: 'Gemini Pro',
    daily_quota: 1000,
    current_used: 328,
    carry_open: 120,
    balance_carry: 0,
    available_quota: 792,
    expires_at: future(90),
    virtual_expires_at: future(87),
    is_expired: false,
    rollover_enabled: true,
    reset_quota_weekly: 0,
    reset_quota_30d: 1,
  }),
];

export const MOCK_SUBSCRIPTION_HISTORY: SubscriptionHistoryRecord[] = [
  { event_type: 'rollover', event_at: future(-1), quota_before: 45, carry_amount: 45, quota_after: 245 },
  { event_type: 'reset', event_at: future(-2), days_deducted: 1, expires_before: future(60), expires_after: future(59), reset_count_used: 1 },
  { event_type: 'rollover', event_at: future(-3), quota_before: 68, carry_amount: 68, quota_after: 268 },
  { event_type: 'rollover', event_at: future(-4), quota_before: 12, carry_amount: 12, quota_after: 212 },
  { event_type: 'reset', event_at: future(-5), days_deducted: 1, expires_before: future(42), expires_after: future(41), reset_count_used: 2 },
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
