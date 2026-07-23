// mirrors apps/web/src/lib/queries/useStoresAndPrices.ts
import { useQuery } from "@tanstack/react-query";
import type { IngredientPrice, Store } from "@protein-pound/shared";
import { supabase } from "../supabaseClient";

export function useStoresAndPrices() {
  return useQuery({
    queryKey: ["stores-and-prices"],
    queryFn: async (): Promise<{ stores: Store[]; prices: IngredientPrice[] }> => {
      const [storesRes, pricesRes] = await Promise.all([
        supabase.from("stores").select("id, name, display_order").order("display_order"),
        supabase.from("ingredient_prices").select("ingredient_id, store_id, price, updated_at"),
      ]);
      if (storesRes.error) throw storesRes.error;
      if (pricesRes.error) throw pricesRes.error;

      const stores: Store[] = storesRes.data.map((s) => ({
        id: s.id,
        name: s.name,
        displayOrder: s.display_order,
      }));
      const prices: IngredientPrice[] = pricesRes.data.map((p) => ({
        ingredientId: p.ingredient_id,
        storeId: p.store_id,
        price: p.price,
        updatedAt: p.updated_at,
      }));
      return { stores, prices };
    },
  });
}
