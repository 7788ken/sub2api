import type { JobLogger, JobLoggerFields } from '../types/job-contract';

export class ConsoleJobLogger implements JobLogger {
  info(message: string, fields: JobLoggerFields = {}) {
    console.info(`[beehears-jobs] ${message}`, fields);
  }

  warn(message: string, fields: JobLoggerFields = {}) {
    console.warn(`[beehears-jobs] ${message}`, fields);
  }

  error(message: string, fields: JobLoggerFields = {}) {
    console.error(`[beehears-jobs] ${message}`, fields);
  }
}
