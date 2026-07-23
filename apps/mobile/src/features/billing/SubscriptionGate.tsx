// Deliberately neutral, not a paywall/marketing screen — see the plan's Apple
// Guideline 3.1.3(a) "Multiplatform Services" reasoning. No pricing, no feature bullets,
// no persuasive copy; just a plain statement of fact and an understated link out to the
// web, opened via the full system browser (Linking.openURL, not an in-app WebView) so
// there's no in-app purchase flow of any kind for App Review to scrutinize.
import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { colors } from "../../theme/tokens";
import { supabase } from "../../lib/supabaseClient";

const MANAGE_URL = "https://protein-pound.vercel.app/";

export function SubscriptionGate() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Protein/Pound</Text>
      <Text style={styles.body}>No active subscription found for this account.</Text>
      <Pressable onPress={() => Linking.openURL(MANAGE_URL)}>
        <Text style={styles.link}>Manage subscription</Text>
      </Pressable>
      <Pressable style={styles.signOutBtn} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: 24, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "800", color: colors.ink, marginBottom: 16 },
  body: { fontSize: 14, color: colors.muted, marginBottom: 12 },
  link: { fontSize: 13, fontWeight: "600", color: colors.ink, textDecorationLine: "underline" },
  signOutBtn: { marginTop: 24 },
  signOutText: { fontSize: 12, fontWeight: "700", color: colors.deal, textDecorationLine: "underline" },
});
