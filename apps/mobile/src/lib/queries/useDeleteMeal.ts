// mirrors apps/web/src/lib/queries/useDeleteMeal.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";

export function useDeleteMeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mealId: string) => {
      const { error } = await supabase.from("meals").delete().eq("id", mealId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meals"] }),
  });
}
