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
  MEAL_CATEGORIES,
  MEAL_CATEGORY_LABELS,
  type Ingredient,
  type Meal,
  type MealCategory,
  type PriceLookup,
  type Store,
} from "@protein-pound/shared";
import { useMeals } from "../../lib/queries/useMeals";
import { useStoresAndPrices } from "../../lib/queries/useStoresAndPrices";
import { useIngredients } from "../../lib/queries/useIngredients";
import { useDeleteMeal } from "../../lib/queries/useDeleteMeal";
import { useAuth } from "../../lib/auth/AuthContext";
import { AiEditPanel } from "./AiEditPanel";

type SortBy = "value" | "cheap" | "protein";
type DietFilter = "all" | "veggie" | "meat";
type OwnerFilter = "all" | "mine";

const SORT_VALUES: SortBy[] = ["value", "cheap", "protein"];
const DIET_VALUES: DietFilter[] = ["all", "veggie", "meat"];
const OWNER_VALUES: OwnerFilter[] = ["all", "mine"];
const FILTER_PARAM_KEYS = ["q", "store", "sort", "category", "diet", "owner"] as const;

function readParam<T extends string>(params: URLSearchParams, key: string, valid: readonly T[], fallback: T): T {
  const value = params.get(key);
  return (valid as readonly string[]).includes(value ?? "") ? (value as T) : fallback;
}

export function MealsPage({
  onEditMeal,
  onOpenMeal,
}: {
  onEditMeal: (meal: Meal) => void;
  onOpenMeal: (meal: Meal) => void;
}) {
  const { user } = useAuth();
  const mealsQuery = useMeals();
  const storesQuery = useStoresAndPrices();
  const ingredientsQuery = useIngredients();
  const deleteMeal = useDeleteMeal();
  // Lazy initializers so a shared/bookmarked link (e.g. ?store=...&category=dinner) opens
  // with the same filters already applied, instead of always resetting to defaults.
  const [searchQuery, setSearchQuery] = useState<string>(
    () => new URLSearchParams(window.location.search).get("q") ?? ""
  );
  const [storeId, setStoreId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("store") || null
  );
  const [sortBy, setSortBy] = useState<SortBy>(() =>
    readParam(new URLSearchParams(window.location.search), "sort", SORT_VALUES, "value")
  );
  const [category, setCategory] = useState<MealCategory | "">(() =>
    readParam(new URLSearchParams(window.location.search), "category", MEAL_CATEGORIES, "")
  );
  const [dietFilter, setDietFilter] = useState<DietFilter>(() =>
    readParam(new URLSearchParams(window.location.search), "diet", DIET_VALUES, "all")
  );
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>(() =>
    readParam(new URLSearchParams(window.location.search), "owner", OWNER_VALUES, "all")
  );
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null);
  const [openPricesId, setOpenPricesId] = useState<string | null>(null);
  const [openAiEditId, setOpenAiEditId] = useState<string | null>(null);

  // Keep the URL in sync with the current filters so this view is shareable/bookmarkable —
  // history.replaceState (not pushState) so tweaking a filter doesn't spam browser back-history.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setOrClear = (key: string, value: string, isDefault: boolean) => {
      if (isDefault) params.delete(key);
      else params.set(key, value);
    };
    setOrClear("q", searchQuery.trim(), !searchQuery.trim());
    setOrClear("store", storeId ?? "", !storeId);
    setOrClear("sort", sortBy, sortBy === "value");
    setOrClear("category", category, !category);
    setOrClear("diet", dietFilter, dietFilter === "all");
    setOrClear("owner", ownerFilter, ownerFilter === "all");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));

    // Leaving the Meals tab: strip these params so they don't linger over on other pages.
    return () => {
      const cleared = new URLSearchParams(window.location.search);
      for (const key of FILTER_PARAM_KEYS) cleared.delete(key);
      const remaining = cleared.toString();
      window.history.replaceState(null, "", window.location.pathname + (remaining ? `?${remaining}` : ""));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, storeId, sortBy, category, dietFilter, ownerFilter]);

  if (mealsQuery.isLoading || storesQuery.isLoading || ingredientsQuery.isLoading) {
    return <div className="note">Loading meals…</div>;
  }
  if (mealsQuery.isError || storesQuery.isError || ingredientsQuery.isError) {
    return (
      <div className="note">
        Couldn't load meals from Supabase. Check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in
        apps/web/.env and that migrations + seed.sql have been applied.
      </div>
    );
  }

  const meals = mealsQuery.data ?? [];
  const { stores, prices } = storesQuery.data!;
  const ingredients = ingredientsQuery.data!;
  const priceLookup = buildPriceLookup(prices);
  const lastChecked = latestPriceCheck(prices);

  const searchLower = searchQuery.trim().toLowerCase();
  const rows = meals
    .filter(
      (m) =>
        !searchLower ||
        m.name.toLowerCase().includes(searchLower) ||
        m.description.toLowerCase().includes(searchLower)
    )
    .filter((m) => dietFilter === "all" || (dietFilter === "veggie" ? m.isVeggie : !m.isVeggie))
    .filter((m) => ownerFilter === "all" || (!!user && m.ownerId === user.id))
    .filter((m) => !category || m.category === category)
    .map((m) => {
      const perServing = mealCostPerServing(m, priceLookup, storeId);
      return { meal: m, perServing, valuePerPound: proteinPerPound(perServing, m.proteinG) };
    });

  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "value") return b.valuePerPound - a.valuePerPound;
    if (sortBy === "cheap") return a.perServing - b.perServing;
    return b.meal.proteinG - a.meal.proteinG;
  });

  // "Best value" must reflect the full catalog, not whatever subset the current filters
  // happen to leave visible — otherwise a single filtered-in meal gets crowned by default.
  let bestValueMealId: string | null = null;
  let bestValueSoFar = -Infinity;
  for (const m of meals) {
    const v = proteinPerPound(mealCostPerServing(m, priceLookup, storeId), m.proteinG);
    if (v > bestValueSoFar) {
      bestValueSoFar = v;
      bestValueMealId = m.id;
    }
  }

  return (
    <>
      <h2 className="sr-only">Meals</h2>
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ position: "relative", maxWidth: 420 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search meals…"
            aria-label="Search meals"
            style={{ width: "100%", paddingRight: searchQuery ? 34 : undefined }}
          />
          {searchQuery && (
            <button
              className="xbtn"
              aria-label="Clear search"
              onClick={() => setSearchQuery("")}
              style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)" }}
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div className="ctrls">
        <div className="fld-inline">
          <label htmlFor="meals-price-at">Price at</label>
          <select id="meals-price-at" value={storeId ?? ""} onChange={(e) => setStoreId(e.target.value || null)}>
            <option value="">Cheapest mix</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="fld-inline">
          <label htmlFor="meals-sort">Sort</label>
          <select id="meals-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
            <option value="value">Best protein per £</option>
            <option value="cheap">Cheapest per serving</option>
            <option value="protein">Most protein</option>
          </select>
        </div>
        <div className="fld-inline">
          <label htmlFor="meals-category">Category</label>
          <select id="meals-category" value={category} onChange={(e) => setCategory(e.target.value as MealCategory | "")}>
            <option value="">All categories</option>
            {MEAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {MEAL_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="fld-inline">
          <label htmlFor="meals-diet">Diet</label>
          <select id="meals-diet" value={dietFilter} onChange={(e) => setDietFilter(e.target.value as DietFilter)}>
            <option value="all">All</option>
            <option value="veggie">Vegetarian</option>
            <option value="meat">Meat</option>
          </select>
        </div>
        <div className="fld-inline">
          <label htmlFor="meals-owner">Show</label>
          <select id="meals-owner" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value as OwnerFilter)}>
            <option value="all">All meals</option>
            <option value="mine">My recipes</option>
          </select>
        </div>
      </div>
      {lastChecked && (
        <div style={{ fontSize: 11.5, color: "var(--faint)", padding: "0 20px 10px" }}>
          Prices last checked {formatPriceCheckDate(lastChecked)}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="empty" style={{ margin: 20 }}>
          {searchLower ? (
            <>No meals match "{searchQuery.trim()}".</>
          ) : ownerFilter === "mine" ? (
            <>
              You haven't saved any recipes yet — generate one with ✨ Generate, or build one in
              Price my recipe.
            </>
          ) : (
            <>No meals match these filters.</>
          )}
        </div>
      ) : (
        <div className="grid">
          {sorted.map(({ meal, perServing, valuePerPound }) => (
            <MealCard
              key={meal.id}
              meal={meal}
              perServing={perServing}
              valuePerPound={valuePerPound}
              isBest={meal.id === bestValueMealId && sortBy === "value"}
              storeLabel={storeId ? stores.find((s) => s.id === storeId)?.name ?? "" : "cheapest mix"}
              ingredients={ingredients}
              stores={stores}
              priceLookup={priceLookup}
              recipeOpen={openRecipeId === meal.id}
              onToggleRecipe={() => {
                setOpenRecipeId(openRecipeId === meal.id ? null : meal.id);
                setOpenPricesId(null);
                setOpenAiEditId(null);
              }}
              pricesOpen={openPricesId === meal.id}
              onTogglePrices={() => {
                setOpenPricesId(openPricesId === meal.id ? null : meal.id);
                setOpenRecipeId(null);
                setOpenAiEditId(null);
              }}
              aiEditOpen={openAiEditId === meal.id}
              onToggleAiEdit={() => {
                setOpenAiEditId(openAiEditId === meal.id ? null : meal.id);
                setOpenRecipeId(null);
                setOpenPricesId(null);
              }}
              isOwner={!!user && meal.ownerId === user.id}
              onEdit={() => onEditMeal(meal)}
              onOpen={() => onOpenMeal(meal)}
              onDelete={() => {
                if (window.confirm(`Delete "${meal.name}"? This can't be undone.`)) {
                  deleteMeal.mutate(meal.id);
                }
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function MealCard({
  meal,
  perServing,
  valuePerPound,
  isBest,
  storeLabel,
  ingredients,
  stores,
  priceLookup,
  recipeOpen,
  onToggleRecipe,
  pricesOpen,
  onTogglePrices,
  aiEditOpen,
  onToggleAiEdit,
  isOwner,
  onEdit,
  onOpen,
  onDelete,
}: {
  meal: Meal;
  perServing: number;
  valuePerPound: number;
  isBest: boolean;
  storeLabel: string;
  ingredients: Map<string, Ingredient>;
  stores: Store[];
  priceLookup: PriceLookup;
  recipeOpen: boolean;
  onToggleRecipe: () => void;
  pricesOpen: boolean;
  onTogglePrices: () => void;
  aiEditOpen: boolean;
  onToggleAiEdit: () => void;
  isOwner: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [scaleServings, setScaleServings] = useState(meal.servings);
  const isScaled = scaleServings !== meal.servings && scaleServings > 0;
  const scaleFactor = meal.servings > 0 ? scaleServings / meal.servings : 1;

  return (
    <div className="card">
      <div className="card-top">
        <div className="badges">
          {isBest && <span className="badge best">Best value</span>}
          {meal.source !== "builtin" && (
            <span className="badge cust">{meal.source === "ai" ? "✨ AI" : "Yours"}</span>
          )}
          {meal.isVeggie && <span className="badge v">Veggie</span>}
          <span className="badge">{MEAL_CATEGORY_LABELS[meal.category]}</span>
          <span className="badge">{servingsLabel(meal.servings)}</span>
        </div>
        <h3>
          <a
            href={`/meals/${meal.slug}`}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              onOpen();
            }}
          >
            {meal.name}
          </a>
        </h3>
        <p className="desc">{meal.description}</p>
        <div className="stats">
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
      </div>
      <div className="tagrow">
        <div className="sel">
          <div className="big ppp-disp">{money(perServing)}</div>
          <div className="sm">per serving · {storeLabel}</div>
        </div>
        <div className="valcell">
          <div className="big ppp-disp">{valuePerPound.toFixed(0)}g</div>
          <div className="sm">protein per £1</div>
        </div>
      </div>

      {recipeOpen && (
        <div className="recipe">
          <h4>
            Recipe <span className="time">· {meal.timeLabel ?? "—"} · serves {meal.servings}</span>
          </h4>
          <div className="fld-inline" style={{ margin: "2px 0 12px" }}>
            <label htmlFor={`scale-${meal.id}`}>Cooking for</label>
            <input
              id={`scale-${meal.id}`}
              type="number"
              min="1"
              value={scaleServings}
              onChange={(e) => setScaleServings(Math.max(1, Number(e.target.value)))}
              style={{ width: 56 }}
            />
            <span style={{ color: "var(--muted)" }}>servings</span>
          </div>
          {isScaled && (
            <div className="tcard" style={{ marginBottom: 12, fontSize: 12.5 }}>
              For {scaleServings} servings: <b>{money(perServing * scaleServings)}</b> total ·{" "}
              <b>{Math.round(meal.kcal * scaleServings).toLocaleString()}</b> kcal ·{" "}
              <b>{Math.round(meal.proteinG * scaleServings)}g</b> protein
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
                      — {packAmountLabel(use.packFraction * scaleFactor)} for {scaleServings}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <ol>
            {meal.method.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {pricesOpen && (
        <div className="brk">
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
      )}

      {aiEditOpen && <AiEditPanel meal={meal} ingredients={ingredients} isOwner={isOwner} />}

      <div className="actions">
        <button onClick={onToggleRecipe}>{recipeOpen ? "Hide recipe" : "Recipe"}</button>
        <button onClick={onTogglePrices}>{pricesOpen ? "Hide prices" : "Prices"}</button>
        <button onClick={onToggleAiEdit}>{aiEditOpen ? "Cancel" : "✨ Edit with AI"}</button>
        {isOwner && <button onClick={onEdit}>Edit</button>}
        {isOwner && <button onClick={onDelete}>Delete</button>}
      </div>
    </div>
  );
}
