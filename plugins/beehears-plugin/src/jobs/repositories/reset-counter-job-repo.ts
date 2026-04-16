import type { SqlExecutor } from '../../api/types/subscription-contract';

export class ResetCounterJobRepository {
  async resetWeeklyCounter(executor: SqlExecutor, now: Date): Promise<number> {
    const result = await executor.query(
      `
        UPDATE plugin_beehears.subscription_extensions
        SET
          reset_count_weekly = 0,
          reset_week_start = $1,
          updated_at = NOW()
      `,
      [now.toISOString()],
    );

    return result.rowCount;
  }

  async resetThirtyDayWindow(executor: SqlExecutor, now: Date): Promise<number> {
    const result = await executor.query(
      `
        UPDATE plugin_beehears.subscription_extensions
        SET
          reset_count_30d = 0,
          reset_window_start = $1,
          updated_at = NOW()
        WHERE ($1::timestamp - reset_window_start) > INTERVAL '30 days'
      `,
      [now.toISOString()],
    );

    return result.rowCount;
  }
}
