alter table public.companies add column if not exists linkedin_url text;
alter table public.companies add column if not exists employee_count text;
alter table public.companies add column if not exists industry text;

alter table public.people add column if not exists role_tier text not null default 'primary'
  check (role_tier in ('primary', 'secondary', 'tertiary'));

create index if not exists people_company_role_tier_idx on public.people (company_id, role_tier);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  title text not null,
  description text,
  metadata jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_user_idx on public.activity_logs (user_id, created_at desc);

alter table public.activity_logs enable row level security;

drop policy if exists "activity_logs: user read own" on public.activity_logs;
create policy "activity_logs: user read own" on public.activity_logs
  for select using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists "activity_logs: user update own" on public.activity_logs;
create policy "activity_logs: user update own" on public.activity_logs
  for update using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists "activity_logs: user insert own" on public.activity_logs;
create policy "activity_logs: user insert own" on public.activity_logs
  for insert with check (user_id = auth.uid() or public.is_super_admin());
