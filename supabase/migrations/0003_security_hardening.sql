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

drop policy if exists "opportunities: delete own" on public.opportunities;
create policy "opportunities: delete own"
  on public.opportunities for delete to authenticated
  using (user_id = auth.uid() and scheduled_at <= now());

alter table public.profiles
  drop constraint if exists profiles_slack_webhook_check;

alter table public.profiles
  add constraint profiles_slack_webhook_check
  check (
    slack_webhook_url is null
    or slack_webhook_url ~ '^https://hooks\.slack\.com/services/[A-Za-z0-9+/=_-]+$'
  );

