-- LILY // 0001_init
-- Multi-tenant workspace for autonomous B2B outbound.
--
-- Access model
--   clients      -> only their own rows, and only opportunities whose
--                   scheduled_at has passed (the 08:00 release gate).
--   super_admin  -> unrestricted read/write through RLS.
--   service_role -> bypasses RLS; used by /api/admin/ingest and server actions.
--
-- Run with: supabase db push   (or paste into the SQL editor).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  agency_name text not null default 'New agency',
  contact_email text not null,
  role text not null default 'client' check (role in ('client', 'super_admin')),
  target_niche text,
  daily_lead_quota integer not null default 10 check (daily_lead_quota between 0 and 50),
  slack_webhook_url text,
  subscription_tier text not null default 'Starter'
    check (subscription_tier in ('Starter', 'Growth', 'Scale')),
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

-- Security-definer helpers: these read profiles while bypassing RLS, which
-- avoids the self-referential policy recursion trap.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
  );
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Provision a profile for every new auth user. Invite-only sign-in means the
-- operator creates the account first; role is always client and must be
-- promoted deliberately.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, agency_name, contact_email)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'agency_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'New agency'
    ),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Clients may edit their own agency details, but never their role, quota or
-- id. Service role and super admins are exempt.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'profiles.id is immutable';
  end if;

  if auth.role() <> 'service_role' and not public.is_super_admin() then
    if new.role is distinct from old.role then
      raise exception 'only a super admin may change role';
    end if;
    if new.daily_lead_quota is distinct from old.daily_lead_quota then
      raise exception 'only a super admin may change the daily lead quota';
    end if;
    if new.subscription_tier is distinct from old.subscription_tier then
      raise exception 'only a super admin may change the subscription tier';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_privileges on public.profiles;
create trigger guard_profile_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  domain text,
  website text,
  location text,
  tech_stack text[],
  created_at timestamptz not null default now()
);

create index if not exists companies_user_idx on public.companies (user_id);
create unique index if not exists companies_user_domain_idx
  on public.companies (user_id, lower(domain))
  where domain is not null;

-- ---------------------------------------------------------------------------
-- people
-- ---------------------------------------------------------------------------
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  first_name text not null,
  last_name text,
  job_title text not null,
  email text,
  linkedin_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists people_user_idx on public.people (user_id);
create index if not exists people_company_idx on public.people (company_id);
create index if not exists people_linkedin_idx on public.people (lower(linkedin_url));

-- ---------------------------------------------------------------------------
-- opportunities (the kanban cards)
-- ---------------------------------------------------------------------------
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  person_id uuid references public.people (id) on delete set null,
  deal_name text not null,
  deal_value numeric(12, 2) not null default 0,
  stage text not null default 'New Lead'
    check (stage in ('New Lead', 'Screening', 'Meeting', 'Proposal', 'Customer', 'Lost')),
  buying_trigger text not null,
  trigger_url text,
  ai_subject_line text,
  ai_icebreaker text,
  scheduled_at timestamptz not null default (
    (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '1 day 8 hours')
    at time zone 'Asia/Kolkata'
  ),
  outreach_dispatched boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists opportunities_user_idx on public.opportunities (user_id);
create index if not exists opportunities_user_scheduled_idx
  on public.opportunities (user_id, scheduled_at desc);
create index if not exists opportunities_stage_idx on public.opportunities (stage);
create index if not exists opportunities_company_idx on public.opportunities (company_id);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz,
  completed boolean not null default false,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_idx on public.tasks (user_id);
create index if not exists tasks_due_idx on public.tasks (user_id, due_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.people enable row level security;
alter table public.opportunities enable row level security;
alter table public.tasks enable row level security;

-- profiles ------------------------------------------------------------------
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "profiles: read as super admin" on public.profiles;
create policy "profiles: read as super admin"
  on public.profiles for select to authenticated
  using (public.is_super_admin());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.current_profile_role()
  );

drop policy if exists "profiles: update as super admin" on public.profiles;
create policy "profiles: update as super admin"
  on public.profiles for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- companies -----------------------------------------------------------------
drop policy if exists "companies: read own" on public.companies;
create policy "companies: read own"
  on public.companies for select to authenticated
  using (
    user_id = auth.uid()
    and (
      exists (
        select 1 from public.opportunities o
        where o.company_id = public.companies.id
          and o.user_id = auth.uid()
          and o.scheduled_at <= now()
      )
      or not exists (
        select 1 from public.opportunities o
        where o.company_id = public.companies.id
          and o.user_id = auth.uid()
      )
    )
  );

drop policy if exists "companies: read as super admin" on public.companies;
create policy "companies: read as super admin"
  on public.companies for select to authenticated
  using (public.is_super_admin());

drop policy if exists "companies: insert own" on public.companies;
create policy "companies: insert own"
  on public.companies for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "companies: update own" on public.companies;
create policy "companies: update own"
  on public.companies for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "companies: delete own" on public.companies;
create policy "companies: delete own"
  on public.companies for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "people: read own" on public.people;
create policy "people: read own"
  on public.people for select to authenticated
  using (
    user_id = auth.uid()
    and (
      exists (
        select 1 from public.opportunities o
        where o.person_id = public.people.id
          and o.user_id = auth.uid()
          and o.scheduled_at <= now()
      )
      or not exists (
        select 1 from public.opportunities o
        where o.person_id = public.people.id
          and o.user_id = auth.uid()
      )
    )
  );

drop policy if exists "people: read as super admin" on public.people;
create policy "people: read as super admin"
  on public.people for select to authenticated
  using (public.is_super_admin());

drop policy if exists "people: insert own" on public.people;
create policy "people: insert own"
  on public.people for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "people: update own" on public.people;
create policy "people: update own"
  on public.people for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "people: delete own" on public.people;
create policy "people: delete own"
  on public.people for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "opportunities: read released own" on public.opportunities;
create policy "opportunities: read released own"
  on public.opportunities for select to authenticated
  using (user_id = auth.uid() and scheduled_at <= now());

drop policy if exists "opportunities: read as super admin" on public.opportunities;
create policy "opportunities: read as super admin"
  on public.opportunities for select to authenticated
  using (public.is_super_admin());

drop policy if exists "opportunities: insert own" on public.opportunities;
create policy "opportunities: insert own"
  on public.opportunities for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "opportunities: update released own" on public.opportunities;
create policy "opportunities: update released own"
  on public.opportunities for update to authenticated
  using (user_id = auth.uid() and scheduled_at <= now())
  with check (user_id = auth.uid());

drop policy if exists "opportunities: delete own" on public.opportunities;
create policy "opportunities: delete own"
  on public.opportunities for delete to authenticated
  using (user_id = auth.uid() and scheduled_at <= now());

-- tasks ---------------------------------------------------------------------
drop policy if exists "tasks: read own" on public.tasks;
create policy "tasks: read own"
  on public.tasks for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "tasks: read as super admin" on public.tasks;
create policy "tasks: read as super admin"
  on public.tasks for select to authenticated
  using (public.is_super_admin());

drop policy if exists "tasks: insert own" on public.tasks;
create policy "tasks: insert own"
  on public.tasks for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "tasks: update own" on public.tasks;
create policy "tasks: update own"
  on public.tasks for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "tasks: delete own" on public.tasks;
create policy "tasks: delete own"
  on public.tasks for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Table privileges (RLS still decides which rows are visible)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.companies to authenticated;
grant select, insert, update, delete on public.people to authenticated;
grant select, insert, update, delete on public.opportunities to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;

grant usage on schema public to authenticated;
