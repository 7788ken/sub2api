import { SubscriptionExtensionRepository } from '../api/repositories/subscription-extension-repo';
import { ConsoleJobLogger } from './logging/job-logger';
import { Sub2ApiJobClient } from './clients/sub2api-job-client';
import { ResetCounterJobRepository } from './repositories/reset-counter-job-repo';
import { RolloverJobRepository } from './repositories/rollover-job-repo';
import { ResetCounterJobService } from './services/reset-counter-job-service';
import { RolloverJobService } from './services/rollover-job-service';
import type { DatabaseClient } from '../api/types/subscription-contract';
import type { JobLogger } from './types/job-contract';

type SchedulerOptions = {
  databaseClient: DatabaseClient;
  sub2ApiBaseUrl: string;
  sub2ApiAdminToken?: string;
  sub2ApiJobSubscriptionsPath?: string;
  logger?: JobLogger;
};

export async function registerBeehearsJobs(options: SchedulerOptions) {
  const cronModule = (await import('node-cron')) as {
    schedule: (
      expression: string,
      task: () => void | Promise<void>,
      options?: { timezone?: string },
    ) => unknown;
  };

  const logger = options.logger ?? new ConsoleJobLogger();
  const sub2apiJobClient = new Sub2ApiJobClient({
    baseUrl: options.sub2ApiBaseUrl,
    adminToken: options.sub2ApiAdminToken,
    subscriptionsPath: options.sub2ApiJobSubscriptionsPath,
  });

  const rolloverJobService = new RolloverJobService({
    databaseClient: options.databaseClient,
    logger,
    sub2apiJobClient,
    rolloverJobRepo: new RolloverJobRepository(),
    subscriptionExtensionRepo: new SubscriptionExtensionRepository(),
  });

  const resetCounterJobService = new ResetCounterJobService({
    databaseClient: options.databaseClient,
    logger,
    resetCounterJobRepo: new ResetCounterJobRepository(),
  });

  cronModule.schedule('0 0 0 * * *', async () => {
    try {
      await rolloverJobService.run(new Date());
    } catch (error) {
      logger.error('daily rollover scheduler task failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, { timezone: 'Asia/Shanghai' });

  cronModule.schedule('59 59 23 * * 6', async () => {
    try {
      await resetCounterJobService.runWeeklyReset(new Date());
    } catch (error) {
      logger.error('weekly reset scheduler task failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, { timezone: 'Asia/Shanghai' });

  cronModule.schedule('0 0 1 * * *', async () => {
    try {
      await resetCounterJobService.runThirtyDayWindowReset(new Date());
    } catch (error) {
      logger.error('thirty day window scheduler task failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, { timezone: 'Asia/Shanghai' });

  logger.info('beehears jobs registered', {
    timezone: 'Asia/Shanghai',
    jobs: ['daily-rollover', 'weekly-reset-counter', 'thirty-day-window-reset'],
  });

  return {
    rolloverJobService,
    resetCounterJobService,
  };
}
