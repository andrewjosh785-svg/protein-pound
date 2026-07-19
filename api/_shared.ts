export const SUPABASE_URL = "https://jjeyvzvpjxnplidvihzv.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_MQExcb4Q7i4zDuKW8PVZ4g_0Cf2PV4X";

// Known link-unfurling bots — they don't execute JS, so they never see the per-page
// title/meta tags MealDetailPage sets client-side; these get a pre-rendered HTML shell instead.
export const BOT_UA =
  /facebookexternalhit|Facebot|Twitterbot|Slackbot|Discordbot|TelegramBot|WhatsApp|LinkedInBot|Pinterest|redditbot|Googlebot|bingbot|Applebot|SkypeUriPreview|vkShare|Embedly|Quora Link Preview|YandexBot|Iframely|Nuzzel|Outbrain/i;

export interface ShareMeal {
  name: string;
  description: string;
  protein_g: number;
  kcal: number;
  servings: number;
}

export async function fetchMealBySlug(slug: string): Promise<ShareMeal | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/meals?slug=eq.${encodeURIComponent(slug)}&select=name,description,protein_g,kcal,servings`,
    { headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as ShareMeal[];
  return rows[0] ?? null;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
