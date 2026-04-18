export type Locale = 'zh' | 'en';

const zh = {
  // Shell
  shell_kicker: 'BeeHears Plugin',
  shell_title: '自助服务中心',
  shell_subtitle: '订阅基础数据来自 Sub2API，插件侧补充转结余额与重置次数管理。',

  // Dashboard metrics
  dashboard_total_subs: '活跃订阅',
  dashboard_total_available: '总可用额度',
  dashboard_active_rollovers: '转结开启',
  dashboard_avg_usage: '平均用量',
  dashboard_site_subs: '全站订阅',
  dashboard_valid_site_subs: '有效订阅 / 全站订阅',

  // App states
  loading: '加载中…',
  error_title: '订阅列表加载失败',
  error_desc: '请稍后刷新重试，或检查插件后端 /api/subscriptions 的聚合结果。',

  // SubscriptionGrid
  empty: '当前没有可展示的订阅',

  // SubscriptionCard
  card_label_subscription: '订阅',
  card_label_available: '剩余额度',
  card_label_carry: '转结余额',
  card_label_daily_quota: '日配额',
  card_label_virtual_expires: '到期时间',
  card_label_rollover: '转结',
  card_rollover_on: '已开启',
  card_rollover_off: '已关闭',
  card_btn_detail: '明细',
  card_btn_reset: '重置额度',
  card_badge_week: '周',
  card_badge_30d: '30天',
  msg_rollover_on: '已开启自动余额转结',
  msg_rollover_off: '已关闭自动余额转结',
  msg_rollover_fail: '更新转结状态失败',
  msg_reset_ok: '额度已重置，到期时间已同步更新',
  msg_reset_fail: '重置额度失败',

  // UsageProgress
  usage_label: '今日用量',

  // RolloverHistoryModal
  history_title_suffix: '最近 10 条操作记录',
  history_rollover_tag: '转结',
  history_reset_tag: '重置',
  history_before: '转结前剩余',
  history_carry: '本次转结',
  history_after: '转结后总额',
  history_reset_deduct: '扣减天数',
  history_reset_count_used: '消耗次数',
  history_reset_before: '重置前到期',
  history_reset_after: '重置后到期',

  // ResetConfirmModal
  reset_title_suffix: '重置额度',
  reset_warning: '本次操作会清空今日用量与转结余额',
  reset_warning_desc: '系统将重置额度，并将到期时间扣减 1 天。',
  reset_current_expires: '当前到期时间',
  reset_after_expires: '重置后到期时间',
  reset_weekly_remain: '本周剩余',
  reset_30d_remain: '30 天剩余',
  reset_unit: '次',
  reset_confirm: '确认重置',
  reset_cancel: '取消',
  reset_state_ready: '可执行',
  reset_state_blocked: '不可重置',
  reset_effect_usage_desc: '今日用量将归零',
  reset_effect_carry_desc: '转结余额会被清空',
  reset_quota_ready_desc: '本次操作会同时扣减本周与 30 天重置额度。',
  reset_quota_blocked_desc: '当前本周或 30 天重置额度不足，暂时无法执行。',

  // Beta gate
  beta_title: '内测通道',
  beta_desc: '本功能当前处于内测阶段，请输入内测密码进入。',
  beta_placeholder: '内测密码',
  beta_submit: '进入',
  beta_wrong_password: '密码错误',
} as const;

export type Messages = { [K in keyof typeof zh]: string };

const en: Messages = {
  // Shell
  shell_kicker: 'BeeHears Plugin',
  shell_title: 'Self-Service Center',
  shell_subtitle:
    'Subscription data from Sub2API, extended with rollover balance & reset quota management.',

  // Dashboard metrics
  dashboard_total_subs: 'Active Subs',
  dashboard_total_available: 'Total Available',
  dashboard_active_rollovers: 'Active Rollovers',
  dashboard_avg_usage: 'Avg Usage',
  dashboard_site_subs: 'Site Subs',
  dashboard_valid_site_subs: 'Valid / Total Subs',

  // App states
  loading: 'Loading…',
  error_title: 'Failed to load subscriptions',
  error_desc: 'Please refresh later or check the /api/subscriptions endpoint.',

  // SubscriptionGrid
  empty: 'No subscriptions to display',

  // SubscriptionCard
  card_label_subscription: 'Subscription',
  card_label_available: 'Available',
  card_label_carry: 'Rollover',
  card_label_daily_quota: 'Daily Quota',
  card_label_virtual_expires: 'Expires',
  card_label_rollover: 'Rollover',
  card_rollover_on: 'On',
  card_rollover_off: 'Off',
  card_btn_detail: 'History',
  card_btn_reset: 'Reset Quota',
  card_badge_week: 'Week',
  card_badge_30d: '30d',
  msg_rollover_on: 'Auto rollover enabled',
  msg_rollover_off: 'Auto rollover disabled',
  msg_rollover_fail: 'Failed to update rollover',
  msg_reset_ok: 'Quota reset, expiry updated',
  msg_reset_fail: 'Failed to reset quota',

  // UsageProgress
  usage_label: 'Today',

  // RolloverHistoryModal
  history_title_suffix: 'Recent 10 Activity Records',
  history_rollover_tag: 'Rollover',
  history_reset_tag: 'Reset',
  history_before: 'Before',
  history_carry: 'Carry',
  history_after: 'After',
  history_reset_deduct: 'Days Deducted',
  history_reset_count_used: 'Usage Count',
  history_reset_before: 'Expiry Before',
  history_reset_after: 'Expiry After',

  // ResetConfirmModal
  reset_title_suffix: 'Reset Quota',
  reset_warning: 'This will clear today\'s usage and rollover balance',
  reset_warning_desc:
    'The system will reset quota and deduct 1 day from expiry.',
  reset_current_expires: 'Current Expiry',
  reset_after_expires: 'After Reset',
  reset_weekly_remain: 'Week Remaining',
  reset_30d_remain: '30-Day Remaining',
  reset_unit: '',
  reset_confirm: 'Confirm Reset',
  reset_cancel: 'Cancel',
  reset_state_ready: 'Ready',
  reset_state_blocked: 'Unavailable',
  reset_effect_usage_desc: 'Today usage will be reset to zero',
  reset_effect_carry_desc: 'Rollover balance will be cleared',
  reset_quota_ready_desc: 'This action will consume both weekly and 30-day reset quota.',
  reset_quota_blocked_desc: 'Weekly or 30-day reset quota is exhausted, so reset is unavailable.',

  // Beta gate
  beta_title: 'Beta Access',
  beta_desc: 'This feature is in beta. Please enter the access code.',
  beta_placeholder: 'Access code',
  beta_submit: 'Enter',
  beta_wrong_password: 'Wrong password',
};

export const messages: Record<Locale, Messages> = { zh, en };
