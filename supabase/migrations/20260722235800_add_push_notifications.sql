-- Supports the trial-ending push notification: a place to store each user's current
-- Expo push token, and a marker so the daily reminder check never double-sends for the
-- same subscription if the cron job happens to fire more than once during the eligible
-- window.
alter table public.profiles add column push_token text;

alter table public.subscriptions add column trial_reminder_sent_at timestamptz;
