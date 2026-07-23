// A dedicated, full-brand sign-in screen — replaces the plain centered form that used to
// live inline in App.tsx's Root component. Mirrors apps/web/src/features/landing/LandingPage.tsx's
// hero copy/feature bullets so first impressions match across platforms, using the same
// Barlow Condensed display font (see theme/tokens.ts) for the wordmark.
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, Pressable, Linking } from "react-native";
import { AuthForm } from "./AuthForm";
import { colors, displayFont } from "../../theme/tokens";

const FEATURES = [
  "Compare prices across Tesco, Aldi, Asda, Sainsbury's and Morrisons",
  "Plan your week and track calories, protein and budget",
  "Generate new recipes with AI, already costed at every supermarket",
  "Price your own recipes against the same ingredient database",
];

export function LoginScreen() {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.title}>
            Protein<Text style={styles.titleSlash}>/</Text>Pound
          </Text>
          <Text style={styles.subtitle}>
            High-protein UK meals ranked by what they actually cost at the till.
          </Text>
          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Text style={styles.featureArrow}>→</Text>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in to get started</Text>
          <AuthForm />
        </View>

        <View style={styles.legalRow}>
          <Pressable onPress={() => Linking.openURL("https://protein-pound.vercel.app/terms")}>
            <Text style={styles.legalLink}>Terms of Service</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable onPress={() => Linking.openURL("https://protein-pound.vercel.app/privacy")}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 48, paddingBottom: 32 },
  hero: { marginBottom: 28 },
  title: {
    fontFamily: displayFont.extraBold,
    fontSize: 44,
    lineHeight: 44,
    color: colors.ink,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  titleSlash: { color: colors.deal },
  subtitle: { fontSize: 15.5, color: colors.muted, lineHeight: 21, marginBottom: 20 },
  features: { gap: 10 },
  featureRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  featureArrow: { color: colors.deal, fontWeight: "700", fontSize: 14, lineHeight: 19 },
  featureText: { flex: 1, fontSize: 13.5, color: colors.ink, lineHeight: 19 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 20,
  },
  cardTitle: {
    fontFamily: displayFont.extraBold,
    fontSize: 20,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    color: colors.ink,
    marginBottom: 14,
  },
  legalRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 24 },
  legalLink: { fontSize: 11, color: colors.faint, textDecorationLine: "underline" },
  legalDot: { fontSize: 11, color: colors.faint },
});
