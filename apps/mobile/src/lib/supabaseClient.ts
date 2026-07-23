import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — copy apps/mobile/.env.example to .env and fill in your Supabase project's values."
  );
}

// Unlike the web client (apps/web/src/lib/supabaseClient.ts), which relies entirely on
// supabase-js's implicit browser localStorage default, RN has no such default — this
// config is net-new, not a straight port. detectSessionInUrl is off since there's no
// browser URL for an OAuth/magic-link redirect to land in.
export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
