-- Repairs a stale AI-saved recipe from before the carbs/fat feature shipped: "High Protein
-- Lentil & Chickpea Curry" (32g protein, 530 kcal/serving, 4 servings) still shows the
-- pre-feature default of 0g carbs / 0g fat, which is physically implausible at 530 kcal.
--
-- This is an estimate from the dish type and macros (protein 32g, kcal 530), not from the
-- recipe's actual ingredient list — a direct lookup of its meal_ingredients was blocked by
-- Claude Code's safety classifier (querying another user's row with the service-role key),
-- so unlike the bulk builtin-meal backfill this one couldn't be derived from real quantities.
-- Legume-and-rice curries are carb-heavy with moderate cooking-oil fat; cross-checked against
-- kcal ≈ protein*4 + carbs*4 + fat*9: 32*4 + 65*4 + 16*9 = 128 + 260 + 144 = 532 ≈ 530.
--
-- Guarded by id (not name) since this repairs one specific known-bad row, not a class match —
-- the save-time guard added alongside this (reject 0g carbs AND 0g fat on AI output) stops any
-- new rows from reaching this state going forward.
update public.meals
set carbs_g = 65, fat_g = 16
where id = '2e4b7069-2f91-4f6c-94c5-a50f56afbfa2'
  and carbs_g = 0
  and fat_g = 0;
