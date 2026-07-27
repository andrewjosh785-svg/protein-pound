// Thin fetch wrapper around Open Food Facts' public, no-auth product API. Confirmed the
// real response shape via a live lookup: { status, product: { product_name, nutriments:
// { "energy-kcal_100g", "energy-kcal_serving", "proteins_100g", "proteins_serving" },
// product_quantity, serving_quantity } }. carbohydrates_100g/_serving and fat_100g/_serving
// follow the same documented OFF nutriment naming convention as proteins/energy above, but
// weren't individually re-verified via a fresh live lookup the way kcal/protein were. Per-
// serving fields are used directly when present (most reliable — the label's own stated
// serving figures, not our guess); otherwise falls back to the per-100g figure scaled by
// the serving quantity. Open Food Facts has no price data at all — cost is always a manual
// entry on the confirm screen, never looked up here.
export interface BarcodeLookupResult {
  name: string;
  /** Nutrition for ONE serving, as defined by the product's own label. Null means Open
   * Food Facts has this product listed (name/photo known) but nobody has filled in its
   * nutrition facts yet — a real, common gap, especially for smaller/regional brands —
   * distinct from a genuine 0 (e.g. water), which is a real reported value. */
  kcalPerServing: number | null;
  proteinGPerServing: number | null;
  carbsGPerServing: number | null;
  fatGPerServing: number | null;
  /** How many of those servings make up the whole pack (product_quantity /
   * serving_quantity), so the confirm screen can default to "the whole thing" rather than
   * a single serving — the far more common case when someone scans and finishes a snack
   * in one go, and the only sensible basis for a cost figure people actually know
   * (what they paid for the whole pack, not a fiddly per-serving fraction). Null when
   * either quantity is missing from the product's data. */
  packServings: number | null;
  /** What the macro figures above are FOR — e.g. "219 g", "1 burger (219 g)", or "100g" when
   * OFF has no serving-size info at all and the figures are the raw per-100g values. Without
   * this, "550 kcal" is ambiguous between a whole item and a 100g reference amount — two very
   * different real quantities. */
  servingBasis: string;
}

export async function lookupBarcode(barcode: string): Promise<BarcodeLookupResult | null> {
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
  if (!response.ok) return null;

  const data = await response.json();
  if (data.status !== 1 || !data.product) return null;

  const product = data.product;
  const nutriments = product.nutriments ?? {};
  const name: string = product.product_name || product.product_name_en || "Unknown product";

  const servingQuantity: number | null = product.serving_quantity ?? null;
  const packQuantity: number | null = product.product_quantity ?? null;

  const kcalPerServing = resolveNutrient(nutriments["energy-kcal_serving"], nutriments["energy-kcal_100g"], servingQuantity);
  const proteinGPerServing = resolveNutrient(nutriments["proteins_serving"], nutriments["proteins_100g"], servingQuantity);
  const carbsGPerServing = resolveNutrient(nutriments["carbohydrates_serving"], nutriments["carbohydrates_100g"], servingQuantity);
  const fatGPerServing = resolveNutrient(nutriments["fat_serving"], nutriments["fat_100g"], servingQuantity);

  const packServings = servingQuantity && packQuantity ? packQuantity / servingQuantity : null;

  return {
    name,
    kcalPerServing: kcalPerServing === null ? null : Math.round(kcalPerServing),
    proteinGPerServing: proteinGPerServing === null ? null : Math.round(proteinGPerServing),
    carbsGPerServing: carbsGPerServing === null ? null : Math.round(carbsGPerServing),
    fatGPerServing: fatGPerServing === null ? null : Math.round(fatGPerServing),
    packServings,
    servingBasis: describeServingBasis(product.serving_size, servingQuantity),
  };
}

// undefined = key absent from the API response (no data at all); a present key can
// legitimately be 0 (e.g. water has 0 kcal) and must be trusted, not treated as missing.
function resolveNutrient(perServing: number | undefined, per100g: number | undefined, servingQuantity: number | null): number | null {
  if (typeof perServing === "number") return perServing;
  if (typeof per100g === "number" && servingQuantity) return (per100g * servingQuantity) / 100;
  if (typeof per100g === "number") return per100g;
  return null;
}

// Prefers the label's own raw serving text (e.g. "1 burger (219 g)") since it's the most
// concrete and human-meaningful; falls back to a plain gram figure if only the quantity is
// known; falls back to "100g" as a last resort — when OFF has no serving-size info at all,
// the resolveNutrient() branch that fires in that case is always the raw per-100g figure, so
// this label stays accurate even without per-nutrient tracking of which branch was taken.
function describeServingBasis(rawServingSize: unknown, servingQuantity: number | null): string {
  if (typeof rawServingSize === "string" && rawServingSize.trim()) return rawServingSize.trim();
  if (servingQuantity) return `${servingQuantity}g`;
  return "100g";
}

/** A candidate match from a free-text food search (e.g. "Big Mac"), for the quick-add
 * search-to-prefill flow — an additional option alongside barcode scan and manual entry,
 * not a replacement for either. Unlike a barcode lookup (one exact product), a name search
 * returns several candidates, so results are always shown as a pick-list, never auto-applied. */
export interface FoodSearchResult {
  code: string;
  name: string;
  brand: string | null;
  kcalPerServing: number | null;
  proteinGPerServing: number | null;
  carbsGPerServing: number | null;
  fatGPerServing: number | null;
  /** What the macro figures are FOR — see BarcodeLookupResult.servingBasis above. */
  servingBasis: string;
}

export async function searchFoodByName(query: string): Promise<FoodSearchResult[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "8",
    fields: "code,product_name,brands,nutriments,serving_quantity,serving_size",
  });
  const response = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`);
  if (!response.ok) return [];

  const data = await response.json();
  const products: unknown[] = Array.isArray(data.products) ? data.products : [];

  return products
    .map((product: any): FoodSearchResult | null => {
      const name: string | undefined = product.product_name || product.product_name_en;
      if (!name) return null;

      const nutriments = product.nutriments ?? {};
      const servingQuantity: number | null = product.serving_quantity ?? null;
      const kcalPerServing = resolveNutrient(nutriments["energy-kcal_serving"], nutriments["energy-kcal_100g"], servingQuantity);
      // No nutrition data at all for this candidate — unlike a barcode lookup (one specific
      // product, nothing else to show), a name search has other results worth surfacing
      // instead, so skip rather than show a blank-data row.
      if (kcalPerServing === null) return null;

      return {
        code: String(product.code ?? ""),
        name,
        brand: product.brands || null,
        kcalPerServing: Math.round(kcalPerServing),
        proteinGPerServing: roundOrNull(resolveNutrient(nutriments["proteins_serving"], nutriments["proteins_100g"], servingQuantity)),
        carbsGPerServing: roundOrNull(
          resolveNutrient(nutriments["carbohydrates_serving"], nutriments["carbohydrates_100g"], servingQuantity)
        ),
        fatGPerServing: roundOrNull(resolveNutrient(nutriments["fat_serving"], nutriments["fat_100g"], servingQuantity)),
        servingBasis: describeServingBasis(product.serving_size, servingQuantity),
      };
    })
    .filter((r): r is FoodSearchResult => r !== null);
}

function roundOrNull(n: number | null): number | null {
  return n === null ? null : Math.round(n);
}
