import type {
  ApiEnvelope,
  ResetQuotaSummary,
  ResetSubscriptionResponse,
  RolloverHistoryRecord,
  SubscriptionSummary,
  ToggleRolloverPayload,
  ToggleRolloverResponse,
} from '../types/subscriptions';
import { MOCK_SUBSCRIPTIONS, MOCK_ROLLOVER_HISTORY, mockResetQuota } from './mock-data';

/** When true, all API calls return mock data instead of hitting the real backend. */
const USE_MOCK = new URLSearchParams(window.location.search).has('mock');

/** Extract the iframe token from the page URL so every API request carries it. */
const IFRAME_TOKEN = new URLSearchParams(window.location.search).get('token') ?? '';

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const authHeaders: Record<string, string> = IFRAME_TOKEN
    ? { 'x-sub2api-token': IFRAME_TOKEN }
    : {};

  const response = await fetch(input, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message || 'Request failed');
  }
  return payload.data;
}

export function getSubscriptions(): Promise<SubscriptionSummary[]> {
  if (USE_MOCK) return Promise.resolve(MOCK_SUBSCRIPTIONS);
  return request<SubscriptionSummary[]>('/api/subscriptions');
}

export function getSubscription(id: number): Promise<SubscriptionSummary> {
  if (USE_MOCK) {
    const sub = MOCK_SUBSCRIPTIONS.find((s) => s.id === id);
    return sub ? Promise.resolve(sub) : Promise.reject(new Error('Not found'));
  }
  return request<SubscriptionSummary>(`/api/subscriptions/${id}`);
}

export function toggleRollover(id: number, body: ToggleRolloverPayload): Promise<ToggleRolloverResponse> {
  if (USE_MOCK) {
    const sub = MOCK_SUBSCRIPTIONS.find((s) => s.id === id);
    if (sub) sub.rollover_enabled = body.enabled;
    return Promise.resolve({ id, rollover_enabled: body.enabled, updated_at: new Date().toISOString() });
  }
  return request<ToggleRolloverResponse>(`/api/subscriptions/${id}/rollover/toggle`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getRolloverHistory(id: number, limit = 10): Promise<RolloverHistoryRecord[]> {
  if (USE_MOCK) return Promise.resolve(MOCK_ROLLOVER_HISTORY.slice(0, limit));
  return request<RolloverHistoryRecord[]>(
    `/api/subscriptions/${id}/rollover/history?limit=${limit}`,
  );
}

export function getResetQuota(id: number): Promise<ResetQuotaSummary> {
  if (USE_MOCK) return Promise.resolve(mockResetQuota(id));
  return request<ResetQuotaSummary>(`/api/subscriptions/${id}/reset/quota`);
}

export function resetSubscription(id: number): Promise<ResetSubscriptionResponse> {
  if (USE_MOCK) {
    const sub = MOCK_SUBSCRIPTIONS.find((s) => s.id === id);
    return Promise.resolve({
      id,
      balance_carry: 0,
      reset_quota_30d: Math.max(0, (sub?.reset_quota_30d ?? 0) - 1),
      reset_quota_weekly: 0,
      expires_at: sub?.expires_at ?? '',
      virtual_expires_at: sub?.virtual_expires_at ?? '',
    });
  }
  return request<ResetSubscriptionResponse>(`/api/subscriptions/${id}/reset`, {
    method: 'POST',
  });
}
