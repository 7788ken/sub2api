import {
  PluginApiError,
  mapSub2ApiSubscription,
  type RawSub2ApiSubscription,
  type Sub2ApiEnvelope,
  type Sub2ApiSubscription,
} from '../types/subscription-contract';

export type Sub2ApiSubscriptionClientOptions = {
  baseUrl: string;
  adminToken?: string;
  fetchImpl?: typeof fetch;
  userSubscriptionsPath?: string;
  resetQuotaPathTemplate?: string;
  extendPathTemplate?: string;
};

type ResetQuotaPayload = {
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
};

export class Sub2ApiSubscriptionClient {
  private readonly fetchImpl: typeof fetch;
  private readonly userSubscriptionsPath: string;
  private readonly resetQuotaPathTemplate: string;
  private readonly extendPathTemplate: string;

  constructor(private readonly options: Sub2ApiSubscriptionClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.userSubscriptionsPath = options.userSubscriptionsPath ?? '/api/v1/subscriptions';
    this.resetQuotaPathTemplate =
      options.resetQuotaPathTemplate ?? '/api/v1/admin/subscriptions/:id/reset-quota';
    this.extendPathTemplate =
      options.extendPathTemplate ?? '/api/v1/admin/subscriptions/:id/extend';
  }

  async listUserSubscriptions(accessToken: string): Promise<Sub2ApiSubscription[]> {
    const response = await this.fetchImpl(this.buildUrl(this.userSubscriptionsPath), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new PluginApiError(
        response.status,
        'SUBSCRIPTION_LIST_FAILED',
        'Failed to load subscriptions',
      );
    }

    const payload = (await response.json()) as Sub2ApiEnvelope<RawSub2ApiSubscription[]>;
    if (!Array.isArray(payload.data)) {
      throw new PluginApiError(502, 'UPSTREAM_ERROR', 'Sub2API subscriptions payload is invalid');
    }

    return payload.data.map(mapSub2ApiSubscription);
  }

  async resetDailyQuota(subscriptionId: number): Promise<void> {
    // reset-quota 是 Sub2API 管理员接口，插件后端必须显式持有上游管理凭证。
    if (!this.options.adminToken) {
      throw new PluginApiError(
        500,
        'RESET_UPSTREAM_FAILED',
        'Sub2API admin token is not configured',
      );
    }

    const resetPath = this.resetQuotaPathTemplate.replace(':id', String(subscriptionId));
    const body: ResetQuotaPayload = {
      daily: true,
      weekly: false,
      monthly: false,
    };

    const response = await this.fetchImpl(this.buildUrl(resetPath), {
      method: 'POST',
      headers: {
        'x-api-key': this.options.adminToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new PluginApiError(
        502,
        'RESET_UPSTREAM_FAILED',
        'Failed to reset subscription quota upstream',
      );
    }
  }

  async extendSubscription(subscriptionId: number, days: number): Promise<void> {
    if (!this.options.adminToken) {
      throw new PluginApiError(
        500,
        'EXTEND_UPSTREAM_FAILED',
        'Sub2API admin token is not configured',
      );
    }

    const extendPath = this.extendPathTemplate.replace(':id', String(subscriptionId));

    const response = await this.fetchImpl(this.buildUrl(extendPath), {
      method: 'POST',
      headers: {
        'x-api-key': this.options.adminToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ days }),
    });

    if (!response.ok) {
      throw new PluginApiError(
        502,
        'EXTEND_UPSTREAM_FAILED',
        'Failed to extend subscription upstream',
      );
    }
  }

  private buildUrl(path: string) {
    return new URL(path, this.options.baseUrl).toString();
  }
}
