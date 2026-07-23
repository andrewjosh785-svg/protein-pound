// mirrors apps/web/src/lib/queries/useSubscription.ts — pure logic, no browser APIs,
// copied unchanged aside from the import path.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";

export interface Subscription {
  status: string;
  currentPeriodEnd: string | null;
}

/** Access is "active" for the gate whenever status is trialing or active — everything
 * else (including past_due) is treated as gated, so a failing card is surfaced rather
 * than silently keeping access. */
export function hasActiveAccess(subscription: Subscription | null): boolean {
  return subscription?.status === "trialing" || subscription?.status === "active";
}

export function useSubscription(userId: string | undefined) {
  return useQuery({
    queryKey: ["subscription", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Subscription | null> => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { status: data.status, currentPeriodEnd: data.current_period_end };
    },
  });
}
