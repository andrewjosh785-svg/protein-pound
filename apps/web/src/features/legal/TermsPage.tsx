import { ThemeToggle } from "../../lib/theme/ThemeToggle";

/** Public page, reachable signed-in or signed-out — linked from the landing page and
 * paywall footers. Placeholder bracketed fields need filling in with real business
 * details before this is relied on for live billing; see the note at the top. */
export function TermsPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="bwrap" style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <button className="linklike" onClick={onBack}>
          ← Back
        </button>
        <ThemeToggle />
      </div>
      <h1 className="ppp-disp" style={{ fontSize: 26, textTransform: "uppercase", margin: "0 0 4px" }}>
        Terms of Service
      </h1>
      <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 20px" }}>Last updated: 20 July 2026</p>

      <div className="bad" style={{ fontSize: 12.5, padding: "10px 14px", marginBottom: 20 }}>
        Draft placeholder — replace the bracketed [business name/address/contact] fields
        below with your real registered details before relying on this for live billing.
        This is a solid starting draft, not a substitute for legal review.
      </div>

      <section style={{ fontSize: 14, lineHeight: 1.6 }}>
        <h2>1. Who we are</h2>
        <p>
          Protein/Pound ("we", "us", "our") is operated by [your business name / sole trader
          name], of [registered address]. You can contact us at [contact email].
        </p>

        <h2>2. The service</h2>
        <p>
          Protein/Pound is a UK meal-planning tool that ranks meals by protein-per-pound,
          compares ingredient prices across supermarkets, and offers an AI recipe
          generator and meal planner. Prices shown are estimates sourced periodically from
          public retailer data and may not match the exact price you pay in-store or
          online at any given moment.
        </p>

        <h2>3. Accounts</h2>
        <p>
          You need an account to use the full service. You're responsible for keeping your
          login details secure and for all activity under your account. Tell us if you
          suspect unauthorised access.
        </p>

        <h2>4. Subscription, trial and billing</h2>
        <p>
          Protein/Pound is offered as a single monthly subscription with a 7-day free
          trial for new subscribers. Your payment card is charged automatically when the
          trial ends unless you cancel first. After the trial, subscriptions renew monthly
          until cancelled and are billed in advance via our payment processor, Stripe.
        </p>
        <p>
          You can cancel at any time from the "Manage billing" option in the app, which
          opens Stripe's billing portal. Cancelling stops future renewals; you keep access
          until the end of the period you've already paid for (or the end of your trial,
          if you cancel during it).
        </p>

        <h2>5. Refunds</h2>
        <p>
          Because you get a free 7-day trial to evaluate the service before any charge, we
          don't generally offer refunds for the current billing period once a payment has
          been taken. If something's gone wrong on our end, contact us at [contact email]
          and we'll look at it fairly. This doesn't affect any statutory rights you have as
          a UK consumer.
        </p>

        <h2>6. Acceptable use</h2>
        <p>
          Don't misuse the service — for example, by attempting to disrupt it, scrape it
          at scale, or use the AI recipe generator to produce abusive or unlawful content.
          We can suspend or terminate accounts that do.
        </p>

        <h2>7. No warranty on pricing accuracy</h2>
        <p>
          We make a reasonable effort to keep ingredient prices current, but supermarkets
          change prices constantly and we don't guarantee the figures shown match what
          you'll be charged at the till. Use them as a planning guide, not a guaranteed
          quote.
        </p>

        <h2>8. Limitation of liability</h2>
        <p>
          To the extent permitted by law, we're not liable for indirect or consequential
          losses arising from your use of the service. Nothing here limits liability for
          things that can't legally be limited, like death or personal injury caused by
          negligence, or fraud.
        </p>

        <h2>9. Changes to these terms</h2>
        <p>
          We may update these terms from time to time. We'll update the date at the top of
          this page when we do; continuing to use the service after a change means you
          accept the update.
        </p>

        <h2>10. Governing law</h2>
        <p>These terms are governed by the law of England and Wales.</p>
      </section>
    </div>
  );
}
