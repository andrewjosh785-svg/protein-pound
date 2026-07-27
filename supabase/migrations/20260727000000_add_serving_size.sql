-- Adds an approximate gram weight for one serving of a meal — "serves 4" with per-serving
-- macros doesn't say how big a serving physically is, which matters when trying to hit a
-- protein target. Nullable (not not-null-default-0 like protein_g/carbs_g/fat_g): unlike those
-- columns, 0g is never a real serving weight, so null distinctly means "not yet estimated"
-- rather than a fake confirmed value. Existing rows stay null until backfilled; new saves
-- (Recipe Builder, AI generation) populate it going forward.
alter table public.meals
  add column serving_size_g int null check (serving_size_g is null or serving_size_g > 0);
