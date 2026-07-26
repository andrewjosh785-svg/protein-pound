// mirrors the error-unwrapping shape of useGenerateRecipe.ts, calling the separate
// estimate-meal-photo edge function instead — no ingredient catalogue, no cost, just a rough
// nutrition guess from a photo.
import { useMutation } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";

export interface MealPhotoEstimate {
  name: string | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  notes: string;
}

export interface EstimateMealPhotoParams {
  mimeType: string;
  /** Base64-encoded image bytes — sent inline, never persisted. */
  data: string;
}

export function useEstimateMealPhoto() {
  return useMutation({
    mutationFn: async ({ mimeType, data }: EstimateMealPhotoParams): Promise<MealPhotoEstimate> => {
      const { data: responseData, error } = await supabase.functions.invoke("estimate-meal-photo", {
        body: { image: { mimeType, data } },
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

      if (!responseData?.estimate) throw new Error("No estimate returned");
      return responseData.estimate as MealPhotoEstimate;
    },
  });
}
