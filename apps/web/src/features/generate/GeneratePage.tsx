import { useState } from "react";
import {
  buildPriceLookup,
  formatIngredientLine,
  formatPriceCheckDate,
  latestPriceCheck,
  mealCostPerServing,
  money,
  proteinPerPound,
  servingsLabel,
  MEAL_CATEGORY_LABELS,
} from "@protein-pound/shared";
import { useIngredients } from "../../lib/queries/useIngredients";
import { useStoresAndPrices } from "../../lib/queries/useStoresAndPrices";
import { useGenerateRecipe } from "../../lib/queries/useGenerateRecipe";
import { useSaveGeneratedMeal } from "../../lib/queries/useSaveGeneratedMeal";
import { recipeToMeal } from "../../lib/recipeConversions";

const EXAMPLE_PROMPTS = [
  "Cheap veggie dinner, at least 25g protein",
  "Something with tuna I can batch cook for lunches",
  "A big breakfast under 400 kcal",
];

export function GeneratePage() {
  const [prompt, setPrompt] = useState("");
  const ingredientsQuery = useIngredients();
  const storesQuery = useStoresAndPrices();
  const generate = useGenerateRecipe();
  const save = useSaveGeneratedMeal();

  const handleGenerate = () => {
    if (!prompt.trim() || generate.isPending) return;
    save.reset();
    generate.mutate({ prompt: prompt.trim() });
  };

  if (ingredientsQuery.isLoading || storesQuery.isLoading) {
    return <div className="note">Loading ingredient database…</div>;
  }
  if (ingredientsQuery.isError || storesQuery.isError) {
    return <div className="note">Couldn't load the ingredient database.</div>;
  }

  const ingredients = ingredientsQuery.data!;
  const { stores, prices } = storesQuery.data!;
  const priceLookup = buildPriceLookup(prices);
  const lastChecked = latestPriceCheck(prices);
  const ingredientKeyToId = new Map<string, string>();
  for (const ing of ingredients.values()) ingredientKeyToId.set(ing.key, ing.id);

  const recipe = generate.data;
  const meal = recipe ? recipeToMeal(recipe, ingredientKeyToId) : null;
  const perServing = meal ? mealCostPerServing(meal, priceLookup, null) : 0;
  const valuePerPound = meal ? proteinPerPound(perServing, meal.proteinG) : 0;
  const storeCosts = meal
    ? stores.map((s) => ({
        store: s,
        cost: meal.ingredients.reduce(
          (sum, use) => sum + (priceLookup.get(use.ingredientId)?.get(s.id) ?? 0) * use.packFraction,
          0
        ),
      }))
    : [];
  const cheapestStoreCost = storeCosts.length ? Math.min(...storeCosts.map((s) => s.cost)) : 0;

  return (
    <div className="bwrap">
      <h2 className="ppp-disp" style={{ textTransform: "uppercase", fontSize: 28, margin: "6px 0 2px" }}>
        ✨ Generate a recipe
      </h2>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 14px" }}>
        Describe what you fancy and Gemini invents a recipe on the spot using the priced
        ingredient database — so it arrives already costed at all six supermarkets.
      </p>

      <div className="fldrow" style={{ alignItems: "flex-end" }}>
        <div className="fld" style={{ flex: 1, minWidth: 260 }}>
          <label>What do you fancy?</label>
          <div style={{ display: "flex" }}>
            <input
              type="text"
              value={prompt}
              style={{ width: "100%", borderRight: "none" }}
              placeholder='e.g. "high-protein dinner under £1.50 a serving using chicken thighs"'
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleGenerate();
              }}
            />
            <button
              className="bigbtn"
              onClick={handleGenerate}
              disabled={generate.isPending}
              style={{
                fontSize: 14,
                padding: "8px 16px",
                height: 32,
                whiteSpace: "nowrap",
                ...(generate.isPending ? { opacity: 0.6, cursor: "wait" } : {}),
              }}
            >
              {generate.isPending ? "Generating…" : "Generate"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {EXAMPLE_PROMPTS.map((ex) => (
          <button key={ex} className="pill" onClick={() => setPrompt(ex)}>
            {ex}
          </button>
        ))}
      </div>

      {generate.isError && (
        <div className="tcard" style={{ borderColor: "var(--deal)", marginBottom: 14 }}>
          <span className="bad" style={{ fontWeight: 600 }}>
            {generate.error instanceof Error ? generate.error.message : "Something went wrong."}
          </span>
        </div>
      )}

      {meal && (
        <div className="card" style={{ maxWidth: 620 }}>
          <div className="card-top">
            <div className="badges">
              <span className="badge cust">✨ AI</span>
              {meal.isVeggie && <span className="badge v">Veggie</span>}
              <span className="badge">{MEAL_CATEGORY_LABELS[meal.category]}</span>
              <span className="badge">{servingsLabel(meal.servings)}</span>
            </div>
            <h3>{meal.name}</h3>
            <p className="desc">{meal.description}</p>
            <div className="stats">
              <span>
                <b>{meal.proteinG}g</b> protein / serving
              </span>
              <span>
                <b>{meal.kcal}</b> kcal
              </span>
              <span>
                <b>{meal.timeLabel}</b>
              </span>
            </div>
          </div>
          <div className="tagrow">
            <div className="sel">
              <div className="big ppp-disp">{money(perServing)}</div>
              <div className="sm">per serving · cheapest mix</div>
            </div>
            <div className="valcell">
              <div className="big ppp-disp">{valuePerPound.toFixed(0)}g</div>
              <div className="sm">protein per £1</div>
            </div>
          </div>
          <div className="recipe">
            <h4>
              Recipe <span className="time">· {meal.timeLabel} · serves {meal.servings}</span>
            </h4>
            <ul>
              {meal.ingredients.map((use) => {
                const ing = ingredients.get(use.ingredientId);
                return (
                  <li key={use.ingredientId}>{formatIngredientLine(use.humanQuantity, ing?.name ?? "ingredient")}</li>
                );
              })}
            </ul>
            {meal.method.length > 0 && (
              <ol>
                {meal.method.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            )}
          </div>
          <div className="brk">
            <table>
              <thead>
                <tr>
                  {storeCosts.map(({ store }) => (
                    <th key={store.id}>{store.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {storeCosts.map(({ store, cost }) => (
                    <td key={store.id} className={cost === cheapestStoreCost ? "lo" : ""}>
                      {money(cost)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {lastChecked && (
            <div style={{ fontSize: 11.5, color: "var(--faint)", padding: "6px 14px 0" }}>
              Prices last checked {formatPriceCheckDate(lastChecked)}
            </div>
          )}

          {save.isError && (
            <div style={{ padding: "8px 14px", fontSize: 12.5 }} className="bad">
              {save.error instanceof Error ? save.error.message : "Could not save recipe."}
            </div>
          )}
          {save.isSuccess && (
            <div style={{ padding: "8px 14px", fontSize: 12.5 }} className="ok">
              Saved — it's now in your Meals list.
            </div>
          )}

          <div className="actions">
            <button onClick={() => generate.mutate({ prompt: prompt.trim() })} disabled={generate.isPending}>
              Try another
            </button>
            <button onClick={() => generate.reset()}>Discard</button>
            <button
              className="add"
              onClick={() => save.mutate({ recipe: recipe!, ingredientKeyToId })}
              disabled={save.isPending || save.isSuccess}
            >
              {save.isPending ? "Saving…" : "Save to my meals"}
            </button>
          </div>
        </div>
      )}

      {!meal && !generate.isPending && !generate.isError && (
        <div className="empty" style={{ maxWidth: 620 }}>
          Your generated recipe will appear here — priced per supermarket, with macros and a
          full method. Save it and it joins the meal rankings like any other recipe.
        </div>
      )}
    </div>
  );
}
