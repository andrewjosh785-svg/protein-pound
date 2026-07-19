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
