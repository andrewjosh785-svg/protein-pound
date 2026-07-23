// Shown once, right after a new (or returning-but-never-seen-it) user first reaches
// AppShell — a brand-new account has no meals of their own, no week plan, and no idea
// what the four tabs do, so this gives a one-screen orientation before they're dropped
// into the app. Dismissing sets a local AsyncStorage flag (see ../../lib/onboarding.ts)
// so it never shows again on this device.
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/tokens";

const STEPS: Array<{ icon: keyof typeof Ionicons.glyphMap; title: string; body: string }> = [
  {
    icon: "restaurant-outline",
    title: "Meals",
    body: "Browse a library of meals ranked by protein-per-£, or filter to just the ones you've built.",
  },
  {
    icon: "calendar-outline",
    title: "Week",
    body: "Plan out your week, log snacks and extras (including a barcode scan), and get a shopping list.",
  },
  {
    icon: "sparkles-outline",
    title: "Generate",
    body: "Ask AI for a new recipe — it's automatically costed against every meal already in the app.",
  },
  {
    icon: "create-outline",
    title: "Recipe",
    body: "Price your own recipe from scratch using the same ingredient database.",
  },
];

export function OnboardingOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Welcome to Protein/Pound</Text>
          <Text style={styles.subtitle}>Here's what each tab does</Text>

          {STEPS.map((step) => (
            <View key={step.title} style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons name={step.icon} size={20} color={colors.ink} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{step.title}</Text>
                <Text style={styles.rowBody}>{step.body}</Text>
              </View>
            </View>
          ))}

          <Pressable style={styles.button} onPress={onDismiss}>
            <Text style={styles.buttonText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.paper,
    borderRadius: 16,
    padding: 22,
  },
  title: { fontSize: 19, fontWeight: "800", color: colors.ink, marginBottom: 2, textAlign: "center" },
  subtitle: { fontSize: 12.5, color: colors.muted, marginBottom: 18, textAlign: "center" },
  row: { flexDirection: "row", gap: 12, marginBottom: 16, alignItems: "flex-start" },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: "700", color: colors.ink, marginBottom: 2 },
  rowBody: { fontSize: 12.5, color: colors.muted, lineHeight: 17 },
  button: {
    marginTop: 6,
    backgroundColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: { color: colors.paper, fontSize: 14, fontWeight: "700" },
});
