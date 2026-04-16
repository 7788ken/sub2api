import { Alert, Modal, Skeleton, Tag } from 'antd';
import { useMemo } from 'react';
import { usePlugin } from '../../i18n/context';
import { useResetQuota } from '../../hooks/useSubscriptions';
import type { SubscriptionSummary } from '../../types/subscriptions';

type ResetConfirmModalProps = {
  open: boolean;
  subscription?: SubscriptionSummary;
  confirmLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function formatDateLocal(value?: string) {
  if (!value) return '--';
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftVirtualExpiry(currentValue?: string) {
  if (!currentValue) return '--';
  const date = new Date(currentValue);
  date.setDate(date.getDate() - 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function ResetConfirmModal({
  open,
  subscription,
  confirmLoading,
  onCancel,
  onConfirm,
}: ResetConfirmModalProps) {
  const { t } = usePlugin();
  const quotaQuery = useResetQuota(subscription?.id, open);

  const projectedExpiry = useMemo(
    () => shiftVirtualExpiry(subscription?.virtual_expires_at),
    [subscription?.virtual_expires_at],
  );

  return (
    <Modal
      title={`${subscription?.plan_name ?? t.card_label_subscription} · ${t.reset_title_suffix}`}
      open={open}
      onCancel={onCancel}
      onOk={onConfirm}
      okText={t.reset_confirm}
      cancelText={t.reset_cancel}
      confirmLoading={confirmLoading}
      okButtonProps={{ danger: true, disabled: quotaQuery.data ? !quotaQuery.data.can_reset : false }}
    >
      {quotaQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <div className="ssc-reset-modal">
          <Alert
            type="warning"
            showIcon
            message={t.reset_warning}
            description={t.reset_warning_desc}
          />
          <div className="ssc-reset-grid">
            <div>
              <span className="ssc-label">{t.reset_current_expires}</span>
              <strong>{formatDateLocal(subscription?.virtual_expires_at)}</strong>
            </div>
            <div>
              <span className="ssc-label">{t.reset_after_expires}</span>
              <strong>{projectedExpiry}</strong>
            </div>
          </div>
          <div className="ssc-badges">
            <Tag color="gold">{t.reset_weekly_remain} {quotaQuery.data?.reset_quota_weekly ?? 0} {t.reset_unit}</Tag>
            <Tag color="cyan">{t.reset_30d_remain} {quotaQuery.data?.reset_quota_30d ?? 0} {t.reset_unit}</Tag>
          </div>
        </div>
      )}
    </Modal>
  );
}
