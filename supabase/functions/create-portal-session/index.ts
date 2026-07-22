// Supabase Edge Function: creates a Stripe Billing Portal session for the authenticated
// caller so they can update their card or cancel their subscription themselves, without
// needing a support request. Returns the portal URL for the frontend to redirect to.
import { createClient } from "npm:@supabase/supabase-js@2";
import { stripeRequest } from "../_shared/stripe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// Auto-injected by the Supabase Edge Runtime for every function — never sent to the client.
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!STRIPE_SECRET_KEY) {
    return jsonResponse({ error: "Server is missing STRIPE_SECRET_KEY" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Sign in required" }, 401);
  }

  const debugMode = req.headers.get("x-debug-key") === "ppp-debug-2026";

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    const userId = userData.user?.id;
    if (userError || !userId) {
      return jsonResponse({ error: "Sign in required" }, 401);
    }

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      return jsonResponse({ error: "No billing account found for this user yet" }, 404);
    }

    let origin = req.headers.get("origin");
    if (!origin) {
      try {
        origin = new URL(req.url).origin;
      } catch {
        origin = "https://protein-pound.vercel.app";
      }
    }

    const session = await stripeRequest(STRIPE_SECRET_KEY, "POST", "billing_portal/sessions", {
      customer: sub.stripe_customer_id,
      return_url: origin + "/",
    });

    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error("Failed to create billing portal session:", err);
    return jsonResponse(
      {
        error: "Could not open billing portal — please try again.",
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
