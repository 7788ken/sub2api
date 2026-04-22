export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error: ApiError | null;
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
  is_expired: boolean;
  rollover_enabled: boolean;
  reset_quota_weekly: number;
  reset_quota_30d: number;
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

export type ResetQuotaSummary = {
  id: number;
  reset_count_30d: number;
  reset_count_weekly: number;
  reset_quota_30d: number;
  reset_quota_weekly: number;
  can_reset: boolean;
};

export type ToggleRolloverPayload = {
  enabled: boolean;
};

export type ToggleRolloverResponse = {
  id: number;
  rollover_enabled: boolean;
  updated_at: string;
};

export type ResetSubscriptionResponse = Pick<
  SubscriptionSummary,
  | 'id'
  | 'balance_carry'
  | 'reset_quota_30d'
  | 'reset_quota_weekly'
  | 'expires_at'
  | 'virtual_expires_at'
>;
