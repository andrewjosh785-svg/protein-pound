-- Aisle groupings for the shopping list export (feature A), grouping ingredients the way
-- a shopper would walk a UK supermarket rather than alphabetically.
update public.ingredients set category = v.category
from (values
  ('chickenThigh', 'Meat & Fish'),
  ('chickenBreast', 'Meat & Fish'),
  ('turkeyMince', 'Meat & Fish'),
  ('mince', 'Meat & Fish'),
  ('fish', 'Meat & Fish'),
  ('tuna', 'Meat & Fish'),
  ('sardines', 'Meat & Fish'),
  ('eggs', 'Dairy & Chilled'),
  ('tofu', 'Dairy & Chilled'),
  ('greekYog', 'Dairy & Chilled'),
  ('cottage', 'Dairy & Chilled'),
  ('milk', 'Dairy & Chilled'),
  ('lentils', 'Tins & Pulses'),
  ('chickpeas', 'Tins & Pulses'),
  ('kidneyBeans', 'Tins & Pulses'),
  ('toms', 'Tins & Pulses'),
  ('oats', 'Bakery & Grains'),
  ('rice', 'Bakery & Grains'),
  ('pasta', 'Bakery & Grains'),
  ('noodles', 'Bakery & Grains'),
  ('wraps', 'Bakery & Grains'),
  ('bread', 'Bakery & Grains'),
  ('potatoes', 'Fruit & Veg'),
  ('onions', 'Fruit & Veg'),
  ('banana', 'Fruit & Veg'),
  ('frozenVeg', 'Frozen'),
  ('pb', 'Store Cupboard'),
  ('pantry', 'Store Cupboard')
) as v(key, category)
where public.ingredients.key = v.key;
