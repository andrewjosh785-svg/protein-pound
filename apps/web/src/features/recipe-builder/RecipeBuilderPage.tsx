import { useEffect, useState } from "react";
import {
  money,
  proteinPerPound,
  PACK_AMOUNTS,
  packAmountLabel,
  MEAL_CATEGORIES,
  MEAL_CATEGORY_LABELS,
  type Meal,
  type MealCategory,
} from "@protein-pound/shared";
import { useIngredients } from "../../lib/queries/useIngredients";
import { useStoresAndPrices } from "../../lib/queries/useStoresAndPrices";
import { useSaveCustomMeal } from "../../lib/queries/useSaveCustomMeal";
import { useUpdateCustomMeal } from "../../lib/queries/useUpdateCustomMeal";

interface BuilderItem {
  ingredientId: string;
  packFraction: number;
}

const emptyForm = () => ({
  name: "",
  servings: 2,
  protein: 25,
  kcal: 450,
  veggie: false,
  category: "dinner" as MealCategory,
  method: "",
  items: [] as BuilderItem[],
});

export function RecipeBuilderPage({
  editingMeal,
  onDoneEditing,
}: {
  editingMeal: Meal | null;
  onDoneEditing: () => void;
}) {
  const ingredientsQuery = useIngredients();
  const storesQuery = useStoresAndPrices();
  const save = useSaveCustomMeal();
  const update = useUpdateCustomMeal();

  const [name, setName] = useState("");
  const [servings, setServings] = useState(2);
  const [protein, setProtein] = useState(25);
  const [kcal, setKcal] = useState(450);
  const [veggie, setVeggie] = useState(false);
  const [category, setCategory] = useState<MealCategory>("dinner");
  const [method, setMethod] = useState("");
  const [items, setItems] = useState<BuilderItem[]>([]);

  // Reload the form whenever the meal being edited changes — including back to null,
  // which resets to a blank recipe (e.g. after finishing an edit or cancelling out of one).
  useEffect(() => {
    if (editingMeal) {
      setName(editingMeal.name);
      setServings(editingMeal.servings);
      setProtein(editingMeal.proteinG);
      setKcal(editingMeal.kcal);
      setVeggie(editingMeal.isVeggie);
      setCategory(editingMeal.category);
      setMethod(editingMeal.method.join("\n"));
      setItems(
        editingMeal.ingredients.map((use) => ({ ingredientId: use.ingredientId, packFraction: use.packFraction }))
      );
    } else {
      const blank = emptyForm();
      setName(blank.name);
      setServings(blank.servings);
      setProtein(blank.protein);
      setKcal(blank.kcal);
      setVeggie(blank.veggie);
      setCategory(blank.category);
      setMethod(blank.method);
      setItems(blank.items);
    }
    save.reset();
    update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingMeal]);

  if (ingredientsQuery.isLoading || storesQuery.isLoading) {
    return <div className="note">Loading ingredient database…</div>;
  }
  if (ingredientsQuery.isError || storesQuery.isError) {
    return <div className="note">Couldn't load the ingredient database.</div>;
  }

  const ingredients = ingredientsQuery.data!;
  const ingredientList = Array.from(ingredients.values()).sort((a, b) => a.name.localeCompare(b.name));
  const { stores, prices } = storesQuery.data!;
  const priceLookup = new Map<string, Map<string, number>>();
  for (const p of prices) {
    if (!priceLookup.has(p.ingredientId)) priceLookup.set(p.ingredientId, new Map());
    priceLookup.get(p.ingredientId)!.set(p.storeId, p.price);
  }

  const defaultIngredientId = ingredientList[0]?.id ?? "";

  const addItem = () => setItems((prev) => [...prev, { ingredientId: defaultIngredientId, packFraction: 0.25 }]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));
  const updateItem = (index: number, patch: Partial<BuilderItem>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const meal: Meal = {
    id: editingMeal?.id ?? "builder",
    slug: "builder",
    name: name.trim() || "My recipe",
    servings: Math.max(1, servings),
    proteinG: Math.max(0, protein),
    kcal: Math.max(0, kcal),
    isVeggie: veggie,
    timeLabel: editingMeal?.timeLabel ?? null,
    description: editingMeal?.description ?? "Your own recipe, priced from the ingredient database.",
    method: method
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    source: editingMeal?.source ?? "custom",
    ownerId: null,
    category,
    ingredients: items.map((it, index) => ({
      ingredientId: it.ingredientId,
      packFraction: it.packFraction,
      humanQuantity: packAmountLabel(it.packFraction),
      sortOrder: index,
    })),
  };

  // Costed per-store (whole recipe from one supermarket), matching how you'd actually shop for it —
  // not a cheapest-mix blend across stores.
  const storeCosts = stores.map((s) => ({
    store: s,
    cost: meal.ingredients.reduce(
      (sum, use) => sum + (priceLookup.get(use.ingredientId)?.get(s.id) ?? 0) * use.packFraction,
      0
    ),
  }));
  const cheapestCost = storeCosts.length ? Math.min(...storeCosts.map((s) => s.cost)) : 0;
  const perServing = meal.servings > 0 ? cheapestCost / meal.servings : 0;
  const valuePerPound = proteinPerPound(perServing, meal.proteinG);

  const isEditing = editingMeal !== null;
  const activeMutation = isEditing ? update : save;

  const handleSave = () => {
    if (!items.length) return;
    if (isEditing) {
      update.mutate({ mealId: editingMeal.id, meal }, { onSuccess: onDoneEditing });
    } else {
      save.mutate(meal);
    }
  };

  return (
    <div className="bwrap">
      <h2 className="ppp-disp" style={{ textTransform: "uppercase", fontSize: 28, margin: "6px 0 2px" }}>
        {isEditing ? "Edit recipe" : "Price my recipe"}
      </h2>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 14px" }}>
        {isEditing
          ? "Update the recipe and save — it'll refresh in your Meals list."
          : "Build a recipe from the ingredient database and see what it costs at each supermarket. Save it and it joins the meal rankings — method and all."}
      </p>

      <div className="fldrow">
        <div className="fld">
          <label>Recipe name</label>
          <input
            type="text"
            value={name}
            placeholder="e.g. Mum's chicken curry"
            onChange={(e) => setName(e.target.value)}
            style={{ width: 220 }}
          />
        </div>
        <div className="fld">
          <label>Servings</label>
          <input
            type="number"
            min="1"
            value={servings}
            onChange={(e) => setServings(Number(e.target.value))}
            style={{ width: 110 }}
          />
        </div>
        <div className="fld">
          <label>Protein / serving (g)</label>
          <input
            type="number"
            min="0"
            value={protein}
            onChange={(e) => setProtein(Number(e.target.value))}
            style={{ width: 110 }}
          />
        </div>
        <div className="fld">
          <label>Kcal / serving</label>
          <input
            type="number"
            min="0"
            value={kcal}
            onChange={(e) => setKcal(Number(e.target.value))}
            style={{ width: 110 }}
          />
        </div>
        <div className="fld">
          <label>Vegetarian</label>
          <button className={"pill " + (veggie ? "on" : "")} onClick={() => setVeggie(!veggie)} style={{ width: 110 }}>
            {veggie ? "Yes" : "No"}
          </button>
        </div>
        <div className="fld">
          <label>Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as MealCategory)}
            style={{ width: 110 }}
          >
            {MEAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {MEAL_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          margin: "10px 0 6px",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: ".8px",
          color: "var(--muted)",
        }}
      >
        Ingredients
      </div>
      {items.map((item, i) => (
        <div className="irow" key={i}>
          <select value={item.ingredientId} onChange={(e) => updateItem(i, { ingredientId: e.target.value })}>
            {ingredientList.map((ing) => (
              <option key={ing.id} value={ing.id}>
                {ing.name} ({ing.packLabel})
              </option>
            ))}
          </select>
          <select
            value={item.packFraction}
            onChange={(e) => updateItem(i, { packFraction: Number(e.target.value) })}
          >
            {PACK_AMOUNTS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <button className="xbtn" aria-label="Remove ingredient" onClick={() => removeItem(i)}>
            ✕
          </button>
        </div>
      ))}
      <button className="bigbtn alt" style={{ fontSize: 14, padding: "6px 14px" }} onClick={addItem}>
        + Add ingredient
      </button>

      <div
        style={{
          margin: "16px 0 6px",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: ".8px",
          color: "var(--muted)",
        }}
      >
        Method (one step per line, optional)
      </div>
      <textarea
        value={method}
        placeholder={"Fry the onions...\nAdd the chicken...\nSimmer 20 minutes..."}
        onChange={(e) => setMethod(e.target.value)}
      />

      {items.length > 0 && (
        <>
          <div className="totrow" style={{ marginTop: 20 }}>
            {storeCosts.map(({ store, cost }) => (
              <div className={"tot " + (cost === cheapestCost ? "win" : "")} key={store.id}>
                <div className="st">
                  {store.name}
                  {cost === cheapestCost ? " · cheapest" : ""}
                </div>
                <div className="pr ppp-disp">{money(cost)}</div>
                <div className="df">{money(cost / Math.max(1, meal.servings))} / serving</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, marginBottom: 14 }}>
            At the cheapest store that's <b>{money(perServing)} per serving</b>
            {meal.proteinG > 0 && (
              <>
                {" "}
                — <b className="ok">{valuePerPound.toFixed(0)}g protein per £1</b>
              </>
            )}
          </div>

          {activeMutation.isError && (
            <div className="bad" style={{ marginBottom: 10, fontSize: 12.5 }}>
              {activeMutation.error instanceof Error ? activeMutation.error.message : "Could not save recipe."}
            </div>
          )}
          {save.isSuccess && !isEditing ? (
            <div className="ok" style={{ fontSize: 13 }}>
              Saved — it's now in your Meals list.
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="bigbtn" onClick={handleSave} disabled={activeMutation.isPending}>
                {activeMutation.isPending ? "Saving…" : isEditing ? "Save changes" : "Save to my meals"}
              </button>
              {isEditing && (
                <button className="bigbtn alt" onClick={onDoneEditing}>
                  Cancel
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
