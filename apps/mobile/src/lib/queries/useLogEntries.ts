// mirrors apps/web/src/lib/queries/useLogEntries.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DayOfWeek, LogEntry } from "@protein-pound/shared";
import { supabase } from "../supabaseClient";

export interface NewLogItem {
  name: string;
  kcal: number;
  proteinG: number;
  cost: number;
  snackPresetId?: string | null;
}

export function useLogEntries(planId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["log-entries", planId];

  const query = useQuery({
    queryKey,
    enabled: !!planId,
    queryFn: async (): Promise<LogEntry[]> => {
      const { data, error } = await supabase
        .from("log_entries")
        .select("id, day_of_week, name, kcal, protein_g, cost, quantity, snack_preset_id")
        .eq("plan_id", planId!);
      if (error) throw new Error(error.message);
      return data.map((r) => ({
        id: r.id,
        dayOfWeek: r.day_of_week as DayOfWeek,
        name: r.name,
        kcal: r.kcal,
        proteinG: r.protein_g,
        cost: r.cost,
        quantity: r.quantity,
        snackPresetId: r.snack_preset_id,
      }));
    },
  });

  const addEntry = useMutation({
    mutationFn: async ({ day, item }: { day: DayOfWeek; item: NewLogItem }) => {
      const current = query.data ?? [];
      const existing = current.find((e) => e.dayOfWeek === day && e.name === item.name && e.kcal === item.kcal);
      if (existing) {
        const { error } = await supabase
          .from("log_entries")
          .update({ quantity: existing.quantity + 1 })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("log_entries").insert({
          plan_id: planId,
          day_of_week: day,
          name: item.name,
          kcal: item.kcal,
          protein_g: item.proteinG,
          cost: item.cost,
          quantity: 1,
          source: item.snackPresetId ? "snack_preset" : "custom",
          snack_preset_id: item.snackPresetId ?? null,
        });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const removeEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const current = query.data ?? [];
      const existing = current.find((e) => e.id === entryId);
      if (!existing) return;
      if (existing.quantity > 1) {
        const { error } = await supabase
          .from("log_entries")
          .update({ quantity: existing.quantity - 1 })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("log_entries").delete().eq("id", existing.id);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, addEntry, removeEntry };
}
