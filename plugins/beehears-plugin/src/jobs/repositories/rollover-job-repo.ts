import type {
  EnabledRolloverSubscriptionRow,
  InsertRolloverHistoryParams,
} from '../types/job-contract';
import type {
  RolloverHistoryRecord,
  SqlExecutor,
  SubscriptionExtensionRecord,
} from '../../api/types/subscription-contract';

export class RolloverJobRepository {
  async listEnabledSubscriptions(
    executor: SqlExecutor,
  ): Promise<EnabledRolloverSubscriptionRow[]> {
    const result = await executor.query<EnabledRolloverSubscriptionRow>(
      `
        SELECT
          user_id,
          sub2api_subscription_id
        FROM plugin_beehears.rollover_settings
        WHERE enabled = TRUE
        ORDER BY user_id ASC, sub2api_subscription_id ASC
      `,
    );

    return result.rows;
  }

  async existsRolloverForDate(
    executor: SqlExecutor,
    userId: number,
    subscriptionId: number,
    businessDate: string,
  ): Promise<boolean> {
    const result = await executor.query<{ id: number }>(
      `
        SELECT id
        FROM plugin_beehears.rollover_history
        WHERE user_id = $1
          AND sub2api_subscription_id = $2
          AND ((rolled_at AT TIME ZONE 'Asia/Shanghai')::date = $3::date)
        LIMIT 1
      `,
      [userId, subscriptionId, businessDate],
    );

    return result.rowCount > 0;
  }

  async incrementBalanceCarry(
    executor: SqlExecutor,
    userId: number,
    subscriptionId: number,
    carryAmount: number,
  ): Promise<SubscriptionExtensionRecord | null> {
    const result = await executor.query<SubscriptionExtensionRecord>(
      `
        UPDATE plugin_beehears.subscription_extensions
        SET
          balance_carry = balance_carry + $3,
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
      [userId, subscriptionId, carryAmount],
    );

    return result.rows[0] ?? null;
  }

  async insertHistory(
    executor: SqlExecutor,
    params: InsertRolloverHistoryParams,
  ): Promise<RolloverHistoryRecord> {
    const result = await executor.query<RolloverHistoryRecord>(
      `
        INSERT INTO plugin_beehears.rollover_history (
          user_id,
          sub2api_subscription_id,
          quota_before,
          carry_amount,
          quota_after
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          rolled_at,
          quota_before,
          carry_amount,
          quota_after
      `,
      [
        params.userId,
        params.subscriptionId,
        params.quotaBefore,
        params.carryAmount,
        params.quotaAfter,
      ],
    );

    return result.rows[0];
  }
}
