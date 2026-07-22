import { supabase } from "../../lib/supabaseClient";
import { useCreateCheckoutSession } from "../../lib/queries/useCreateCheckoutSession";
import { ThemeToggle } from "../../lib/theme/ThemeToggle";

/** Shown to signed-in users with no trialing/active subscription — mirrors LandingPage's
 * layout so the paywall doesn't feel like a different app. */
export function UpgradePage() {
  const checkout = useCreateCheckoutSession();

  return (
    <div className="landing">
      <div style={{ position: "absolute", top: 20, right: 24 }}>
        <ThemeToggle />
      </div>
      <div className="landing-hero">
        <h1 className="ppp-disp landing-title">
          Protein<span className="slash">/</span>Pound
        </h1>
        <p className="landing-sub">Start your 7-day free trial to unlock the full app.</p>
        <ul className="landing-features">
          <li>Compare prices across Tesco, Aldi, Asda, Sainsbury's and Morrisons</li>
          <li>Plan your week and track calories, protein and budget</li>
          <li>Generate new recipes with AI, already costed at every supermarket</li>
          <li>Price your own recipes against the same ingredient database</li>
        </ul>
      </div>
      <div className="landing-auth tcard">
        <h2 className="ppp-disp" style={{ fontSize: 20, textTransform: "uppercase", margin: "0 0 14px" }}>
          Start your free trial
        </h2>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 14px" }}>
          7 days free, then a single monthly subscription. Cancel any time before the
          trial ends and you won't be charged.
        </p>
        <button
          className="bigbtn"
          style={{ width: "100%", padding: "12px 0", ...(checkout.isPending ? { opacity: 0.6, cursor: "wait" } : {}) }}
          onClick={() => checkout.mutate()}
          disabled={checkout.isPending}
        >
          {checkout.isPending ? "Starting…" : "Start free trial"}
        </button>
        {checkout.isError && (
          <div className="bad" style={{ fontSize: 12.5, marginTop: 10 }}>
            {checkout.error instanceof Error ? checkout.error.message : "Something went wrong."}
          </div>
        )}
        <button
          className="linklike"
          style={{ marginTop: 14 }}
          onClick={() => supabase.auth.signOut()}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
