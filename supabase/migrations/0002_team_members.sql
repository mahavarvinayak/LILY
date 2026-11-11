create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'BDE',
  status text not null default 'Active',
  joined_at timestamptz not null default now()
);

create index if not exists team_members_agency_idx on public.team_members (agency_id);
create unique index if not exists team_members_agency_email_idx on public.team_members (agency_id, lower(email));

alter table public.team_members enable row level security;

drop policy if exists "team_members: read own" on public.team_members;
create policy "team_members: read own"
  on public.team_members for select to authenticated
  using (agency_id = auth.uid() or public.is_super_admin());

drop policy if exists "team_members: insert own" on public.team_members;
create policy "team_members: insert own"
  on public.team_members for insert to authenticated
  with check (agency_id = auth.uid() or public.is_super_admin());

drop policy if exists "team_members: update own" on public.team_members;
create policy "team_members: update own"
  on public.team_members for update to authenticated
  using (agency_id = auth.uid() or public.is_super_admin())
  with check (agency_id = auth.uid() or public.is_super_admin());

drop policy if exists "team_members: delete own" on public.team_members;
create policy "team_members: delete own"
  on public.team_members for delete to authenticated
  using (agency_id = auth.uid() or public.is_super_admin());

grant select, insert, update, delete on public.team_members to authenticated;

