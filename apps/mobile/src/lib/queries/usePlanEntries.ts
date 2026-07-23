// mirrors apps/web/src/lib/queries/usePlanEntries.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DayOfWeek, PlanEntry } from "@protein-pound/shared";
import { supabase } from "../supabaseClient";

export function usePlanEntries(planId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["plan-entries", planId];

  const query = useQuery({
    queryKey,
    enabled: !!planId,
    queryFn: async (): Promise<PlanEntry[]> => {
      const { data, error } = await supabase
        .from("plan_entries")
        .select("id, day_of_week, meal_id, servings")
        .eq("plan_id", planId!);
      if (error) throw new Error(error.message);
      return data.map((r) => ({
        id: r.id,
        dayOfWeek: r.day_of_week as DayOfWeek,
        mealId: r.meal_id,
        servings: r.servings,
      }));
    },
  });

  const addServing = useMutation({
    mutationFn: async ({ day, mealId }: { day: DayOfWeek; mealId: string }) => {
      const current = query.data ?? [];
      const existing = current.find((e) => e.dayOfWeek === day && e.mealId === mealId);
      if (existing) {
        const { error } = await supabase
          .from("plan_entries")
          .update({ servings: existing.servings + 1 })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("plan_entries")
          .insert({ plan_id: planId, day_of_week: day, meal_id: mealId, servings: 1 });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const setServings = useMutation({
    mutationFn: async ({ day, mealId, servings }: { day: DayOfWeek; mealId: string; servings: number }) => {
      const current = query.data ?? [];
      const existing = current.find((e) => e.dayOfWeek === day && e.mealId === mealId);
      if (servings <= 0) {
        if (existing) {
          const { error } = await supabase.from("plan_entries").delete().eq("id", existing.id);
          if (error) throw new Error(error.message);
        }
        return;
      }
      if (existing) {
        const { error } = await supabase.from("plan_entries").update({ servings }).eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("plan_entries")
          .insert({ plan_id: planId, day_of_week: day, meal_id: mealId, servings });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const removeServing = useMutation({
    mutationFn: async ({ day, mealId }: { day: DayOfWeek; mealId: string }) => {
      const current = query.data ?? [];
      const existing = current.find((e) => e.dayOfWeek === day && e.mealId === mealId);
      if (!existing) return;
      if (existing.servings > 1) {
        const { error } = await supabase
          .from("plan_entries")
          .update({ servings: existing.servings - 1 })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("plan_entries").delete().eq("id", existing.id);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, addServing, removeServing, setServings };
}
