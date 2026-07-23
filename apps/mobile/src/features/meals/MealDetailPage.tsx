// mirrors apps/web/src/features/meals/MealDetailPage.tsx — the web version's
// document.title/meta-tag SEO block is dropped entirely, no native equivalent needed.
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import {
  buildPriceLookup,
  formatIngredientLine,
  formatPriceCheckDate,
  latestPriceCheck,
  mealCostPerServing,
  money,
  packAmountLabel,
  proteinPerPound,
  servingsLabel,
  MEAL_CATEGORY_LABELS,
} from "@protein-pound/shared";
import { useMeals } from "../../lib/queries/useMeals";
import { useStoresAndPrices } from "../../lib/queries/useStoresAndPrices";
import { useIngredients } from "../../lib/queries/useIngredients";
import { colors } from "../../theme/tokens";

export function MealDetailPage({ slug, onBack }: { slug: string; onBack: () => void }) {
  const mealsQuery = useMeals();
  const storesQuery = useStoresAndPrices();
  const ingredientsQuery = useIngredients();
  const [scaleServings, setScaleServings] = useState<string | null>(null);

  const meal = mealsQuery.data?.find((m) => m.slug === slug);

  if (mealsQuery.isLoading || storesQuery.isLoading || ingredientsQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (mealsQuery.isError || storesQuery.isError || ingredientsQuery.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.noteText}>Couldn't load this recipe.</Text>
      </View>
    );
  }
  if (!meal) {
    return (
      <View style={styles.center}>
        <Text style={styles.noteText}>Couldn't find that recipe — it may have been removed.</Text>
        <Pressable style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Back to meals</Text>
        </Pressable>
      </View>
    );
  }

  const { stores, prices } = storesQuery.data!;
  const ingredients = ingredientsQuery.data!;
  const priceLookup = buildPriceLookup(prices);
  const perServing = mealCostPerServing(meal, priceLookup, null);
  const valuePerPound = proteinPerPound(perServing, meal.proteinG);
  const lastChecked = latestPriceCheck(prices);

  const servings = Math.max(1, Number(scaleServings) || meal.servings);
  const isScaled = servings !== meal.servings;
  const scaleFactor = meal.servings > 0 ? servings / meal.servings : 1;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Pressable style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>← Back to meals</Text>
      </Pressable>

      <View style={styles.badgeRow}>
        {meal.source !== "builtin" && <Badge text={meal.source === "ai" ? "✨ AI" : "Yours"} />}
        {meal.isVeggie && <Badge text="Veggie" />}
        <Badge text={MEAL_CATEGORY_LABELS[meal.category]} />
        <Badge text={servingsLabel(meal.servings)} />
      </View>
      <Text style={styles.title}>{meal.name}</Text>
      <Text style={styles.desc}>{meal.description}</Text>
      <View style={styles.statsRow}>
        <Text style={styles.statText}>
          <Text style={styles.statBold}>{meal.proteinG}g</Text> protein / serving
        </Text>
        <Text style={styles.statText}>
          <Text style={styles.statBold}>{meal.kcal}</Text> kcal
        </Text>
        {!!meal.timeLabel && <Text style={styles.statText}>{meal.timeLabel}</Text>}
      </View>

      <View style={styles.tagRow}>
        <View>
          <Text style={styles.bigValue}>{money(perServing)}</Text>
          <Text style={styles.smallLabel}>per serving · cheapest mix</Text>
        </View>
        <View>
          <Text style={styles.bigValue}>{valuePerPound.toFixed(0)}g</Text>
          <Text style={styles.smallLabel}>protein per £1</Text>
        </View>
      </View>

      <View style={styles.recipeBlock}>
        <Text style={styles.recipeHeading}>
          Recipe · {meal.timeLabel ?? "—"} · serves {meal.servings}
        </Text>
        <View style={styles.scaleRow}>
          <Text style={styles.filterLabel}>Cooking for</Text>
          <TextInput
            style={styles.scaleInput}
            keyboardType="number-pad"
            value={scaleServings ?? String(meal.servings)}
            onChangeText={setScaleServings}
          />
          <Text style={styles.smallLabel}>servings</Text>
        </View>
        {isScaled && (
          <Text style={styles.scaledNote}>
            For {servings} servings: {money(perServing * servings)} total ·{" "}
            {Math.round(meal.kcal * servings).toLocaleString()} kcal · {Math.round(meal.proteinG * servings)}g protein
          </Text>
        )}
        {meal.ingredients.map((use) => {
          const name = ingredients.get(use.ingredientId)?.name ?? "ingredient";
          return (
            <Text key={use.ingredientId} style={styles.listItem}>
              • {formatIngredientLine(use.humanQuantity, name)}
              {isScaled && (
                <Text style={styles.faintText}> — {packAmountLabel(use.packFraction * scaleFactor)} for {servings}</Text>
              )}
            </Text>
          );
        })}
        {meal.method.length > 0 &&
          meal.method.map((step, i) => (
            <Text key={i} style={styles.listItem}>
              {i + 1}. {step}
            </Text>
          ))}
      </View>

      <View style={styles.priceTable}>
        {meal.ingredients.map((use) => {
          const ing = ingredients.get(use.ingredientId);
          const costs = stores.map((s) => (priceLookup.get(use.ingredientId)?.get(s.id) ?? 0) * use.packFraction);
          const lo = Math.min(...costs);
          return (
            <View key={use.ingredientId} style={styles.priceRow}>
              <Text style={styles.priceRowName}>{ing?.name ?? "Ingredient"}</Text>
              <View style={styles.priceRowCosts}>
                {costs.map((c, i) => (
                  <Text key={i} style={[styles.priceCell, c === lo && styles.priceCellLo]}>
                    {stores[i].name}: {money(c)}
                  </Text>
                ))}
              </View>
            </View>
          );
        })}
      </View>
      {lastChecked && <Text style={styles.lastChecked}>Prices last checked {formatPriceCheckDate(lastChecked)}</Text>}
    </ScrollView>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  noteText: { fontSize: 13, color: colors.muted, textAlign: "center", marginBottom: 12 },
  backBtn: { marginBottom: 16 },
  backBtnText: { fontSize: 13, fontWeight: "700", color: colors.ink },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  badge: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "700", color: colors.ink },
  title: { fontSize: 24, fontWeight: "800", color: colors.ink, marginBottom: 4 },
  desc: { fontSize: 13, color: colors.muted, marginBottom: 12 },
  statsRow: { flexDirection: "row", gap: 14, marginBottom: 14 },
  statText: { fontSize: 12, color: colors.muted },
  statBold: { fontWeight: "700", color: colors.ink },
  tagRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  bigValue: { fontSize: 22, fontWeight: "800", color: colors.ink },
  smallLabel: { fontSize: 11, color: colors.muted },
  recipeBlock: { marginBottom: 16 },
  recipeHeading: { fontSize: 14, fontWeight: "700", color: colors.ink, marginBottom: 8 },
  filterLabel: { fontSize: 10, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
  scaleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  scaleInput: {
    width: 50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 13,
    color: colors.ink,
  },
  scaledNote: {
    fontSize: 12,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  listItem: { fontSize: 13, color: colors.ink, marginBottom: 4, lineHeight: 18 },
  faintText: { color: colors.faint },
  priceTable: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    padding: 12,
  },
  priceRow: { marginBottom: 8 },
  priceRowName: { fontSize: 12, fontWeight: "700", color: colors.ink, marginBottom: 2 },
  priceRowCosts: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  priceCell: { fontSize: 12, color: colors.muted },
  priceCellLo: { color: colors.green, fontWeight: "700" },
  lastChecked: { fontSize: 11, color: colors.faint, marginTop: 8 },
});
