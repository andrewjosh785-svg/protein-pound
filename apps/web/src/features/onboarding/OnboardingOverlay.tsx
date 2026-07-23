// mirrors apps/mobile/src/features/onboarding/OnboardingOverlay.tsx — shown once, right
// after a new (or returning-but-never-seen-it) user first reaches the app shell, since a
// brand-new account has no plan/recipes of their own and no idea what the four sections do.
const STEPS: Array<{ icon: string; title: string; body: string }> = [
  {
    icon: "🍽️",
    title: "Meals",
    body: "Browse a library of meals ranked by protein-per-£, or filter to just the ones you've built.",
  },
  {
    icon: "📅",
    title: "My week",
    body: "Plan out your week, log snacks and extras, and get a shopping list.",
  },
  {
    icon: "✨",
    title: "Generate",
    body: "Ask AI for a new recipe — it's automatically costed against every meal already in the app.",
  },
  {
    icon: "💷",
    title: "Price my recipe",
    body: "Price your own recipe from scratch using the same ingredient database.",
  },
];

export function OnboardingOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 1000,
      }}
    >
      <div
        className="tcard"
        style={{ width: "100%", maxWidth: 440, padding: 26, background: "var(--paper)" }}
      >
        <h2 className="ppp-disp" style={{ fontSize: 22, textTransform: "uppercase", margin: "0 0 2px", textAlign: "center" }}>
          Welcome to Protein/Pound
        </h2>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 20px", textAlign: "center" }}>
          Here's what each section does
        </p>

        {STEPS.map((step) => (
          <div key={step.title} style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-start" }}>
            <div
              style={{
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: 10,
                background: "var(--surface)",
                border: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 17,
              }}
              aria-hidden="true"
            >
              {step.icon}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{step.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>{step.body}</div>
            </div>
          </div>
        ))}

        <button className="bigbtn" style={{ width: "100%", padding: "12px 0", marginTop: 4 }} onClick={onDismiss}>
          Got it
        </button>
      </div>
    </div>
  );
}
