import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Meal } from "@protein-pound/shared";
import { supabase } from "../supabaseClient";

export function useSaveCustomMeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (meal: Meal) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error("Sign in to save recipes to your meals.");
      }

      const { data: savedMeal, error: mealError } = await supabase
        .from("meals")
        .insert({
          name: meal.name,
          servings: meal.servings,
          protein_g: meal.proteinG,
          kcal: meal.kcal,
          is_veggie: meal.isVeggie,
          time_label: meal.timeLabel,
          description: meal.description,
          method: meal.method,
          source: "custom",
          owner_id: userData.user.id,
          category: meal.category,
        })
        .select("id")
        .single();

      if (mealError || !savedMeal) throw new Error(mealError?.message ?? "Could not save recipe");

      const rows = meal.ingredients.map((use, index) => ({
        meal_id: savedMeal.id,
        ingredient_id: use.ingredientId,
        pack_fraction: use.packFraction,
        human_quantity: use.humanQuantity || "",
        sort_order: index,
      }));

      const { error: ingredientsError } = await supabase.from("meal_ingredients").insert(rows);
      if (ingredientsError) throw new Error(ingredientsError.message);

      return savedMeal.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meals"] });
    },
  });
}
