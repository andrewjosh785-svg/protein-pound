// mirrors apps/web/src/lib/queries/useCopyLastWeek.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import { useAuth } from "../auth/AuthContext";

function getMondayOfLastWeek(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun .. 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday - 7);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export function useCopyLastWeek(currentPlanId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user || !currentPlanId) throw new Error("Not ready yet — try again in a moment.");
      const lastWeekStart = getMondayOfLastWeek();

      const { data: lastPlan, error: planError } = await supabase
        .from("weekly_plans")
        .select("id")
        .eq("user_id", user.id)
        .eq("week_start_date", lastWeekStart)
        .maybeSingle();
      if (planError) throw new Error(planError.message);
      if (!lastPlan) throw new Error("No previous week found to copy.");

      const { data: lastEntries, error: entriesError } = await supabase
        .from("plan_entries")
        .select("day_of_week, meal_id, servings")
        .eq("plan_id", lastPlan.id);
      if (entriesError) throw new Error(entriesError.message);
      if (!lastEntries || lastEntries.length === 0) throw new Error("Last week's plan was empty.");

      const { error: insertError } = await supabase.from("plan_entries").insert(
        lastEntries.map((e) => ({
          plan_id: currentPlanId,
          day_of_week: e.day_of_week,
          meal_id: e.meal_id,
          servings: e.servings,
        }))
      );
      if (insertError) throw new Error(insertError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan-entries", currentPlanId] });
    },
  });
}
