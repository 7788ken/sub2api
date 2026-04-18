import { Empty, Modal, Skeleton } from 'antd';
import { usePlugin } from '../../i18n/context';
import { useRolloverHistory } from '../../hooks/useSubscriptions';
import type { SubscriptionHistoryRecord } from '../../types/subscriptions';

type RolloverHistoryModalProps = {
  open: boolean;
  subscriptionId?: number;
  planName?: string;
  onClose: () => void;
};

export function RolloverHistoryModal({
  open,
  subscriptionId,
  planName,
  onClose,
}: RolloverHistoryModalProps) {
  const { t } = usePlugin();
  const historyQuery = useRolloverHistory(subscriptionId, 10, open);

  return (
    <Modal
      title={`${planName ?? t.card_label_subscription} · ${t.history_title_suffix}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
    >
      {historyQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <div className="ssc-timeline">
          {(historyQuery.data ?? []).length === 0 ? (
            <Empty description={t.empty ?? 'No records'} />
          ) : (
            (historyQuery.data ?? []).map((item: SubscriptionHistoryRecord, index: number) => (
              <div key={index} className="ssc-timeline-item">
                <div className="ssc-timeline-dot" />
                <div className="ssc-timeline-content">
                  <div className="ssc-history-time">{item.event_at}</div>
                  {item.event_type === 'rollover' ? (
                    <div className="ssc-history-values">
                      <span><strong>{t.history_rollover_tag}</strong></span>
                      <span>{t.history_before} <strong>{item.quota_before}</strong></span>
                      <span>{t.history_carry} <strong>{item.carry_amount}</strong></span>
                      <span>{t.history_after} <strong>{item.quota_after}</strong></span>
                    </div>
                  ) : (
                    <div className="ssc-history-values">
                      <span><strong>{t.history_reset_tag}</strong></span>
                      <span>{t.history_reset_deduct} <strong>{item.days_deducted}</strong></span>
                      <span>{t.history_reset_count_used} <strong>{item.reset_count_used}</strong></span>
                      <span>{t.history_reset_before} <strong>{item.expires_before}</strong></span>
                      <span>{t.history_reset_after} <strong>{item.expires_after}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  );
}
