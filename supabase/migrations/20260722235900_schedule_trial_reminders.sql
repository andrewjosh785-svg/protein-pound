-- Schedules the send-trial-reminders edge function to run once daily via Supabase's
-- standard pg_cron + pg_net pattern — no external cron service needed. The function
-- itself authenticates the call via a shared-secret header (CRON_SECRET), since a
-- cron-triggered call can't carry a Supabase JWT the way a real user request would.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select
  cron.schedule(
    'send-trial-reminders-daily',
    '0 9 * * *', -- 09:00 UTC daily
    $$
    select
      net.http_post(
        url := 'https://jjeyvzvpjxnplidvihzv.supabase.co/functions/v1/send-trial-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', 'baeedf4ee59c40ed79e48dcba52d48680a78f49d37422cef'
        ),
        body := '{}'::jsonb
      );
    $$
  );
