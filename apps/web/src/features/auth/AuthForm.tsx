import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Mode = "sign-in" | "sign-up";

export function AuthForm({ onSuccess }: { onSuccess?: () => void }) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
      setConfirmMessage("Check your email to confirm your account, then sign in.");
    } else {
      setEmail("");
      setPassword("");
      onSuccess?.();
    }
  };

  return (
    <div>
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
