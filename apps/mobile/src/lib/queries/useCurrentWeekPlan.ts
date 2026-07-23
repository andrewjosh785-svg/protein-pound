// mirrors apps/web/src/lib/queries/useCurrentWeekPlan.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import { useAuth } from "../auth/AuthContext";

function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun .. 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

/** Finds this week's plan for the current user, creating it if it doesn't exist yet. */
export function useCurrentWeekPlan() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["current-week-plan", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<string> => {
      const weekStart = getMondayOfCurrentWeek();
      const { data, error } = await supabase
        .from("weekly_plans")
        .upsert({ user_id: user!.id, week_start_date: weekStart }, { onConflict: "user_id,week_start_date" })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not load this week's plan");
      return data.id as string;
    },
  });
}
