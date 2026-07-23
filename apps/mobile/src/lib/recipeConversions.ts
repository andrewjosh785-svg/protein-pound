// mirrors apps/web/src/lib/recipeConversions.ts — pure converters, no browser APIs.
import type { Ingredient, Meal } from "@protein-pound/shared";
import type { GeneratedRecipeResult } from "./queries/useGenerateRecipe";

export function recipeToMeal(
  recipe: GeneratedRecipeResult,
  ingredientKeyToId: Map<string, string>,
  overrides?: Partial<Pick<Meal, "id" | "slug" | "ownerId" | "source">>
): Meal {
  return {
    id: overrides?.id ?? "generated",
    slug: overrides?.slug ?? "generated",
    name: recipe.name,
    servings: recipe.servings,
    proteinG: recipe.protein,
    kcal: recipe.kcal,
    isVeggie: recipe.veggie,
    timeLabel: recipe.time,
    description: recipe.desc,
    method: recipe.method,
    source: overrides?.source ?? "ai",
    ownerId: overrides?.ownerId ?? null,
    category: recipe.category,
    ingredients: recipe.uses
      .map(([key, fraction, humanQuantity], index) => {
        const ingredientId = ingredientKeyToId.get(key);
        if (!ingredientId) return null;
        return { ingredientId, packFraction: fraction, humanQuantity, sortOrder: index };
      })
      .filter((use): use is NonNullable<typeof use> => use !== null),
  };
}

export function mealToEditPayload(meal: Meal, ingredients: Map<string, Ingredient>): GeneratedRecipeResult {
  return {
    name: meal.name,
    desc: meal.description,
    servings: meal.servings,
    protein: meal.proteinG,
    kcal: meal.kcal,
    veggie: meal.isVeggie,
    time: meal.timeLabel ?? "",
    category: meal.category,
    uses: meal.ingredients.map((use) => [
      ingredients.get(use.ingredientId)?.key ?? "",
      use.packFraction,
      use.humanQuantity,
    ]),
    method: meal.method,
  };
}
