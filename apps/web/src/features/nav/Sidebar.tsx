import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/auth/AuthContext";
import { useTheme } from "../../lib/theme/ThemeContext";

export type Tab = "meals" | "gen" | "build" | "week";

const NAV_ITEMS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "meals", label: "Meals", icon: "🍽️" },
  { id: "gen", label: "Generate", icon: "✨" },
  { id: "build", label: "Price my recipe", icon: "💷" },
  { id: "week", label: "My week", icon: "📅" },
];

export function Sidebar({ tab, onSelectTab }: { tab: Tab; onSelectTab: (t: Tab) => void }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1 className="ppp-disp">
          Protein<span className="slash">/</span>Pound
        </h1>
        <p>High-protein meals ranked by what they actually cost at the till.</p>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${tab === item.id ? "on" : ""}`}
            onClick={() => onSelectTab(item.id)}
          >
            <span className="sidebar-item-icon" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-user">
          <span>{user?.email}</span>
          <button className="linklike" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
        <button
          className="sidebar-theme-btn"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>
    </aside>
  );
}
