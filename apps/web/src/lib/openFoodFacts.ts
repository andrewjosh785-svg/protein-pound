// Lean, search-only counterpart to apps/mobile/src/lib/openFoodFacts.ts — web has no barcode
// scan feature (no camera), so this only carries the free-text search used by the quick-add
// search-to-prefill flow, not the barcode lookup. Confirmed live that the search API's
// nutriments shape matches the single-product lookup mobile already handles, so the same
// per-serving/per-100g/null fallback logic applies here too.
export interface FoodSearchResult {
  code: string;
  name: string;
  brand: string | null;
  kcalPerServing: number | null;
  proteinGPerServing: number | null;
  carbsGPerServing: number | null;
  fatGPerServing: number | null;
}

export async function searchFoodByName(query: string): Promise<FoodSearchResult[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "8",
    fields: "code,product_name,brands,nutriments,serving_quantity",
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
      // No nutrition data at all for this candidate — a name search has other results worth
      // surfacing instead, so skip rather than show a blank-data row.
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
      };
    })
    .filter((r): r is FoodSearchResult => r !== null);
}

// undefined = key absent from the API response (no data at all); a present key can
// legitimately be 0 (e.g. water has 0 kcal) and must be trusted, not treated as missing.
function resolveNutrient(perServing: number | undefined, per100g: number | undefined, servingQuantity: number | null): number | null {
  if (typeof perServing === "number") return perServing;
  if (typeof per100g === "number" && servingQuantity) return (per100g * servingQuantity) / 100;
  if (typeof per100g === "number") return per100g;
  return null;
}

function roundOrNull(n: number | null): number | null {
  return n === null ? null : Math.round(n);
}
