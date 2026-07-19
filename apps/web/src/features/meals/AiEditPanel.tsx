import { useState } from "react";
import type { Ingredient, Meal } from "@protein-pound/shared";
import { useGenerateRecipe } from "../../lib/queries/useGenerateRecipe";
import { useSaveGeneratedMeal } from "../../lib/queries/useSaveGeneratedMeal";
import { useUpdateCustomMeal } from "../../lib/queries/useUpdateCustomMeal";
import { recipeToMeal, mealToEditPayload } from "../../lib/recipeConversions";

export function AiEditPanel({
  meal,
  ingredients,
  isOwner,
}: {
  meal: Meal;
  ingredients: Map<string, Ingredient>;
  isOwner: boolean;
}) {
  const [instruction, setInstruction] = useState("");
  const generate = useGenerateRecipe();
  const save = useSaveGeneratedMeal();
  const update = useUpdateCustomMeal();

  const busy = generate.isPending || save.isPending || update.isPending;
  const done = save.isSuccess || update.isSuccess;

  const handleApply = () => {
    if (!instruction.trim() || busy) return;
    save.reset();
    update.reset();

    const ingredientKeyToId = new Map<string, string>();
    for (const ing of ingredients.values()) ingredientKeyToId.set(ing.key, ing.id);

    generate.mutate(
      { prompt: instruction.trim(), editMeal: mealToEditPayload(meal, ingredients) },
      {
        onSuccess: (recipe) => {
          if (isOwner) {
            const updatedMeal = recipeToMeal(recipe, ingredientKeyToId, {
              id: meal.id,
              slug: meal.slug,
              ownerId: meal.ownerId,
              source: meal.source,
            });
            update.mutate({ mealId: meal.id, meal: updatedMeal });
          } else {
            save.mutate({ recipe, ingredientKeyToId });
          }
        },
      }
    );
  };

  return (
    <div className="recipe">
      <h4>✨ Edit with AI</h4>
      <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 10px" }}>
        {isOwner
          ? "Describe a change and it'll update this recipe in place."
          : "This isn't your recipe, so your edit saves as a new copy in My recipes — the original is left untouched."}
      </p>
      {!done && (
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
      {done && (
        <div className="ok" style={{ fontSize: 12.5 }}>
          {isOwner ? "Recipe updated." : "Saved as a new recipe in My recipes."}
        </div>
      )}
    </div>
  );
}
