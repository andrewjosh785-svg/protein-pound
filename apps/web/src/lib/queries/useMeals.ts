import { useQuery } from "@tanstack/react-query";
import type { Meal, MealCategory, MealSource } from "@protein-pound/shared";
import { supabase } from "../supabaseClient";

interface RawMealRow {
  id: string;
  slug: string | null;
  name: string;
  servings: number;
  protein_g: number;
  kcal: number;
  is_veggie: boolean;
  time_label: string | null;
  description: string;
  method: string[];
  source: MealSource;
  owner_id: string | null;
  category: MealCategory;
  meal_ingredients: Array<{
    ingredient_id: string;
    pack_fraction: number;
    human_quantity: string;
    sort_order: number;
  }>;
}

const MEAL_SELECT =
  "id, slug, name, servings, protein_g, kcal, is_veggie, time_label, description, method, source, owner_id, category, " +
  "meal_ingredients(ingredient_id, pack_fraction, human_quantity, sort_order)";

export function useMeals() {
  return useQuery({
    queryKey: ["meals"],
    queryFn: async (): Promise<Meal[]> => {
      const { data, error } = await supabase.from("meals").select(MEAL_SELECT).order("name");
      if (error) throw error;

      // Cast needed until `supabase gen types typescript` is run against a linked project;
      // without generated Database types, postgrest-js can't verify this select string's shape.
      return (data as unknown as RawMealRow[]).map((row) => ({
        id: row.id,
        slug: row.slug ?? row.id,
        name: row.name,
        servings: row.servings,
        proteinG: row.protein_g,
        kcal: row.kcal,
        isVeggie: row.is_veggie,
        timeLabel: row.time_label,
        description: row.description,
        method: row.method,
        source: row.source,
        ownerId: row.owner_id,
        category: row.category,
        ingredients: [...row.meal_ingredients]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((mi) => ({
            ingredientId: mi.ingredient_id,
            packFraction: mi.pack_fraction,
            humanQuantity: mi.human_quantity,
            sortOrder: mi.sort_order,
          })),
      }));
    },
  });
}
