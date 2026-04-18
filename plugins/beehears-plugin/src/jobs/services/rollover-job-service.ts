import { JobBlockedError, type RolloverJobServiceDependencies, type RolloverJobSummary } from '../types/job-contract';
import { PluginApiError } from '../../api/types/subscription-contract';

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
      const businessDate = formatBusinessDate(now);
      const enabledRows = await this.dependencies.rolloverJobRepo.listEnabledSubscriptions(
        this.dependencies.databaseClient,
      );
      if (enabledRows.length === 0) {
        return this.finish(summary);
      }

      const serviceToken = this.dependencies.sub2apiJobClient.getServiceToken();
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
            const nextCarry = Math.max(
              carryOpen + subscription.daily_quota - subscription.current_used,
              0,
            );
            const quotaAfter = subscription.daily_quota + nextCarry;

            await this.dependencies.rolloverJobRepo.replaceBalanceCarry(
              tx,
              row.user_id,
              row.sub2api_subscription_id,
              nextCarry,
            );

            await this.dependencies.rolloverJobRepo.insertHistory(tx, {
              userId: row.user_id,
              subscriptionId: row.sub2api_subscription_id,
              quotaBefore: nextCarry,
              carryAmount: nextCarry,
              quotaAfter,
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

function formatBusinessDate(date: Date) {
  const utc8 = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const year = utc8.getUTCFullYear();
  const month = String(utc8.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc8.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
