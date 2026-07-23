// Registers this device for push notifications and saves the resulting Expo push token
// against the signed-in user's profile, so the server-side trial-reminder job has
// somewhere to send to. Requires an EAS project id (Constants.expoConfig.extra.eas.
// projectId) — set once `eas init` has been run and the user is logged into an Expo
// account; until then this silently no-ops rather than throwing, since push
// registration failing shouldn't ever block using the app.
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { supabase } from "./supabaseClient";

export async function registerForPushNotifications(userId: string): Promise<void> {
  // Simulators/emulators don't have push capability at all — Expo's own recommended check.
  if (!Device.isDevice) return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn("Skipping push registration — no EAS project id configured yet (run `eas init`).");
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  const { error } = await supabase.from("profiles").update({ push_token: token }).eq("id", userId);
  if (error) console.warn("Failed to save push token:", error.message);
}
