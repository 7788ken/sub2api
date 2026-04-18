import {
  PluginApiError,
  calculateCarryFirstQuota,
  calculateResetQuota30d,
  calculateResetQuotaWeekly,
  classifyPlanCategory,
  createDefaultExtension,
  normalizeResetState,
  type OwnedSubscriptionSnapshot,
  type SubscriptionExtensionRecord,
  type SubscriptionSummary,
} from '../types/subscription-contract';
import type { SubscriptionExtensionRepository } from '../repositories/subscription-extension-repo';
import type { RolloverSettingsRepository } from '../repositories/rollover-settings-repo';
import type { DatabaseClient, RolloverSettingRecord, Sub2ApiSubscription } from '../types/subscription-contract';
import type { Sub2ApiSubscriptionClient } from './sub2api-subscription-client';

export class SubscriptionMergeService {
  constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly sub2apiClient: Sub2ApiSubscriptionClient,
    private readonly extensionRepository: SubscriptionExtensionRepository,
    private readonly rolloverSettingsRepository: RolloverSettingsRepository,
  ) {}

  async listOwnedSubscriptions(userId: number, accessToken: string): Promise<OwnedSubscriptionSnapshot[]> {
    const subscriptions = await this.sub2apiClient.listUserSubscriptions(accessToken);
    const subscriptionIds = subscriptions.map((subscription) => subscription.id);

    const [extensions, rolloverSettings] = await Promise.all([
      this.extensionRepository.listByUserId(this.databaseClient, userId, subscriptionIds),
      this.rolloverSettingsRepository.listByUserId(this.databaseClient, userId, subscriptionIds),
    ]);

    const extensionMap = new Map<number, SubscriptionExtensionRecord>(
      extensions.map((record) => [record.sub2api_subscription_id, record]),
    );
    const settingMap = new Map<number, RolloverSettingRecord>(
      rolloverSettings.map((record) => [record.sub2api_subscription_id, record]),
    );

    return subscriptions.map((subscription) => {
      const now = new Date();
      const rawExtension =
        extensionMap.get(subscription.id) ?? createDefaultExtension(userId, subscription.id, now);
      const normalized = normalizeResetState(rawExtension, now);
      const extension: SubscriptionExtensionRecord = {
        ...rawExtension,
        ...normalized,
      };
      const rolloverSetting = settingMap.get(subscription.id) ?? null;

      return {
        base: subscription,
        extension,
        rolloverSetting,
        summary: buildSubscriptionSummary(subscription, extension, rolloverSetting),
      };
    });
  }

  async getOwnedSubscription(
    userId: number,
    accessToken: string,
    subscriptionId: number,
  ): Promise<OwnedSubscriptionSnapshot> {
    const subscriptions = await this.listOwnedSubscriptions(userId, accessToken);
    const subscription = subscriptions.find((item) => item.base.id === subscriptionId);

    if (!subscription) {
      throw new PluginApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
    }

    return subscription;
  }
}

export function buildSubscriptionSummary(
  subscription: Sub2ApiSubscription,
  extension: SubscriptionExtensionRecord,
  rolloverSetting: RolloverSettingRecord | null,
): SubscriptionSummary {
  const resetQuota30d = calculateResetQuota30d(extension.reset_count_30d);
  const resetQuotaWeekly = calculateResetQuotaWeekly(extension.reset_count_weekly);
  const quotaBreakdown = calculateCarryFirstQuota(
    subscription.daily_quota,
    extension.balance_carry,
    subscription.current_used,
  );

  return {
    id: subscription.id,
    plan_name: subscription.plan_name,
    category: classifyPlanCategory(subscription.plan_name, subscription.platform),
    daily_quota: subscription.daily_quota,
    current_used: subscription.current_used,
    carry_open: quotaBreakdown.carry_open,
    balance_carry: quotaBreakdown.carry_remaining,
    available_quota: quotaBreakdown.available_total,
    expires_at: subscription.expires_at,
    virtual_expires_at: subscription.expires_at,
    rollover_enabled: rolloverSetting?.enabled ?? false,
    reset_quota_weekly: resetQuotaWeekly,
    reset_quota_30d: resetQuota30d,
    extra_days_deducted: extension.extra_days_deducted,
  };
}
