import type { ResetHistoryRecord, SqlExecutor } from '../types/subscription-contract';

export type InsertResetHistoryParams = {
  userId: number;
  subscriptionId: number;
  expiresBefore: string;
  expiresAfter: string;
  resetCountUsed: number;
};

export class ResetHistoryRepository {
  async insert(
    executor: SqlExecutor,
    params: InsertResetHistoryParams,
  ): Promise<ResetHistoryRecord> {
    const result = await executor.query<ResetHistoryRecord>(
      `
        INSERT INTO plugin_beehears.reset_history (
          user_id,
          sub2api_subscription_id,
          days_deducted,
          expires_before,
          expires_after,
          reset_count_used
        )
        VALUES ($1, $2, 1, $3, $4, $5)
        RETURNING
          id,
          user_id,
          sub2api_subscription_id,
          reset_at,
          days_deducted,
          expires_before,
          expires_after,
          reset_count_used,
          created_at
      `,
      [
        params.userId,
        params.subscriptionId,
        params.expiresBefore,
        params.expiresAfter,
        params.resetCountUsed,
      ],
    );

    return result.rows[0];
  }
}
