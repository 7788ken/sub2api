import type { RolloverSettingRecord, SqlExecutor } from '../types/subscription-contract';

export class RolloverSettingsRepository {
  async listByUserId(
    executor: SqlExecutor,
    userId: number,
    subscriptionIds: number[],
  ): Promise<RolloverSettingRecord[]> {
    if (subscriptionIds.length === 0) {
      return [];
    }

    const result = await executor.query<RolloverSettingRecord>(
      `
        SELECT
          id,
          user_id,
          sub2api_subscription_id,
          enabled,
          created_at,
          updated_at
        FROM plugin_beehears.rollover_settings
        WHERE user_id = $1
          AND sub2api_subscription_id = ANY($2::bigint[])
      `,
      [userId, subscriptionIds],
    );

    return result.rows;
  }

  async upsert(
    executor: SqlExecutor,
    userId: number,
    subscriptionId: number,
    enabled: boolean,
  ): Promise<RolloverSettingRecord> {
    const result = await executor.query<RolloverSettingRecord>(
      `
        INSERT INTO plugin_beehears.rollover_settings (
          user_id,
          sub2api_subscription_id,
          enabled
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (sub2api_subscription_id)
        DO UPDATE SET
          enabled = EXCLUDED.enabled,
          updated_at = NOW()
        RETURNING
          id,
          user_id,
          sub2api_subscription_id,
          enabled,
          created_at,
          updated_at
      `,
      [userId, subscriptionId, enabled],
    );

    return result.rows[0];
  }
}
