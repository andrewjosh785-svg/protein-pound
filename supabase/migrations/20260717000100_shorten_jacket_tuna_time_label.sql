-- "15 min (microwave)" was long enough to risk wrapping in the meal card's stats row.
-- The microwave method is already explained in the recipe steps, so the badge doesn't
-- need to repeat it.
update public.meals
set time_label = '15 min'
where slug = 'jacketTuna';
