-- ---------------------------------------------------------------------------
-- 0006 — verified profiles
--
-- Signup is open to anyone and creates an account with no proof that the
-- caller controls the address. The cron digests therefore must not trust a
-- profile row: `verified_at` is stamped only after a successful emailed-code
-- sign-in, and only verified profiles receive mail.
--
-- Run this in the Supabase SQL editor (or `supabase db push`) after 0005.
-- Until it runs, /api/cron/daily-digest returns 503 instead of mailing an
-- unvetted recipient list.
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists verified_at timestamptz;

-- Backfill from real sign-ins, but only for accounts that cannot be opened with
-- a password. `last_sign_in_at` is also set by a password login, and a
-- password chosen by whoever squatted the address is exactly the pre-hijack
-- case 0006 exists to stop. Password-holding accounts stay unverified until
-- their owner completes one emailed-code sign-in (or an operator resets the
-- password).
update public.profiles p
set verified_at = u.last_sign_in_at
from auth.users u
where u.id = p.id
  and p.verified_at is null
  and u.last_sign_in_at is not null
  and coalesce(u.encrypted_password, '') = '';

-- Redefine the guard so a client cannot mark itself verified: RLS "update own"
-- would otherwise let any session set verified_at and receive digest mail.
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
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_privileges on public.profiles;
create trigger guard_profile_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- The agency name is rendered in the dashboard and interpolated into email
-- headers and bodies. The app normalises it, but a client can still PATCH
-- `profiles` directly through PostgREST, so enforce the same bounds in the DB.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_agency_name_len'
  ) then
    alter table public.profiles
      add constraint profiles_agency_name_len
      check (char_length(agency_name) between 2 and 80) not valid;
  end if;
end;
$$;

-- Validate only when no pre-existing row violates the rule, so this migration
-- never fails half-way on legacy data. New writes are checked either way.
do $$
begin
  if not exists (
    select 1 from public.profiles where char_length(agency_name) not between 2 and 80
  ) then
    alter table public.profiles validate constraint profiles_agency_name_len;
  end if;
end;
$$;

-- Keep new profiles inside the constraint: the old fallback used the raw email
-- local part, which can be one character long.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
begin
  candidate := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'agency_name', '')), '');

  if candidate is null then
    candidate := coalesce(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;

  candidate := left(btrim(candidate), 80);

  if char_length(candidate) < 2 then
    candidate := 'New agency';
  end if;

  insert into public.profiles (id, agency_name, contact_email)
  values (new.id, candidate, coalesce(new.email, ''))
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Digest query support: verified clients, scanned every cron run.
create index if not exists profiles_verified_clients_idx
  on public.profiles (role, verified_at)
  where verified_at is not null;
