// mirrors apps/web/src/lib/queries/useCreatePortalSession.ts, but opens the returned
// Stripe portal URL via the system browser (Linking) instead of window.location — same
// "no in-app WebView for anything billing-related" rule SubscriptionGate follows, per
// the Apple Guideline 3.1.3(a) reasoning in the mobile app's billing gate.
import { useMutation } from "@tanstack/react-query";
import { Linking } from "react-native";
import { invokeFunctionOrThrow } from "../invokeFunctionOrThrow";

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: async () => {
      const { url } = await invokeFunctionOrThrow<{ url: string }>("create-portal-session");
      if (!url) throw new Error("No billing portal URL returned");
      return url;
    },
    onSuccess: (url) => {
      Linking.openURL(url);
    },
  });
}
