alter table public.wm_hr_signup_invites
  add column if not exists token_value text;

-- Signup invite tokens are retained server-side so resending the same acceptance
-- email never rotates or invalidates an unclaimed link. RLS remains enabled and
-- only service_role has table access.
