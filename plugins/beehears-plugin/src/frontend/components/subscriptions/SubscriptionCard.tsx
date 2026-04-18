import type React from 'react';
import { App, Button, Card, Space, Switch, Tag } from 'antd';
import { useState } from 'react';
import { usePlugin } from '../../i18n/context';
import { useResetSubscription, useToggleRollover } from '../../hooks/useSubscriptions';
import type { SubscriptionSummary } from '../../types/subscriptions';
import { ResetConfirmModal } from './ResetConfirmModal';
import { RolloverHistoryModal } from './RolloverHistoryModal';
import { UsageProgress, getUsageStateRawColor } from './UsageProgress';
import { PlanIcon } from '../../utils/plan-icons';

function formatDateLocal(value?: string) {
  if (!value) return '--';
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type SubscriptionCardProps = {
  subscription: SubscriptionSummary;
  animationDelay?: number;
};

export function SubscriptionCard({ subscription, animationDelay = 0 }: SubscriptionCardProps) {
  const { t } = usePlugin();
  const { message } = App.useApp();
  const toggleMutation = useToggleRollover();
  const resetMutation = useResetSubscription();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const totalQuota = subscription.daily_quota + subscription.carry_open;
  const statusRaw = getUsageStateRawColor(subscription.current_used);

  const badgeText = `${t.card_badge_week} ${subscription.reset_quota_weekly} / ${t.card_badge_30d} ${subscription.reset_quota_30d}`;

  const handleToggle = async (checked: boolean) => {
    try {
      await toggleMutation.mutateAsync({ id: subscription.id, enabled: checked });
      message.success(checked ? t.msg_rollover_on : t.msg_rollover_off);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t.msg_rollover_fail);
    }
  };

  const handleReset = async () => {
    try {
      await resetMutation.mutateAsync(subscription.id);
      message.success(t.msg_reset_ok);
      setResetOpen(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t.msg_reset_fail);
    }
  };

  return (
    <>
      <Card
        className="ssc-card ssc-card-animated"
        variant="borderless"
        style={{
          '--ssc-card-status-color': statusRaw,
          animationDelay: `${animationDelay}ms`,
        } as React.CSSProperties}
      >
        <div className="ssc-card-head">
          <div className="ssc-card-head-left">
            <PlanIcon planName={subscription.category} size={22} />
            <h3>{subscription.plan_name}</h3>
            {subscription.category !== 'Other' && (
              <Tag style={{ margin: 0, fontSize: 11, borderRadius: 20 }} color="processing">
                {subscription.category}
              </Tag>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--ssc-text-muted)' }}>#{subscription.id}</span>
        </div>

        <div className="ssc-card-main">
          <UsageProgress currentUsed={subscription.current_used} totalQuota={totalQuota} size={88} />
          <div className="ssc-card-data">
            <div className="ssc-card-available-row">
              <strong className="ssc-available-value">{subscription.available_quota}</strong>
              <span className="ssc-available-label-inline">{t.card_label_available}</span>
            </div>
            <div className="ssc-card-stats-row">
              <div className="ssc-card-stat-item">
                <span className="ssc-label">{t.card_label_daily_quota}</span>
                <strong>{subscription.daily_quota}</strong>
              </div>
              <div className="ssc-card-stat-divider" />
              <div className="ssc-card-stat-item">
                <span className="ssc-label">{t.card_label_carry}</span>
                <strong>{subscription.balance_carry}</strong>
              </div>
              <div className="ssc-card-stat-divider" />
              <div className="ssc-card-stat-item">
                <span className="ssc-label">{t.card_label_virtual_expires}</span>
                <strong>{formatDateLocal(subscription.virtual_expires_at)}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="ssc-card-footer">
          <div className="ssc-card-footer-left">
            <div className="ssc-toggle-inline">
              <span className="ssc-label">{t.card_label_rollover}</span>
              <Switch
                size="small"
                checked={subscription.rollover_enabled}
                loading={toggleMutation.isPending}
                onChange={handleToggle}
              />
            </div>
            <Button size="small" type="text" onClick={() => setHistoryOpen(true)}>
              {t.card_btn_detail}
            </Button>
          </div>
          <Space size={8}>
            <Tag style={{ fontSize: 11, borderRadius: 20 }}>{badgeText}</Tag>
            <Button
              size="small"
              type="default"
              onClick={() => setResetOpen(true)}
              style={{ borderColor: 'var(--ssc-status-warning)', color: 'var(--ssc-status-warning)' }}
            >
              {t.card_btn_reset}
            </Button>
          </Space>
        </div>
      </Card>

      <RolloverHistoryModal
        open={historyOpen}
        subscriptionId={subscription.id}
        planName={subscription.plan_name}
        onClose={() => setHistoryOpen(false)}
      />

      <ResetConfirmModal
        open={resetOpen}
        subscription={subscription}
        confirmLoading={resetMutation.isPending}
        onCancel={() => setResetOpen(false)}
        onConfirm={handleReset}
      />
    </>
  );
}
