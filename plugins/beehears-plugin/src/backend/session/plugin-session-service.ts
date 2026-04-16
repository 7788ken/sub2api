import { PluginApiError, type ApiRequestContext } from '../../api/types/subscription-contract';
import type { Sub2ApiAuthClient } from '../../api/services/sub2api-auth-client';
import type { PluginSession, PluginSessionStore } from './plugin-session';

export type ResolvedPluginSession = {
  session: PluginSession;
  sessionId: string;
  responseHeaders?: Record<string, string>;
};

export type PluginSessionServiceOptions = {
  cookieName?: string;
  iframeTokenHeader?: string;
  sessionHeader?: string;
  iframeTokenQueryKeys?: string[];
};

const DEFAULT_COOKIE_NAME = 'beehears_plugin_session';
const DEFAULT_IFRAME_TOKEN_HEADER = 'x-sub2api-token';
const DEFAULT_SESSION_HEADER = 'x-plugin-session-id';
const DEFAULT_IFRAME_TOKEN_QUERY_KEYS = ['token', 'access_token'];

export class PluginSessionService {
  private readonly cookieName: string;
  private readonly iframeTokenHeader: string;
  private readonly sessionHeader: string;
  private readonly iframeTokenQueryKeys: string[];

  constructor(
    private readonly authClient: Sub2ApiAuthClient,
    private readonly sessionStore: PluginSessionStore,
    options: PluginSessionServiceOptions = {},
  ) {
    this.cookieName = options.cookieName ?? DEFAULT_COOKIE_NAME;
    this.iframeTokenHeader = options.iframeTokenHeader ?? DEFAULT_IFRAME_TOKEN_HEADER;
    this.sessionHeader = options.sessionHeader ?? DEFAULT_SESSION_HEADER;
    this.iframeTokenQueryKeys = options.iframeTokenQueryKeys ?? DEFAULT_IFRAME_TOKEN_QUERY_KEYS;
  }

  async requireSession(context: ApiRequestContext): Promise<ResolvedPluginSession> {
    const sessionId = this.readSessionId(context);
    if (sessionId) {
      const session = await this.sessionStore.get(sessionId);
      if (session) {
        return {
          session,
          sessionId,
        };
      }
    }

    const iframeToken = this.readIframeToken(context);
    if (!iframeToken) {
      throw new PluginApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const user = await this.authClient.authenticate(iframeToken);
    const nextSessionId = crypto.randomUUID();
    // 首次拿到 iframe token 时立即换成插件 session，后续业务接口统一基于插件 session 鉴权。
    const session: PluginSession = {
      userId: user.id,
      sub2apiToken: iframeToken,
      email: user.email,
      displayName: user.nickname ?? user.username ?? user.email,
      createdAt: new Date().toISOString(),
    };

    await this.sessionStore.set(nextSessionId, session);

    return {
      session,
      sessionId: nextSessionId,
      responseHeaders: {
        'Set-Cookie': `${this.cookieName}=${nextSessionId}; Path=/; HttpOnly; SameSite=Lax`,
      },
    };
  }

  private readSessionId(context: ApiRequestContext) {
    const explicitCookie = context.cookies?.[this.cookieName];
    if (explicitCookie) {
      return explicitCookie;
    }

    const cookieHeader = context.headers.get('cookie');
    if (cookieHeader) {
      const sessionId = cookieHeader
        .split(';')
        .map((entry) => entry.trim())
        .map((entry) => entry.split('='))
        .find(([key]) => key === this.cookieName)?.[1];
      if (sessionId) {
        return sessionId;
      }
    }

    return context.headers.get(this.sessionHeader) ?? undefined;
  }

  private readIframeToken(context: ApiRequestContext) {
    const bearer = context.headers.get('authorization');
    if (bearer?.startsWith('Bearer ')) {
      return bearer.slice('Bearer '.length).trim();
    }

    const headerToken = context.headers.get(this.iframeTokenHeader);
    if (headerToken) {
      return headerToken;
    }

    const queryToken = this.readTokenFromSearchParams(context.query);
    if (queryToken) {
      return queryToken;
    }

    return this.readTokenFromReferer(context.headers);
  }

  private readTokenFromSearchParams(searchParams: URLSearchParams) {
    for (const key of this.iframeTokenQueryKeys) {
      const value = searchParams.get(key);
      if (value) {
        return value;
      }
    }

    return undefined;
  }

  private readTokenFromReferer(headers: Headers) {
    const referer = headers.get('referer') ?? headers.get('referrer');
    if (!referer) {
      return undefined;
    }

    try {
      const refererUrl = new URL(referer);
      return this.readTokenFromSearchParams(refererUrl.searchParams);
    } catch {
      return undefined;
    }
  }
}
