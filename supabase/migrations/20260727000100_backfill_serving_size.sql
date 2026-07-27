-- Backfills an approximate serving_size_g for the existing builtin meals, since the new
-- column defaults to null and every existing row would otherwise show no weight at all.
-- These are estimates of a realistic plate/bowl weight for each recipe (cross-checked
-- loosely against kcal density — a real mixed meal typically runs ~100-200 kcal per 100g;
-- drier dishes like toast or pancakes sit higher, watery ones like curries and stews sit
-- lower) — not weighed, same honesty standard as the earlier carbs/fat backfill.

update public.meals m
set serving_size_g = v.serving_size_g
from (
  values
    ('traybake', 380),
    ('lentilCurry', 430),
    ('tunaBake', 380),
    ('yogBowl', 350),
    ('friedRice', 380),
    ('chilli', 430),
    ('cottageToast', 220),
    ('fishRice', 400),
    ('tofuStir', 400),
    ('onOats', 300),
    ('turkeyRagu', 420),
    ('sardinesToast', 180),
    ('jacketTuna', 380),
    ('chickenCurry', 450),
    ('beanChilli', 420),
    ('pancakes', 220),
    ('shakshuka', 380),
    ('peanutNoodles', 400),
    ('fajitaWraps', 320)
) as v(slug, serving_size_g)
where m.slug = v.slug;
