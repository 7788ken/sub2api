import type { PluginSessionService } from '../../backend/session/plugin-session-service';
import type { ResetHistoryRepository } from '../repositories/reset-history-repo';
import type { RolloverHistoryRepository } from '../repositories/rollover-history-repo';
import type { RolloverSettingsRepository } from '../repositories/rollover-settings-repo';
import type { DatabaseClient, RouteDefinition } from '../types/subscription-contract';
import type { SubscriptionMergeService } from '../services/subscription-merge-service';
import type { SubscriptionResetService } from '../services/subscription-reset-service';
import { SubscriptionHandler } from '../handlers/subscription-handler';

export type CreateSubscriptionRoutesDependencies = {
  databaseClient: DatabaseClient;
  sessionService: PluginSessionService;
  mergeService: SubscriptionMergeService;
  rolloverSettingsRepository: RolloverSettingsRepository;
  rolloverHistoryRepository: RolloverHistoryRepository;
  resetHistoryRepository: ResetHistoryRepository;
  resetService: SubscriptionResetService;
};

export function createSubscriptionRoutes(
  dependencies: CreateSubscriptionRoutesDependencies,
): RouteDefinition[] {
  const handler = new SubscriptionHandler(dependencies);

  return [
    {
      method: 'GET',
      path: '/api/subscriptions',
      handle: async (context) => handler.list(context),
    },
    {
      method: 'GET',
      path: '/api/subscriptions/:id',
      handle: async (context) => handler.getById(context),
    },
    {
      method: 'POST',
      path: '/api/subscriptions/:id/rollover/toggle',
      handle: async (context) => handler.toggleRollover(context),
    },
    {
      method: 'GET',
      path: '/api/subscriptions/:id/rollover/history',
      handle: async (context) => handler.getRolloverHistory(context),
    },
    {
      method: 'POST',
      path: '/api/subscriptions/:id/reset',
      handle: async (context) => handler.reset(context),
    },
    {
      method: 'GET',
      path: '/api/subscriptions/:id/reset/quota',
      handle: async (context) => handler.getResetQuota(context),
    },
  ];
}
