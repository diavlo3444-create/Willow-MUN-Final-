create table if not exists public.wm_hr_signup_invite_tokens (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.wm_hr_signup_invites(id) on delete cascade,
  token_hash text not null unique,
  token_value text not null,
  created_at timestamptz not null default now(),
  constraint wm_hr_signup_invite_tokens_hash_length check (length(token_hash) = 64)
);

alter table public.wm_hr_signup_invite_tokens enable row level security;
revoke all on public.wm_hr_signup_invite_tokens from anon, authenticated;
grant all on public.wm_hr_signup_invite_tokens to service_role;
