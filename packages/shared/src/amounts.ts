/** Preset pack-fraction options for the recipe builder's ingredient picker, with human labels. */
export const PACK_AMOUNTS: Array<[value: number, label: string]> = [
  [0.1, "1/10 pack"],
  [0.15, "0.15 pack"],
  [0.2, "1/5 pack"],
  [0.25, "¼ pack"],
  [0.33, "⅓ pack"],
  [0.5, "½ pack"],
  [0.6, "0.6 pack"],
  [0.75, "¾ pack"],
  [1, "1 pack"],
  [1.5, "1½ packs"],
  [2, "2 packs"],
  [3, "3 packs"],
];

export function packAmountLabel(fraction: number): string {
  const found = PACK_AMOUNTS.find(([v]) => Math.abs(v - fraction) < 0.001);
  return found ? found[1] : `${Math.round(fraction * 100) / 100} pack`;
}

/**
 * Combines a recipe ingredient's human-readable quantity with its name for display,
 * avoiding duplication when the quantity text already names the ingredient — either
 * wholesale ("4 eggs", which our AI recipe prompt's own examples encourage) or via a
 * shared word (e.g. a "pantry" use of "oil & seasoning" already says "oil", so
 * appending the ingredient's full name "Oil, spices & sauces" would just be noise).
 */
export function formatIngredientLine(humanQuantity: string, ingredientName: string): string {
  const hq = humanQuantity.toLowerCase();
  const nameWords = ingredientName
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2);
  const overlaps = nameWords.some((w) => hq.includes(w) || hq.includes(w.endsWith("s") ? w.slice(0, -1) : w));
  if (overlaps) return humanQuantity;
  return `${humanQuantity} ${ingredientName.toLowerCase()}`;
}

/** "1 serving" / "4 servings" — avoids the "1 servings" pluralization bug. */
export function servingsLabel(n: number): string {
  return `${n} serving${n === 1 ? "" : "s"}`;
}
