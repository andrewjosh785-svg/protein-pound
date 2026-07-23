// mirrors apps/web/src/lib/queries/useGenerateRecipe.ts
import { useMutation } from "@tanstack/react-query";
import type { MealCategory } from "@protein-pound/shared";
import { supabase } from "../supabaseClient";

export interface GeneratedRecipeResult {
  name: string;
  desc: string;
  servings: number;
  protein: number;
  kcal: number;
  veggie: boolean;
  time: string;
  category: MealCategory;
  uses: Array<[string, number, string]>;
  method: string[];
}

export interface GenerateRecipeParams {
  prompt: string;
  editMeal?: GeneratedRecipeResult;
}

export function useGenerateRecipe() {
  return useMutation({
    mutationFn: async ({ prompt, editMeal }: GenerateRecipeParams): Promise<GeneratedRecipeResult> => {
      const { data, error } = await supabase.functions.invoke("generate-recipe", {
        body: editMeal ? { prompt, editMeal } : { prompt },
      });

      if (error) {
        const context = (error as { context?: Response }).context;
        if (context) {
          try {
            const body = await context.json();
            throw new Error(body?.error || error.message);
          } catch {
            throw new Error(error.message);
          }
        }
        throw new Error(error.message);
      }

      if (!data?.recipe) throw new Error("No recipe returned");
      return data.recipe as GeneratedRecipeResult;
    },
  });
}
