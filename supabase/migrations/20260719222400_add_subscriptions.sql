-- Stripe subscription state, one row per user. Kept separate from public.profiles
-- deliberately: profiles has a blanket "users can update their own profile" policy, and a
-- subscriptions table living there would let a user grant themselves paid access by just
-- updating their own row. All writes here go through the stripe-webhook edge function's
-- service-role client instead, so there is no insert/update policy for regular users at all.
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  status text not null default 'none', -- none | trialing | active | past_due | canceled | unpaid | incomplete
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "users can view their own subscription" on public.subscriptions
  for select using (user_id = auth.uid());
