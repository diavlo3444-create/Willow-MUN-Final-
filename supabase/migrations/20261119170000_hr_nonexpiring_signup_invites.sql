create table if not exists public.wm_hr_signup_invites (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.wm_applications(id) on delete cascade,
  token_hash text not null unique,
  issued_by uuid not null references auth.users(id),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  claimed_at timestamptz,
  claimed_user_id uuid references auth.users(id),
  claim_started_at timestamptz,
  constraint wm_hr_signup_invites_hash_length check (length(token_hash) = 64)
);

create index if not exists wm_hr_signup_invites_application_idx on public.wm_hr_signup_invites(application_id);
alter table public.wm_hr_signup_invites enable row level security;
revoke all on public.wm_hr_signup_invites from anon, authenticated;
grant all on public.wm_hr_signup_invites to service_role;
