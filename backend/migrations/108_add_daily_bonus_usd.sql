-- Add daily_bonus_usd column to user_subscriptions for carry rollover injection.
-- This field stores the carry amount calculated by the beehears-plugin rollover job,
-- and is added to the group's daily_limit_usd when checking daily quota.
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS daily_bonus_usd DECIMAL(20,10) NOT NULL DEFAULT 0;
