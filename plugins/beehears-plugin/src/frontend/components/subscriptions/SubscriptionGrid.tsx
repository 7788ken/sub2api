import { Empty } from 'antd';
import { usePlugin } from '../../i18n/context';
import type { SubscriptionSummary } from '../../types/subscriptions';
import { SubscriptionCard } from './SubscriptionCard';

type SubscriptionGridProps = {
  subscriptions: SubscriptionSummary[];
};

export function SubscriptionGrid({ subscriptions }: SubscriptionGridProps) {
  const { t } = usePlugin();

  if (subscriptions.length === 0) {
    return (
      <div className="ssc-state">
        <Empty description={t.empty} />
      </div>
    );
  }

  return (
    <section className="ssc-grid">
      {subscriptions.map((subscription, index) => (
        <SubscriptionCard
          key={subscription.id}
          subscription={subscription}
          animationDelay={index * 100}
        />
      ))}
    </section>
  );
}
