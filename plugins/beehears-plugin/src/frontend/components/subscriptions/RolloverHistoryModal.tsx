import { Modal, Skeleton, Timeline } from 'antd';
import { usePlugin } from '../../i18n/context';
import { useRolloverHistory } from '../../hooks/useSubscriptions';
import type { RolloverHistoryRecord } from '../../types/subscriptions';

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
        <Timeline
          items={(historyQuery.data ?? []).map((item: RolloverHistoryRecord) => ({
            color: 'var(--ssc-accent, #22d3ee)',
            children: (
              <div className="ssc-history-item">
                <div className="ssc-history-time">{item.rolled_at}</div>
                <div className="ssc-history-values">
                  <span>{t.history_before} {item.quota_before}</span>
                  <span>{t.history_carry} {item.carry_amount}</span>
                  <span>{t.history_after} {item.quota_after}</span>
                </div>
              </div>
            ),
          }))}
        />
      )}
    </Modal>
  );
}
