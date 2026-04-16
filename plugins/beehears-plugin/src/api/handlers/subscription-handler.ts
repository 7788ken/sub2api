import { PluginSessionService } from '../../backend/session/plugin-session-service';
import {
  buildErrorResult,
  buildSuccessResult,
  parseHistoryLimit,
  parseToggleRequest,
  requirePositiveInteger,
  type ApiHandlerResult,
  type ApiRequestContext,
  type ResetQuotaSummary,
  type ResetSubscriptionResponse,
  type RolloverHistoryRecord,
  type SubscriptionSummary,
  type ToggleRolloverResponse,
} from '../types/subscription-contract';
import type { RolloverHistoryRepository } from '../repositories/rollover-history-repo';
import type { RolloverSettingsRepository } from '../repositories/rollover-settings-repo';
import type { DatabaseClient } from '../types/subscription-contract';
import type { SubscriptionMergeService } from '../services/subscription-merge-service';
import type { SubscriptionResetService } from '../services/subscription-reset-service';

export type SubscriptionHandlerDependencies = {
  databaseClient: DatabaseClient;
  sessionService: PluginSessionService;
  mergeService: SubscriptionMergeService;
  rolloverSettingsRepository: RolloverSettingsRepository;
  rolloverHistoryRepository: RolloverHistoryRepository;
  resetService: SubscriptionResetService;
};

export class SubscriptionHandler {
  constructor(private readonly dependencies: SubscriptionHandlerDependencies) {}

  async list(context: ApiRequestContext): Promise<ApiHandlerResult<SubscriptionSummary[] | null>> {
    try {
      const session = await this.dependencies.sessionService.requireSession(context);
      const subscriptions = await this.dependencies.mergeService.listOwnedSubscriptions(
        session.session.userId,
        session.session.sub2apiToken,
      );

      return buildSuccessResult(
        subscriptions.map((item) => item.summary),
        200,
        session.responseHeaders,
      );
    } catch (error) {
      console.error('[plugin] list subscriptions failed:', error);
      return buildErrorResult(error, 502, 'SUBSCRIPTION_LIST_FAILED', 'Failed to load subscriptions');
    }
  }

  async getById(context: ApiRequestContext): Promise<ApiHandlerResult<SubscriptionSummary | null>> {
    try {
      const session = await this.dependencies.sessionService.requireSession(context);
      const subscriptionId = requirePositiveInteger(context.params.id, 'subscription id');
      const subscription = await this.dependencies.mergeService.getOwnedSubscription(
        session.session.userId,
        session.session.sub2apiToken,
        subscriptionId,
      );

      return buildSuccessResult(subscription.summary, 200, session.responseHeaders);
    } catch (error) {
      return buildErrorResult(error, 502, 'UPSTREAM_ERROR', 'Failed to load subscription');
    }
  }

  async toggleRollover(
    context: ApiRequestContext,
  ): Promise<ApiHandlerResult<ToggleRolloverResponse | null>> {
    try {
      const session = await this.dependencies.sessionService.requireSession(context);
      const subscriptionId = requirePositiveInteger(context.params.id, 'subscription id');
      const request = parseToggleRequest(context.body);

      await this.dependencies.mergeService.getOwnedSubscription(
        session.session.userId,
        session.session.sub2apiToken,
        subscriptionId,
      );

      const updated = await this.dependencies.rolloverSettingsRepository.upsert(
        this.dependencies.databaseClient,
        session.session.userId,
        subscriptionId,
        request.enabled,
      );

      return buildSuccessResult(
        {
          id: subscriptionId,
          rollover_enabled: updated.enabled,
          updated_at: updated.updated_at,
        },
        200,
        session.responseHeaders,
      );
    } catch (error) {
      console.error('[plugin] rollover toggle error detail:', error);
      return buildErrorResult(
        error,
        502,
        'ROLLOVER_TOGGLE_FAILED',
        'Failed to update rollover setting',
      );
    }
  }

  async getRolloverHistory(
    context: ApiRequestContext,
  ): Promise<ApiHandlerResult<RolloverHistoryRecord[] | null>> {
    try {
      const session = await this.dependencies.sessionService.requireSession(context);
      const subscriptionId = requirePositiveInteger(context.params.id, 'subscription id');
      const limit = parseHistoryLimit(context.query.get('limit'));

      await this.dependencies.mergeService.getOwnedSubscription(
        session.session.userId,
        session.session.sub2apiToken,
        subscriptionId,
      );

      const history = await this.dependencies.rolloverHistoryRepository.listRecent(
        this.dependencies.databaseClient,
        session.session.userId,
        subscriptionId,
        limit,
      );

      return buildSuccessResult(history, 200, session.responseHeaders);
    } catch (error) {
      return buildErrorResult(
        error,
        502,
        'ROLLOVER_HISTORY_FAILED',
        'Failed to load rollover history',
      );
    }
  }

  async reset(
    context: ApiRequestContext,
  ): Promise<ApiHandlerResult<ResetSubscriptionResponse | null>> {
    try {
      const session = await this.dependencies.sessionService.requireSession(context);
      const subscriptionId = requirePositiveInteger(context.params.id, 'subscription id');
      const result = await this.dependencies.resetService.resetSubscription(
        session.session.userId,
        session.session.sub2apiToken,
        subscriptionId,
      );

      return buildSuccessResult(result, 200, session.responseHeaders);
    } catch (error) {
      console.error('[plugin] reset error detail:', error);
      return buildErrorResult(error, 502, 'RESET_UPSTREAM_FAILED', 'Failed to reset subscription');
    }
  }

  async getResetQuota(
    context: ApiRequestContext,
  ): Promise<ApiHandlerResult<ResetQuotaSummary | null>> {
    try {
      const session = await this.dependencies.sessionService.requireSession(context);
      const subscriptionId = requirePositiveInteger(context.params.id, 'subscription id');
      const result = await this.dependencies.resetService.getResetQuotaSummary(
        session.session.userId,
        session.session.sub2apiToken,
        subscriptionId,
      );

      return buildSuccessResult(result, 200, session.responseHeaders);
    } catch (error) {
      return buildErrorResult(
        error,
        502,
        'RESET_QUOTA_LOOKUP_FAILED',
        'Failed to load reset quota',
      );
    }
  }
}
