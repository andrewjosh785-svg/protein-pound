import { useTheme } from "./ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button className="pill" onClick={toggleTheme} aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}>
      {isDark ? "☀️ Light" : "🌙 Dark"}
    </button>
  );
}
