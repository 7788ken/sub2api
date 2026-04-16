import { useMemo, type PropsWithChildren } from 'react';
import { Skeleton } from 'antd';
import { usePlugin } from '../../i18n/context';
import type { SubscriptionSummary } from '../../types/subscriptions';

type ShellProps = PropsWithChildren<{
  subscriptions?: SubscriptionSummary[];
  loading?: boolean;
}>;

export function SelfServiceShell({ subscriptions, loading, children }: ShellProps) {
  const { t } = usePlugin();

  const metrics = useMemo(() => {
    const subs = subscriptions ?? [];
    const total = subs.length;
    const totalAvailable = subs.reduce((s, v) => s + v.available_quota, 0);
    const activeRollovers = subs.filter((v) => v.rollover_enabled).length;
    const avgUsage =
      total === 0
        ? 0
        : subs.reduce((s, v) => {
            const cap = Math.max(v.daily_quota + v.balance_carry, 1);
            return s + (v.current_used / cap) * 100;
          }, 0) / total;
    return { total, totalAvailable, activeRollovers, avgUsage: Math.round(avgUsage) };
  }, [subscriptions]);

  return (
    <main className="ssc-shell">
      <div className="ssc-dashboard-header">
        <p className="ssc-kicker">{t.shell_kicker}</p>
        <h1>{t.shell_title}</h1>
      </div>

      <div className="ssc-metrics-bar">
        {loading ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="ssc-metric-card">
                <Skeleton active paragraph={false} title={{ width: '60%' }} />
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="ssc-metric-card">
              <span className="ssc-metric-label">{t.dashboard_total_subs}</span>
              <span className="ssc-metric-value">{metrics.total}</span>
            </div>
            <div className="ssc-metric-card">
              <span className="ssc-metric-label">{t.dashboard_total_available}</span>
              <span className="ssc-metric-value">{metrics.totalAvailable}</span>
            </div>
            <div className="ssc-metric-card">
              <span className="ssc-metric-label">{t.dashboard_active_rollovers}</span>
              <span className="ssc-metric-value ssc-metric-value--accent">{metrics.activeRollovers}</span>
            </div>
            <div className="ssc-metric-card">
              <span className="ssc-metric-label">{t.dashboard_avg_usage}</span>
              <span className="ssc-metric-value">{metrics.avgUsage}%</span>
            </div>
          </>
        )}
      </div>

      <section>{children}</section>
    </main>
  );
}
