import { AuthForm } from "../auth/AuthForm";
import { ThemeToggle } from "../../lib/theme/ThemeToggle";

export function LandingPage() {
  return (
    <div className="landing">
      <div style={{ position: "absolute", top: 20, right: 24 }}>
        <ThemeToggle />
      </div>
      <div className="landing-row">
        <div className="landing-hero">
          <h1 className="ppp-disp landing-title">
            Protein<span className="slash">/</span>Pound
          </h1>
          <p className="landing-sub">
            High-protein UK meals ranked by what they actually cost at the till.
          </p>
          <ul className="landing-features">
            <li>Compare prices across Tesco, Aldi, Asda, Sainsbury's and Morrisons</li>
            <li>Plan your week and track calories, protein and budget</li>
            <li>Generate new recipes with AI, already costed at every supermarket</li>
            <li>Price your own recipes against the same ingredient database</li>
          </ul>
        </div>
        <div className="landing-auth tcard">
          <h2 className="ppp-disp" style={{ fontSize: 20, textTransform: "uppercase", margin: "0 0 14px" }}>
            Sign in to get started
          </h2>
          <AuthForm />
        </div>
      </div>
      {/* Static, not absolutely pinned to the viewport bottom — with the OAuth buttons added,
          the row can be taller than 100vh on shorter windows, and an absolute-bottom footer
          would just get pushed off-screen below the fold instead of following the content. */}
      <div className="landing-legal">
        <a href="/terms">Terms of Service</a> · <a href="/privacy">Privacy Policy</a>
      </div>
    </div>
  );
}
