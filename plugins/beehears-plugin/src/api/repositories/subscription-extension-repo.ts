import {
  createDefaultExtension,
  type SqlExecutor,
  type SubscriptionExtensionRecord,
} from '../types/subscription-contract';

export class SubscriptionExtensionRepository {
  async listByUserId(
    executor: SqlExecutor,
    userId: number,
    subscriptionIds: number[],
  ): Promise<SubscriptionExtensionRecord[]> {
    if (subscriptionIds.length === 0) {
      return [];
    }

    const result = await executor.query<SubscriptionExtensionRecord>(
      `
        SELECT
          id,
          user_id,
          sub2api_subscription_id,
          balance_carry,
          reset_count_30d,
          reset_window_start,
          reset_count_weekly,
          reset_week_start,
          extra_days_deducted,
          created_at,
          updated_at
        FROM plugin_beehears.subscription_extensions
        WHERE user_id = $1
          AND sub2api_subscription_id = ANY($2::bigint[])
      `,
      [userId, subscriptionIds],
    );

    return result.rows;
  }

  async findOrCreateForUpdate(
    executor: SqlExecutor,
    userId: number,
    subscriptionId: number,
    now: Date,
  ): Promise<SubscriptionExtensionRecord> {
    await executor.query(
      `
        INSERT INTO plugin_beehears.subscription_extensions (
          user_id,
          sub2api_subscription_id,
          reset_window_start,
          reset_week_start
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (sub2api_subscription_id) DO NOTHING
      `,
      [userId, subscriptionId, now.toISOString(), now.toISOString()],
    );

    const result = await executor.query<SubscriptionExtensionRecord>(
      `
        SELECT
          id,
          user_id,
          sub2api_subscription_id,
          balance_carry,
          reset_count_30d,
          reset_window_start,
          reset_count_weekly,
          reset_week_start,
          extra_days_deducted,
          created_at,
          updated_at
        FROM plugin_beehears.subscription_extensions
        WHERE user_id = $1
          AND sub2api_subscription_id = $2
        FOR UPDATE
      `,
      [userId, subscriptionId],
    );

    return result.rows[0] ?? createDefaultExtension(userId, subscriptionId, now);
  }

  async updateAfterReset(
    executor: SqlExecutor,
    params: {
      userId: number;
      subscriptionId: number;
      balanceCarry: number;
      resetCount30d: number;
      resetWindowStart: string;
      resetCountWeekly: number;
      resetWeekStart: string;
      extraDaysDeducted: number;
    },
  ): Promise<SubscriptionExtensionRecord> {
    const result = await executor.query<SubscriptionExtensionRecord>(
      `
        UPDATE plugin_beehears.subscription_extensions
        SET
          balance_carry = $3,
          reset_count_30d = $4,
          reset_window_start = $5,
          reset_count_weekly = $6,
          reset_week_start = $7,
          extra_days_deducted = $8,
          updated_at = NOW()
        WHERE user_id = $1
          AND sub2api_subscription_id = $2
        RETURNING
          id,
          user_id,
          sub2api_subscription_id,
          balance_carry,
          reset_count_30d,
          reset_window_start,
          reset_count_weekly,
          reset_week_start,
          extra_days_deducted,
          created_at,
          updated_at
      `,
      [
        params.userId,
        params.subscriptionId,
        params.balanceCarry,
        params.resetCount30d,
        params.resetWindowStart,
        params.resetCountWeekly,
        params.resetWeekStart,
        params.extraDaysDeducted,
      ],
    );

    return result.rows[0];
  }
}
