import type { RolloverHistoryRecord, SqlExecutor } from '../types/subscription-contract';

export class RolloverHistoryRepository {
  async listRecent(
    executor: SqlExecutor,
    userId: number,
    subscriptionId: number,
    limit: number,
  ): Promise<RolloverHistoryRecord[]> {
    const result = await executor.query<RolloverHistoryRecord>(
      `
        SELECT
          rolled_at,
          quota_before,
          carry_amount,
          quota_after
        FROM plugin_beehears.rollover_history
        WHERE user_id = $1
          AND sub2api_subscription_id = $2
        ORDER BY rolled_at DESC
        LIMIT $3
      `,
      [userId, subscriptionId, limit],
    );

    return result.rows;
  }
}
