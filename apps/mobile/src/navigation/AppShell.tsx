// Simple state-based tab switching, deliberately not Expo Router — the web app itself
// has no real router either (App.tsx hand-rolls window.location/popstate tab-switching),
// so this mirrors that same level of simplicity rather than introducing new navigation
// architecture the source app doesn't have. Bottom tabs will grow as more phases land
// (Generate, Recipe builder, Week); Meals is the only one wired up so far.
import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { Meal } from "@protein-pound/shared";
import { MealsPage } from "../features/meals/MealsPage";
import { MealDetailPage } from "../features/meals/MealDetailPage";
import { RecipeBuilderPage } from "../features/recipe-builder/RecipeBuilderPage";
import { GeneratePage } from "../features/generate/GeneratePage";
import { WeekPage } from "../features/week/WeekPage";
import { OnboardingOverlay } from "../features/onboarding/OnboardingOverlay";
import { supabase } from "../lib/supabaseClient";
import { useCreatePortalSession } from "../lib/queries/useCreatePortalSession";
import { hasSeenOnboarding, markOnboardingSeen } from "../lib/onboarding";
import { colors } from "../theme/tokens";

type Tab = "meals" | "build" | "generate" | "week";

const TAB_CONFIG: Array<{ id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: "meals", label: "Meals", icon: "restaurant-outline" },
  { id: "week", label: "Week", icon: "calendar-outline" },
  { id: "generate", label: "Generate", icon: "sparkles-outline" },
  { id: "build", label: "Recipe", icon: "create-outline" },
];

export function AppShell({ userEmail }: { userEmail: string | undefined }) {
  const [tab, setTab] = useState<Tab>("meals");
  const [openMealSlug, setOpenMealSlug] = useState<string | null>(null);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const insets = useSafeAreaInsets();
  const portal = useCreatePortalSession();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    hasSeenOnboarding().then((seen) => {
      if (!seen) setShowOnboarding(true);
    });
  }, []);

  return (
    // edges=['top'] only — the tab bar handles its own bottom inset below, with its own
    // background colour, so the surface colour extends all the way to the physical
    // bottom edge instead of leaving an uncoloured gap under the home indicator.
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.brand}>Protein/Pound</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => portal.mutate()} disabled={portal.isPending}>
            <Text style={styles.manageLink}>{portal.isPending ? "Opening…" : "Manage subscription"}</Text>
          </Pressable>
          <Pressable onPress={() => supabase.auth.signOut()}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>
      </View>
      {portal.isError && (
        <Text style={styles.portalError}>
          {portal.error instanceof Error ? portal.error.message : "Couldn't open billing portal."}
        </Text>
      )}

      <View style={styles.content}>
        {openMealSlug ? (
          <MealDetailPage slug={openMealSlug} onBack={() => setOpenMealSlug(null)} />
        ) : tab === "meals" ? (
          <MealsPage
            onOpenMeal={(meal: Meal) => setOpenMealSlug(meal.slug)}
            onEditMeal={(meal: Meal) => {
              setEditingMeal(meal);
              setTab("build");
            }}
          />
        ) : tab === "build" ? (
          <RecipeBuilderPage
            editingMeal={editingMeal}
            onDoneEditing={() => {
              setEditingMeal(null);
              setTab("meals");
            }}
          />
        ) : tab === "generate" ? (
          <GeneratePage />
        ) : (
          <WeekPage />
        )}
      </View>

      <View style={[styles.tabBar, { paddingBottom: insets.bottom + 4 }]}>
        {TAB_CONFIG.map(({ id, label, icon }) => {
          const active = tab === id;
          return (
            <Pressable
              key={id}
              style={styles.tabBtn}
              onPress={() => {
                setOpenMealSlug(null);
                if (id !== "build") setEditingMeal(null);
                setTab(id);
              }}
            >
              <View style={[styles.tabIconWrap, active && styles.tabIconWrapOn]}>
                <Ionicons name={icon} size={22} color={active ? colors.paper : colors.muted} />
              </View>
              <Text style={[styles.tabLabel, active && styles.tabLabelOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {showOnboarding && (
        <OnboardingOverlay
          onDismiss={() => {
            setShowOnboarding(false);
            markOnboardingSeen();
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  brand: { fontSize: 16, fontWeight: "800", color: colors.ink },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  manageLink: { fontSize: 11.5, fontWeight: "700", color: colors.muted, textDecorationLine: "underline" },
  signOut: { fontSize: 12, fontWeight: "700", color: colors.deal, textDecorationLine: "underline" },
  portalError: {
    fontSize: 11.5,
    color: colors.deal,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  content: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    paddingTop: 10,
    paddingBottom: 8,
  },
  tabBtn: { flex: 1, alignItems: "center", gap: 5, paddingVertical: 6 },
  tabIconWrap: {
    width: 44,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconWrapOn: { backgroundColor: colors.ink },
  tabLabel: { fontSize: 11.5, fontWeight: "600", color: colors.muted },
  tabLabelOn: { color: colors.ink, fontWeight: "800" },
});
