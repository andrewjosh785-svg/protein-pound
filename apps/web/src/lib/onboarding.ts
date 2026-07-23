// mirrors apps/mobile/src/lib/onboarding.ts, using localStorage instead of AsyncStorage
const KEY = "onboarding_seen_v1";

export function hasSeenOnboarding(): boolean {
  return localStorage.getItem(KEY) === "true";
}

export function markOnboardingSeen(): void {
  localStorage.setItem(KEY, "true");
}
