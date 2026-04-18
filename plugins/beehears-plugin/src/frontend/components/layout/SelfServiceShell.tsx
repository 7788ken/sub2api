import type React from 'react';
import { useMemo, type PropsWithChildren } from 'react';
import { Skeleton } from 'antd';
import { usePlugin } from '../../i18n/context';
import type { SubscriptionSummary } from '../../types/subscriptions';
import { PlanIcon } from '../../utils/plan-icons';

type ShellProps = PropsWithChildren<{
  subscriptions?: SubscriptionSummary[];
  loading?: boolean;
  adminStats?: { totalSubscriptions: number; validSubscriptions: number } | null;
}>;

type QuotaGroup = {
  category: string;
  iconKey: string;
  totalAvailable: number;
  totalQuota: number;
};

function AdminStatsIcon() {
  return (
    <span className="ssc-admin-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3l7 4v5c0 4.2-2.6 7.9-7 9-4.4-1.1-7-4.8-7-9V7l7-4Z" />
        <path d="M9.5 12.5l1.7 1.7 3.3-4.2" />
      </svg>
    </span>
  );
}

export function SelfServiceShell({ subscriptions, loading, adminStats, children }: ShellProps) {
  const { t } = usePlugin();
  const quotaGroups = useMemo(() => {
    const totals = new Map<string, { available: number; quota: number }>();
    for (const sub of subscriptions ?? []) {
      if (!['Claude', 'OpenAI', 'Gemini'].includes(sub.category)) continue;
      const existing = totals.get(sub.category);
      const subQuota = sub.daily_quota + sub.carry_open;
      if (existing) {
        existing.available += sub.available_quota;
        existing.quota += subQuota;
      } else {
        totals.set(sub.category, { available: sub.available_quota, quota: subQuota });
      }
    }

    return [
      { category: 'Claude', iconKey: 'claude' },
      { category: 'OpenAI', iconKey: 'openai' },
      { category: 'Gemini', iconKey: 'gemini' },
    ].map(({ category, iconKey }): QuotaGroup => {
      const data = totals.get(category);
      return {
        category,
        iconKey,
        totalAvailable: data?.available ?? 0,
        totalQuota: data?.quota ?? 0,
      };
    });
  }, [subscriptions]);

  const colCount = 3 + (adminStats ? 1 : 0);

  return (
    <main className="ssc-shell">
      <div className="ssc-header">
        <div className="ssc-header-content">
          <h1>{t.shell_title}</h1>
          <p>{t.shell_subtitle}</p>
        </div>
        <div className="ssc-header-actions">
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--ssc-accent)' }}>
            {t.shell_kicker}
          </span>
        </div>
      </div>

      <div className="ssc-metrics-bar" style={!loading && colCount ? { '--ssc-metrics-cols': Math.min(colCount, 4) } as React.CSSProperties : undefined}>
        {loading ? (
          <>
            {Array.from({ length: colCount || 3 }, (_, i) => (
              <div key={i} className="ssc-metric-card">
                <Skeleton active paragraph={false} title={{ width: '60%' }} />
              </div>
            ))}
          </>
        ) : (
          <>
            {quotaGroups.map((group) => (
              <div key={group.category} className="ssc-quota-type-card">
                <PlanIcon planName={group.iconKey} size={28} />
                <div className="ssc-quota-type-info">
                  <span className="ssc-quota-type-name">{group.category}</span>
                  <span className="ssc-quota-type-value">
                    {group.totalAvailable}
                    <span className="ssc-quota-type-total"> / {group.totalQuota}</span>
                  </span>
                </div>
              </div>
            ))}
            {adminStats && (
              <div className="ssc-quota-type-card">
                <AdminStatsIcon />
                <div className="ssc-quota-type-info">
                  <span className="ssc-quota-type-name">
                    {t.dashboard_valid_site_subs}
                    <span className="ssc-admin-badge">Admin</span>
                  </span>
                  <span className="ssc-quota-type-value">
                  {adminStats.validSubscriptions}
                    <span className="ssc-quota-type-total"> / {adminStats.totalSubscriptions}</span>
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <section>{children}</section>
    </main>
  );
}
