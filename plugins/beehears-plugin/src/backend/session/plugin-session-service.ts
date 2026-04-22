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
  iframeTokenQueryKeys?: string[];
  sessionTtlMs?: number;
  secureCookie?: boolean;
  requireBetaAccess?: boolean;
};

const DEFAULT_COOKIE_NAME = 'beehears_plugin_session';
const DEFAULT_IFRAME_TOKEN_HEADER = 'x-sub2api-token';
const DEFAULT_IFRAME_TOKEN_QUERY_KEYS = ['token', 'access_token'];
const DEFAULT_SESSION_TTL_MS = 5 * 60 * 1000;

export class PluginSessionService {
  private readonly cookieName: string;
  private readonly iframeTokenHeader: string;
  private readonly iframeTokenQueryKeys: string[];
  private readonly sessionTtlMs: number;
  private readonly secureCookie: boolean;
  private readonly requireBetaAccess: boolean;

  constructor(
    private readonly authClient: Sub2ApiAuthClient,
    private readonly sessionStore: PluginSessionStore,
    options: PluginSessionServiceOptions = {},
  ) {
    this.cookieName = options.cookieName ?? DEFAULT_COOKIE_NAME;
    this.iframeTokenHeader = options.iframeTokenHeader ?? DEFAULT_IFRAME_TOKEN_HEADER;
    this.iframeTokenQueryKeys = options.iframeTokenQueryKeys ?? DEFAULT_IFRAME_TOKEN_QUERY_KEYS;
    this.sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
    this.secureCookie = options.secureCookie ?? false;
    this.requireBetaAccess = options.requireBetaAccess ?? false;
  }

  async requireSession(context: ApiRequestContext): Promise<ResolvedPluginSession> {
    const sessionId = this.readSessionId(context);
    const iframeToken = this.readIframeToken(context);
    const existingSession = sessionId ? await this.sessionStore.get(sessionId) : null;
    const tokenSessionMatch = iframeToken
      ? await this.sessionStore.findBySub2apiToken(iframeToken)
      : null;

    if (iframeToken) {
      if (
        !existingSession
        && tokenSessionMatch
        && this.isSessionFresh(tokenSessionMatch.session)
      ) {
        return {
          session: tokenSessionMatch.session,
          sessionId: tokenSessionMatch.sessionId,
          responseHeaders: {
            'Set-Cookie': this.buildSessionCookie(tokenSessionMatch.sessionId),
          },
        };
      }

      if (
        existingSession?.sub2apiToken === iframeToken
        && this.isSessionFresh(existingSession)
      ) {
        return {
          session: existingSession,
          sessionId: sessionId!,
        };
      }

      return await this.bootstrapSessionFromToken(iframeToken, {
        existingSessionId: sessionId ?? tokenSessionMatch?.sessionId,
        previousSession: existingSession ?? tokenSessionMatch?.session,
      });
    }

    if (existingSession) {
      if (this.isSessionFresh(existingSession)) {
        return {
          session: existingSession,
          sessionId: sessionId!,
        };
      }

      return await this.bootstrapSessionFromToken(existingSession.sub2apiToken, {
        existingSessionId: sessionId,
        previousSession: existingSession,
      });
    }

    throw new PluginApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  async markBetaUnlocked(sessionId: string): Promise<void> {
    const session = await this.sessionStore.get(sessionId);
    if (!session) {
      throw new PluginApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    await this.sessionStore.set(sessionId, {
      ...session,
      betaUnlockedAt: new Date().toISOString(),
    });
  }

  async clearBetaUnlocked(sessionId: string): Promise<void> {
    const session = await this.sessionStore.get(sessionId);
    if (!session) {
      throw new PluginApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    if (!session.betaUnlockedAt) {
      return;
    }

    await this.sessionStore.set(sessionId, {
      ...session,
      betaUnlockedAt: undefined,
    });
  }

  assertBetaAccess(resolvedSession: ResolvedPluginSession): void {
    if (!this.requireBetaAccess) {
      return;
    }

    if (!resolvedSession.session.betaUnlockedAt) {
      throw new PluginApiError(403, 'BETA_ACCESS_REQUIRED', 'Beta access required');
    }
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

    return undefined;
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

  private async bootstrapSessionFromToken(
    iframeToken: string,
    options: {
      existingSessionId?: string;
      previousSession?: PluginSession;
    } = {},
  ): Promise<ResolvedPluginSession> {
    try {
      const user = await this.authClient.authenticate(iframeToken);
      const nextSessionId = options.existingSessionId ?? crypto.randomUUID();
      const nowIso = new Date().toISOString();
      const session: PluginSession = {
        userId: user.id,
        sub2apiToken: iframeToken,
        email: user.email,
        displayName: user.nickname ?? user.username ?? user.email,
        createdAt: options.previousSession?.createdAt ?? nowIso,
        validatedAt: nowIso,
        betaUnlockedAt: options.previousSession?.betaUnlockedAt,
      };

      await this.sessionStore.set(nextSessionId, session);

      return {
        session,
        sessionId: nextSessionId,
        responseHeaders: options.existingSessionId
          ? undefined
          : {
              'Set-Cookie': this.buildSessionCookie(nextSessionId),
            },
      };
    } catch (error) {
      if (options.existingSessionId) {
        await this.sessionStore.delete(options.existingSessionId);
      }
      throw error;
    }
  }

  private isSessionFresh(session: PluginSession): boolean {
    const validatedAt = Date.parse(session.validatedAt || session.createdAt);
    if (!Number.isFinite(validatedAt)) {
      return false;
    }
    return Date.now() - validatedAt < this.sessionTtlMs;
  }

  private buildSessionCookie(sessionId: string): string {
    const cookieParts = [
      `${this.cookieName}=${sessionId}`,
      'Path=/',
      'HttpOnly',
      `Max-Age=${Math.max(1, Math.floor(this.sessionTtlMs / 1000))}`,
    ];

    if (this.secureCookie) {
      cookieParts.push('SameSite=None');
      cookieParts.push('Secure');
    } else {
      cookieParts.push('SameSite=Lax');
    }

    return cookieParts.join('; ');
  }
}
