-- ---------------------------------------------------------------------------
-- 0009 — teammate RLS reachability, release gate, teammate writes, payment guard
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0008.
-- Additive and idempotent: safe to run twice.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1) 0008's "agency member" policies test whether `auth.jwt()->>'email'` appears
-- in `team_members`, but the subquery is itself subject to team_members' own
-- RLS, whose only SELECT policy is `agency_id = auth.uid()` (or super admin).
-- A teammate's row therefore never matches, and every 0008 policy was dead.
-- A member may read their own invite row; that is what the EXISTS needs.
-- ---------------------------------------------------------------------------
drop policy if exists "team_members: read own invite" on public.team_members;
create policy "team_members: read own invite" on public.team_members
  for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- ---------------------------------------------------------------------------
-- 2) The 08:00 release gate. 0008 gave teammates read/update on opportunities
-- without the `scheduled_at <= now()` check that own-row policies enforce, so a
-- teammate could read the morning drop before it was released.
-- ---------------------------------------------------------------------------
drop policy if exists "opportunities: read agency member" on public.opportunities;
create policy "opportunities: read agency member" on public.opportunities
  for select to authenticated
  using (
    scheduled_at <= now()
    and exists (
      select 1 from public.team_members tm
      where tm.agency_id = opportunities.user_id
        and lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "opportunities: update agency member" on public.opportunities;
create policy "opportunities: update agency member" on public.opportunities
  for update to authenticated
  using (
    scheduled_at <= now()
    and exists (
      select 1 from public.team_members tm
      where tm.agency_id = opportunities.user_id
        and lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  with check (
    scheduled_at <= now()
    and exists (
      select 1 from public.team_members tm
      where tm.agency_id = opportunities.user_id
        and lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- Companies and people were gated for the owner in 0002/0003 but not for
-- teammates in 0008; mirror the same rule so a teammate cannot enumerate a
-- company/person that only exists behind a future release.
drop policy if exists "companies: read agency member" on public.companies;
create policy "companies: read agency member" on public.companies
  for select to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.agency_id = companies.user_id
        and lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    and (
      exists (
        select 1 from public.opportunities o
        where o.company_id = companies.id
          and o.user_id = companies.user_id
          and o.scheduled_at <= now()
      )
      or not exists (
        select 1 from public.opportunities o
        where o.company_id = companies.id
          and o.user_id = companies.user_id
      )
    )
  );

drop policy if exists "people: read agency member" on public.people;
create policy "people: read agency member" on public.people
  for select to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.agency_id = people.user_id
        and lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    and (
      exists (
        select 1 from public.opportunities o
        where o.person_id = people.id
          and o.user_id = people.user_id
          and o.scheduled_at <= now()
      )
      or not exists (
        select 1 from public.opportunities o
        where o.person_id = people.id
          and o.user_id = people.user_id
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4) Teammate writes. 0008 only granted read/update on opportunities and tasks,
-- so a teammate who created a deal, company, person, task or activity logged it
-- against their own id — and the workspace query (which is scoped to the agency)
-- filtered it straight back out. These permissive INSERT policies let teammate
-- writes land on the agency id that `lib/workspace.ts` now uses.
-- ---------------------------------------------------------------------------
drop policy if exists "opportunities: insert agency member" on public.opportunities;
create policy "opportunities: insert agency member" on public.opportunities
  for insert to authenticated
  with check (
    exists (
      select 1 from public.team_members tm
      where tm.agency_id = opportunities.user_id
        and lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "tasks: insert agency member" on public.tasks;
create policy "tasks: insert agency member" on public.tasks
  for insert to authenticated
  with check (
    exists (
      select 1 from public.team_members tm
      where tm.agency_id = tasks.user_id
        and lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "companies: insert agency member" on public.companies;
create policy "companies: insert agency member" on public.companies
  for insert to authenticated
  with check (
    exists (
      select 1 from public.team_members tm
      where tm.agency_id = companies.user_id
        and lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "people: insert agency member" on public.people;
create policy "people: insert agency member" on public.people
  for insert to authenticated
  with check (
    exists (
      select 1 from public.team_members tm
      where tm.agency_id = people.user_id
        and lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "activity_logs: read agency member" on public.activity_logs;
create policy "activity_logs: read agency member" on public.activity_logs
  for select to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.agency_id = activity_logs.user_id
        and lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "activity_logs: insert agency member" on public.activity_logs;
create policy "activity_logs: insert agency member" on public.activity_logs
  for insert to authenticated
  with check (
    exists (
      select 1 from public.team_members tm
      where tm.agency_id = activity_logs.user_id
        and lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "activity_logs: update agency member" on public.activity_logs;
create policy "activity_logs: update agency member" on public.activity_logs
  for update to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.agency_id = activity_logs.user_id
        and lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  with check (
    exists (
      select 1 from public.team_members tm
      where tm.agency_id = activity_logs.user_id
        and lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- ---------------------------------------------------------------------------
-- 5) Payment state is operator-owned. The 0008 columns were added without
-- extending guard_profile_privileges, so `profiles: update own` let a client
-- PATCH payment_verified / payment_amount over PostgREST and mark itself paid.
-- Recreated here in full (0006 version + payment columns), keeping search_path
-- pinned and every object schema-qualified.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'profiles.id is immutable';
  end if;

  if auth.role() <> 'service_role' and not public.is_super_admin() then
    if new.contact_email is distinct from old.contact_email then
      raise exception 'only the service role may change contact_email';
    end if;
    if new.verified_at is distinct from old.verified_at then
      raise exception 'only the service role may change verified_at';
    end if;
    if new.role is distinct from old.role then
      raise exception 'only a super admin may change role';
    end if;
    if new.daily_lead_quota is distinct from old.daily_lead_quota then
      raise exception 'only a super admin may change the daily lead quota';
    end if;
    if new.subscription_tier is distinct from old.subscription_tier then
      raise exception 'only a super admin may change the subscription tier';
    end if;
    if new.payment_verified is distinct from old.payment_verified then
      raise exception 'only a super admin may change payment verification';
    end if;
    if new.payment_amount is distinct from old.payment_amount then
      raise exception 'only a super admin may change the payment amount';
    end if;
    -- payment_utr is client-submitted, but it must not be rewritten after an
    -- operator has verified the transfer.
    if old.payment_verified and new.payment_utr is distinct from old.payment_utr then
      raise exception 'a verified payment reference cannot be changed';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_privileges on public.profiles;
create trigger guard_profile_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- Bound the UTR column so a client cannot store an unbounded blob in it.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_payment_utr_len'
  ) then
    alter table public.profiles
      add constraint profiles_payment_utr_len
      check (payment_utr is null or char_length(payment_utr) between 6 and 30) not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from public.profiles
    where payment_utr is not null
      and char_length(payment_utr) not between 6 and 30
  ) then
    alter table public.profiles validate constraint profiles_payment_utr_len;
  end if;
end;
$$;
