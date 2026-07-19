import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Meal } from "@protein-pound/shared";
import { supabase } from "../supabaseClient";

interface UpdateCustomMealParams {
  mealId: string;
  meal: Meal;
}

export function useUpdateCustomMeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mealId, meal }: UpdateCustomMealParams) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error("Sign in to edit your recipes.");
      }

      const { error: updateError } = await supabase
        .from("meals")
        .update({
          name: meal.name,
          servings: meal.servings,
          protein_g: meal.proteinG,
          kcal: meal.kcal,
          is_veggie: meal.isVeggie,
          time_label: meal.timeLabel,
          description: meal.description,
          method: meal.method,
          category: meal.category,
        })
        .eq("id", mealId);
      if (updateError) throw new Error(updateError.message);

      // Ingredients are always fully replaced together rather than diffed — simpler and
      // correct since the builder always submits the complete current ingredient list.
      const { error: deleteError } = await supabase.from("meal_ingredients").delete().eq("meal_id", mealId);
      if (deleteError) throw new Error(deleteError.message);

      const rows = meal.ingredients.map((use, index) => ({
        meal_id: mealId,
        ingredient_id: use.ingredientId,
        pack_fraction: use.packFraction,
        human_quantity: use.humanQuantity,
        sort_order: index,
      }));
      const { error: insertError } = await supabase.from("meal_ingredients").insert(rows);
      if (insertError) throw new Error(insertError.message);

      return mealId;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meals"] }),
  });
}
