import type { DayOfWeek } from "./types";

/** Today, as this app's DayOfWeek index (0=Mon..6=Sun) — converts from JS's Date.getDay()
 * (0=Sun..6=Sat). Promoted out of ScanConfirmSheet.tsx so both platforms can share it. */
export function todayAsDayOfWeek(): DayOfWeek {
  const jsDay = new Date().getDay();
  return (jsDay === 0 ? 6 : jsDay - 1) as DayOfWeek;
}
