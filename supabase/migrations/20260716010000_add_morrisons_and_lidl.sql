-- Adds Morrisons and Lidl to the store lineup, alongside the existing Tesco/Aldi/Asda/Sainsbury's.
-- Prices are illustrative (same basis as the original seed data), derived as:
--   Lidl ~ Aldi * 0.99      (the two discounters trade blows and are usually near-identical)
--   Morrisons ~ avg(Tesco, Asda)  (typical "big 4" mainstream positioning)

insert into public.stores (name, slug, display_order) values
  ('Morrisons', 'morrisons', 4),
  ('Lidl', 'lidl', 5);

insert into public.ingredient_prices (ingredient_id, store_id, price)
select i.id, s.id, v.price
from (values
  ('chickenThigh', 'morrisons', 4.83),
  ('chickenThigh', 'lidl', 4.25),
  ('chickenBreast', 'morrisons', 6.38),
  ('chickenBreast', 'lidl', 5.73),
  ('turkeyMince', 'morrisons', 3.13),
  ('turkeyMince', 'lidl', 2.86),
  ('mince', 'morrisons', 3.38),
  ('mince', 'lidl', 2.96),
  ('fish', 'morrisons', 3.63),
  ('fish', 'lidl', 3.26),
  ('tuna', 'morrisons', 3.3),
  ('tuna', 'lidl', 2.96),
  ('sardines', 'morrisons', 0.8),
  ('sardines', 'lidl', 0.68),
  ('eggs', 'morrisons', 2.55),
  ('eggs', 'lidl', 2.27),
  ('tofu', 'morrisons', 1.8),
  ('tofu', 'lidl', 1.57),
  ('greekYog', 'morrisons', 2.68),
  ('greekYog', 'lidl', 2.17),
  ('cottage', 'morrisons', 1.15),
  ('cottage', 'lidl', 0.94),
  ('milk', 'morrisons', 1.2),
  ('milk', 'lidl', 1.14),
  ('lentils', 'morrisons', 1.75),
  ('lentils', 'lidl', 1.44),
  ('chickpeas', 'morrisons', 0.6),
  ('chickpeas', 'lidl', 0.49),
  ('kidneyBeans', 'morrisons', 0.55),
  ('kidneyBeans', 'lidl', 0.45),
  ('pb', 'morrisons', 1.5),
  ('pb', 'lidl', 1.18),
  ('oats', 'morrisons', 1.05),
  ('oats', 'lidl', 0.89),
  ('rice', 'morrisons', 1.5),
  ('rice', 'lidl', 1.28),
  ('pasta', 'morrisons', 0.72),
  ('pasta', 'lidl', 0.58),
  ('noodles', 'morrisons', 0.88),
  ('noodles', 'lidl', 0.74),
  ('wraps', 'morrisons', 1),
  ('wraps', 'lidl', 0.88),
  ('bread', 'morrisons', 0.9),
  ('bread', 'lidl', 0.74),
  ('potatoes', 'morrisons', 1.45),
  ('potatoes', 'lidl', 1.28),
  ('frozenVeg', 'morrisons', 1.25),
  ('frozenVeg', 'lidl', 1.08),
  ('toms', 'morrisons', 0.51),
  ('toms', 'lidl', 0.41),
  ('onions', 'morrisons', 0.9),
  ('onions', 'lidl', 0.78),
  ('banana', 'morrisons', 0.89),
  ('banana', 'lidl', 0.81),
  ('pantry', 'morrisons', 2),
  ('pantry', 'lidl', 2)
) as v(ingredient_key, store_slug, price)
join public.ingredients i on i.key = v.ingredient_key
join public.stores s on s.slug = v.store_slug
;
