declare module 'node-cron' {
  export type ScheduledTask = {
    start(): void;
    stop(): void;
    destroy(): void;
  };

  export function schedule(
    expression: string,
    func: () => void | Promise<void>,
    options?: { timezone?: string },
  ): ScheduledTask;
}
