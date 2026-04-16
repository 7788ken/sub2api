import {
  PluginApiError,
  mapSub2ApiSubscription,
  type RawSub2ApiSubscription,
  type Sub2ApiEnvelope,
  type Sub2ApiSubscription,
} from '../../api/types/subscription-contract';
import { JobBlockedError, type Sub2ApiJobClientOptions } from '../types/job-contract';

export class Sub2ApiJobClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: Sub2ApiJobClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  getServiceToken(): string {
    if (!this.options.adminToken) {
      throw new JobBlockedError(
        'sub2api-job-service-token',
        'SUB2API_ADMIN_API_KEY is not configured',
      );
    }

    return this.options.adminToken;
  }

  async listSubscriptionsForJobs(serviceToken: string): Promise<Sub2ApiSubscription[]> {
    if (!this.options.subscriptionsPath) {
      throw new JobBlockedError(
        'sub2api-job-read-capability',
        'Sub2API job subscriptions path is not configured',
      );
    }

    const response = await this.fetchImpl(this.buildUrl(this.options.subscriptionsPath), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${serviceToken}`,
      },
    });

    if (!response.ok) {
      throw new PluginApiError(
        502,
        'SUBSCRIPTION_LIST_FAILED',
        'Failed to load Sub2API subscriptions for jobs',
      );
    }

    const payload = (await response.json()) as Sub2ApiEnvelope<RawSub2ApiSubscription[]>;
    if (!Array.isArray(payload.data)) {
      throw new PluginApiError(
        502,
        'UPSTREAM_ERROR',
        'Sub2API job subscriptions payload is invalid',
      );
    }

    return payload.data.map(mapSub2ApiSubscription);
  }

  private buildUrl(path: string) {
    return new URL(path, this.options.baseUrl).toString();
  }
}
