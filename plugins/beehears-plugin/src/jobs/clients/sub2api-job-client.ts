import {
  PluginApiError,
  mapSub2ApiSubscription,
  type RawSub2ApiSubscription,
  type Sub2ApiEnvelope,
  type Sub2ApiSubscription,
} from '../../api/types/subscription-contract';
import { JobBlockedError, type Sub2ApiJobClientOptions } from '../types/job-contract';

type PaginatedSubscriptionsData = {
  items?: RawSub2ApiSubscription[];
  total?: number;
  page?: number;
  page_size?: number;
  pages?: number;
};

export class Sub2ApiJobClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: Sub2ApiJobClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  getServiceToken(): string {
    if (!this.options.adminToken) {
      throw new JobBlockedError(
        'sub2api-job-service-token',
        'SUB2API_ADMIN_TOKEN is not configured',
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

    const subscriptions: RawSub2ApiSubscription[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const response = await this.fetchImpl(this.buildUrl(this.options.subscriptionsPath, {
        page,
        page_size: 1000,
      }), {
        method: 'GET',
        headers: {
          'x-api-key': serviceToken,
        },
      });

      if (!response.ok) {
        throw new PluginApiError(
          502,
          'SUBSCRIPTION_LIST_FAILED',
          'Failed to load Sub2API subscriptions for jobs',
        );
      }

      const payload = (await response.json()) as Sub2ApiEnvelope<RawSub2ApiSubscription[] | PaginatedSubscriptionsData>;
      const pageItems = extractSubscriptions(payload.data);
      if (!pageItems) {
        throw new PluginApiError(
          502,
          'UPSTREAM_ERROR',
          'Sub2API job subscriptions payload is invalid',
        );
      }

      subscriptions.push(...pageItems);

      if (Array.isArray(payload.data)) {
        break;
      }

      totalPages = normalizeTotalPages(payload.data, pageItems.length);
      page += 1;
    }

    return subscriptions.map(mapSub2ApiSubscription);
  }

  private buildUrl(path: string, query?: Record<string, string | number>) {
    const url = new URL(path, this.options.baseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }
}

function extractSubscriptions(data: RawSub2ApiSubscription[] | PaginatedSubscriptionsData) {
  if (Array.isArray(data)) {
    return data;
  }

  return Array.isArray(data.items) ? data.items : null;
}

function normalizeTotalPages(data: PaginatedSubscriptionsData, itemCount: number) {
  if (typeof data.pages === 'number' && Number.isFinite(data.pages) && data.pages > 0) {
    return Math.floor(data.pages);
  }

  if (
    typeof data.total === 'number' &&
    Number.isFinite(data.total) &&
    data.total >= 0 &&
    typeof data.page_size === 'number' &&
    Number.isFinite(data.page_size) &&
    data.page_size > 0
  ) {
    return Math.max(1, Math.ceil(data.total / data.page_size));
  }

  return itemCount > 0 ? 1 : 0;
}
