import type {
  DayOfWeek,
  IngredientPrice,
  LogEntry,
  Meal,
  PlanEntry,
  Store,
} from "./types";

export const money = (n: number) => "£" + n.toFixed(2);

/** ingredientId -> storeId -> price, for O(1) lookups instead of the prototype's positional price array. */
export type PriceLookup = Map<string, Map<string, number>>;

export function buildPriceLookup(prices: IngredientPrice[]): PriceLookup {
  const map: PriceLookup = new Map();
  for (const p of prices) {
    if (!map.has(p.ingredientId)) map.set(p.ingredientId, new Map());
    map.get(p.ingredientId)!.set(p.storeId, p.price);
  }
  return map;
}

/** Pass storeId to price at a specific store, or null for the cheapest store per ingredient ("cheapest mix"). */
export function ingredientPriceAt(
  prices: PriceLookup,
  ingredientId: string,
  storeId: string | null
): number {
  const byStore = prices.get(ingredientId);
  if (!byStore || byStore.size === 0) return 0;
  if (storeId) return byStore.get(storeId) ?? 0;
  return Math.min(...byStore.values());
}

export function mealCostPerServing(
  meal: Meal,
  prices: PriceLookup,
  storeId: string | null
): number {
  if (meal.servings <= 0) return 0;
  const total = meal.ingredients.reduce(
    (sum, use) => sum + ingredientPriceAt(prices, use.ingredientId, storeId) * use.packFraction,
    0
  );
  return total / meal.servings;
}

export function proteinPerPound(perServingCost: number, proteinG: number): number {
  return perServingCost > 0 ? proteinG / perServingCost : 0;
}

export interface DayStats {
  kcal: number;
  proteinG: number;
  mealCost: number;
  extraCost: number;
  count: number;
}

export function computeDayStats(
  dayOfWeek: DayOfWeek,
  planEntries: PlanEntry[],
  logEntries: LogEntry[],
  mealsById: Map<string, Meal>,
  prices: PriceLookup
): DayStats {
  let kcal = 0,
    proteinG = 0,
    mealCost = 0,
    extraCost = 0,
    count = 0;

  for (const entry of planEntries) {
    if (entry.dayOfWeek !== dayOfWeek) continue;
    const meal = mealsById.get(entry.mealId);
    if (!meal) continue;
    kcal += meal.kcal * entry.servings;
    proteinG += meal.proteinG * entry.servings;
    // Grocery totals always use the cheapest-mix price, independent of the meal browser's store filter.
    mealCost += mealCostPerServing(meal, prices, null) * entry.servings;
    count += entry.servings;
  }

  for (const log of logEntries) {
    if (log.dayOfWeek !== dayOfWeek) continue;
    kcal += log.kcal * log.quantity;
    proteinG += log.proteinG * log.quantity;
    extraCost += log.cost * log.quantity;
    count += log.quantity;
  }

  return { kcal, proteinG, mealCost, extraCost, count };
}

export interface ShoppingListItem {
  ingredientId: string;
  packsNeeded: number;
}

/** Sums fractional pack usage across the whole week's plan and rounds up to whole packs per ingredient. */
export function buildShoppingList(planEntries: PlanEntry[], mealsById: Map<string, Meal>): ShoppingListItem[] {
  const need = new Map<string, number>();
  for (const entry of planEntries) {
    const meal = mealsById.get(entry.mealId);
    if (!meal || meal.servings <= 0) continue;
    for (const use of meal.ingredients) {
      const frac = (use.packFraction / meal.servings) * entry.servings;
      need.set(use.ingredientId, (need.get(use.ingredientId) ?? 0) + frac);
    }
  }
  return Array.from(need.entries())
    .map(([ingredientId, frac]) => ({ ingredientId, packsNeeded: Math.ceil(frac - 0.0001) }))
    .filter((item) => item.packsNeeded > 0);
}

export function shoppingListTotalsByStore(
  items: ShoppingListItem[],
  stores: Store[],
  prices: PriceLookup
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const store of stores) {
    totals[store.id] = items.reduce(
      (sum, item) => sum + ingredientPriceAt(prices, item.ingredientId, store.id) * item.packsNeeded,
      0
    );
  }
  return totals;
}

export function cheapestStoreId(totals: Record<string, number>): string | null {
  let best: string | null = null;
  let bestValue = Infinity;
  for (const [storeId, value] of Object.entries(totals)) {
    if (value < bestValue) {
      bestValue = value;
      best = storeId;
    }
  }
  return best;
}

/** Most recent updated_at across a set of prices — used as a "prices last checked" trust signal. */
export function latestPriceCheck(prices: IngredientPrice[]): Date | null {
  if (prices.length === 0) return null;
  return new Date(Math.max(...prices.map((p) => new Date(p.updatedAt).getTime())));
}

export function formatPriceCheckDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
