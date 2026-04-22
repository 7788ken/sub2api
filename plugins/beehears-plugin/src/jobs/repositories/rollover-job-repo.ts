import type {
  EnabledRolloverSubscriptionRow,
  InsertRolloverHistoryParams,
  UpdateDailyBonusParams,
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
          AND business_date = $3::date
        LIMIT 1
      `,
      [userId, subscriptionId, businessDate],
    );

    return result.rowCount > 0;
  }

  async replaceBalanceCarry(
    executor: SqlExecutor,
    userId: number,
    subscriptionId: number,
    balanceCarry: number,
  ): Promise<SubscriptionExtensionRecord | null> {
    const result = await executor.query<SubscriptionExtensionRecord>(
      `
        UPDATE plugin_beehears.subscription_extensions
        SET
          balance_carry = $3,
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
      [userId, subscriptionId, balanceCarry],
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
          business_date,
          quota_before,
          carry_amount,
          quota_after,
          bonus_injected
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          rolled_at,
          quota_before,
          carry_amount,
          quota_after,
          bonus_injected
      `,
      [
        params.userId,
        params.subscriptionId,
        params.businessDate,
        params.quotaBefore,
        params.carryAmount,
        params.quotaAfter,
        params.bonusInjected,
      ],
    );

    return result.rows[0];
  }

  /**
   * 直接更新 Sub2API user_subscriptions 表的 daily_bonus_usd 字段。
   * 绕过 Admin API，缓存 TTL (~5min) 后自动生效。
   */
  async updateDailyBonusUsd(
    executor: SqlExecutor,
    params: UpdateDailyBonusParams,
  ): Promise<void> {
    await executor.query(
      `
        UPDATE user_subscriptions
        SET daily_bonus_usd = $2,
            updated_at = NOW()
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [params.subscriptionId, params.bonusUsd],
    );
  }
}
