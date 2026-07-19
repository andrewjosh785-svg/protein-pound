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
