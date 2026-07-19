import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import type { GeneratedRecipeResult } from "./useGenerateRecipe";

interface SaveGeneratedMealParams {
  recipe: GeneratedRecipeResult;
  ingredientKeyToId: Map<string, string>;
}

export function useSaveGeneratedMeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ recipe, ingredientKeyToId }: SaveGeneratedMealParams) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error("Sign in to save recipes to your meals.");
      }

      const { data: meal, error: mealError } = await supabase
        .from("meals")
        .insert({
          name: recipe.name,
          servings: recipe.servings,
          protein_g: recipe.protein,
          kcal: recipe.kcal,
          is_veggie: recipe.veggie,
          time_label: recipe.time,
          description: recipe.desc,
          method: recipe.method,
          source: "ai",
          owner_id: userData.user.id,
          category: recipe.category,
        })
        .select("id")
        .single();

      if (mealError || !meal) throw new Error(mealError?.message ?? "Could not save recipe");

      const rows = recipe.uses
        .map(([key, fraction, humanQuantity], index) => {
          const ingredientId = ingredientKeyToId.get(key);
          if (!ingredientId) return null;
          return {
            meal_id: meal.id,
            ingredient_id: ingredientId,
            pack_fraction: fraction,
            human_quantity: humanQuantity,
            sort_order: index,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      const { error: ingredientsError } = await supabase.from("meal_ingredients").insert(rows);
      if (ingredientsError) throw new Error(ingredientsError.message);

      return meal.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meals"] });
    },
  });
}
