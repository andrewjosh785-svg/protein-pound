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
  /** When present, the edge function treats this as an edit instruction against the
   * given recipe rather than a fresh generation request. */
  editMeal?: GeneratedRecipeResult;
}

export function useGenerateRecipe() {
  return useMutation({
    mutationFn: async ({ prompt, editMeal }: GenerateRecipeParams): Promise<GeneratedRecipeResult> => {
      const { data, error } = await supabase.functions.invoke("generate-recipe", {
        body: editMeal ? { prompt, editMeal } : { prompt },
      });

      if (error) {
        // FunctionsHttpError exposes the raw Response on `.context`, which carries the
        // Edge Function's { error: string } body on non-2xx responses.
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
