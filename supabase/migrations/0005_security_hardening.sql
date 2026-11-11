-- ---------------------------------------------------------------------------
-- 0005 — security hardening for OTPs and profile identity
--
-- Run this in the Supabase SQL editor (or `supabase db push`) on every
-- environment that already applied 0004. Until it runs, the counter function is
-- still executable by anon through PostgREST and the app falls back to an
-- admin-side user lookup in `send-otp`.
-- ---------------------------------------------------------------------------

-- Pin the search_path to an empty value so a caller cannot shadow auth_otps or
-- operators with objects in a schema they control. pg_catalog is still resolved
-- implicitly and every app object below is schema-qualified.
create or replace function public.increment_otp_attempt(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_attempts integer;
begin
  update public.auth_otps
  set attempts = attempts + 1
  where id = p_id
    and attempts < 5
  returning attempts into new_attempts;

  return coalesce(new_attempts, 5);
end;
$$;

-- PostgREST exposes every executable function at /rest/v1/rpc/<name>. Only the
-- server (service role) needs this one.
revoke all on function public.increment_otp_attempt(uuid) from public, anon, authenticated;
grant execute on function public.increment_otp_attempt(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- auth_user_exists — the only trustworthy "does this address own an account?"
-- check. `profiles.contact_email` is an ordinary, user-editable column, so it
-- must never gate OTP delivery: Supabase's `generateLink` would auto-create an
-- account (and send mail) for any address a client typed into that column.
-- ---------------------------------------------------------------------------
create or replace function public.auth_user_exists(p_email text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from auth.users u
    where lower(u.email) = lower(btrim(p_email))
  );
$$;

revoke all on function public.auth_user_exists(text) from public, anon, authenticated;
grant execute on function public.auth_user_exists(text) to service_role;

-- ---------------------------------------------------------------------------
-- Support the durable per-email quota: count codes issued in the last 10 min.
-- ---------------------------------------------------------------------------
create index if not exists auth_otps_email_created_idx
  on public.auth_otps (email, created_at desc);

-- ---------------------------------------------------------------------------
-- 0004 created the tables with RLS on and no policies, which denies every
-- client read/write. `force` makes that explicit for the table owner too, so a
-- leaked session cannot read hashes even if it somehow owns the relation.
--
-- `FORCE ROW LEVEL SECURITY` also applies to the SECURITY DEFINER functions
-- above; they keep working because Supabase's function owner (`postgres`) has
-- BYPASSRLS. If this migration is re-run under a role without BYPASSRLS, every
-- OTP verification would report "too many attempts" — verify once after applying.
-- ---------------------------------------------------------------------------
alter table public.auth_otps force row level security;
alter table public.workspace_mailboxes force row level security;

-- ---------------------------------------------------------------------------
-- Profile identity is server-owned. Clients may still edit agency_name,
-- target_niche and slack_webhook_url, but `id` and `contact_email` (the address
-- the welcome mail and digests go to) are written only by `handle_new_user` or
-- the service role.
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
