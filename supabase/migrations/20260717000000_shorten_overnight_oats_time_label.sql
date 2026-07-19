-- "5 min + overnight" was long enough to wrap onto its own line in the meal card's
-- stats row, throwing off card-grid alignment. Shortened to fit on one line like every
-- other meal's time label.
update public.meals
set time_label = '5 min + 🌙'
where slug = 'onOats';
