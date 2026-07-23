// mirrors apps/web/src/features/generate/GeneratePage.tsx — same generation/save logic,
// rebuilt with RN primitives.
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import {
  buildPriceLookup,
  formatIngredientLine,
  formatPriceCheckDate,
  latestPriceCheck,
  mealCostPerServing,
  money,
  proteinPerPound,
  servingsLabel,
  MEAL_CATEGORY_LABELS,
} from "@protein-pound/shared";
import { useIngredients } from "../../lib/queries/useIngredients";
import { useStoresAndPrices } from "../../lib/queries/useStoresAndPrices";
import { useGenerateRecipe } from "../../lib/queries/useGenerateRecipe";
import { useSaveGeneratedMeal } from "../../lib/queries/useSaveGeneratedMeal";
import { recipeToMeal } from "../../lib/recipeConversions";
import { colors } from "../../theme/tokens";

const EXAMPLE_PROMPTS = [
  "Cheap veggie dinner, at least 25g protein",
  "Something with tuna I can batch cook for lunches",
  "A big breakfast under 400 kcal",
];

export function GeneratePage() {
  const [prompt, setPrompt] = useState("");
  const ingredientsQuery = useIngredients();
  const storesQuery = useStoresAndPrices();
  const generate = useGenerateRecipe();
  const save = useSaveGeneratedMeal();

  const handleGenerate = () => {
    if (!prompt.trim() || generate.isPending) return;
    save.reset();
    generate.mutate({ prompt: prompt.trim() });
  };

  if (ingredientsQuery.isLoading || storesQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (ingredientsQuery.isError || storesQuery.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.noteText}>Couldn't load the ingredient database.</Text>
      </View>
    );
  }

  const ingredients = ingredientsQuery.data!;
  const { stores, prices } = storesQuery.data!;
  const priceLookup = buildPriceLookup(prices);
  const lastChecked = latestPriceCheck(prices);
  const ingredientKeyToId = new Map<string, string>();
  for (const ing of ingredients.values()) ingredientKeyToId.set(ing.key, ing.id);

  const recipe = generate.data;
  const meal = recipe ? recipeToMeal(recipe, ingredientKeyToId) : null;
  const perServing = meal ? mealCostPerServing(meal, priceLookup, null) : 0;
  const valuePerPound = meal ? proteinPerPound(perServing, meal.proteinG) : 0;
  const storeCosts = meal
    ? stores.map((s) => ({
        store: s,
        cost: meal.ingredients.reduce(
          (sum, use) => sum + (priceLookup.get(use.ingredientId)?.get(s.id) ?? 0) * use.packFraction,
          0
        ),
      }))
    : [];
  const cheapestStoreCost = storeCosts.length ? Math.min(...storeCosts.map((s) => s.cost)) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.heading}>✨ Generate a recipe</Text>
      <Text style={styles.subtext}>
        Describe what you fancy and Gemini invents a recipe on the spot using the priced ingredient database.
      </Text>

      <Text style={styles.fieldLabel}>What do you fancy?</Text>
      <View style={styles.promptRow}>
        <TextInput
          style={styles.promptInput}
          value={prompt}
          onChangeText={setPrompt}
          placeholder='e.g. "high-protein dinner under £1.50"'
          onSubmitEditing={handleGenerate}
        />
        <Pressable style={[styles.generateBtn, generate.isPending && styles.btnDisabled]} onPress={handleGenerate} disabled={generate.isPending}>
          {generate.isPending ? <ActivityIndicator color={colors.paper} size="small" /> : <Text style={styles.generateBtnText}>Generate</Text>}
        </Pressable>
      </View>

      <View style={styles.pillRow}>
        {EXAMPLE_PROMPTS.map((ex) => (
          <Pressable key={ex} style={styles.pill} onPress={() => setPrompt(ex)}>
            <Text style={styles.pillText}>{ex}</Text>
          </Pressable>
        ))}
      </View>

      {generate.isError && (
        <Text style={styles.errorText}>
          {generate.error instanceof Error ? generate.error.message : "Something went wrong."}
        </Text>
      )}

      {meal && (
        <View style={styles.card}>
          <View style={styles.badgeRow}>
            <Badge text="✨ AI" />
            {meal.isVeggie && <Badge text="Veggie" />}
            <Badge text={MEAL_CATEGORY_LABELS[meal.category]} />
            <Badge text={servingsLabel(meal.servings)} />
          </View>
          <Text style={styles.mealName}>{meal.name}</Text>
          <Text style={styles.mealDesc}>{meal.description}</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statText}>
              <Text style={styles.statBold}>{meal.proteinG}g</Text> protein / serving
            </Text>
            <Text style={styles.statText}>
              <Text style={styles.statBold}>{meal.kcal}</Text> kcal
            </Text>
            <Text style={styles.statText}>{meal.timeLabel}</Text>
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

          <Text style={styles.recipeHeading}>
            Recipe · {meal.timeLabel} · serves {meal.servings}
          </Text>
          {meal.ingredients.map((use) => {
            const ing = ingredients.get(use.ingredientId);
            return (
              <Text key={use.ingredientId} style={styles.listItem}>
                • {formatIngredientLine(use.humanQuantity, ing?.name ?? "ingredient")}
              </Text>
            );
          })}
          {meal.method.map((step, i) => (
            <Text key={i} style={styles.listItem}>
              {i + 1}. {step}
            </Text>
          ))}

          <View style={styles.priceTable}>
            {storeCosts.map(({ store, cost }) => (
              <Text key={store.id} style={[styles.priceCell, cost === cheapestStoreCost && styles.priceCellLo]}>
                {store.name}: {money(cost)}
              </Text>
            ))}
          </View>
          {lastChecked && <Text style={styles.lastChecked}>Prices last checked {formatPriceCheckDate(lastChecked)}</Text>}

          {save.isError && (
            <Text style={styles.errorText}>
              {save.error instanceof Error ? save.error.message : "Could not save recipe."}
            </Text>
          )}
          {save.isSuccess && <Text style={styles.okText}>Saved — it's now in your Meals list.</Text>}

          <View style={styles.actionsRow}>
            <ActionBtn label="Try another" onPress={() => generate.mutate({ prompt: prompt.trim() })} disabled={generate.isPending} />
            <ActionBtn label="Discard" onPress={() => generate.reset()} />
            <ActionBtn
              label={save.isPending ? "Saving…" : "Save to my meals"}
              onPress={() => save.mutate({ recipe: recipe!, ingredientKeyToId })}
              disabled={save.isPending || save.isSuccess}
              primary
            />
          </View>
        </View>
      )}

      {!meal && !generate.isPending && !generate.isError && (
        <Text style={styles.emptyText}>
          Your generated recipe will appear here — priced per supermarket, with macros and a full method.
        </Text>
      )}
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

function ActionBtn({
  label,
  onPress,
  disabled,
  primary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      style={[styles.actionBtn, primary && styles.actionBtnPrimary, disabled && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.actionBtnText, primary && styles.actionBtnTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  noteText: { fontSize: 13, color: colors.muted },
  heading: { fontSize: 22, fontWeight: "800", color: colors.ink, marginBottom: 4 },
  subtext: { fontSize: 13, color: colors.muted, marginBottom: 16 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginBottom: 6 },
  promptRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  promptInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  generateBtn: { backgroundColor: colors.ink, borderRadius: 6, paddingHorizontal: 16, justifyContent: "center" },
  generateBtnText: { color: colors.paper, fontSize: 13, fontWeight: "700" },
  btnDisabled: { opacity: 0.6 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  pill: { borderWidth: 1, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontSize: 12, fontWeight: "600", color: colors.ink },
  errorText: { fontSize: 12.5, color: colors.deal, marginBottom: 14, fontWeight: "600" },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 14 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  badge: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "700", color: colors.ink },
  mealName: { fontSize: 18, fontWeight: "800", color: colors.ink, marginBottom: 2 },
  mealDesc: { fontSize: 13, color: colors.muted, marginBottom: 8 },
  statsRow: { flexDirection: "row", gap: 14, marginBottom: 10 },
  statText: { fontSize: 12, color: colors.muted },
  statBold: { fontWeight: "700", color: colors.ink },
  tagRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: colors.paper, borderRadius: 6, padding: 10, marginBottom: 10 },
  bigValue: { fontSize: 20, fontWeight: "800", color: colors.ink },
  smallLabel: { fontSize: 11, color: colors.muted },
  recipeHeading: { fontSize: 13, fontWeight: "700", color: colors.ink, marginBottom: 8 },
  listItem: { fontSize: 13, color: colors.ink, marginBottom: 4, lineHeight: 18 },
  priceTable: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10, marginBottom: 8 },
  priceCell: { fontSize: 12, color: colors.muted },
  priceCellLo: { color: colors.green, fontWeight: "700" },
  lastChecked: { fontSize: 11, color: colors.faint, marginBottom: 8 },
  okText: { fontSize: 12.5, color: colors.green, marginBottom: 8 },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  actionBtn: { borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 },
  actionBtnPrimary: { backgroundColor: colors.ink, borderColor: colors.ink },
  actionBtnText: { fontSize: 12, fontWeight: "600", color: colors.ink },
  actionBtnTextPrimary: { color: colors.paper },
  emptyText: { fontSize: 13, color: colors.muted },
});
