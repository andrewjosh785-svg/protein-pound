import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserTargets } from "@protein-pound/shared";
import { supabase } from "../supabaseClient";
import { useAuth } from "../auth/AuthContext";

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<UserTargets> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("daily_kcal_target, daily_protein_target, weekly_budget")
        .eq("id", user!.id)
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not load profile");
      return {
        dailyKcalTarget: data.daily_kcal_target,
        dailyProteinTarget: data.daily_protein_target,
        weeklyBudget: data.weekly_budget,
      };
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<UserTargets>) => {
      const dbPatch: Record<string, number> = {};
      if (patch.dailyKcalTarget !== undefined) dbPatch.daily_kcal_target = patch.dailyKcalTarget;
      if (patch.dailyProteinTarget !== undefined) dbPatch.daily_protein_target = patch.dailyProteinTarget;
      if (patch.weeklyBudget !== undefined) dbPatch.weekly_budget = patch.weeklyBudget;
      const { error } = await supabase.from("profiles").update(dbPatch).eq("id", user!.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile", user?.id] }),
  });

  return { ...query, update };
}
