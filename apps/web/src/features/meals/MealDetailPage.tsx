import { useEffect, useState } from "react";
import {
  buildPriceLookup,
  formatIngredientLine,
  formatPriceCheckDate,
  latestPriceCheck,
  mealCostPerServing,
  money,
  packAmountLabel,
  proteinPerPound,
  servingsLabel,
  MEAL_CATEGORY_LABELS,
} from "@protein-pound/shared";
import { useMeals } from "../../lib/queries/useMeals";
import { useStoresAndPrices } from "../../lib/queries/useStoresAndPrices";
import { useIngredients } from "../../lib/queries/useIngredients";

function setMetaTag(selector: string, attrs: Record<string, string>, content: string): () => void {
  let tag = document.querySelector(selector);
  const existed = !!tag;
  const prevContent = tag?.getAttribute("content") ?? null;
  if (!tag) {
    tag = document.createElement("meta");
    for (const [k, v] of Object.entries(attrs)) tag.setAttribute(k, v);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
  return () => {
    if (!existed) {
      tag?.remove();
    } else if (prevContent !== null) {
      tag?.setAttribute("content", prevContent);
    }
  };
}

export function MealDetailPage({ slug, onBack }: { slug: string; onBack: () => void }) {
  const mealsQuery = useMeals();
  const storesQuery = useStoresAndPrices();
  const ingredientsQuery = useIngredients();
  const [scaleServings, setScaleServings] = useState<number | null>(null);

  const meal = mealsQuery.data?.find((m) => m.slug === slug);

  useEffect(() => {
    if (!meal) return;
    const prevTitle = document.title;
    document.title = `${meal.name} — Protein/Pound`;
    const summary = `${meal.proteinG}g protein / serving · serves ${meal.servings} · ${meal.description}`;
    const restoreDescription = setMetaTag('meta[name="description"]', { name: "description" }, summary);
    const restoreOgTitle = setMetaTag('meta[property="og:title"]', { property: "og:title" }, `${meal.name} — Protein/Pound`);
    const restoreOgDescription = setMetaTag('meta[property="og:description"]', { property: "og:description" }, summary);
    return () => {
      document.title = prevTitle;
      restoreDescription();
      restoreOgTitle();
      restoreOgDescription();
    };
  }, [meal]);

  if (mealsQuery.isLoading || storesQuery.isLoading || ingredientsQuery.isLoading) {
    return <div className="note">Loading recipe…</div>;
  }
  if (mealsQuery.isError || storesQuery.isError || ingredientsQuery.isError) {
    return <div className="note">Couldn't load this recipe.</div>;
  }
  if (!meal) {
    return (
      <div className="empty" style={{ margin: 20, maxWidth: 620 }}>
        Couldn't find that recipe — it may have been removed.
        <div style={{ marginTop: 12 }}>
          <button className="bigbtn alt" style={{ fontSize: 14, padding: "8px 16px" }} onClick={onBack}>
            ← Back to meals
          </button>
        </div>
      </div>
    );
  }

  const { stores, prices } = storesQuery.data!;
  const ingredients = ingredientsQuery.data!;
  const priceLookup = buildPriceLookup(prices);
  const perServing = mealCostPerServing(meal, priceLookup, null);
  const valuePerPound = proteinPerPound(perServing, meal.proteinG);
  const lastChecked = latestPriceCheck(prices);

  const servings = scaleServings ?? meal.servings;
  const isScaled = servings !== meal.servings && servings > 0;
  const scaleFactor = meal.servings > 0 ? servings / meal.servings : 1;

  return (
    <div className="bwrap">
      <button className="bigbtn alt" style={{ fontSize: 14, padding: "8px 16px", marginBottom: 16 }} onClick={onBack}>
        ← Back to meals
      </button>

      <div className="badges" style={{ marginBottom: 8 }}>
        {meal.source !== "builtin" && (
          <span className="badge cust">{meal.source === "ai" ? "✨ AI" : "Yours"}</span>
        )}
        {meal.isVeggie && <span className="badge v">Veggie</span>}
        <span className="badge">{MEAL_CATEGORY_LABELS[meal.category]}</span>
        <span className="badge">{servingsLabel(meal.servings)}</span>
      </div>
      <h2 className="ppp-disp" style={{ textTransform: "uppercase", fontSize: 28, margin: "0 0 6px" }}>
        {meal.name}
      </h2>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 14px" }}>{meal.description}</p>
      <div className="stats" style={{ marginBottom: 14 }}>
        <span>
          <b>{meal.proteinG}g</b> protein / serving
        </span>
        <span>
          <b>{meal.kcal}</b> kcal
        </span>
        {meal.timeLabel && (
          <span>
            <b>{meal.timeLabel}</b>
          </span>
        )}
      </div>

      <div className="tagrow" style={{ maxWidth: 620 }}>
        <div className="sel">
          <div className="big ppp-disp">{money(perServing)}</div>
          <div className="sm">per serving · cheapest mix</div>
        </div>
        <div className="valcell">
          <div className="big ppp-disp">{valuePerPound.toFixed(0)}g</div>
          <div className="sm">protein per £1</div>
        </div>
      </div>

      <div className="recipe" style={{ maxWidth: 620 }}>
        <h4>
          Recipe <span className="time">· {meal.timeLabel ?? "—"} · serves {meal.servings}</span>
        </h4>
        <div className="fld-inline" style={{ margin: "2px 0 12px" }}>
          <label htmlFor="detail-scale">Cooking for</label>
          <input
            id="detail-scale"
            type="number"
            min="1"
            value={servings}
            onChange={(e) => setScaleServings(Math.max(1, Number(e.target.value)))}
            style={{ width: 56 }}
          />
          <span style={{ color: "var(--muted)" }}>servings</span>
        </div>
        {isScaled && (
          <div className="tcard" style={{ marginBottom: 12, fontSize: 12.5 }}>
            For {servings} servings: <b>{money(perServing * servings)}</b> total ·{" "}
            <b>{Math.round(meal.kcal * servings).toLocaleString()}</b> kcal ·{" "}
            <b>{Math.round(meal.proteinG * servings)}g</b> protein
          </div>
        )}
        <ul>
          {meal.ingredients.map((use) => {
            const name = ingredients.get(use.ingredientId)?.name ?? "ingredient";
            return (
              <li key={use.ingredientId}>
                {formatIngredientLine(use.humanQuantity, name)}
                {isScaled && (
                  <span style={{ color: "var(--faint)" }}>
                    {" "}
                    — {packAmountLabel(use.packFraction * scaleFactor)} for {servings}
                  </span>
                )}
              </li>
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

      <div className="brk" style={{ background: "var(--surface)", border: "1.5px solid var(--ink)", maxWidth: 620 }}>
        <table>
          <thead>
            <tr>
              <th className="namecol">Ingredient</th>
              {stores.map((s) => (
                <th key={s.id}>{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {meal.ingredients.map((use) => {
              const ing = ingredients.get(use.ingredientId);
              const costs = stores.map((s) => (priceLookup.get(use.ingredientId)?.get(s.id) ?? 0) * use.packFraction);
              const lo = Math.min(...costs);
              return (
                <tr key={use.ingredientId}>
                  <td className="namecol">{ing?.name ?? "Ingredient"}</td>
                  {costs.map((c, i) => (
                    <td key={i} className={c === lo ? "lo" : ""}>
                      {money(c)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {lastChecked && (
        <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 8 }}>
          Prices last checked {formatPriceCheckDate(lastChecked)}
        </div>
      )}
    </div>
  );
}
