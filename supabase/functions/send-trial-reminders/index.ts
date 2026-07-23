// Supabase Edge Function: sends a one-time push notification to any trialing
// subscriber whose trial ends within the next ~36 hours, so someone who isn't actively
// opening the app still finds out before their card gets charged. Cron-triggered (see
// the scheduling migration), not user-triggered — same reasoning as stripe-webhook for
// why this can't carry a Supabase JWT: verify_jwt = false in supabase/config.toml, with
// a shared-secret header standing in for auth a real caller can't provide.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const REMINDER_WINDOW_HOURS = 36;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!CRON_SECRET) {
    console.error("Missing CRON_SECRET");
    return new Response("Server misconfigured", { status: 500 });
  }
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const windowEnd = new Date(Date.now() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data: subscriptions, error } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id, current_period_end")
    .eq("status", "trialing")
    .is("trial_reminder_sent_at", null)
    .gte("current_period_end", now)
    .lte("current_period_end", windowEnd);

  if (error) {
    console.error("Failed to query trialing subscriptions:", error);
    return new Response("Query failed", { status: 500 });
  }

  let sent = 0;
  for (const sub of subscriptions ?? []) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("push_token")
      .eq("id", sub.user_id)
      .maybeSingle();

    if (!profile?.push_token) continue;

    try {
      const pushResponse = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: profile.push_token,
          title: "Your Protein/Pound trial ends tomorrow",
          body: "You'll be charged automatically unless you cancel before then.",
        }),
      });
      if (!pushResponse.ok) {
        console.error("Expo push send failed for user " + sub.user_id + ":", await pushResponse.text());
        continue;
      }
    } catch (err) {
      console.error("Expo push send threw for user " + sub.user_id + ":", err);
      continue;
    }

    // Mark as sent regardless of per-message delivery status details from Expo (a
    // successful POST means Expo accepted it) — this is a best-effort reminder, not a
    // guaranteed-delivery system, and re-sending on transient Expo-side issues risks
    // spamming rather than helping.
    await supabaseAdmin
      .from("subscriptions")
      .update({ trial_reminder_sent_at: new Date().toISOString() })
      .eq("user_id", sub.user_id);
    sent++;
  }

  return new Response(JSON.stringify({ checked: subscriptions?.length ?? 0, sent }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
