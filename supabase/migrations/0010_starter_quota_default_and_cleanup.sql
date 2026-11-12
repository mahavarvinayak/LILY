alter table public.profiles alter column daily_lead_quota set default 5;

update public.profiles
set daily_lead_quota = 5
where subscription_tier = 'Starter' and daily_lead_quota = 10;
