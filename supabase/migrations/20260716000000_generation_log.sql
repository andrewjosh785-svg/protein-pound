-- Tracks generate-recipe Edge Function attempts so the function can enforce a global
-- daily cap, staying under Gemini's free-tier project-wide quota (20 requests/day).
-- No RLS policies are defined, so this table is invisible to anon/authenticated clients
-- entirely — only the Edge Function's service-role client can read or write it.
create table public.generation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index generation_log_created_at_idx on public.generation_log(created_at);

alter table public.generation_log enable row level security;
