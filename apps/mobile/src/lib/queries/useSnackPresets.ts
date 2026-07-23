// mirrors apps/web/src/lib/queries/useSnackPresets.ts
import { useQuery } from "@tanstack/react-query";
import type { SnackPreset } from "@protein-pound/shared";
import { supabase } from "../supabaseClient";

export function useSnackPresets() {
  return useQuery({
    queryKey: ["snack-presets"],
    queryFn: async (): Promise<SnackPreset[]> => {
      const { data, error } = await supabase
        .from("snack_presets")
        .select("id, name, kcal, protein_g, cost")
        .order("sort_order");
      if (error) throw new Error(error.message);
      return data.map((r) => ({ id: r.id, name: r.name, kcal: r.kcal, proteinG: r.protein_g, cost: r.cost }));
    },
  });
}
