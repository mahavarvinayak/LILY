alter table public.profiles add column if not exists payment_utr text;
alter table public.profiles add column if not exists payment_verified boolean not null default false;
alter table public.profiles add column if not exists payment_amount integer not null default 0;

drop policy if exists "companies: read agency member" on public.companies;
create policy "companies: read agency member" on public.companies
  for select to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.agency_id = companies.user_id
        and lower(tm.email) = lower(auth.jwt()->>'email')
    )
  );

drop policy if exists "people: read agency member" on public.people;
create policy "people: read agency member" on public.people
  for select to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.agency_id = people.user_id
        and lower(tm.email) = lower(auth.jwt()->>'email')
    )
  );

drop policy if exists "opportunities: read agency member" on public.opportunities;
create policy "opportunities: read agency member" on public.opportunities
  for select to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.agency_id = opportunities.user_id
        and lower(tm.email) = lower(auth.jwt()->>'email')
    )
  );

drop policy if exists "opportunities: update agency member" on public.opportunities;
create policy "opportunities: update agency member" on public.opportunities
  for update to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.agency_id = opportunities.user_id
        and lower(tm.email) = lower(auth.jwt()->>'email')
    )
  );

drop policy if exists "tasks: read agency member" on public.tasks;
create policy "tasks: read agency member" on public.tasks
  for select to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.agency_id = tasks.user_id
        and lower(tm.email) = lower(auth.jwt()->>'email')
    )
  );

drop policy if exists "tasks: update agency member" on public.tasks;
create policy "tasks: update agency member" on public.tasks
  for update to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.agency_id = tasks.user_id
        and lower(tm.email) = lower(auth.jwt()->>'email')
    )
  );

drop policy if exists "profiles: read agency member" on public.profiles;
create policy "profiles: read agency member" on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.agency_id = profiles.id
        and lower(tm.email) = lower(auth.jwt()->>'email')
    )
  );
