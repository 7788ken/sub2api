import { App, Button, Card, Space, Switch, Tag } from 'antd';
import { useState } from 'react';
import { usePlugin } from '../../i18n/context';
import { useResetSubscription, useToggleRollover } from '../../hooks/useSubscriptions';
import type { SubscriptionSummary } from '../../types/subscriptions';
import { ResetConfirmModal } from './ResetConfirmModal';
import { RolloverHistoryModal } from './RolloverHistoryModal';
import { UsageProgress, getStatusRawColor } from './UsageProgress';

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

  const totalQuota = subscription.daily_quota + subscription.balance_carry;
  const usagePercent = totalQuota === 0 ? 0 : Math.min(100, (subscription.current_used / totalQuota) * 100);
  const statusRaw = getStatusRawColor(usagePercent);

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
        style={{ borderLeftColor: statusRaw, animationDelay: `${animationDelay}ms` }}
      >
        <div className="ssc-card-head">
          <div className="ssc-card-head-left">
            <span className="ssc-status-dot" style={{ background: statusRaw }} />
            <h3>{subscription.plan_name}</h3>
          </div>
          <Tag style={{ margin: 0, opacity: 0.7 }}>#{subscription.id}</Tag>
        </div>

        <div className="ssc-card-body-row">
          <UsageProgress currentUsed={subscription.current_used} totalQuota={totalQuota} />
          <div className="ssc-card-metrics">
            <div>
              <span className="ssc-label">{t.card_label_available}</span>
              <strong>{subscription.available_quota}</strong>
            </div>
            <div>
              <span className="ssc-label">{t.card_label_carry}</span>
              <strong>{subscription.balance_carry}</strong>
            </div>
            <div>
              <span className="ssc-label">{t.card_label_daily_quota}</span>
              <strong>{subscription.daily_quota}</strong>
            </div>
            <div>
              <span className="ssc-label">{t.card_label_virtual_expires}</span>
              <strong>{formatDateLocal(subscription.virtual_expires_at)}</strong>
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
          <Space size={4}>
            <Tag color="cyan" style={{ fontSize: 11 }}>{badgeText}</Tag>
            <Button size="small" type="primary" danger onClick={() => setResetOpen(true)}>
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
