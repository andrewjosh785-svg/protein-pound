// Supabase Edge Function: receives Stripe webhook events and keeps public.subscriptions
// in sync. This is the ONLY writer of subscription state — the frontend/other functions
// only ever read it, so a user can never grant themselves paid access by editing their
// own row (RLS on subscriptions has no insert/update policy for regular users).
//
// Unauthenticated on purpose (Stripe can't send a Supabase JWT) — verify_jwt = false is
// set for this function in supabase/config.toml, and the Stripe signature check below is
// what actually authenticates the caller instead.
import { createClient } from "npm:@supabase/supabase-js@2";
import { stripeRequest, verifyStripeSignature } from "../_shared/stripe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

// Newer Stripe API versions moved the billing-period fields off the top-level
// Subscription object down onto individual subscription items (a subscription can now
// have items with different billing periods), so current_period_end may only exist at
// subscription.items.data[0].current_period_end rather than the top level.
// deno-lint-ignore no-explicit-any
function extractCurrentPeriodEnd(subscription: any): string | null {
  const raw = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return new Date(raw * 1000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return new Response("Server misconfigured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  // Signature verification needs the untouched raw bytes — read as text, never req.json(),
  // and do this before anything else so a bad signature short-circuits immediately.
  const rawBody = await req.text();

  try {
    if (!signature) throw new Error("Missing stripe-signature header");
    await verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  // deno-lint-ignore no-explicit-any
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId: string | null = session.client_reference_id ?? null;
        const customerId: string | null = session.customer ?? null;
        const subscriptionId: string | null = session.subscription ?? null;

        if (!userId || !customerId) {
          console.error("checkout.session.completed missing client_reference_id/customer");
          break;
        }

        let status = "active";
        let currentPeriodEnd: string | null = null;
        if (subscriptionId) {
          const subscription = await stripeRequest(STRIPE_SECRET_KEY, "GET", "subscriptions/" + subscriptionId);
          status = subscription.status;
          currentPeriodEnd = extractCurrentPeriodEnd(subscription);
        }

        await supabaseAdmin.from("subscriptions").upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status,
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        });
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const status = event.type === "customer.subscription.deleted" ? "canceled" : subscription.status;

        await supabaseAdmin
          .from("subscriptions")
          .update({
            status,
            current_period_end: extractCurrentPeriodEnd(subscription),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }

      default:
        // Ignore anything we haven't opted into — Stripe sends many event types.
        break;
    }
  } catch (err) {
    console.error("Failed to process webhook event " + event.type + ":", err);
    // Included in the response body temporarily while diagnosing setup — this is only
    // ever visible in the Stripe account owner's own dashboard (event delivery detail),
    // never exposed publicly, so it's safe to be verbose here.
    return new Response(
      "Webhook handler error: " + (err instanceof Error ? err.message : String(err)),
      { status: 500 }
    );
  }

  return new Response("ok", { status: 200 });
});
