import { Alert, App as AntdApp, Spin } from 'antd';
import { usePlugin } from './i18n/context';
import { SelfServiceShell } from './components/layout/SelfServiceShell';
import { SubscriptionGrid } from './components/subscriptions/SubscriptionGrid';
import { BetaGate } from './components/BetaGate';
import { useSubscriptions, useAdminStats } from './hooks/useSubscriptions';

export default function App() {
  const { t } = usePlugin();
  const subscriptionsQuery = useSubscriptions();
  const adminStatsQuery = useAdminStats();

  return (
    <AntdApp>
      <BetaGate>
        <SelfServiceShell
          subscriptions={subscriptionsQuery.data}
          loading={subscriptionsQuery.isLoading}
          adminStats={adminStatsQuery.data ?? null}
        >
          {subscriptionsQuery.isLoading ? (
            <div className="ssc-state">
              <Spin size="large" />
            </div>
          ) : subscriptionsQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message={t.error_title}
              description={t.error_desc}
            />
          ) : (
            <SubscriptionGrid subscriptions={subscriptionsQuery.data ?? []} />
          )}
        </SelfServiceShell>
      </BetaGate>
    </AntdApp>
  );
}
