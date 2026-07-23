// Thin fetch wrapper around Open Food Facts' public, no-auth product API. Confirmed the
// real response shape via a live lookup: { status, product: { product_name, nutriments:
// { "energy-kcal_100g", "energy-kcal_serving", "proteins_100g", "proteins_serving" },
// product_quantity, serving_quantity } }. Per-serving fields are used directly when
// present (most reliable — the label's own stated serving figures, not our guess);
// otherwise falls back to the per-100g figure scaled by the serving quantity. Open Food
// Facts has no price data at all — cost is always a manual entry on the confirm screen,
// never looked up here.
export interface BarcodeLookupResult {
  name: string;
  /** Nutrition for ONE serving, as defined by the product's own label. Null means Open
   * Food Facts has this product listed (name/photo known) but nobody has filled in its
   * nutrition facts yet — a real, common gap, especially for smaller/regional brands —
   * distinct from a genuine 0 (e.g. water), which is a real reported value. */
  kcalPerServing: number | null;
  proteinGPerServing: number | null;
  /** How many of those servings make up the whole pack (product_quantity /
   * serving_quantity), so the confirm screen can default to "the whole thing" rather than
   * a single serving — the far more common case when someone scans and finishes a snack
   * in one go, and the only sensible basis for a cost figure people actually know
   * (what they paid for the whole pack, not a fiddly per-serving fraction). Null when
   * either quantity is missing from the product's data. */
  packServings: number | null;
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

  const packServings = servingQuantity && packQuantity ? packQuantity / servingQuantity : null;

  return {
    name,
    kcalPerServing: kcalPerServing === null ? null : Math.round(kcalPerServing),
    proteinGPerServing: proteinGPerServing === null ? null : Math.round(proteinGPerServing),
    packServings,
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
