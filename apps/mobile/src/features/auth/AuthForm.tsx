// mirrors apps/web/src/features/auth/AuthForm.tsx — same sign-in/sign-up logic and
// copy, rebuilt with RN primitives instead of form/input/div markup.
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { supabase } from "../../lib/supabaseClient";
import { signInWithProvider, type OAuthProvider } from "../../lib/oauth";
import { colors } from "../../theme/tokens";

type Mode = "sign-in" | "sign-up";

const OAUTH_PROVIDERS: Array<{ id: OAuthProvider; label: string; icon: keyof typeof FontAwesome5.glyphMap }> = [
  { id: "google", label: "Google", icon: "google" },
  { id: "apple", label: "Apple", icon: "apple" },
  { id: "facebook", label: "Facebook", icon: "facebook" },
];

export function AuthForm({ onSuccess }: { onSuccess?: () => void }) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);

  const handleOAuth = async (provider: OAuthProvider) => {
    setError("");
    setOauthBusy(provider);
    const { error: oauthError } = await signInWithProvider(provider);
    setOauthBusy(null);
    if (oauthError) setError(oauthError);
    else onSuccess?.();
  };

  const handleSubmit = async () => {
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
      // remember to tap "Sign in" themselves and retype an email they just typed once.
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
    <View>
      <View style={styles.oauthGroup}>
        {OAUTH_PROVIDERS.map((p) => (
          <Pressable
            key={p.id}
            style={styles.oauthBtn}
            onPress={() => handleOAuth(p.id)}
            disabled={busy || oauthBusy !== null}
          >
            <FontAwesome5 name={p.icon} size={15} color={colors.ink} style={styles.oauthIcon} />
            <Text style={styles.oauthBtnText}>
              {oauthBusy === p.id ? "…" : `Continue with ${p.label}`}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or continue with email</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.pillRow}>
        <Pressable
          style={[styles.pill, mode === "sign-in" && styles.pillOn]}
          onPress={() => setMode("sign-in")}
        >
          <Text style={[styles.pillText, mode === "sign-in" && styles.pillTextOn]}>Sign in</Text>
        </Pressable>
        <Pressable
          style={[styles.pill, mode === "sign-up" && styles.pillOn]}
          onPress={() => setMode("sign-up")}
        >
          <Text style={[styles.pillText, mode === "sign-up" && styles.pillTextOn]}>Sign up</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
        value={password}
        onChangeText={setPassword}
      />

      {!!error && <Text style={styles.errorText}>{error}</Text>}
      {!!confirmMessage && <Text style={styles.okText}>{confirmMessage}</Text>}

      <Pressable
        style={[styles.submitBtn, busy && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.paper} />
        ) : (
          <Text style={styles.submitBtnText}>{mode === "sign-in" ? "Sign in" : "Create account"}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  oauthGroup: { gap: 8, marginBottom: 14 },
  oauthBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    paddingVertical: 10,
  },
  oauthIcon: { width: 16 },
  oauthBtnText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { fontSize: 11, color: colors.faint },
  pillRow: { flexDirection: "row", gap: 6, marginBottom: 14 },
  pill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
  },
  pillOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  pillTextOn: { color: colors.paper },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 4, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.ink,
  },
  errorText: { fontSize: 12, color: colors.deal, marginTop: 8 },
  okText: { fontSize: 12, color: colors.green, marginTop: 8 },
  submitBtn: {
    marginTop: 14,
    backgroundColor: colors.ink,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: colors.paper, fontSize: 13, fontWeight: "700" },
});
