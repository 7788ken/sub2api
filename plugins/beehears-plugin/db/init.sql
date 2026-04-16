-- beehears-plugin 插件表结构
-- 在 sub2api 数据库中创建

CREATE SCHEMA IF NOT EXISTS plugin_beehears;

CREATE TABLE IF NOT EXISTS plugin_beehears.subscription_extensions (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL,
  sub2api_subscription_id INTEGER NOT NULL UNIQUE,
  balance_carry   NUMERIC(12, 4) NOT NULL DEFAULT 0,
  reset_count_30d INTEGER NOT NULL DEFAULT 0,
  reset_window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reset_count_weekly INTEGER NOT NULL DEFAULT 0,
  reset_week_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  extra_days_deducted INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_ext_user_id ON plugin_beehears.subscription_extensions (user_id);
CREATE INDEX IF NOT EXISTS idx_sub_ext_sub_id ON plugin_beehears.subscription_extensions (sub2api_subscription_id);

CREATE TABLE IF NOT EXISTS plugin_beehears.rollover_settings (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL,
  sub2api_subscription_id INTEGER NOT NULL UNIQUE,
  enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rollover_settings_user_id ON plugin_beehears.rollover_settings (user_id);

CREATE TABLE IF NOT EXISTS plugin_beehears.rollover_history (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL,
  sub2api_subscription_id INTEGER NOT NULL,
  rolled_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quota_before    NUMERIC(12, 4) NOT NULL DEFAULT 0,
  carry_amount    NUMERIC(12, 4) NOT NULL DEFAULT 0,
  quota_after     NUMERIC(12, 4) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rollover_history_sub_id ON plugin_beehears.rollover_history (sub2api_subscription_id);
CREATE INDEX IF NOT EXISTS idx_rollover_history_rolled_at ON plugin_beehears.rollover_history (rolled_at);

CREATE TABLE IF NOT EXISTS plugin_beehears.reset_history (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL,
  sub2api_subscription_id INTEGER NOT NULL,
  reset_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  days_deducted   INTEGER NOT NULL DEFAULT 0,
  expires_before  TIMESTAMPTZ NOT NULL,
  expires_after   TIMESTAMPTZ NOT NULL,
  reset_count_used INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reset_history_sub_id ON plugin_beehears.reset_history (sub2api_subscription_id);
