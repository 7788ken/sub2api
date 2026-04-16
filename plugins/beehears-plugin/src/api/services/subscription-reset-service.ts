import {
  PluginApiError,
  calculateResetQuota30d,
  calculateResetQuotaWeekly,
  hasResettableVirtualExpiry,
  normalizeResetState,
  startOfResetWeek,
  type DatabaseClient,
  type ResetQuotaSummary,
  type ResetSubscriptionResponse,
} from '../types/subscription-contract';
import type { ResetHistoryRepository } from '../repositories/reset-history-repo';
import type { SubscriptionExtensionRepository } from '../repositories/subscription-extension-repo';
import type { SubscriptionMergeService } from './subscription-merge-service';
import type { Sub2ApiSubscriptionClient } from './sub2api-subscription-client';

export class SubscriptionResetService {
  constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly mergeService: SubscriptionMergeService,
    private readonly sub2apiClient: Sub2ApiSubscriptionClient,
    private readonly extensionRepository: SubscriptionExtensionRepository,
    private readonly resetHistoryRepository: ResetHistoryRepository,
  ) {}

  async getResetQuotaSummary(
    userId: number,
    accessToken: string,
    subscriptionId: number,
  ): Promise<ResetQuotaSummary> {
    const now = new Date();
    const snapshot = await this.mergeService.getOwnedSubscription(userId, accessToken, subscriptionId);
    const normalized = normalizeResetState(snapshot.extension, now);
    const extraDaysDeducted = snapshot.extension.extra_days_deducted;
    const expiresAt = snapshot.base.expires_at;
    const hasEnoughExpiry = hasResettableVirtualExpiry(expiresAt, now);

    return {
      id: snapshot.base.id,
      reset_count_30d: normalized.reset_count_30d,
      reset_count_weekly: normalized.reset_count_weekly,
      reset_quota_30d: calculateResetQuota30d(normalized.reset_count_30d),
      reset_quota_weekly: calculateResetQuotaWeekly(normalized.reset_count_weekly),
      extra_days_deducted: extraDaysDeducted,
      virtual_expires_at: expiresAt,
      can_reset:
        normalized.reset_count_30d < 3 &&
        normalized.reset_count_weekly < 1 &&
        hasEnoughExpiry,
    };
  }

  async resetSubscription(
    userId: number,
    accessToken: string,
    subscriptionId: number,
  ): Promise<ResetSubscriptionResponse> {
    const snapshot = await this.mergeService.getOwnedSubscription(userId, accessToken, subscriptionId);
    const now = new Date();

    return this.databaseClient.transaction(async (tx) => {
      const lockedExtension = await this.extensionRepository.findOrCreateForUpdate(
        tx,
        userId,
        subscriptionId,
        now,
      );
      const normalized = normalizeResetState(lockedExtension, now);

      if (normalized.reset_count_30d >= 3 || normalized.reset_count_weekly >= 1) {
        throw new PluginApiError(409, 'RESET_NOT_ALLOWED', 'Reset quota exceeded');
      }

      if (!hasResettableVirtualExpiry(snapshot.base.expires_at, now)) {
        throw new PluginApiError(409, 'RESET_NOT_ALLOWED', 'Subscription expires too soon to reset');
      }

      await this.sub2apiClient.extendSubscription(subscriptionId, -1);

      try {
        await this.sub2apiClient.resetDailyQuota(subscriptionId);
      } catch (resetError) {
        try {
          await this.sub2apiClient.extendSubscription(subscriptionId, 1);
        } catch { /* best-effort compensation */ }
        throw resetError;
      }

      const nextResetCount30d = normalized.reset_count_30d + 1;
      const nextResetCountWeekly = normalized.reset_count_weekly + 1;
      const nextExtraDaysDeducted = lockedExtension.extra_days_deducted + 1;
      const nextResetWindowStart =
        normalized.reset_count_30d === 0 ? now.toISOString() : normalized.reset_window_start;
      const nextResetWeekStart =
        normalized.reset_count_weekly === 0
          ? startOfResetWeek(now).toISOString()
          : normalized.reset_week_start;

      await this.extensionRepository.updateAfterReset(tx, {
        userId,
        subscriptionId,
        balanceCarry: 0,
        resetCount30d: nextResetCount30d,
        resetWindowStart: nextResetWindowStart,
        resetCountWeekly: nextResetCountWeekly,
        resetWeekStart: nextResetWeekStart,
        extraDaysDeducted: nextExtraDaysDeducted,
      });

      const expiresAtAfterReset = new Date(
        new Date(snapshot.base.expires_at).getTime() - 24 * 60 * 60 * 1000,
      ).toISOString();

      await this.resetHistoryRepository.insert(tx, {
        userId,
        subscriptionId,
        expiresBefore: snapshot.base.expires_at,
        expiresAfter: expiresAtAfterReset,
        resetCountUsed: nextResetCount30d,
      });

      return {
        id: subscriptionId,
        balance_carry: 0,
        extra_days_deducted: nextExtraDaysDeducted,
        expires_at: expiresAtAfterReset,
        virtual_expires_at: expiresAtAfterReset,
        reset_quota_weekly: calculateResetQuotaWeekly(nextResetCountWeekly),
        reset_quota_30d: calculateResetQuota30d(nextResetCount30d),
      };
    });
  }
}
