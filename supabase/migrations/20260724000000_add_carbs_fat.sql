-- Adds carbs/fat tracking alongside the existing protein_g/kcal columns, following the
-- exact same convention (not-null, defaulted, non-negative) rather than making them
-- nullable — consistent with how protein_g/kcal already behave on these same tables.
-- Existing rows default to 0 here; a separate corrective migration backfills real,
-- ingredient-derived estimates for the builtin meals and snack_presets so nothing ships
-- showing a misleading 0g for food that obviously has carbs/fat.
alter table public.meals
  add column carbs_g int not null default 0 check (carbs_g >= 0),
  add column fat_g int not null default 0 check (fat_g >= 0);

alter table public.log_entries
  add column carbs_g int not null default 0 check (carbs_g >= 0),
  add column fat_g int not null default 0 check (fat_g >= 0);

alter table public.snack_presets
  add column carbs_g int not null default 0 check (carbs_g >= 0),
  add column fat_g int not null default 0 check (fat_g >= 0);
