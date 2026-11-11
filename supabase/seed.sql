-- LILY // seed
-- Populates the first client workspace with a realistic pipeline.
-- Safe to re-run: every row uses a fixed UUID and ON CONFLICT DO NOTHING.
--
-- Prerequisite: at least one profile with role = 'client'. Sign in once with
-- the invited agency email so the auth trigger creates it, or insert a profile
-- manually. The block exits quietly when no client exists.

do $$
declare
  uid uuid;
  now_ist timestamptz := now();
  tomorrow_8 timestamptz :=
    (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '1 day 8 hours')
    at time zone 'Asia/Kolkata';
begin
  select id into uid
  from public.profiles
  where role = 'client'
  order by created_at
  limit 1;

  if uid is null then
    raise notice 'No client profile found — sign in once, then re-run supabase/seed.sql.';
    return;
  end if;

  -- companies ---------------------------------------------------------------
  insert into public.companies (id, user_id, name, domain, website, location, tech_stack, created_at)
  values
    ('11111111-1111-4111-8111-111111111111', uid, 'Northwind Commerce',
     'northwindcommerce.in', 'https://northwindcommerce.in', 'Bengaluru, IN',
     array['Shopify Plus', 'Klaviyo', 'React', 'AWS'], now_ist - interval '9 days'),
    ('22222222-2222-4222-8222-222222222222', uid, 'Kernel Analytics',
     'kernelanalytics.io', 'https://kernelanalytics.io', 'Pune, IN',
     array['Next.js', 'Snowflake', 'Postgres', 'Vercel'], now_ist - interval '8 days'),
    ('33333333-3333-4333-8333-333333333333', uid, 'Atlas Freight',
     'atlasfreight.co', 'https://atlasfreight.co', 'Singapore, SG',
     array['Node.js', 'GCP', 'Salesforce'], now_ist - interval '7 days'),
    ('44444444-4444-4444-8444-444444444444', uid, 'Meridian Health',
     'meridianhealth.in', 'https://meridianhealth.in', 'Hyderabad, IN',
     array['Postgres', 'Twilio', 'AWS'], now_ist - interval '6 days'),
    ('55555555-5555-4555-8555-555555555555', uid, 'Foundry & Co',
     'foundryandco.studio', 'https://foundryandco.studio', 'Mumbai, IN',
     array['Webflow', 'Figma', 'HubSpot'], now_ist - interval '5 days'),
    ('66666666-6666-4666-8666-666666666666', uid, 'Lumen Payments',
     'lumenpay.ae', 'https://lumenpay.ae', 'Dubai, AE',
     array['React', 'Stripe', 'AWS'], now_ist - interval '4 days')
  on conflict (id) do nothing;

  -- people ------------------------------------------------------------------
  insert into public.people (id, user_id, company_id, first_name, last_name, job_title, email, linkedin_url, created_at)
  values
    ('a1111111-1111-4111-8111-111111111111', uid, '11111111-1111-4111-8111-111111111111',
     'Ananya', 'Rao', 'Founder & CEO', 'ananya@northwindcommerce.in',
     'https://linkedin.com/in/ananya-rao-northwind', now_ist - interval '9 days'),
    ('a2222222-2222-4222-8222-222222222222', uid, '22222222-2222-4222-8222-222222222222',
     'Rohan', 'Mehta', 'VP Marketing', 'rohan@kernelanalytics.io',
     'https://linkedin.com/in/rohan-mehta-kernel', now_ist - interval '8 days'),
    ('a3333333-3333-4333-8333-333333333333', uid, '33333333-3333-4333-8333-333333333333',
     'Priya', 'Nair', 'Chief Operating Officer', 'priya@atlasfreight.co',
     'https://linkedin.com/in/priya-nair-atlas', now_ist - interval '7 days'),
    ('a4444444-4444-4444-8444-444444444444', uid, '44444444-4444-4444-8444-444444444444',
     'Arjun', 'Patel', 'Head of Growth', 'arjun@meridianhealth.in',
     'https://linkedin.com/in/arjun-patel-meridian', now_ist - interval '6 days'),
    ('a5555555-5555-4555-8555-555555555555', uid, '55555555-5555-4555-8555-555555555555',
     'Meera', 'Shah', 'Studio Lead', 'meera@foundryandco.studio',
     'https://linkedin.com/in/meera-shah-foundry', now_ist - interval '5 days'),
    ('a6666666-6666-4666-8666-666666666666', uid, '66666666-6666-4666-8666-666666666666',
     'Omar', 'Haddad', 'Chief Marketing Officer', 'omar@lumenpay.ae',
     'https://linkedin.com/in/omar-haddad-lumen', now_ist - interval '4 days')
  on conflict (id) do nothing;

  -- opportunities -----------------------------------------------------------
  insert into public.opportunities (
    id, user_id, company_id, person_id, deal_name, deal_value, stage,
    buying_trigger, trigger_url, ai_subject_line, ai_icebreaker,
    scheduled_at, outreach_dispatched, notes, created_at
  )
  values
    ('b1111111-1111-4111-8111-111111111111', uid,
     '11111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111',
     'Shopify CRO & Lifecycle Retainer', 480000, 'New Lead',
     'Hiring: 2 Senior Shopify Engineers (posted 11h ago)',
     'https://linkedin.com/jobs/view/4252026496',
     'Northwind: two Senior Shopify hires',
     'Ananya — two Senior Shopify Engineer roles went live eleven hours ago. For a Shopify Plus brand at your volume, that usually means conversion work is queued behind platform work. We map the revenue gap before the hires land. Worth a 12-minute look?',
     tomorrow_8, false, 'Warm intro available via Karan at Klaviyo.', now_ist - interval '9 days'),

    ('b2222222-2222-4222-8222-222222222222', uid,
     '22222222-2222-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222',
     'Product-Led Growth Sprint', 360000, 'Screening',
     'Raised ₹4.2Cr seed + hiring 3 BDRs (2d ago)',
     'https://linkedin.com/company/kernel-analytics/posts',
     'Kernel: seed round + three BDR hires',
     'Rohan — the seed announcement and three BDR reqs in the same fortnight reads like a pipeline target you have to hit this quarter. We build the outbound motion that feeds those reps. Worth a 12-minute look?',
     now_ist - interval '1 day 4 hours', true, 'Replied positively; screening call booked.', now_ist - interval '8 days'),

    ('b3333333-3333-4333-8333-333333333333', uid,
     '33333333-3333-4333-8333-333333333333', 'a3333333-3333-4333-8333-333333333333',
     'Salesforce → HubSpot Migration', 640000, 'Meeting',
     'Posted RFP for CRM consolidation (3d ago)',
     'https://atlasfreight.co/careers',
     'Atlas: CRM consolidation RFP',
     'Priya — the CRM consolidation RFP closes Friday and the scope reads like the migration is already three weeks behind. We have run this exact Salesforce-to-HubSpot cutover for two freight operators. Worth comparing notes before you award?',
     now_ist - interval '3 days 2 hours', true, 'Discovery call Thursday 15:30 IST.', now_ist - interval '7 days'),

    ('b4444444-4444-4444-8444-444444444444', uid,
     '44444444-4444-4444-8444-444444444444', 'a4444444-4444-4444-8444-444444444444',
     'Patient Lifecycle Retainer', 520000, 'Proposal',
     'Launching 4 new clinics + hiring lifecycle marketer (5d ago)',
     'https://linkedin.com/jobs/view/4251887311',
     'Meridian: four clinic launches',
     'Arjun — four clinic launches and a lifecycle hire in the same month means the patient journey is about to be rebuilt by someone who starts in six weeks. We can have the retention map ready before they land. Worth a look at the proposal?',
     now_ist - interval '5 days 3 hours', true, 'Proposal sent; follow up Monday.', now_ist - interval '6 days'),

    ('b5555555-5555-4555-8555-555555555555', uid,
     '55555555-5555-4555-8555-555555555555', 'a5555555-5555-4555-8555-555555555555',
     'Webflow Rebuild & CRO', 280000, 'Customer',
     'Website relaunch announced for Q1 (8d ago)',
     'https://foundryandco.studio/journal/q1',
     'Foundry: Q1 relaunch',
     'Meera — the Q1 relaunch announcement is live and the current site still routes every enquiry through a single form. We rebuilt the same flow for two studios last quarter and cut cost-per-enquiry by a third. Worth a 12-minute look?',
     now_ist - interval '12 days', true, 'Won — kickoff scheduled.', now_ist - interval '5 days'),

    ('b6666666-6666-4666-8666-666666666666', uid,
     '66666666-6666-4666-8666-666666666666', 'a6666666-6666-4666-8666-666666666666',
     'ABM Pilot — UAE Fintech', 450000, 'New Lead',
     'Appointed new CMO + opening Riyadh office (1d ago)',
     'https://linkedin.com/company/lumen-payments/posts',
     'Lumen: new CMO, new market',
     'Omar — a new CMO seat and a Riyadh office in the same quarter is the cleanest moment to rebuild outbound from scratch. We run the account selection and first-touch engine for two payments teams in the Gulf. Worth a 12-minute look?',
     tomorrow_8 + interval '1 day', false, 'Riyadh expansion confirmed in press release.', now_ist - interval '4 days')
  on conflict (id) do nothing;

  -- tasks -------------------------------------------------------------------
  insert into public.tasks (id, user_id, title, description, due_at, completed, priority, created_at)
  values
    ('c1111111-1111-4111-8111-111111111111', uid, 'Follow up on Meridian proposal',
     'Arjun asked for the retention map before the board review.', now_ist + interval '6 hours', false, 'high', now_ist - interval '1 day'),
    ('c2222222-2222-4222-8222-222222222222', uid, 'Prepare Atlas migration scope',
     'Pull the two freight case studies and the Salesforce field map.', now_ist + interval '1 day 2 hours', false, 'high', now_ist - interval '2 days'),
    ('c3333333-3333-4333-8333-333333333333', uid, 'Review tomorrow''s 08:00 drop',
     'Confirm six new leads are enriched before the gate opens.', now_ist + interval '18 hours', false, 'medium', now_ist - interval '1 day'),
    ('c4444444-4444-4444-8444-444444444444', uid, 'Send Foundry kickoff agenda',
     'Share the 90-day CRO roadmap and the analytics access checklist.', now_ist - interval '2 days', true, 'low', now_ist - interval '4 days')
  on conflict (id) do nothing;

  raise notice 'Seeded LILY workspace for profile %', uid;
end;
$$;
