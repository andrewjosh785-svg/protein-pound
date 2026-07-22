// Supabase Edge Function: starts a Stripe Checkout session (subscription mode, 7-day
// trial) for the authenticated caller, reusing their Stripe customer if one already
// exists. Returns the Checkout URL for the frontend to redirect to.
import { createClient } from "npm:@supabase/supabase-js@2";
import { stripeRequest } from "../_shared/stripe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// Auto-injected by the Supabase Edge Runtime for every function — never sent to the client.
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_PRICE_ID = Deno.env.get("STRIPE_PRICE_ID");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-debug-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
    return jsonResponse({ error: "Server is missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Sign in required" }, 401);
  }

  // Hidden debug mode, same pattern as generate-recipe: only activates with this exact
  // header, so real users never see internals but a test request can surface the cause.
  const debugMode = req.headers.get("x-debug-key") === "ppp-debug-2026";

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    const userId = userData.user?.id;
    const userEmail = userData.user?.email;
    if (userError || !userId) {
      return jsonResponse({ error: "Sign in required" }, 401);
    }

    const { data: existingSub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    let origin = req.headers.get("origin");
    if (!origin) {
      try {
        origin = new URL(req.url).origin;
      } catch {
        origin = "https://protein-pound.vercel.app";
      }
    }

    const session = await stripeRequest(STRIPE_SECRET_KEY, "POST", "checkout/sessions", {
      mode: "subscription",
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      subscription_data: { trial_period_days: 7 },
      client_reference_id: userId,
      ...(existingSub?.stripe_customer_id
        ? { customer: existingSub.stripe_customer_id }
        : { customer_email: userEmail }),
      success_url: origin + "/?checkout=success",
      cancel_url: origin + "/?checkout=cancelled",
    });

    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error("Failed to create checkout session:", err);
    return jsonResponse(
      {
        error: "Could not start checkout — please try again.",
        ...(debugMode ? { debug: err instanceof Error ? err.message : String(err) } : {}),
      },
      502
    );
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
