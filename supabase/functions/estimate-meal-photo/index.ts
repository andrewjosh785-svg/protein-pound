// Supabase Edge Function: estimates rough nutrition (kcal/protein/carbs/fat) for a photo of a
// meal via Gemini vision. Unlike generate-recipe, there's no priced ingredient catalogue to
// constrain against — this is a ballpark guess from what's visible in the photo, always meant
// to be reviewed/edited by the user before logging, never presented as precise. The photo is
// never persisted: it's sent inline as base64 and discarded after the single Gemini call.
import { createClient } from "npm:@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
// Same model as generate-recipe for now — first live test must confirm this tier actually
// accepts image input; the "-latest" alias has already silently changed accepted-parameter
// behavior once this project (see the thinkingConfig regression), so don't assume, verify.
const GEMINI_MODEL = "gemini-flash-lite-latest";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// Auto-injected by the Supabase Edge Runtime for every function — never sent to the client.
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Shared with generate-recipe's cap: both features bill the same Gemini account, and this is
// a blanket cost/abuse guard rather than a per-feature quota, so they count against one total.
const DAILY_GENERATION_CAP = 100;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MealPhotoEstimate {
  name: string | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  notes: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!GEMINI_API_KEY) {
    return jsonResponse({ error: "Server is missing GEMINI_API_KEY" }, 500);
  }

  let mimeType: string;
  let data: string;
  try {
    const body = await req.json();
    mimeType = String(body?.image?.mimeType ?? "");
    data = String(body?.image?.data ?? "");
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!mimeType || !data) {
    return jsonResponse({ error: "image.mimeType and image.data are required" }, 400);
  }

  // Hidden debug mode: only activates with this exact header, so real users never see internals,
  // but errors can be inspected directly from a test request without redeploying each time.
  const debugMode = req.headers.get("x-debug-key") === "ppp-debug-2026";
  const authHeader = req.headers.get("Authorization");

  // Global rate limit check, before doing any other work, so a capped-out request fails fast.
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: countError } = await supabaseAdmin
    .from("generation_log")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since);

  if (!countError && (recentCount ?? 0) >= DAILY_GENERATION_CAP) {
    return jsonResponse(
      { error: "The AI estimator has reached its daily limit — please try again in a few hours." },
      429
    );
  }

  // Log this attempt now (not after a successful estimate) so a burst of failing requests still
  // counts against the cap rather than letting retries slip through for free.
  let loggedUserId: string | null = null;
  if (authHeader) {
    const { data: userData } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    loggedUserId = userData.user?.id ?? null;
  }
  await supabaseAdmin.from("generation_log").insert({ user_id: loggedUserId });

  const prompt = [
    "You are estimating rough nutrition for a photo of a meal or plate of food — this could be",
    "home-cooked, a restaurant dish, or unpackaged food with no label. Identify what's in the",
    "photo and estimate calories, protein, carbs and fat for the portion shown, assuming a",
    "typical single serving unless the photo clearly suggests a different amount. Be",
    "conservative and realistic — this is a rough estimate a user will review and adjust before",
    "logging, not a lab measurement. If you cannot identify any food in the image at all,",
    'respond with "name": null and zeros for the numeric fields.',
    "",
    "Respond with ONLY a raw JSON object - no markdown fences, no commentary:",
    '{"name": string | null (best-guess dish name, or null if no food is recognisable), "kcal": int, "protein": int (grams), "carbs": int (grams), "fat": int (grams), "notes": string (one short sentence on any assumption made, e.g. portion size or sauce not visible)}',
  ].join("\n");

  let estimate: MealPhotoEstimate;
  try {
    const response = await callGemini(prompt, mimeType, data);
    const responseData = await response.json();
    const text = (responseData.candidates?.[0]?.content?.parts ?? [])
      .map((part: { text?: string }) => part.text ?? "")
      .join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    estimate = {
      name: parsed.name ? String(parsed.name) : null,
      kcal: Math.max(0, Math.round(Number(parsed.kcal) || 0)),
      protein: Math.max(0, Math.round(Number(parsed.protein) || 0)),
      carbs: Math.max(0, Math.round(Number(parsed.carbs) || 0)),
      fat: Math.max(0, Math.round(Number(parsed.fat) || 0)),
      notes: String(parsed.notes || ""),
    };
  } catch (err) {
    console.error("Meal photo estimate failed:", err);
    return jsonResponse(
      {
        error: "Couldn't estimate that photo — try again or enter it manually.",
        ...(debugMode ? { debug: err instanceof Error ? err.message : String(err) } : {}),
      },
      502
    );
  }

  return jsonResponse({ estimate });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Gemini's free tier returns 503 (overloaded) and 429 (rate limited) fairly often under load;
// both are transient, so a short retry here saves the user from having to click "try again"
// themselves for what's usually a one-off hiccup.
async function callGemini(prompt: string, mimeType: string, base64Data: string): Promise<Response> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY!,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }] }],
          generationConfig: {
            maxOutputTokens: 512,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (response.ok) return response;

    const isRetryable = response.status === 503 || response.status === 429;
    if (isRetryable && attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 800));
      continue;
    }

    const bodyText = await response.text().catch(() => "");
    throw new Error("Gemini API returned " + response.status + ": " + bodyText.slice(0, 1200));
  }
  // Unreachable — the loop above always returns or throws — but keeps the return type honest.
  throw new Error("Gemini API request failed");
}
