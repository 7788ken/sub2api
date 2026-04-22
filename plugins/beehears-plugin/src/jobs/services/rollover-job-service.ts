import { JobBlockedError, type RolloverJobServiceDependencies, type RolloverJobSummary } from '../types/job-contract';
import { PluginApiError } from '../../api/types/subscription-contract';

const ROLLOVER_TIMEZONE = 'Asia/Shanghai';
const ROLLOVER_SNAPSHOT_BATCH_SIZE = 200;

export class RolloverJobService {
  constructor(private readonly dependencies: RolloverJobServiceDependencies) {}

  async run(now: Date = new Date()): Promise<RolloverJobSummary> {
    const startedAt = new Date();
    const summary: RolloverJobSummary = {
      jobName: 'daily-rollover',
      startedAt: startedAt.toISOString(),
      finishedAt: startedAt.toISOString(),
      processedCount: 0,
      successCount: 0,
      skipCount: 0,
      failureCount: 0,
    };

    try {
      const businessDate = formatPreviousBusinessDate(now);
      const enabledRows = await this.dependencies.rolloverJobRepo.listEnabledSubscriptions(
        this.dependencies.databaseClient,
      );
      if (enabledRows.length === 0) {
        return this.finish(summary);
      }

      const serviceToken = this.dependencies.sub2apiJobClient.getServiceToken();
      const snapshotToken = this.dependencies.sub2apiJobClient.getRolloverSnapshotToken();
      let sub2apiSubscriptions;
      try {
        sub2apiSubscriptions =
          await this.dependencies.sub2apiJobClient.listSubscriptionsForJobs(serviceToken);
      } catch (error) {
        if (error instanceof JobBlockedError) {
          throw error;
        }

        summary.processedCount = enabledRows.length;
        summary.failureCount = enabledRows.length;
        this.dependencies.logger.error('daily rollover failed to load subscriptions for jobs', {
          candidateCount: enabledRows.length,
          error: toLoggableError(error),
        });
        return this.finish(summary);
      }

      const rolloverSnapshotMap = new Map<number, number>();
      const snapshotSubscriptionIds = Array.from(
        new Set(enabledRows.map((row) => row.sub2api_subscription_id)),
      );
      try {
        for (const subscriptionIds of chunkNumbers(snapshotSubscriptionIds, ROLLOVER_SNAPSHOT_BATCH_SIZE)) {
          const chunkSnapshot = await this.dependencies.sub2apiJobClient.getUsageRolloverSnapshot(
            serviceToken,
            snapshotToken,
            businessDate,
            ROLLOVER_TIMEZONE,
            subscriptionIds,
          );
          for (const [subscriptionId, actualCost] of chunkSnapshot.entries()) {
            rolloverSnapshotMap.set(subscriptionId, actualCost);
          }
        }
      } catch (error) {
        if (error instanceof JobBlockedError) {
          throw error;
        }

        summary.processedCount = enabledRows.length;
        summary.failureCount = enabledRows.length;
        this.dependencies.logger.error('daily rollover failed to load settled usage snapshot', {
          candidateCount: enabledRows.length,
          businessDate,
          timezone: ROLLOVER_TIMEZONE,
          error: toLoggableError(error),
        });
        return this.finish(summary);
      }

      const subMap = new Map(sub2apiSubscriptions.map((item) => [item.id, item]));

      for (const row of enabledRows) {
        summary.processedCount += 1;

        const subscription = subMap.get(row.sub2api_subscription_id);
        if (!subscription) {
          summary.skipCount += 1;
          this.dependencies.logger.warn('skip missing subscription in sub2api', row);
          continue;
        }

        try {
          await this.dependencies.databaseClient.transaction(async (tx) => {
            const alreadyRolled = await this.dependencies.rolloverJobRepo.existsRolloverForDate(
              tx,
              row.user_id,
              row.sub2api_subscription_id,
              businessDate,
            );
            if (alreadyRolled) {
              summary.skipCount += 1;
              return;
            }

            const extension = await this.dependencies.subscriptionExtensionRepo.findOrCreateForUpdate(
              tx,
              row.user_id,
              row.sub2api_subscription_id,
              now,
            );

            const carryOpen = extension.balance_carry;
            const yesterdayUsed = rolloverSnapshotMap.get(row.sub2api_subscription_id) ?? 0;
            // yesterdayUsed = 来自 usage_logs 稳定账本的昨日总消耗（含 carry + 日配额两部分）
            // carry-first 消费顺序：先扣 carry，再扣日配额
            // 场景1：yesterdayUsed <= carryOpen → carry 未耗尽，日配额未动，次日 carry = carry 剩余
            // 场景2：yesterdayUsed >  carryOpen → carry 耗尽，日配额被消耗，次日 carry = 日配额剩余
            const carryConsumed = Math.min(yesterdayUsed, carryOpen);
            const dailyConsumed = Math.max(yesterdayUsed - carryOpen, 0);
            const carryLeftover = carryOpen - carryConsumed;
            const dailyRolloverIn = yesterdayUsed <= carryOpen
              ? 0  // 日配额未被使用，本次没有新的日配额转入
              : Math.max(subscription.daily_quota - dailyConsumed, 0);
            const nextCarry = carryLeftover + dailyRolloverIn;
            const quotaAfter = subscription.daily_quota + nextCarry;
            // carryAmount：本次从日配额转入的新增量（carry 剩余继承不算新增）
            const carryAmount = dailyRolloverIn;

            await this.dependencies.rolloverJobRepo.replaceBalanceCarry(
              tx,
              row.user_id,
              row.sub2api_subscription_id,
              nextCarry,
            );

            // 直接更新 Sub2API 数据库 daily_bonus_usd（绕过 API，缓存 ~5min 后生效）
            await this.dependencies.rolloverJobRepo.updateDailyBonusUsd(tx, {
              subscriptionId: row.sub2api_subscription_id,
              bonusUsd: nextCarry,
            });

            await this.dependencies.rolloverJobRepo.insertHistory(tx, {
              userId: row.user_id,
              subscriptionId: row.sub2api_subscription_id,
              businessDate,
              quotaBefore: carryOpen,
              carryAmount,
              quotaAfter,
              bonusInjected: nextCarry,
            });

            summary.successCount += 1;
          });
        } catch (error) {
          summary.failureCount += 1;
          this.dependencies.logger.error('daily rollover failed for subscription', {
            userId: row.user_id,
            subscriptionId: row.sub2api_subscription_id,
            error: toLoggableError(error),
          });
        }
      }

      return this.finish(summary);
    } catch (error) {
      if (error instanceof JobBlockedError) {
        summary.blocked = error.code;
        this.dependencies.logger.warn('daily rollover blocked', {
          blocked: error.code,
          message: error.message,
        });
        return this.finish(summary);
      }

      throw error;
    }
  }

  private finish(summary: RolloverJobSummary) {
    const finishedAt = new Date().toISOString();
    const nextSummary = {
      ...summary,
      finishedAt,
    };
    this.dependencies.logger.info('daily rollover finished', nextSummary);
    return nextSummary;
  }
}

function formatPreviousBusinessDate(date: Date) {
  const utc8 = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  utc8.setUTCDate(utc8.getUTCDate() - 1);
  const year = utc8.getUTCFullYear();
  const month = String(utc8.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc8.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function chunkNumbers(values: number[], size: number) {
  if (size <= 0) {
    return [values];
  }

  const chunks: number[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function toLoggableError(error: unknown) {
  if (error instanceof PluginApiError) {
    return {
      name: error.name,
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return String(error);
}
