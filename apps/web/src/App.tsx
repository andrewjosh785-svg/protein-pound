import { useEffect, useState } from "react";
import type { Meal } from "@protein-pound/shared";
import { MealsPage } from "./features/meals/MealsPage";
import { MealDetailPage } from "./features/meals/MealDetailPage";
import { GeneratePage } from "./features/generate/GeneratePage";
import { RecipeBuilderPage } from "./features/recipe-builder/RecipeBuilderPage";
import { WeekPage } from "./features/week/WeekPage";
import { AuthWidget } from "./features/auth/AuthWidget";
import { LandingPage } from "./features/landing/LandingPage";
import { UpgradePage } from "./features/billing/UpgradePage";
import { TermsPage } from "./features/legal/TermsPage";
import { PrivacyPage } from "./features/legal/PrivacyPage";
import { Sidebar, type Tab } from "./features/nav/Sidebar";
import { OnboardingOverlay } from "./features/onboarding/OnboardingOverlay";
import { useAuth } from "./lib/auth/AuthContext";
import { useTheme } from "./lib/theme/ThemeContext";
import { ThemeToggle } from "./lib/theme/ThemeToggle";
import { useSubscription, hasActiveAccess } from "./lib/queries/useSubscription";
import { hasSeenOnboarding, markOnboardingSeen } from "./lib/onboarding";

/** No router library — the app only ever needed tab-switching until shareable meal URLs (C)
 * came along, so this hand-rolls the one route it actually needs. */
function useMealSlugFromPath(): [string | null, (path: string) => void] {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (nextPath: string) => {
    window.history.pushState(null, "", nextPath);
    setPath(nextPath);
  };

  const match = path.match(/^\/meals\/([^/]+)\/?$/);
  return [match ? decodeURIComponent(match[1]) : null, navigate];
}

/** Shares the same history-backed navigate as useMealSlugFromPath so all in-app links
 * behave consistently, without needing a full router for two static pages. */
function useLegalPageFromPath(): ["terms" | "privacy" | null, (path: string) => void] {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (nextPath: string) => {
    window.history.pushState(null, "", nextPath);
    setPath(nextPath);
  };

  const page = path === "/terms" ? "terms" : path === "/privacy" ? "privacy" : null;
  return [page, navigate];
}

function Logo() {
  return (
    <div>
      <h1>
        Protein<span className="slash">/</span>Pound
      </h1>
      <p>High-protein meals ranked by what they actually cost at the till.</p>
    </div>
  );
}

function App() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const [tab, setTab] = useState<Tab>("meals");
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [mealSlug, navigate] = useMealSlugFromPath();
  const [legalPage, navigateLegal] = useLegalPageFromPath();
  const subscription = useSubscription(user?.id);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user && hasActiveAccess(subscription.data ?? null) && !hasSeenOnboarding()) {
      setShowOnboarding(true);
    }
  }, [user, subscription.data]);

  // Fully public and independent of auth/subscription state — checked before the loading
  // guard too, so these never get stuck behind an auth check that isn't relevant to them.
  if (legalPage) {
    return (
      <div className="ppp-root" data-theme={theme}>
        {legalPage === "terms" ? (
          <TermsPage onBack={() => navigateLegal("/")} />
        ) : (
          <PrivacyPage onBack={() => navigateLegal("/")} />
        )}
      </div>
    );
  }

  if (loading) {
    return <div className="note">Loading…</div>;
  }

  // Meal-detail pages stay publicly viewable (shared links, social previews) even
  // signed out — everything else requires an account first.
  if (!user) {
    if (mealSlug) {
      return (
        <div className="ppp-root" data-theme={theme}>
          <header className="hdr">
            <Logo />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ThemeToggle />
              <AuthWidget closeSignal={mealSlug} />
            </div>
          </header>
          <MealDetailPage slug={mealSlug} onBack={() => navigate("/")} />
        </div>
      );
    }
    return (
      <div className="ppp-root" data-theme={theme}>
        <LandingPage />
      </div>
    );
  }

  if (subscription.isLoading) {
    return <div className="note">Loading…</div>;
  }

  if (!hasActiveAccess(subscription.data ?? null)) {
    return (
      <div className="ppp-root" data-theme={theme}>
        <UpgradePage />
      </div>
    );
  }

  return (
    <div className="ppp-root" data-theme={theme}>
      <div className="app-shell">
        <Sidebar
          tab={tab}
          onSelectTab={(t) => {
            setEditingMeal(null);
            setTab(t);
            if (mealSlug) navigate("/");
          }}
        />
        <main className="app-content">
          {mealSlug ? (
            <MealDetailPage slug={mealSlug} onBack={() => navigate("/")} />
          ) : (
            <>
              {tab === "meals" && (
                <MealsPage
                  onEditMeal={(meal) => {
                    setEditingMeal(meal);
                    setTab("build");
                  }}
                  onOpenMeal={(meal) => navigate(`/meals/${meal.slug}`)}
                />
              )}
              {tab === "gen" && <GeneratePage />}
              {tab === "build" && (
                <RecipeBuilderPage
                  editingMeal={editingMeal}
                  onDoneEditing={() => {
                    setEditingMeal(null);
                    setTab("meals");
                  }}
                />
              )}
              {tab === "week" && <WeekPage />}
            </>
          )}
        </main>
      </div>
      {showOnboarding && (
        <OnboardingOverlay
          onDismiss={() => {
            setShowOnboarding(false);
            markOnboardingSeen();
          }}
        />
      )}
    </div>
  );
}

export default App;
