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

-- Backfill from real sign-ins. last_sign_in_at is only set by Supabase after an
-- actual authentication, so squatted accounts created at signup stay unmarked
-- and simply start receiving digests after their owner signs in once.
update public.profiles p
set verified_at = u.last_sign_in_at
from auth.users u
where u.id = p.id
  and p.verified_at is null
  and u.last_sign_in_at is not null;

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

-- Digest query support: verified clients, scanned every cron run.
create index if not exists profiles_verified_clients_idx
  on public.profiles (role, verified_at)
  where verified_at is not null;
