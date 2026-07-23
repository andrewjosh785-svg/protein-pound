import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Mode = "sign-in" | "sign-up";
type OAuthProvider = "google" | "apple" | "facebook";

const OAUTH_PROVIDERS = [
  { id: "google" as const, label: "Google", icon: <GoogleIcon /> },
  { id: "apple" as const, label: "Apple", icon: <AppleIcon /> },
  { id: "facebook" as const, label: "Facebook", icon: <FacebookIcon /> },
];

export function AuthForm({ onSuccess }: { onSuccess?: () => void }) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);

  // Redirects to the exact URL the user started from (landing page, or a shared meal page
  // where AuthWidget lives) — detectSessionInUrl (browser client default) auto-detects the
  // returned session on load, so no callback route/page is needed on either end.
  const handleOAuth = async (provider: OAuthProvider) => {
    setError("");
    setOauthBusy(provider);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.href },
    });
    if (authError) {
      setError(authError.message);
      setOauthBusy(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setConfirmMessage("");

    const { error: authError } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });

    setBusy(false);

    if (authError) {
      setError(authError.message);
      return;
    }
    if (mode === "sign-up") {
      // Leave the email filled in and switch to Sign in so the user lands on the right
      // form the moment they come back from confirming — without this they'd have to
      // remember to click "Sign in" themselves and retype an email they just typed once.
      setConfirmMessage(`We've sent a confirmation link to ${email.trim()}. Open it, then sign in below.`);
      setPassword("");
      setMode("sign-in");
    } else {
      setEmail("");
      setPassword("");
      onSuccess?.();
    }
  };

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {OAUTH_PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="bigbtn alt"
            style={{ width: "100%", fontSize: 13, padding: "8px 0", gap: 8 }}
            disabled={busy || oauthBusy !== null}
            onClick={() => handleOAuth(p.id)}
          >
            {p.icon}
            {oauthBusy === p.id ? "…" : `Continue with ${p.label}`}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px", fontSize: 11, color: "var(--faint)" }}>
        <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
        or continue with email
        <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button
          type="button"
          className={"pill " + (mode === "sign-in" ? "on" : "")}
          style={{ flex: 1 }}
          onClick={() => setMode("sign-in")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={"pill " + (mode === "sign-up" ? "on" : "")}
          style={{ flex: 1 }}
          onClick={() => setMode("sign-up")}
        >
          Sign up
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="fld" style={{ marginBottom: 8 }}>
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
        <div className="fld" style={{ marginBottom: 10 }}>
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
        {error && (
          <div className="bad" style={{ fontSize: 12, marginBottom: 8 }}>
            {error}
          </div>
        )}
        {confirmMessage && (
          <div className="ok" style={{ fontSize: 12, marginBottom: 8 }}>
            {confirmMessage}
          </div>
        )}
        <button
          type="submit"
          className="bigbtn"
          style={{ width: "100%", fontSize: 13, padding: "8px 0" }}
          disabled={busy}
        >
          {busy ? "…" : mode === "sign-in" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
