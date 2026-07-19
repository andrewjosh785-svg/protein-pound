// Supabase Edge Function: generates a recipe via the Gemini API, constrained to the
// priced ingredient database. Runs server-side so GEMINI_API_KEY lives as a function
// secret and is never sent to the client.
import { createClient } from "npm:@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
// "-latest" alias so this doesn't break again when Google retires a dated model version.
// Billing is now enabled on this project, so the free-tier 20/day ceiling no longer applies —
// using the Flash-Lite tier instead of plain Flash for the lowest per-token cost, since this
// task (constrained JSON recipe generation) doesn't need Flash's extra quality/speed headroom.
const GEMINI_MODEL = "gemini-flash-lite-latest";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// Auto-injected by the Supabase Edge Runtime for every function — never sent to the client.
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Billing is on, so this is no longer a free-tier workaround — it's a runaway-cost guard
// (e.g. a bug or someone hammering the endpoint) rather than a real usage constraint at
// personal-project scale. Flash-Lite is cheap enough that even this is a low ceiling on spend.
const DAILY_GENERATION_CAP = 100;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type MealCategory = "breakfast" | "lunch" | "dinner" | "snack" | "dessert";
const VALID_CATEGORIES: MealCategory[] = ["breakfast", "lunch", "dinner", "snack", "dessert"];

interface GeneratedRecipe {
  name: string;
  desc: string;
  servings: number;
  protein: number;
  kcal: number;
  veggie: boolean;
  time: string;
  category: MealCategory;
  uses: Array<[string, number, string]>;
  method: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!GEMINI_API_KEY) {
    return jsonResponse({ error: "Server is missing GEMINI_API_KEY" }, 500);
  }

  let prompt: string;
  let editMeal: GeneratedRecipe | null = null;
  try {
    const body = await req.json();
    prompt = String(body.prompt ?? "").trim();
    if (body.editMeal && typeof body.editMeal === "object") {
      editMeal = body.editMeal as GeneratedRecipe;
    }
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!prompt) {
    return jsonResponse({ error: "prompt is required" }, 400);
  }

  // Hidden debug mode: only activates with this exact header, so real users never see internals,
  // but errors can be inspected directly from a test request without redeploying each time.
  const debugMode = req.headers.get("x-debug-key") === "ppp-debug-2026";
  const authHeader = req.headers.get("Authorization");

  // Global rate limit check, before doing any other work (including the ingredient fetch) so a
  // capped-out request fails fast and doesn't spend anything beyond a single DB read.
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: countError } = await supabaseAdmin
    .from("generation_log")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since);

  if (!countError && (recentCount ?? 0) >= DAILY_GENERATION_CAP) {
    return jsonResponse(
      { error: "The recipe generator has reached its daily limit — please try again in a few hours." },
      429
    );
  }

  // Log this attempt now (not after a successful generation) so a burst of failing requests
  // still counts against the cap rather than letting retries slip through for free.
  let loggedUserId: string | null = null;
  if (authHeader) {
    const { data: userData } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    loggedUserId = userData.user?.id ?? null;
  }
  await supabaseAdmin.from("generation_log").insert({ user_id: loggedUserId });

  // Forward the caller's JWT so this read respects RLS rather than using the service role —
  // ingredients are public-read anyway, but there's no reason to reach for elevated access.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  });

  const { data: ingredients, error: ingredientsError } = await supabase
    .from("ingredients")
    .select("key, name, pack_label, ingredient_prices(price)");

  if (ingredientsError || !ingredients) {
    return jsonResponse({ error: "Could not load ingredient catalogue" }, 500);
  }

  const catalogue = ingredients
    .map((ing) => {
      const prices = (ing.ingredient_prices ?? []).map((p: { price: number }) => p.price);
      const cheapest = prices.length ? Math.min(...prices) : 0;
      return ing.key + " | " + ing.name + " | pack: " + ing.pack_label + " | cheapest £" + cheapest.toFixed(2);
    })
    .join("\n");

  // Built with string concatenation (no template literals) because multi-line backtick
  // strings with special characters have been unreliable to paste into the dashboard's
  // browser-based function editor.
  const responseSchema =
    '{"name": string, "desc": string (one appetising sentence), "servings": int, "protein": int (grams per serving), "kcal": int (per serving), "veggie": bool, "time": string (e.g. "30 min"), "category": string (one of "breakfast", "lunch", "dinner", "snack", "dessert" - whichever best fits the recipe), "uses": [[ingredientKey, fractionOfPackUsedByWholeRecipe, humanQuantity]], "method": [4-6 short cooking steps]}';
  const usageRules =
    'Rules: fractions are of the stated pack size and cover the WHOLE recipe (all servings), e.g. 600g from a 1kg pack = 0.6, 2 tins = 2. humanQuantity is the real-world amount like "400g" or "2 tins" or "4 eggs". Keep macros realistic for the quantities used. Only use ingredient keys from the list above.';

  const geminiPrompt = editMeal
    ? [
        "You are editing an existing recipe based on a user's requested change. You may ONLY use these ingredients (format: key | name | pack size | cheapest price):",
        catalogue,
        "",
        "Current recipe:",
        "Name: " + editMeal.name,
        "Servings: " + editMeal.servings,
        "Protein per serving: " + editMeal.protein + "g",
        "Kcal per serving: " + editMeal.kcal,
        "Vegetarian: " + editMeal.veggie,
        "Time: " + editMeal.time,
        "Category: " + editMeal.category,
        "Ingredients used: " + editMeal.uses.map((u) => u[0] + " (" + u[2] + ")").join(", "),
        "Method: " + editMeal.method.join(" "),
        "",
        'Requested change: "' + prompt + '"',
        "",
        "Apply ONLY the requested change. Keep everything else about the recipe as close to the original as sensible — same rough style and method — recalculating ingredients, macros and method only as far as the change actually requires.",
        "",
        "Respond with ONLY a raw JSON object representing the FULL UPDATED recipe - no markdown fences, no commentary:",
        responseSchema,
        "",
        usageRules,
      ].join("\n")
    : [
        "You create cheap, healthy, high-protein UK recipes. You may ONLY use these ingredients (format: key | name | pack size | cheapest price):",
        catalogue,
        "",
        'User request: "' + prompt + '"',
        "",
        "Respond with ONLY a raw JSON object - no markdown fences, no commentary:",
        responseSchema,
        "",
        usageRules,
      ].join("\n");

  let recipe: GeneratedRecipe;
  try {
    const response = await callGemini(geminiPrompt);
    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((part: { text?: string }) => part.text ?? "")
      .join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    const validIngredientKeys = new Set(ingredients.map((i) => i.key));
    const uses = (Array.isArray(parsed.uses) ? parsed.uses : [])
      .filter(
        (u: unknown): u is [string, number, string] =>
          Array.isArray(u) && validIngredientKeys.has(u[0]) && Number(u[1]) > 0
      )
      .map((u: [string, number, string]) => [u[0], Number(u[1]), String(u[2] ?? "")]);

    if (!uses.length) throw new Error("No valid ingredients in response");

    const category: MealCategory = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : "dinner";

    recipe = {
      name: String(parsed.name || "Generated recipe"),
      desc: String(parsed.desc || "AI-generated recipe."),
      servings: Math.max(1, Math.round(Number(parsed.servings) || 2)),
      protein: Math.max(0, Math.round(Number(parsed.protein) || 0)),
      kcal: Math.max(0, Math.round(Number(parsed.kcal) || 0)),
      veggie: !!parsed.veggie,
      time: String(parsed.time || "—"),
      category,
      uses,
      method: Array.isArray(parsed.method) ? parsed.method.map(String).filter(Boolean) : [],
    };
  } catch (err) {
    console.error("Recipe generation failed:", err);
    return jsonResponse(
      {
        error: "Couldn't generate a recipe that time — try again (the odd attempt needs a retry).",
        ...(debugMode ? { debug: err instanceof Error ? err.message : String(err) } : {}),
      },
      502
    );
  }

  return jsonResponse({ recipe });
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
async function callGemini(geminiPrompt: string): Promise<Response> {
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
          contents: [{ parts: [{ text: geminiPrompt }] }],
          generationConfig: {
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
            // Flash models think by default, which can burn the whole token budget on
            // internal reasoning before writing any JSON, truncating the actual response.
            // Not needed for a deterministic recipe-formatting task.
            thinkingConfig: { thinkingBudget: 0 },
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
