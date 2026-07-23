// mirrors apps/web/src/features/meals/AiEditPanel.tsx — same fork-vs-mutate logic,
// rebuilt with RN primitives.
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import type { Ingredient, Meal } from "@protein-pound/shared";
import { useGenerateRecipe } from "../../lib/queries/useGenerateRecipe";
import { useSaveGeneratedMeal } from "../../lib/queries/useSaveGeneratedMeal";
import { useUpdateCustomMeal } from "../../lib/queries/useUpdateCustomMeal";
import { recipeToMeal, mealToEditPayload } from "../../lib/recipeConversions";
import { colors } from "../../theme/tokens";

export function AiEditPanel({
  meal,
  ingredients,
  isOwner,
}: {
  meal: Meal;
  ingredients: Map<string, Ingredient>;
  isOwner: boolean;
}) {
  const [instruction, setInstruction] = useState("");
  const generate = useGenerateRecipe();
  const save = useSaveGeneratedMeal();
  const update = useUpdateCustomMeal();

  const busy = generate.isPending || save.isPending || update.isPending;
  const done = save.isSuccess || update.isSuccess;

  const handleApply = () => {
    if (!instruction.trim() || busy) return;
    save.reset();
    update.reset();

    const ingredientKeyToId = new Map<string, string>();
    for (const ing of ingredients.values()) ingredientKeyToId.set(ing.key, ing.id);

    generate.mutate(
      { prompt: instruction.trim(), editMeal: mealToEditPayload(meal, ingredients) },
      {
        onSuccess: (recipe) => {
          if (isOwner) {
            const updatedMeal = recipeToMeal(recipe, ingredientKeyToId, {
              id: meal.id,
              slug: meal.slug,
              ownerId: meal.ownerId,
              source: meal.source,
            });
            update.mutate({ mealId: meal.id, meal: updatedMeal });
          } else {
            save.mutate({ recipe, ingredientKeyToId });
          }
        },
      }
    );
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>✨ Edit with AI</Text>
      <Text style={styles.subtext}>
        {isOwner
          ? "Describe a change and it'll update this recipe in place."
          : "This isn't your recipe, so your edit saves as a new copy in My recipes — the original is left untouched."}
      </Text>
      {!done && (
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
});
