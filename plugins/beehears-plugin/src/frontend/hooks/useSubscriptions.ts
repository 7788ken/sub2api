import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getResetQuota,
  getRolloverHistory,
  getSubscription,
  getSubscriptions,
  resetSubscription,
  toggleRollover,
} from '../api/subscriptions';

export function useSubscriptions() {
  return useQuery({
    queryKey: ['subscriptions'],
    queryFn: getSubscriptions,
  });
}

export function useSubscription(id?: number) {
  return useQuery({
    queryKey: ['subscriptions', id],
    queryFn: () => getSubscription(id as number),
    enabled: Boolean(id),
  });
}

export function useRolloverHistory(id?: number, limit = 10, enabled = false) {
  return useQuery({
    queryKey: ['subscriptions', id, 'rollover-history', limit],
    queryFn: () => getRolloverHistory(id as number, limit),
    enabled: Boolean(id) && enabled,
  });
}

export function useResetQuota(id?: number, enabled = false) {
  return useQuery({
    queryKey: ['subscriptions', id, 'reset-quota'],
    queryFn: () => getResetQuota(id as number),
    enabled: Boolean(id) && enabled,
  });
}

export function useToggleRollover() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      toggleRollover(id, { enabled }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      void queryClient.invalidateQueries({ queryKey: ['subscriptions', variables.id] });
    },
  });
}

export function useResetSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => resetSubscription(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      void queryClient.invalidateQueries({ queryKey: ['subscriptions', id] });
      void queryClient.invalidateQueries({ queryKey: ['subscriptions', id, 'reset-quota'] });
    },
  });
}
