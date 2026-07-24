-- Backfills real, estimated carbs_g/fat_g for the existing builtin meals and snack_presets,
-- since the new columns default to 0 and every existing row would otherwise show a
-- misleadingly-zero macro breakdown. These are estimates derived from each meal's actual
-- ingredients and quantities (already recorded in meal_ingredients/the seed data) and
-- standard nutritional composition of those ingredients — not lab-verified values, same
-- honesty standard as the sourced ingredient prices. Cross-checked against each meal's
-- already-recorded kcal/protein_g via kcal ≈ protein*4 + carbs*4 + fat*9.
--
-- Snack presets are generic categories (e.g. "meal deal", "takeaway average portion"), so
-- those figures are necessarily rougher than the recipe-derived meal estimates. Alcoholic
-- drinks (lager) have calories from alcohol itself, which isn't represented by the
-- protein/carbs/fat model here — the carbs/fat figures given are real macro content, but
-- won't sum to the stated kcal via the usual formula for that one row, and that's expected.

update public.meals m
set carbs_g = v.carbs_g, fat_g = v.fat_g
from (
  values
    ('traybake', 42, 22),
    ('lentilCurry', 55, 16),
    ('tunaBake', 48, 18),
    ('yogBowl', 32, 20),
    ('friedRice', 55, 19),
    ('chilli', 50, 21),
    ('cottageToast', 28, 21),
    ('fishRice', 52, 12),
    ('tofuStir', 48, 17),
    ('onOats', 38, 20),
    ('turkeyRagu', 58, 15),
    ('sardinesToast', 26, 21),
    ('jacketTuna', 52, 14),
    ('chickenCurry', 48, 21),
    ('beanChilli', 58, 13),
    ('pancakes', 44, 19),
    ('shakshuka', 38, 19),
    ('peanutNoodles', 48, 26),
    ('fajitaWraps', 38, 21)
) as v(slug, carbs_g, fat_g)
where m.slug = v.slug;

update public.snack_presets sp
set carbs_g = v.carbs_g, fat_g = v.fat_g
from (
  values
    ('Bowl of cereal & milk', 45, 5),
    ('Meal deal (sandwich, snack, drink)', 78, 25),
    ('Toast with butter (2 slices)', 26, 12),
    ('Protein bar', 18, 7),
    ('Protein shake (whey + water)', 3, 2),
    ('Banana', 23, 0),
    ('Apple', 21, 0),
    ('Yoghurt pot', 14, 3),
    ('Packet of crisps', 17, 10),
    ('Chocolate bar', 27, 12),
    ('Biscuits (2)', 20, 7),
    ('Sausage roll', 24, 21),
    ('Latte (medium)', 16, 10),
    ('Can of fizzy drink', 35, 0),
    ('Pint of lager', 15, 0),
    ('Takeaway (average portion)', 100, 50)
) as v(name, carbs_g, fat_g)
where sp.name = v.name;
