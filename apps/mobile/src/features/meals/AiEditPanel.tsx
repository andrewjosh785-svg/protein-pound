// mirrors apps/web/src/features/meals/AiEditPanel.tsx — same fork-vs-mutate logic plus the
// before/after delta + implausible-macro guard + retry, rebuilt with RN primitives.
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { mealCostPerServing, money, type Ingredient, type Meal, type PriceLookup } from "@protein-pound/shared";
import { useGenerateRecipe } from "../../lib/queries/useGenerateRecipe";
import { useSaveGeneratedMeal } from "../../lib/queries/useSaveGeneratedMeal";
import { useUpdateCustomMeal } from "../../lib/queries/useUpdateCustomMeal";
import { recipeToMeal, mealToEditPayload } from "../../lib/recipeConversions";
import { colors } from "../../theme/tokens";

interface Delta {
  proteinG: number;
  carbsG: number;
  fatG: number;
  kcal: number;
  cost: number;
}

function detectExpectedDirection(instruction: string): { expectCheaper: boolean; expectMoreProtein: boolean } {
  const lower = instruction.toLowerCase();
  return {
    expectCheaper: /cheap|cheaper|budget|less expensive/.test(lower),
    expectMoreProtein: /protein/.test(lower) && /(more|higher|increase|boost|extra|up)/.test(lower),
  };
}

function fmtDelta(before: number, after: number, unit: string, decimals = 0): string {
  const diff = after - before;
  const sign = diff > 0 ? "+" : "";
  return `${before.toFixed(decimals)}${unit} → ${after.toFixed(decimals)}${unit} (${sign}${diff.toFixed(decimals)}${unit})`;
}

export function AiEditPanel({
  meal,
  ingredients,
  priceLookup,
  isOwner,
}: {
  meal: Meal;
  ingredients: Map<string, Ingredient>;
  priceLookup: PriceLookup;
  isOwner: boolean;
}) {
  const [instruction, setInstruction] = useState("");
  const [lastInstruction, setLastInstruction] = useState("");
  const [flag, setFlag] = useState<string | null>(null);
  const [delta, setDelta] = useState<{ before: Delta; after: Delta } | null>(null);
  const generate = useGenerateRecipe();
  const save = useSaveGeneratedMeal();
  const update = useUpdateCustomMeal();

  const busy = generate.isPending || save.isPending || update.isPending;
  const done = (save.isSuccess || update.isSuccess) && !flag;

  const runInstruction = (instructionText: string) => {
    if (!instructionText.trim() || busy) return;
    save.reset();
    update.reset();
    setFlag(null);
    setDelta(null);
    setLastInstruction(instructionText.trim());

    const ingredientKeyToId = new Map<string, string>();
    for (const ing of ingredients.values()) ingredientKeyToId.set(ing.key, ing.id);

    const before: Delta = {
      proteinG: meal.proteinG,
      carbsG: meal.carbsG,
      fatG: meal.fatG,
      kcal: meal.kcal,
      cost: mealCostPerServing(meal, priceLookup, null),
    };

    generate.mutate(
      { prompt: instructionText.trim(), editMeal: mealToEditPayload(meal, ingredients) },
      {
        onSuccess: (recipe) => {
          const updatedMeal = recipeToMeal(recipe, ingredientKeyToId, {
            id: meal.id,
            slug: meal.slug,
            ownerId: meal.ownerId,
            source: meal.source,
          });
          const after: Delta = {
            proteinG: updatedMeal.proteinG,
            carbsG: updatedMeal.carbsG,
            fatG: updatedMeal.fatG,
            kcal: updatedMeal.kcal,
            cost: mealCostPerServing(updatedMeal, priceLookup, null),
          };
          setDelta({ before, after });

          if (after.carbsG === 0 && after.fatG === 0) {
            setFlag("This result shows 0g carbs and 0g fat, which isn't realistic — try again.");
            return;
          }

          const { expectCheaper, expectMoreProtein } = detectExpectedDirection(instructionText);
          if (expectCheaper && after.cost > before.cost + 0.005) {
            setFlag("You asked for cheaper, but this actually costs more per serving.");
          } else if (expectMoreProtein && after.proteinG < before.proteinG) {
            setFlag("You asked for more protein, but this has less.");
          }

          if (isOwner) {
            update.mutate({ mealId: meal.id, meal: updatedMeal });
          } else {
            save.mutate({ recipe, ingredientKeyToId });
          }
        },
      }
    );
  };

  const handleApply = () => runInstruction(instruction);
  const handleRetry = () => runInstruction(lastInstruction);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>✨ Edit with AI</Text>
      <Text style={styles.subtext}>
        {isOwner
          ? "Describe a change and it'll update this recipe in place."
          : "This isn't your recipe, so your edit saves as a new copy in My recipes — the original is left untouched."}
      </Text>
      {!done && !flag && (
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={instruction}
            onChangeText={setInstruction}
            placeholder='e.g. "swap chicken for tofu"'
            onSubmitEditing={handleApply}
          />
          <Pressable style={[styles.applyBtn, busy && styles.applyBtnDisabled]} onPress={handleApply} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.paper} size="small" /> : <Text style={styles.applyBtnText}>Apply</Text>}
          </Pressable>
        </View>
      )}
      {generate.isError && (
        <Text style={styles.errorText}>
          {generate.error instanceof Error ? generate.error.message : "Something went wrong."}
        </Text>
      )}
      {(save.isError || update.isError) && (
        <Text style={styles.errorText}>Generated the edit, but couldn't save it — try again.</Text>
      )}
      {flag && (
        <View style={styles.flagBox}>
          <Text style={styles.flagText}>{flag}</Text>
          <Pressable style={[styles.retryBtn, busy && styles.applyBtnDisabled]} onPress={handleRetry} disabled={busy}>
            {busy ? <ActivityIndicator size="small" /> : <Text style={styles.retryBtnText}>Try again</Text>}
          </Pressable>
        </View>
      )}
      {delta && (done || flag) && (
        <Text style={styles.deltaText}>
          {money(delta.before.cost)} → {money(delta.after.cost)} / serving ·{" "}
          {fmtDelta(delta.before.proteinG, delta.after.proteinG, "g")} protein ·{" "}
          {fmtDelta(delta.before.carbsG, delta.after.carbsG, "g")} carbs ·{" "}
          {fmtDelta(delta.before.fatG, delta.after.fatG, "g")} fat ·{" "}
          {fmtDelta(delta.before.kcal, delta.after.kcal, "")} kcal
        </Text>
      )}
      {done && (
        <Text style={styles.okText}>{isOwner ? "Recipe updated." : "Saved as a new recipe in My recipes."}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 12, padding: 12, borderTopWidth: 1, borderTopColor: colors.line },
  heading: { fontSize: 14, fontWeight: "700", color: colors.ink, marginBottom: 4 },
  subtext: { fontSize: 12, color: colors.muted, marginBottom: 10 },
  row: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.ink,
  },
  applyBtn: { backgroundColor: colors.ink, borderRadius: 6, paddingHorizontal: 16, justifyContent: "center" },
  applyBtnDisabled: { opacity: 0.6 },
  applyBtnText: { color: colors.paper, fontSize: 13, fontWeight: "700" },
  errorText: { fontSize: 12, color: colors.deal, marginTop: 8 },
  okText: { fontSize: 12, color: colors.green, marginTop: 8 },
  flagBox: {
    marginTop: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.deal,
    borderRadius: 6,
  },
  flagText: { fontSize: 12.5, fontWeight: "700", color: colors.deal, marginBottom: 8 },
  retryBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryBtnText: { fontSize: 13, fontWeight: "700", color: colors.ink },
  deltaText: { fontSize: 11.5, color: colors.muted, marginTop: 8, lineHeight: 17 },
});
