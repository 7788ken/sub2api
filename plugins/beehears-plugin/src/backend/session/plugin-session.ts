export type PluginSession = {
  userId: number;
  sub2apiToken: string;
  email?: string;
  displayName?: string;
  createdAt: string;
  validatedAt: string;
  betaUnlockedAt?: string;
};

export interface PluginSessionStore {
  get(sessionId: string): Promise<PluginSession | null>;
  set(sessionId: string, session: PluginSession): Promise<void>;
  findBySub2apiToken(
    sub2apiToken: string,
  ): Promise<{ sessionId: string; session: PluginSession } | null>;
  delete(sessionId: string): Promise<void>;
}

export class InMemoryPluginSessionStore implements PluginSessionStore {
  private readonly sessions = new Map<string, PluginSession>();

  async get(sessionId: string): Promise<PluginSession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async set(sessionId: string, session: PluginSession): Promise<void> {
    this.sessions.set(sessionId, session);
  }

  async findBySub2apiToken(
    sub2apiToken: string,
  ): Promise<{ sessionId: string; session: PluginSession } | null> {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.sub2apiToken === sub2apiToken) {
        return { sessionId, session };
      }
    }
    return null;
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}
