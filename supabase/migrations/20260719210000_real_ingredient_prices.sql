-- Replaces the prototype's placeholder/formula-derived ingredient prices with real prices
-- sourced from comparethetrolley.co.uk and trolley.co.uk (checked 19 Jul 2026), scaled to
-- each ingredient's pack_label. A handful of cells use the closest real product available
-- at that store where an exact match doesn't exist (see notes below) rather than a fabricated
-- number:
--   - cottage @ morrisons: no Morrisons-branded cottage cheese found; nearest real match is
--     Lindahls Protein Cottage Cheese (store availability for this SKU not fully confirmed).
--   - lentils @ aldi: Aldi doesn't stock dried red split lentils; nearest real product is
--     Four Seasons tinned lentils, a different (cooked) format, priced per equivalent kg.
--   - rice @ asda, rice @ morrisons, pasta @ asda, pasta @ morrisons, bread @ morrisons,
--     potatoes @ morrisons: no wholewheat/wholemeal/plain own-brand match found at that
--     store; nearest real stocked product used instead (see git history / PR notes for detail).
--   - banana prices: stores list bananas per-item/per-pack rather than per-kg, so per-kg
--     figures assume an average 150g banana except Sainsbury's loose price, which is
--     already quoted per-kg.
--
-- Lidl is dropped entirely: no online source (comparethetrolley.co.uk, trolley.co.uk, or
-- lidl.co.uk itself) publishes per-item Lidl prices, so there is no honest way to populate it.

update public.ingredient_prices ip
set price = v.price, updated_at = now()
from (
  values
    ('chickenThigh', 'tesco', 7.25),
    ('chickenThigh', 'aldi', 8.13),
    ('chickenThigh', 'asda', 6.84),
    ('chickenThigh', 'sainsbury-s', 6.95),
    ('chickenThigh', 'morrisons', 7.25),

    ('chickenBreast', 'tesco', 7.69),
    ('chickenBreast', 'aldi', 6.69),
    ('chickenBreast', 'asda', 6.94),
    ('chickenBreast', 'sainsbury-s', 6.69),
    ('chickenBreast', 'morrisons', 6.99),

    ('turkeyMince', 'tesco', 4.90),
    ('turkeyMince', 'aldi', 3.99),
    ('turkeyMince', 'asda', 4.80),
    ('turkeyMince', 'sainsbury-s', 4.95),
    ('turkeyMince', 'morrisons', 4.00),

    ('mince', 'tesco', 5.19),
    ('mince', 'aldi', 5.19),
    ('mince', 'asda', 5.19),
    ('mince', 'sainsbury-s', 5.19),
    ('mince', 'morrisons', 5.40),

    ('fish', 'tesco', 10.83),
    ('fish', 'aldi', 5.76),
    ('fish', 'asda', 10.83),
    ('fish', 'sainsbury-s', 11.20),
    ('fish', 'morrisons', 9.75),

    ('tuna', 'tesco', 2.60),
    ('tuna', 'aldi', 2.49),
    ('tuna', 'asda', 2.60),
    ('tuna', 'sainsbury-s', 2.60),
    ('tuna', 'morrisons', 5.34),

    ('sardines', 'tesco', 0.49),
    ('sardines', 'aldi', 0.49),
    ('sardines', 'asda', 0.60),
    ('sardines', 'sainsbury-s', 0.60),
    ('sardines', 'morrisons', 0.60),

    ('eggs', 'tesco', 2.85),
    ('eggs', 'aldi', 2.49),
    ('eggs', 'asda', 2.85),
    ('eggs', 'sainsbury-s', 2.95),
    ('eggs', 'morrisons', 2.85),

    ('tofu', 'tesco', 1.90),
    ('tofu', 'aldi', 1.88),
    ('tofu', 'asda', 2.12),
    ('tofu', 'sainsbury-s', 1.90),
    ('tofu', 'morrisons', 2.38),

    ('greekYog', 'tesco', 1.95),
    ('greekYog', 'aldi', 1.90),
    ('greekYog', 'asda', 1.86),
    ('greekYog', 'sainsbury-s', 1.70),
    ('greekYog', 'morrisons', 1.95),

    ('cottage', 'tesco', 1.65),
    ('cottage', 'aldi', 1.39),
    ('cottage', 'asda', 1.58),
    ('cottage', 'sainsbury-s', 1.60),
    ('cottage', 'morrisons', 2.06),

    ('milk', 'tesco', 1.21),
    ('milk', 'aldi', 1.20),
    ('milk', 'asda', 1.21),
    ('milk', 'sainsbury-s', 1.21),
    ('milk', 'morrisons', 1.21),

    ('lentils', 'tesco', 2.60),
    ('lentils', 'aldi', 1.13),
    ('lentils', 'asda', 3.94),
    ('lentils', 'sainsbury-s', 4.20),
    ('lentils', 'morrisons', 4.20),

    ('chickpeas', 'tesco', 0.45),
    ('chickpeas', 'aldi', 0.41),
    ('chickpeas', 'asda', 0.41),
    ('chickpeas', 'sainsbury-s', 0.41),
    ('chickpeas', 'morrisons', 0.37),

    ('kidneyBeans', 'tesco', 0.33),
    ('kidneyBeans', 'aldi', 0.39),
    ('kidneyBeans', 'asda', 0.39),
    ('kidneyBeans', 'sainsbury-s', 0.39),
    ('kidneyBeans', 'morrisons', 0.37),

    ('pb', 'tesco', 0.99),
    ('pb', 'aldi', 0.99),
    ('pb', 'asda', 1.80),
    ('pb', 'sainsbury-s', 1.25),
    ('pb', 'morrisons', 4.00),

    ('oats', 'tesco', 2.95),
    ('oats', 'aldi', 0.85),
    ('oats', 'asda', 4.50),
    ('oats', 'sainsbury-s', 0.85),
    ('oats', 'morrisons', 3.00),

    ('rice', 'tesco', 1.25),
    ('rice', 'aldi', 0.52),
    ('rice', 'asda', 2.76),
    ('rice', 'sainsbury-s', 1.25),
    ('rice', 'morrisons', 4.00),

    ('pasta', 'tesco', 0.75),
    ('pasta', 'aldi', 0.75),
    ('pasta', 'asda', 1.20),
    ('pasta', 'sainsbury-s', 0.69),
    ('pasta', 'morrisons', 0.69),

    ('noodles', 'tesco', 0.95),
    ('noodles', 'aldi', 1.08),
    ('noodles', 'asda', 1.15),
    ('noodles', 'sainsbury-s', 0.95),
    ('noodles', 'morrisons', 1.08),

    ('wraps', 'tesco', 0.99),
    ('wraps', 'aldi', 0.99),
    ('wraps', 'asda', 1.32),
    ('wraps', 'sainsbury-s', 0.99),
    ('wraps', 'morrisons', 1.40),

    ('bread', 'tesco', 0.75),
    ('bread', 'aldi', 0.55),
    ('bread', 'asda', 0.75),
    ('bread', 'sainsbury-s', 0.75),
    ('bread', 'morrisons', 0.74),

    ('potatoes', 'tesco', 1.65),
    ('potatoes', 'aldi', 1.65),
    ('potatoes', 'asda', 1.65),
    ('potatoes', 'sainsbury-s', 1.65),
    ('potatoes', 'morrisons', 3.90),

    ('frozenVeg', 'tesco', 1.65),
    ('frozenVeg', 'aldi', 0.99),
    ('frozenVeg', 'asda', 1.15),
    ('frozenVeg', 'sainsbury-s', 1.65),
    ('frozenVeg', 'morrisons', 0.99),

    ('toms', 'tesco', 0.43),
    ('toms', 'aldi', 0.43),
    ('toms', 'asda', 0.46),
    ('toms', 'sainsbury-s', 0.35),
    ('toms', 'morrisons', 0.47),

    ('onions', 'tesco', 0.95),
    ('onions', 'aldi', 0.95),
    ('onions', 'asda', 0.95),
    ('onions', 'sainsbury-s', 0.95),
    ('onions', 'morrisons', 0.95),

    ('banana', 'tesco', 1.07),
    ('banana', 'aldi', 1.07),
    ('banana', 'asda', 1.07),
    ('banana', 'sainsbury-s', 0.95),
    ('banana', 'morrisons', 1.20)
) as v(ingredient_key, store_slug, price)
join public.ingredients i on i.key = v.ingredient_key
join public.stores s on s.slug = v.store_slug
where ip.ingredient_id = i.id and ip.store_id = s.id
;

-- Lidl: no accessible online source publishes real per-item prices, so drop it rather than
-- keep a fabricated/formula-derived column.
delete from public.ingredient_prices
where store_id = (select id from public.stores where slug = 'lidl');

delete from public.stores where slug = 'lidl';
