import { Button, Modal, Skeleton } from 'antd';
import { useMemo } from 'react';
import { usePlugin } from '../../i18n/context';
import { useResetQuota } from '../../hooks/useSubscriptions';
import type { SubscriptionSummary } from '../../types/subscriptions';
import { formatDisplayQuota } from '../../utils/number-format';

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
  const isExpired = Boolean(subscription?.is_expired);
  const canReset = Boolean(quotaQuery.data?.can_reset) && !quotaQuery.isLoading && !isExpired;

  const projectedExpiry = useMemo(
    () => shiftVirtualExpiry(subscription?.virtual_expires_at),
    [subscription?.virtual_expires_at],
  );

  return (
    <Modal
      className="ssc-reset-dialog"
      title={null}
      open={open}
      width={560}
      centered
      onCancel={onCancel}
      footer={null}
    >
      {quotaQuery.isLoading ? (
        <div className="ssc-reset-loading">
          <Skeleton active paragraph={{ rows: 5 }} />
        </div>
      ) : (
        <div className="ssc-reset-modal">
          <section className="ssc-reset-head">
            <span className="ssc-reset-kicker">{t.reset_title_suffix}</span>
            <div className="ssc-reset-title-row">
              <div className="ssc-reset-title-block">
                <h3>{subscription?.plan_name ?? t.card_label_subscription}</h3>
                <p>{t.reset_warning}</p>
              </div>
              <span className={`ssc-reset-state ${canReset ? 'is-ready' : 'is-blocked'}`}>
                {canReset ? t.reset_state_ready : t.reset_state_blocked}
              </span>
            </div>
            <div className="ssc-reset-description">
              {t.reset_warning_desc}
            </div>
          </section>

          <section className="ssc-reset-impact-grid">
            <article className="ssc-reset-impact-card is-danger">
              <span className="ssc-label">{t.usage_label}</span>
              <strong>{formatDisplayQuota(subscription?.current_used ?? 0)}</strong>
              <p>{t.reset_effect_usage_desc}</p>
            </article>
            <article className="ssc-reset-impact-card is-danger">
              <span className="ssc-label">{t.card_label_carry}</span>
              <strong>{formatDisplayQuota(subscription?.balance_carry ?? 0)}</strong>
              <p>{t.reset_effect_carry_desc}</p>
            </article>
          </section>

          <div className="ssc-compare-grid">
            <div className="ssc-compare-card">
              <span className="ssc-label">{t.reset_current_expires}</span>
              <strong>{formatDateLocal(subscription?.virtual_expires_at)}</strong>
            </div>
            <span className="ssc-compare-arrow">→</span>
            <div className="ssc-compare-card is-next">
              <span className="ssc-label">{t.reset_after_expires}</span>
              <strong>{projectedExpiry}</strong>
            </div>
          </div>

          <section className="ssc-reset-quota-panel">
            <div className="ssc-reset-quota-copy">
              <span className="ssc-label">{t.reset_confirm}</span>
              <p>
                {canReset
                  ? t.reset_quota_ready_desc
                  : isExpired
                    ? t.reset_expired_desc
                    : t.reset_quota_blocked_desc}
              </p>
            </div>
            <div className="ssc-reset-quota-chips">
              <div className="ssc-reset-quota-chip">
                <span>{t.reset_weekly_remain}</span>
                <strong>{quotaQuery.data?.reset_quota_weekly ?? 0} {t.reset_unit}</strong>
              </div>
              <div className="ssc-reset-quota-chip">
                <span>{t.reset_30d_remain}</span>
                <strong>{quotaQuery.data?.reset_quota_30d ?? 0} {t.reset_unit}</strong>
              </div>
            </div>
          </section>

          <footer className="ssc-reset-actions">
            <Button onClick={onCancel} disabled={confirmLoading}>
              {t.reset_cancel}
            </Button>
            <Button
              type="primary"
              danger
              loading={confirmLoading}
              disabled={!canReset}
              onClick={onConfirm}
              className="ssc-reset-confirm-btn"
            >
              {t.reset_confirm}
            </Button>
          </footer>
        </div>
      )}
    </Modal>
  );
}
