import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../lib/auth/AuthContext";
import { AuthForm } from "./AuthForm";

// Only ever rendered signed-out: the authenticated app uses NavMenu (nav + theme + sign out)
// instead, so this widget's job is just the sign-in/sign-up dropdown for logged-out visitors
// (the landing page, and the header on publicly-viewable shared meal pages).
export function AuthWidget({ closeSignal }: { closeSignal?: unknown }) {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dismiss on outside click, Escape, or when the parent signals a route/tab change.
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setOpen(false), [closeSignal]);

  if (loading || user) return null;

  return (
    <div style={{ position: "relative" }} ref={containerRef}>
      <button className="pill" onClick={() => setOpen((o) => !o)}>
        Sign in
      </button>
      {open && (
        <div
          className="tcard"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 260,
            zIndex: 10,
            background: "var(--surface)",
          }}
        >
          <AuthForm onSuccess={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
