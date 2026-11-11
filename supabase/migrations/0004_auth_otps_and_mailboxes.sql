create table if not exists public.auth_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  token_hash text not null,
  verification_type text not null default 'magiclink',
  attempts integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_otps_email_idx on public.auth_otps (lower(email));
create index if not exists auth_otps_expires_at_idx on public.auth_otps (expires_at);

alter table public.auth_otps enable row level security;

create or replace function public.increment_otp_attempt(p_id uuid)
returns integer
language plpgsql
security definer
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

create table if not exists public.workspace_mailboxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'custom_smtp',
  sender_name text not null,
  sender_email text not null,
  smtp_host text not null,
  smtp_port integer not null default 465,
  smtp_secure boolean not null default true,
  smtp_user text not null,
  encrypted_pass jsonb not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_mailboxes_user_unique unique (user_id)
);

create index if not exists workspace_mailboxes_user_idx on public.workspace_mailboxes (user_id);

alter table public.workspace_mailboxes enable row level security;
