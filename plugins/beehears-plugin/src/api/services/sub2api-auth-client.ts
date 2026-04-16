import {
  PluginApiError,
  type Sub2ApiCurrentUser,
  type Sub2ApiEnvelope,
} from '../types/subscription-contract';

export type Sub2ApiAuthClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  mePath?: string;
};

export class Sub2ApiAuthClient {
  private readonly fetchImpl: typeof fetch;
  private readonly mePath: string;

  constructor(private readonly options: Sub2ApiAuthClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.mePath = options.mePath ?? '/api/v1/auth/me';
  }

  async authenticate(accessToken: string): Promise<Sub2ApiCurrentUser> {
    const response = await this.fetchImpl(this.buildUrl(this.mePath), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new PluginApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const payload = (await response.json()) as Sub2ApiEnvelope<Sub2ApiCurrentUser>;
    if (!payload?.data?.id) {
      throw new PluginApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    return payload.data;
  }

  private buildUrl(path: string) {
    return new URL(path, this.options.baseUrl).toString();
  }
}
