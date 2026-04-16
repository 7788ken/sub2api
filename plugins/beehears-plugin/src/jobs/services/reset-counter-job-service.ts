import type {
  ResetCounterJobServiceDependencies,
  ResetCounterSummary,
} from '../types/job-contract';

export class ResetCounterJobService {
  constructor(private readonly dependencies: ResetCounterJobServiceDependencies) {}

  async runWeeklyReset(now: Date = new Date()): Promise<ResetCounterSummary> {
    const startedAt = new Date();
    const affectedRows = await this.dependencies.resetCounterJobRepo.resetWeeklyCounter(
      this.dependencies.databaseClient,
      now,
    );

    const summary: ResetCounterSummary = {
      jobName: 'weekly-reset-counter',
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      processedCount: affectedRows,
      successCount: affectedRows,
      skipCount: 0,
      failureCount: 0,
      affectedRows,
    };

    this.dependencies.logger.info('weekly reset counter finished', summary);
    return summary;
  }

  async runThirtyDayWindowReset(now: Date = new Date()): Promise<ResetCounterSummary> {
    const startedAt = new Date();
    const affectedRows = await this.dependencies.resetCounterJobRepo.resetThirtyDayWindow(
      this.dependencies.databaseClient,
      now,
    );

    const summary: ResetCounterSummary = {
      jobName: 'thirty-day-window-reset',
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      processedCount: affectedRows,
      successCount: affectedRows,
      skipCount: 0,
      failureCount: 0,
      affectedRows,
    };

    this.dependencies.logger.info('thirty day window reset finished', summary);
    return summary;
  }
}
