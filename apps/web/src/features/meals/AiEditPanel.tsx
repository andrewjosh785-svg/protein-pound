import { useState } from "react";
import { mealCostPerServing, money, type Ingredient, type Meal, type PriceLookup } from "@protein-pound/shared";
import { useGenerateRecipe } from "../../lib/queries/useGenerateRecipe";
import { useSaveGeneratedMeal } from "../../lib/queries/useSaveGeneratedMeal";
import { useUpdateCustomMeal } from "../../lib/queries/useUpdateCustomMeal";
import { recipeToMeal, mealToEditPayload } from "../../lib/recipeConversions";

interface Delta {
  proteinG: number;
  carbsG: number;
  fatG: number;
  kcal: number;
  cost: number;
}

/** Best-effort read of what direction the instruction asked for, so a result that moved
 * the wrong way can be flagged instead of silently accepted as if the edit worked. */
function detectExpectedDirection(instruction: string): { expectCheaper: boolean; expectMoreProtein: boolean } {
  const lower = instruction.toLowerCase();
  return {
    expectCheaper: /cheap|cheaper|budget|less expensive/.test(lower),
    expectMoreProtein: /protein/.test(lower) && /(more|higher|increase|boost|extra|up)/.test(lower),
  };
}

function fmtDelta(before: number, after: number, unit: string, decimals = 0): string {
  const diff = after - before;
  const sign = diff > 0 ? "+" : "";
  return `${before.toFixed(decimals)}${unit} → ${after.toFixed(decimals)}${unit} (${sign}${diff.toFixed(decimals)}${unit})`;
}

export function AiEditPanel({
  meal,
  ingredients,
  priceLookup,
  isOwner,
}: {
  meal: Meal;
  ingredients: Map<string, Ingredient>;
  priceLookup: PriceLookup;
  isOwner: boolean;
}) {
  const [instruction, setInstruction] = useState("");
  const [lastInstruction, setLastInstruction] = useState("");
  const [flag, setFlag] = useState<string | null>(null);
  const [delta, setDelta] = useState<{ before: Delta; after: Delta } | null>(null);
  const generate = useGenerateRecipe();
  const save = useSaveGeneratedMeal();
  const update = useUpdateCustomMeal();

  const busy = generate.isPending || save.isPending || update.isPending;
  const done = (save.isSuccess || update.isSuccess) && !flag;

  const runInstruction = (instructionText: string) => {
    if (!instructionText.trim() || busy) return;
    save.reset();
    update.reset();
    setFlag(null);
    setDelta(null);
    setLastInstruction(instructionText.trim());

    const ingredientKeyToId = new Map<string, string>();
    for (const ing of ingredients.values()) ingredientKeyToId.set(ing.key, ing.id);

    const before: Delta = {
      proteinG: meal.proteinG,
      carbsG: meal.carbsG,
      fatG: meal.fatG,
      kcal: meal.kcal,
      cost: mealCostPerServing(meal, priceLookup, null),
    };

    generate.mutate(
      { prompt: instructionText.trim(), editMeal: mealToEditPayload(meal, ingredients) },
      {
        onSuccess: (recipe) => {
          const updatedMeal = recipeToMeal(recipe, ingredientKeyToId, {
            id: meal.id,
            slug: meal.slug,
            ownerId: meal.ownerId,
            source: meal.source,
          });
          const after: Delta = {
            proteinG: updatedMeal.proteinG,
            carbsG: updatedMeal.carbsG,
            fatG: updatedMeal.fatG,
            kcal: updatedMeal.kcal,
            cost: mealCostPerServing(updatedMeal, priceLookup, null),
          };
          setDelta({ before, after });

          // Physically implausible — reject rather than save, since a real recipe can't be
          // 0g carbs AND 0g fat at any real kcal.
          if (after.carbsG === 0 && after.fatG === 0) {
            setFlag("This result shows 0g carbs and 0g fat, which isn't realistic — try again.");
            return;
          }

          const { expectCheaper, expectMoreProtein } = detectExpectedDirection(instructionText);
          if (expectCheaper && after.cost > before.cost + 0.005) {
            setFlag("You asked for cheaper, but this actually costs more per serving.");
          } else if (expectMoreProtein && after.proteinG < before.proteinG) {
            setFlag("You asked for more protein, but this has less.");
          }

          if (isOwner) {
            update.mutate({ mealId: meal.id, meal: updatedMeal });
          } else {
            save.mutate({ recipe, ingredientKeyToId });
          }
        },
      }
    );
  };

  const handleApply = () => runInstruction(instruction);
  const handleRetry = () => runInstruction(lastInstruction);

  return (
    <div className="recipe">
      <h4>✨ Edit with AI</h4>
      <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 10px" }}>
        {isOwner
          ? "Describe a change and it'll update this recipe in place."
          : "This isn't your recipe, so your edit saves as a new copy in My recipes — the original is left untouched."}
      </p>
      {!done && !flag && (
        <div style={{ display: "flex" }}>
          <input
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder='e.g. "swap chicken for tofu" or "make it dairy-free"'
            style={{ width: "100%", borderRight: "none" }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleApply();
            }}
          />
          <button
            className="bigbtn"
            style={{
              fontSize: 14,
              padding: "8px 16px",
              height: 32,
              whiteSpace: "nowrap",
              ...(busy ? { opacity: 0.6, cursor: "wait" } : {}),
            }}
            onClick={handleApply}
            disabled={busy}
          >
            {busy ? "Working…" : "Apply"}
          </button>
        </div>
      )}
      {generate.isError && (
        <div className="bad" style={{ fontSize: 12.5, marginTop: 8 }}>
          {generate.error instanceof Error ? generate.error.message : "Something went wrong."}
        </div>
      )}
      {(save.isError || update.isError) && (
        <div className="bad" style={{ fontSize: 12.5, marginTop: 8 }}>
          Generated the edit, but couldn't save it — try again.
        </div>
      )}
      {flag && (
        <div className="tcard" style={{ borderColor: "var(--deal)", marginTop: 8 }}>
          <div className="bad" style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 8 }}>
            {flag}
          </div>
          <button className="bigbtn alt" style={{ fontSize: 13, padding: "6px 12px" }} onClick={handleRetry} disabled={busy}>
            {busy ? "Retrying…" : "Try again"}
          </button>
        </div>
      )}
      {delta && (done || flag) && (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
          {money(delta.before.cost)} → {money(delta.after.cost)} / serving ·{" "}
          {fmtDelta(delta.before.proteinG, delta.after.proteinG, "g")} protein ·{" "}
          {fmtDelta(delta.before.carbsG, delta.after.carbsG, "g")} carbs ·{" "}
          {fmtDelta(delta.before.fatG, delta.after.fatG, "g")} fat ·{" "}
          {fmtDelta(delta.before.kcal, delta.after.kcal, "")} kcal
        </div>
      )}
      {done && (
        <div className="ok" style={{ fontSize: 12.5, marginTop: delta ? 4 : 0 }}>
          {isOwner ? "Recipe updated." : "Saved as a new recipe in My recipes."}
        </div>
      )}
    </div>
  );
}
