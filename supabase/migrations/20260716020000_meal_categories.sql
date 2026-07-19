-- Adds meal categories (breakfast/lunch/dinner/snack/dessert) so the Meals list can be
-- filtered by meal type, not just vegetarian/protein-per-£.
create type public.meal_category as enum ('breakfast', 'lunch', 'dinner', 'snack', 'dessert');

alter table public.meals
  add column category public.meal_category not null default 'dinner';

-- Categorise the existing builtin meals. Custom/AI meals created after this migration
-- get a category at creation time instead (recipe builder picker / Gemini classification).
update public.meals set category = 'breakfast' where slug in (
  'yogBowl', 'cottageToast', 'onOats', 'sardinesToast', 'pancakes', 'shakshuka'
);
update public.meals set category = 'lunch' where slug in (
  'friedRice', 'jacketTuna', 'fajitaWraps'
);
update public.meals set category = 'dinner' where slug in (
  'traybake', 'lentilCurry', 'tunaBake', 'chilli', 'fishRice', 'tofuStir',
  'turkeyRagu', 'chickenCurry', 'beanChilli', 'peanutNoodles'
);
