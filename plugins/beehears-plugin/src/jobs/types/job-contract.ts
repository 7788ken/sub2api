import type {
  DatabaseClient,
  RawSub2ApiSubscription,
  RolloverHistoryRecord,
  SqlExecutor,
  Sub2ApiSubscription,
  SubscriptionExtensionRecord,
} from '../../api/types/subscription-contract';

export type JobLoggerFields = Record<string, unknown>;

export interface JobLogger {
  info(message: string, fields?: JobLoggerFields): void;
  warn(message: string, fields?: JobLoggerFields): void;
  error(message: string, fields?: JobLoggerFields): void;
}

export type JobRuntimeDependencies = {
  databaseClient: DatabaseClient;
  logger?: JobLogger;
};

export type EnabledRolloverSubscriptionRow = {
  user_id: number;
  sub2api_subscription_id: number;
};

export type InsertRolloverHistoryParams = {
  userId: number;
  subscriptionId: number;
  businessDate: string;
  quotaBefore: number;
  carryAmount: number;
  quotaAfter: number;
  bonusInjected: number;
};

export type UpdateDailyBonusParams = {
  subscriptionId: number;
  bonusUsd: number;
};

export type JobSummary = {
  jobName: string;
  startedAt: string;
  finishedAt: string;
  processedCount: number;
  successCount: number;
  skipCount: number;
  failureCount: number;
  blocked?: string;
};

export type ResetCounterSummary = JobSummary & {
  affectedRows: number;
};

export type RolloverJobSummary = JobSummary;

export type Sub2ApiJobClientOptions = {
  baseUrl: string;
  adminToken?: string;
  rolloverToken?: string;
  subscriptionsPath?: string;
  rolloverSnapshotPath?: string;
  fetchImpl?: typeof fetch;
};

export class JobBlockedError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'JobBlockedError';
    this.code = code;
  }
}

export type RawSub2ApiJobSubscription = RawSub2ApiSubscription;

export type RolloverJobServiceDependencies = {
  databaseClient: DatabaseClient;
  logger: JobLogger;
  sub2apiJobClient: {
    getServiceToken(): string;
    getRolloverSnapshotToken(): string;
    listSubscriptionsForJobs(serviceToken: string): Promise<Sub2ApiSubscription[]>;
    getUsageRolloverSnapshot(
      serviceToken: string,
      snapshotToken: string,
      businessDate: string,
      timezone: string,
      subscriptionIds: number[],
    ): Promise<Map<number, number>>;
  };
  rolloverJobRepo: {
    listEnabledSubscriptions(executor: SqlExecutor): Promise<EnabledRolloverSubscriptionRow[]>;
    existsRolloverForDate(
      executor: SqlExecutor,
      userId: number,
      subscriptionId: number,
      businessDate: string,
    ): Promise<boolean>;
    replaceBalanceCarry(
      executor: SqlExecutor,
      userId: number,
      subscriptionId: number,
      balanceCarry: number,
    ): Promise<SubscriptionExtensionRecord | null>;
    insertHistory(
      executor: SqlExecutor,
      params: InsertRolloverHistoryParams,
    ): Promise<RolloverHistoryRecord>;
    updateDailyBonusUsd(
      executor: SqlExecutor,
      params: UpdateDailyBonusParams,
    ): Promise<void>;
  };
  subscriptionExtensionRepo: {
    findOrCreateForUpdate(
      executor: SqlExecutor,
      userId: number,
      subscriptionId: number,
      now: Date,
    ): Promise<SubscriptionExtensionRecord>;
  };
};

export type ResetCounterJobServiceDependencies = {
  databaseClient: DatabaseClient;
  logger: JobLogger;
  resetCounterJobRepo: {
    resetWeeklyCounter(executor: SqlExecutor, now: Date): Promise<number>;
    resetThirtyDayWindow(executor: SqlExecutor, now: Date): Promise<number>;
  };
};
