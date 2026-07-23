// Completes an OAuth (Google/Apple/Facebook) sign-in via Supabase, following Supabase's own
// documented React Native pattern (supabase.com/docs/guides/auth/native-mobile-deep-linking):
// Supabase generates the provider's authorize URL, we open it in the system browser via
// expo-web-browser, then manually parse the returned redirect URL's tokens and hand them to
// supabase-js. This never relies on detectSessionInUrl (there's no browser to auto-detect a
// session in) and never needs a native auth SDK, so it works today in Expo Go with no custom
// dev client — see the SSO plan for why native modules (expo-apple-authentication, native
// Google Sign-In) are deferred until a dev client exists.
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { supabase } from "./supabaseClient";

// Only meaningful when this app also runs as an Expo web target — a no-op on iOS/Android,
// but calling it unconditionally at module load matches Expo's own documented pattern.
WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = "google" | "apple" | "facebook";

export async function signInWithProvider(provider: OAuthProvider): Promise<{ error: string | null }> {
  const redirectTo = makeRedirectUri({ scheme: "proteinpound" });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) {
    return { error: error?.message ?? "Could not start sign-in." };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") {
    // User cancelled or dismissed the browser — not an error worth surfacing.
    return { error: null };
  }

  const { params, errorCode } = QueryParams.getQueryParams(result.url);
  if (errorCode) return { error: errorCode };

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) {
    return { error: "Sign-in didn't return a valid session." };
  }

  const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
  return { error: sessionError?.message ?? null };
}
