-- Combined bootstrap SQL for pasting into the Supabase SQL editor when the CLI isn't
-- available. This is migrations/20260715090000_core_schema.sql +
-- migrations/20260715090100_rls_policies.sql + seed.sql concatenated in that order.
-- Once the Supabase CLI is installed, prefer `supabase db push` against the individual
-- migration files instead — this file is a manual-paste convenience, not the source of truth.
-- Regenerate with:
--   cat supabase/migrations/20260715090000_core_schema.sql \
--       supabase/migrations/20260715090100_rls_policies.sql \
--       supabase/seed.sql > supabase/combined_bootstrap.sql

-- Protein/Pound core schema
-- Store price lookups are keyed by store_id/ingredient_id rather than the prototype's
-- positional [Tesco, Aldi, Asda, Sainsbury's] array, so store order and count can change freely.

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  display_order int not null unique,
  created_at timestamptz not null default now()
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, -- slug carried over from the prototype for readability/debugging
  name text not null,
  pack_label text not null,
  category text,
  created_at timestamptz not null default now()
);

create table public.ingredient_prices (
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  price numeric(10,2) not null check (price >= 0),
  updated_at timestamptz not null default now(),
  primary key (ingredient_id, store_id)
);
-- Phase 2: a scheduled Edge Function updates rows here from a live pricing API (e.g. Pepesto)
-- instead of the app shipping static prices.

create type public.meal_source as enum ('builtin', 'custom', 'ai');

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  slug text unique, -- set for builtin meals only; custom/ai meals are unslugged
  name text not null,
  servings int not null check (servings > 0),
  protein_g int not null check (protein_g >= 0),
  kcal int not null check (kcal >= 0),
  is_veggie boolean not null default false,
  time_label text,
  description text not null default '',
  method jsonb not null default '[]'::jsonb, -- array of step strings
  source public.meal_source not null default 'custom',
  owner_id uuid references auth.users(id) on delete cascade, -- null for builtin meals
  created_at timestamptz not null default now(),
  constraint builtin_has_no_owner check (
    (source = 'builtin' and owner_id is null) or (source <> 'builtin' and owner_id is not null)
  )
);

create table public.meal_ingredients (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  pack_fraction numeric(6,3) not null check (pack_fraction > 0),
  human_quantity text not null default '',
  sort_order int not null default 0
);
create index meal_ingredients_meal_id_idx on public.meal_ingredients(meal_id);

create table public.snack_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kcal int not null check (kcal >= 0),
  protein_g int not null check (protein_g >= 0),
  cost numeric(10,2) not null check (cost >= 0),
  sort_order int not null default 0
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  daily_kcal_target int not null default 2000,
  daily_protein_target int not null default 120,
  weekly_budget numeric(10,2) not null default 30,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a user signs up, so the app never has to handle a missing profile.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null, -- Monday of that week
  created_at timestamptz not null default now(),
  unique (user_id, week_start_date)
);

create table public.plan_entries (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.weekly_plans(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=Mon .. 6=Sun
  meal_id uuid not null references public.meals(id) on delete restrict,
  servings int not null check (servings > 0),
  created_at timestamptz not null default now()
);
create index plan_entries_plan_id_idx on public.plan_entries(plan_id);

create type public.log_source as enum ('snack_preset', 'custom', 'barcode');

create table public.log_entries (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.weekly_plans(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  name text not null,
  kcal int not null check (kcal >= 0),
  protein_g int not null check (protein_g >= 0),
  cost numeric(10,2) not null check (cost >= 0),
  quantity int not null default 1 check (quantity > 0),
  source public.log_source not null default 'custom',
  snack_preset_id uuid references public.snack_presets(id) on delete set null,
  created_at timestamptz not null default now()
);
create index log_entries_plan_id_idx on public.log_entries(plan_id);

-- Phase 2: barcode-scanned off-plan food, cached from Open Food Facts and kept separate
-- from the curated `ingredients` table since these are arbitrary branded products.
create table public.barcode_products (
  barcode text primary key,
  off_id text,
  name text not null,
  kcal_per_100g numeric(6,2),
  protein_per_100g numeric(6,2),
  fetched_at timestamptz not null default now()
);
-- Row Level Security: public reference data is world-readable; everything
-- user-owned is scoped to auth.uid(), including through join tables.

alter table public.stores enable row level security;
alter table public.ingredients enable row level security;
alter table public.ingredient_prices enable row level security;
alter table public.snack_presets enable row level security;
alter table public.meals enable row level security;
alter table public.meal_ingredients enable row level security;
alter table public.profiles enable row level security;
alter table public.weekly_plans enable row level security;
alter table public.plan_entries enable row level security;
alter table public.log_entries enable row level security;
alter table public.barcode_products enable row level security;

-- Reference data: readable by anyone (including anon), writable only via service role.
create policy "stores are publicly readable" on public.stores
  for select using (true);

create policy "ingredients are publicly readable" on public.ingredients
  for select using (true);

create policy "ingredient prices are publicly readable" on public.ingredient_prices
  for select using (true);

create policy "snack presets are publicly readable" on public.snack_presets
  for select using (true);

create policy "barcode products are publicly readable" on public.barcode_products
  for select using (true);

-- Meals: builtin meals are readable by everyone; custom/AI meals only by their owner.
create policy "builtin and own meals are readable" on public.meals
  for select using (source = 'builtin' or owner_id = auth.uid());

create policy "users can insert their own meals" on public.meals
  for insert with check (owner_id = auth.uid() and source <> 'builtin');

create policy "users can update their own meals" on public.meals
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "users can delete their own meals" on public.meals
  for delete using (owner_id = auth.uid());

-- Meal ingredients inherit visibility/ownership from their parent meal.
create policy "meal ingredients follow parent meal visibility" on public.meal_ingredients
  for select using (
    exists (
      select 1 from public.meals m
      where m.id = meal_ingredients.meal_id
        and (m.source = 'builtin' or m.owner_id = auth.uid())
    )
  );

create policy "users can manage ingredients on their own meals" on public.meal_ingredients
  for all using (
    exists (select 1 from public.meals m where m.id = meal_ingredients.meal_id and m.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.meals m where m.id = meal_ingredients.meal_id and m.owner_id = auth.uid())
  );

-- Profiles: a user can only see/edit their own profile row.
create policy "users can view their own profile" on public.profiles
  for select using (id = auth.uid());

create policy "users can update their own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Weekly plans: fully owned by the user.
create policy "users can manage their own weekly plans" on public.weekly_plans
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Plan entries / log entries: scoped through the parent plan's owner.
create policy "users can manage entries on their own plans" on public.plan_entries
  for all using (
    exists (select 1 from public.weekly_plans p where p.id = plan_entries.plan_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.weekly_plans p where p.id = plan_entries.plan_id and p.user_id = auth.uid())
  );

create policy "users can manage log entries on their own plans" on public.log_entries
  for all using (
    exists (select 1 from public.weekly_plans p where p.id = log_entries.plan_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.weekly_plans p where p.id = log_entries.plan_id and p.user_id = auth.uid())
  );
-- Seed data generated from the prototype's builtin catalogue.
-- Regenerate with: node gen-seed.mjs (see scratchpad script used to produce this file).

insert into public.stores (name, slug, display_order) values
  ('Tesco', 'tesco', 0),
  ('Aldi', 'aldi', 1),
  ('Asda', 'asda', 2),
  ('Sainsbury''s', 'sainsbury-s', 3)
;

insert into public.ingredients (key, name, pack_label) values
  ('chickenThigh', 'Chicken thigh fillets', '1kg'),
  ('chickenBreast', 'Chicken breast fillets', '1kg'),
  ('turkeyMince', '2% fat turkey mince', '500g'),
  ('mince', '5% fat beef mince', '500g'),
  ('fish', 'Frozen white fish fillets', '520g'),
  ('tuna', 'Tuna chunks in brine', '4 × 145g'),
  ('sardines', 'Sardines in tomato sauce', '120g tin'),
  ('eggs', 'Eggs', '12 pack'),
  ('tofu', 'Firm tofu', '396g'),
  ('greekYog', 'Fat-free Greek yoghurt', '1kg'),
  ('cottage', 'Cottage cheese', '300g'),
  ('milk', 'Semi-skimmed milk', '2 pints'),
  ('lentils', 'Red split lentils', '1kg'),
  ('chickpeas', 'Chickpeas', '400g tin'),
  ('kidneyBeans', 'Kidney beans', '400g tin'),
  ('pb', 'Peanut butter', '340g'),
  ('oats', 'Porridge oats', '1kg'),
  ('rice', 'Long grain rice', '1kg'),
  ('pasta', 'Wholewheat pasta', '500g'),
  ('noodles', 'Egg noodles', '250g'),
  ('wraps', 'Tortilla wraps', '8 pack'),
  ('bread', 'Wholemeal bread', '800g loaf'),
  ('potatoes', 'White potatoes', '2.5kg'),
  ('frozenVeg', 'Frozen mixed vegetables', '1kg'),
  ('toms', 'Chopped tomatoes', '400g tin'),
  ('onions', 'Onions', '1kg'),
  ('banana', 'Bananas', '1kg'),
  ('pantry', 'Oil, spices & sauces', 'store cupboard')
;

insert into public.ingredient_prices (ingredient_id, store_id, price)
select i.id, s.id, v.price
from (values
  ('chickenThigh', 'tesco', 4.9),
  ('chickenThigh', 'aldi', 4.29),
  ('chickenThigh', 'asda', 4.75),
  ('chickenThigh', 'sainsbury-s', 5.25),
  ('chickenBreast', 'tesco', 6.5),
  ('chickenBreast', 'aldi', 5.79),
  ('chickenBreast', 'asda', 6.25),
  ('chickenBreast', 'sainsbury-s', 6.75),
  ('turkeyMince', 'tesco', 3.25),
  ('turkeyMince', 'aldi', 2.89),
  ('turkeyMince', 'asda', 3),
  ('turkeyMince', 'sainsbury-s', 3.5),
  ('mince', 'tesco', 3.5),
  ('mince', 'aldi', 2.99),
  ('mince', 'asda', 3.25),
  ('mince', 'sainsbury-s', 3.75),
  ('fish', 'tesco', 3.75),
  ('fish', 'aldi', 3.29),
  ('fish', 'asda', 3.5),
  ('fish', 'sainsbury-s', 4),
  ('tuna', 'tesco', 3.4),
  ('tuna', 'aldi', 2.99),
  ('tuna', 'asda', 3.2),
  ('tuna', 'sainsbury-s', 3.6),
  ('sardines', 'tesco', 0.85),
  ('sardines', 'aldi', 0.69),
  ('sardines', 'asda', 0.75),
  ('sardines', 'sainsbury-s', 0.9),
  ('eggs', 'tesco', 2.65),
  ('eggs', 'aldi', 2.29),
  ('eggs', 'asda', 2.45),
  ('eggs', 'sainsbury-s', 2.8),
  ('tofu', 'tesco', 1.85),
  ('tofu', 'aldi', 1.59),
  ('tofu', 'asda', 1.75),
  ('tofu', 'sainsbury-s', 2),
  ('greekYog', 'tesco', 2.85),
  ('greekYog', 'aldi', 2.19),
  ('greekYog', 'asda', 2.5),
  ('greekYog', 'sainsbury-s', 2.95),
  ('cottage', 'tesco', 1.2),
  ('cottage', 'aldi', 0.95),
  ('cottage', 'asda', 1.1),
  ('cottage', 'sainsbury-s', 1.25),
  ('milk', 'tesco', 1.2),
  ('milk', 'aldi', 1.15),
  ('milk', 'asda', 1.2),
  ('milk', 'sainsbury-s', 1.25),
  ('lentils', 'tesco', 1.85),
  ('lentils', 'aldi', 1.45),
  ('lentils', 'asda', 1.65),
  ('lentils', 'sainsbury-s', 1.9),
  ('chickpeas', 'tesco', 0.65),
  ('chickpeas', 'aldi', 0.49),
  ('chickpeas', 'asda', 0.55),
  ('chickpeas', 'sainsbury-s', 0.7),
  ('kidneyBeans', 'tesco', 0.6),
  ('kidneyBeans', 'aldi', 0.45),
  ('kidneyBeans', 'asda', 0.5),
  ('kidneyBeans', 'sainsbury-s', 0.65),
  ('pb', 'tesco', 1.6),
  ('pb', 'aldi', 1.19),
  ('pb', 'asda', 1.4),
  ('pb', 'sainsbury-s', 1.75),
  ('oats', 'tesco', 1.1),
  ('oats', 'aldi', 0.9),
  ('oats', 'asda', 1),
  ('oats', 'sainsbury-s', 1.2),
  ('rice', 'tesco', 1.55),
  ('rice', 'aldi', 1.29),
  ('rice', 'asda', 1.45),
  ('rice', 'sainsbury-s', 1.65),
  ('pasta', 'tesco', 0.75),
  ('pasta', 'aldi', 0.59),
  ('pasta', 'asda', 0.69),
  ('pasta', 'sainsbury-s', 0.85),
  ('noodles', 'tesco', 0.9),
  ('noodles', 'aldi', 0.75),
  ('noodles', 'asda', 0.85),
  ('noodles', 'sainsbury-s', 1),
  ('wraps', 'tesco', 1.05),
  ('wraps', 'aldi', 0.89),
  ('wraps', 'asda', 0.95),
  ('wraps', 'sainsbury-s', 1.15),
  ('bread', 'tesco', 0.95),
  ('bread', 'aldi', 0.75),
  ('bread', 'asda', 0.85),
  ('bread', 'sainsbury-s', 1.05),
  ('potatoes', 'tesco', 1.5),
  ('potatoes', 'aldi', 1.29),
  ('potatoes', 'asda', 1.4),
  ('potatoes', 'sainsbury-s', 1.6),
  ('frozenVeg', 'tesco', 1.3),
  ('frozenVeg', 'aldi', 1.09),
  ('frozenVeg', 'asda', 1.2),
  ('frozenVeg', 'sainsbury-s', 1.4),
  ('toms', 'tesco', 0.55),
  ('toms', 'aldi', 0.41),
  ('toms', 'asda', 0.47),
  ('toms', 'sainsbury-s', 0.6),
  ('onions', 'tesco', 0.95),
  ('onions', 'aldi', 0.79),
  ('onions', 'asda', 0.85),
  ('onions', 'sainsbury-s', 1),
  ('banana', 'tesco', 0.9),
  ('banana', 'aldi', 0.82),
  ('banana', 'asda', 0.87),
  ('banana', 'sainsbury-s', 0.95),
  ('pantry', 'tesco', 2),
  ('pantry', 'aldi', 2),
  ('pantry', 'asda', 2),
  ('pantry', 'sainsbury-s', 2)
) as v(ingredient_key, store_slug, price)
join public.ingredients i on i.key = v.ingredient_key
join public.stores s on s.slug = v.store_slug
;

insert into public.snack_presets (name, kcal, protein_g, cost, sort_order) values
  ('Bowl of cereal & milk', 260, 9, 0.4, 0),
  ('Meal deal (sandwich, snack, drink)', 650, 24, 3.6, 1),
  ('Toast with butter (2 slices)', 240, 7, 0.2, 2),
  ('Protein bar', 210, 20, 1.5, 3),
  ('Protein shake (whey + water)', 120, 24, 0.7, 4),
  ('Banana', 95, 1, 0.15, 5),
  ('Apple', 80, 0, 0.3, 6),
  ('Yoghurt pot', 130, 12, 0.6, 7),
  ('Packet of crisps', 165, 2, 0.75, 8),
  ('Chocolate bar', 230, 3, 0.85, 9),
  ('Biscuits (2)', 150, 2, 0.15, 10),
  ('Sausage roll', 330, 10, 1.3, 11),
  ('Latte (medium)', 190, 10, 3.4, 12),
  ('Can of fizzy drink', 140, 0, 1, 13),
  ('Pint of lager', 200, 1, 5.2, 14),
  ('Takeaway (average portion)', 1000, 35, 9.5, 15)
;

insert into public.meals (slug, name, servings, protein_g, kcal, is_veggie, time_label, description, method, source) values
  ('traybake', 'Chicken thigh & veg traybake', 4, 38, 520, false, '50 min', 'Thighs roasted over rice and frozen veg. One tray, minimal washing up.', '["Heat the oven to 200°C fan. Season the thighs well with oil, salt, pepper and any spices you like.","Tip the rice into a deep roasting tray with 600ml boiling water and a pinch of salt. Scatter over the frozen veg and sliced onions.","Sit the thighs on top, cover tightly with foil and roast for 30 minutes.","Remove the foil and roast 15 more minutes until the chicken is browned and the rice has absorbed the water.","Rest 5 minutes, fluff the rice and serve. Portions freeze well."]'::jsonb, 'builtin'),
  ('lentilCurry', 'Lentil & chickpea curry', 4, 24, 460, true, '35 min', 'Storecupboard curry with rice. Freezes brilliantly, costs pennies.', '["Soften the chopped onions in oil for 5 minutes, then add 2 tbsp curry powder and cook 1 minute.","Add the lentils, tomatoes and 700ml water. Simmer 20 minutes, stirring now and then, until the lentils are soft.","Stir in the drained chickpeas and simmer 5 more minutes. Season to taste.","Meanwhile cook the rice in boiling salted water for 12 minutes and drain.","Serve the curry over rice. Freezes in portions for up to 3 months."]'::jsonb, 'builtin'),
  ('tunaBake', 'Tuna pasta bake', 3, 34, 490, false, '35 min', 'Three tins of tuna, tomato sauce, wholewheat pasta.', '["Cook the pasta 2 minutes short of the packet time and drain, keeping a mug of pasta water.","Fry the chopped onion in oil until soft, add the tomatoes and a splash of pasta water, and simmer 5 minutes.","Stir in the drained tuna and the pasta. Season with salt, pepper and dried herbs.","Tip into a baking dish and bake at 200°C fan for 12–15 minutes until bubbling at the edges."]'::jsonb, 'builtin'),
  ('yogBowl', 'Greek yoghurt power bowl', 1, 28, 420, true, '5 min', 'Yoghurt, oats, peanut butter and banana. 5-minute breakfast.', '["Spoon the yoghurt into a bowl and stir through the oats.","Slice the banana over the top.","Finish with a spoonful of peanut butter. Add a drizzle of honey if you have it."]'::jsonb, 'builtin'),
  ('friedRice', 'Egg & veg fried rice', 2, 22, 480, true, '15 min', 'Four eggs scrambled through rice and veg with soy sauce.', '["Cook the rice (or use leftover cold rice — even better).","Get a large frying pan or wok very hot with a little oil and stir-fry the frozen veg for 3 minutes.","Push the veg aside, crack in the eggs and scramble them in the pan.","Add the rice and 2 tbsp soy sauce, and stir-fry everything together for 3–4 minutes."]'::jsonb, 'builtin'),
  ('chilli', 'Lean beef chilli', 4, 30, 510, false, '45 min', '5% mince bulked with beans — more protein, lower cost per serving.', '["Brown the mince in a large pan over high heat, breaking it up. Add the chopped onions and cook 5 minutes.","Stir in 1 tbsp each of cumin, paprika and chilli powder and cook 1 minute.","Add the tomatoes and drained beans, and simmer gently for 25–30 minutes.","Cook the rice for the last 12 minutes.","Season the chilli and serve over rice. Even better the next day."]'::jsonb, 'builtin'),
  ('cottageToast', 'Cottage cheese & eggs on toast', 1, 32, 430, true, '10 min', 'Two slices, two eggs, half a tub of cottage cheese.', '["Toast the bread.","Soft-boil or fry the eggs — about 6 minutes for jammy boiled eggs.","Spread the cottage cheese thickly on the toast, top with the eggs and plenty of black pepper."]'::jsonb, 'builtin'),
  ('fishRice', 'Baked fish, rice & greens', 2, 30, 440, false, '25 min', 'Frozen white fish is one of the cheapest lean proteins going.', '["Heat the oven to 200°C fan. Put the fish (straight from frozen is fine) on a lined tray, rub with oil, salt and pepper.","Bake for 18–20 minutes until the fish flakes easily.","Meanwhile cook the rice, adding the frozen veg to the pan for the last 4 minutes.","Drain, plate up and serve the fish on top with a squeeze of lemon if you have one."]'::jsonb, 'builtin'),
  ('tofuStir', 'Crispy tofu stir-fry', 2, 22, 430, true, '25 min', 'Whole block of tofu, pan-fried until golden, over rice.', '["Press the tofu between kitchen paper for 10 minutes, then cut into cubes and toss in 1 tbsp cornflour.","Start the rice cooking.","Fry the tofu in a hot pan with oil for 8–10 minutes, turning until golden on all sides. Set aside.","Stir-fry the veg 3 minutes, return the tofu, add 2 tbsp soy sauce and toss. Serve over the rice."]'::jsonb, 'builtin'),
  ('onOats', 'Peanut butter overnight oats', 1, 20, 410, true, '5 min + overnight', 'Made the night before with milk, yoghurt and peanut butter.', '["Stir the oats, milk, yoghurt and peanut butter together in a jar or tub.","Cover and refrigerate overnight (or at least 4 hours).","Loosen with a splash of milk in the morning. Keeps 2–3 days, so make a few at once."]'::jsonb, 'builtin'),
  ('turkeyRagu', 'Turkey mince ragu & pasta', 4, 32, 500, false, '35 min', '2% turkey mince is leaner and cheaper per gram of protein than beef.', '["Soften the chopped onions in oil, then add the turkey mince and brown it, breaking it up.","Add the tomatoes, a tin of water, dried herbs and seasoning. Simmer 20 minutes until thick.","Cook the pasta for the last 10 minutes and drain.","Toss the pasta through the ragu with a splash of pasta water."]'::jsonb, 'builtin'),
  ('sardinesToast', 'Sardines on toast', 1, 22, 380, false, '5 min', 'The classic budget protein hit — plus omega-3 and calcium.', '["Toast the bread.","Warm the sardines in their sauce for a minute in a small pan or the microwave.","Pile onto the toast, mash lightly with a fork and add plenty of black pepper."]'::jsonb, 'builtin'),
  ('jacketTuna', 'Jacket potato, tuna & cottage cheese', 2, 30, 450, false, '15 min (microwave)', 'Microwave the spuds if you''re short on time. Huge and filling.', '["Prick the potatoes and microwave on high for 8–10 minutes until soft (or bake 1 hour at 200°C for crispy skins).","Mix the drained tuna with the cottage cheese, black pepper and a dash of vinegar or lemon.","Split the potatoes, fluff the insides and pile the tuna mix on top."]'::jsonb, 'builtin'),
  ('chickenCurry', 'Chicken & chickpea curry', 4, 35, 520, false, '40 min', 'Thighs stretched further with chickpeas. Better than a takeaway.', '["Brown the diced chicken thighs in oil over high heat, then remove.","Soften the chopped onions in the same pan, add 2 tbsp curry powder and cook 1 minute.","Return the chicken with the tomatoes, drained chickpeas and half a tin of water. Simmer 20 minutes.","Cook the rice for the last 12 minutes, then serve."]'::jsonb, 'builtin'),
  ('beanChilli', 'Three-bean chilli', 4, 20, 430, true, '35 min', 'Vegan, freezer-friendly and about as cheap as dinner gets.', '["Soften the chopped onions in oil, then add 1 tbsp each of cumin, paprika and chilli powder.","Add the tomatoes and all the drained beans, and simmer 20–25 minutes until rich and thick.","Cook the rice for the last 12 minutes.","Season generously and serve. Freezes brilliantly in portions."]'::jsonb, 'builtin'),
  ('pancakes', 'Banana protein pancakes', 2, 24, 440, true, '20 min', 'Oats, eggs and banana blitzed into a batter, topped with yoghurt.', '["Blitz the oats, eggs and bananas into a smooth batter (a blender or stick blender works).","Heat a non-stick pan with a little oil and fry small pancakes 2 minutes per side.","Stack and top with the Greek yoghurt and any fruit you have."]'::jsonb, 'builtin'),
  ('shakshuka', 'Chickpea shakshuka', 2, 24, 420, true, '25 min', 'Eggs baked in spiced tomatoes and chickpeas, bread for dipping.', '["Soften the chopped onion in oil, add 1 tsp each paprika and cumin, then the tomatoes and drained chickpeas.","Simmer 10 minutes until thickened, then make 4 wells in the sauce.","Crack an egg into each well, cover and cook 5–7 minutes until the whites are set.","Serve straight from the pan with toasted bread for dipping."]'::jsonb, 'builtin'),
  ('peanutNoodles', 'Peanut tofu noodles', 2, 24, 520, true, '20 min', 'Peanut butter, soy and a splash of pasta water make the sauce.', '["Cube and fry the tofu in a hot oiled pan until golden, about 8 minutes.","Cook the noodles, adding the frozen veg for the last 3 minutes. Keep a mug of the water.","Whisk the peanut butter with 2 tbsp soy sauce and enough noodle water to make a pourable sauce.","Toss everything together and finish with chilli flakes."]'::jsonb, 'builtin'),
  ('fajitaWraps', 'Chicken fajita wraps', 3, 35, 480, false, '20 min', 'Sliced breast, charred onions, warm wraps. Batch it for lunches.', '["Slice the chicken and onions. Toss the chicken in 1 tbsp fajita spice mix (paprika, cumin, chilli, garlic).","Get a pan very hot with oil and cook the chicken 5–6 minutes until charred and cooked through. Set aside.","Cook the onions in the same pan until softened and browned at the edges.","Warm the wraps, fill and roll. Cold ones make a great packed lunch."]'::jsonb, 'builtin')
;

insert into public.meal_ingredients (meal_id, ingredient_id, pack_fraction, human_quantity, sort_order)
select me.id, ing.id, v.pack_fraction, v.human_quantity, v.sort_order
from (values
  ('traybake', 'chickenThigh', 0.6, '600g', 0),
  ('traybake', 'rice', 0.3, '300g', 1),
  ('traybake', 'frozenVeg', 0.5, '500g', 2),
  ('traybake', 'onions', 0.2, '2 onions', 3),
  ('traybake', 'pantry', 0.08, 'oil & seasoning', 4),
  ('lentilCurry', 'lentils', 0.3, '300g', 0),
  ('lentilCurry', 'chickpeas', 2, '2 tins', 1),
  ('lentilCurry', 'toms', 1, '1 tin', 2),
  ('lentilCurry', 'onions', 0.25, '2 onions', 3),
  ('lentilCurry', 'rice', 0.3, '300g', 4),
  ('lentilCurry', 'pantry', 0.1, 'curry spices & oil', 5),
  ('tunaBake', 'tuna', 0.75, '3 tins', 0),
  ('tunaBake', 'pasta', 0.6, '300g', 1),
  ('tunaBake', 'toms', 1, '1 tin', 2),
  ('tunaBake', 'onions', 0.15, '1 onion', 3),
  ('tunaBake', 'pantry', 0.06, 'oil & herbs', 4),
  ('yogBowl', 'greekYog', 0.25, '250g', 0),
  ('yogBowl', 'oats', 0.06, '60g', 1),
  ('yogBowl', 'pb', 0.06, '20g', 2),
  ('yogBowl', 'banana', 0.15, '1 banana', 3),
  ('friedRice', 'eggs', 0.34, '4 eggs', 0),
  ('friedRice', 'rice', 0.25, '250g', 1),
  ('friedRice', 'frozenVeg', 0.4, '400g', 2),
  ('friedRice', 'pantry', 0.06, 'soy sauce & oil', 3),
  ('chilli', 'mince', 1, '500g', 0),
  ('chilli', 'kidneyBeans', 1.5, '1½ tins', 1),
  ('chilli', 'toms', 2, '2 tins', 2),
  ('chilli', 'onions', 0.25, '2 onions', 3),
  ('chilli', 'rice', 0.35, '350g', 4),
  ('chilli', 'pantry', 0.1, 'chilli spices', 5),
  ('cottageToast', 'cottage', 0.5, '150g', 0),
  ('cottageToast', 'bread', 0.15, '2 slices', 1),
  ('cottageToast', 'eggs', 0.17, '2 eggs', 2),
  ('fishRice', 'fish', 0.9, '2 large fillets', 0),
  ('fishRice', 'rice', 0.25, '250g', 1),
  ('fishRice', 'frozenVeg', 0.4, '400g', 2),
  ('fishRice', 'pantry', 0.06, 'oil, lemon & pepper', 3),
  ('tofuStir', 'tofu', 1, '1 block', 0),
  ('tofuStir', 'rice', 0.25, '250g', 1),
  ('tofuStir', 'frozenVeg', 0.5, '500g', 2),
  ('tofuStir', 'pantry', 0.08, 'soy, cornflour & oil', 3),
  ('onOats', 'oats', 0.08, '80g', 0),
  ('onOats', 'milk', 0.18, '200ml', 1),
  ('onOats', 'pb', 0.08, '25g', 2),
  ('onOats', 'greekYog', 0.1, '100g', 3),
  ('turkeyRagu', 'turkeyMince', 1, '500g', 0),
  ('turkeyRagu', 'pasta', 0.6, '300g', 1),
  ('turkeyRagu', 'toms', 2, '2 tins', 2),
  ('turkeyRagu', 'onions', 0.25, '2 onions', 3),
  ('turkeyRagu', 'pantry', 0.1, 'herbs, garlic & oil', 4),
  ('sardinesToast', 'sardines', 1, '1 tin', 0),
  ('sardinesToast', 'bread', 0.15, '2 slices', 1),
  ('sardinesToast', 'pantry', 0.02, 'black pepper', 2),
  ('jacketTuna', 'potatoes', 0.25, '2 large potatoes', 0),
  ('jacketTuna', 'tuna', 0.5, '2 tins', 1),
  ('jacketTuna', 'cottage', 0.5, '150g', 2),
  ('jacketTuna', 'pantry', 0.03, 'pepper & vinegar', 3),
  ('chickenCurry', 'chickenThigh', 0.5, '500g', 0),
  ('chickenCurry', 'chickpeas', 1.5, '1½ tins', 1),
  ('chickenCurry', 'toms', 1, '1 tin', 2),
  ('chickenCurry', 'onions', 0.25, '2 onions', 3),
  ('chickenCurry', 'rice', 0.35, '350g', 4),
  ('chickenCurry', 'pantry', 0.1, 'curry spices & oil', 5),
  ('beanChilli', 'kidneyBeans', 2, '2 tins', 0),
  ('beanChilli', 'chickpeas', 1, '1 tin', 1),
  ('beanChilli', 'toms', 2, '2 tins', 2),
  ('beanChilli', 'onions', 0.25, '2 onions', 3),
  ('beanChilli', 'rice', 0.35, '350g', 4),
  ('beanChilli', 'pantry', 0.1, 'chilli spices', 5),
  ('pancakes', 'oats', 0.12, '120g', 0),
  ('pancakes', 'eggs', 0.25, '3 eggs', 1),
  ('pancakes', 'banana', 0.25, '2 bananas', 2),
  ('pancakes', 'greekYog', 0.15, '150g', 3),
  ('shakshuka', 'eggs', 0.33, '4 eggs', 0),
  ('shakshuka', 'chickpeas', 1, '1 tin', 1),
  ('shakshuka', 'toms', 2, '2 tins', 2),
  ('shakshuka', 'onions', 0.2, '1 onion', 3),
  ('shakshuka', 'bread', 0.2, '3 slices', 4),
  ('shakshuka', 'pantry', 0.06, 'paprika & cumin', 5),
  ('peanutNoodles', 'tofu', 1, '1 block', 0),
  ('peanutNoodles', 'noodles', 0.8, '200g', 1),
  ('peanutNoodles', 'pb', 0.15, '50g', 2),
  ('peanutNoodles', 'frozenVeg', 0.4, '400g', 3),
  ('peanutNoodles', 'pantry', 0.06, 'soy & chilli flakes', 4),
  ('fajitaWraps', 'chickenBreast', 0.45, '450g', 0),
  ('fajitaWraps', 'wraps', 0.5, '4 wraps', 1),
  ('fajitaWraps', 'onions', 0.3, '2 onions', 2),
  ('fajitaWraps', 'pantry', 0.08, 'fajita spices & oil', 3)
) as v(meal_slug, ingredient_key, pack_fraction, human_quantity, sort_order)
join public.meals me on me.slug = v.meal_slug
join public.ingredients ing on ing.key = v.ingredient_key
;
