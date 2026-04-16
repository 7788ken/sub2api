export type PluginSession = {
  userId: number;
  sub2apiToken: string;
  email?: string;
  displayName?: string;
  createdAt: string;
};

export interface PluginSessionStore {
  get(sessionId: string): Promise<PluginSession | null>;
  set(sessionId: string, session: PluginSession): Promise<void>;
}

export class InMemoryPluginSessionStore implements PluginSessionStore {
  private readonly sessions = new Map<string, PluginSession>();

  async get(sessionId: string): Promise<PluginSession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async set(sessionId: string, session: PluginSession): Promise<void> {
    this.sessions.set(sessionId, session);
  }
}
