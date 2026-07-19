import { useQuery } from "@tanstack/react-query";
import type { Ingredient } from "@protein-pound/shared";
import { supabase } from "../supabaseClient";

export function useIngredients() {
  return useQuery({
    queryKey: ["ingredients"],
    queryFn: async (): Promise<Map<string, Ingredient>> => {
      const { data, error } = await supabase.from("ingredients").select("id, key, name, pack_label, category");
      if (error) throw error;
      const map = new Map<string, Ingredient>();
      for (const row of data) {
        map.set(row.id, {
          id: row.id,
          key: row.key,
          name: row.name,
          packLabel: row.pack_label,
          category: row.category,
        });
      }
      return map;
    },
  });
}
