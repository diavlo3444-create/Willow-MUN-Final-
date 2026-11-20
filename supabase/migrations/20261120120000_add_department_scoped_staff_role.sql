-- Introduce a distinct non-lead staff role. Staff accounts are department-scoped
-- and must never inherit Executive Board or Department Head permissions.
alter table public.wm_profiles
  drop constraint if exists wm_profiles_role_check;

alter table public.wm_profiles
  add constraint wm_profiles_role_check
  check (role = any (array[
    'super_admin'::text,
    'admin'::text,
    'department_head'::text,
    'executive_board'::text,
    'staff'::text
  ]));

drop policy if exists "Only super admin inserts profiles" on public.wm_profiles;
create policy "Only super admin inserts profiles"
  on public.wm_profiles
  for insert
  with check (
    wm_is_super_admin()
    and role = any (array['admin'::text, 'department_head'::text, 'executive_board'::text, 'staff'::text])
  );

drop policy if exists "Only super admin updates profiles" on public.wm_profiles;
create policy "Only super admin updates profiles"
  on public.wm_profiles
  for update
  using (wm_is_super_admin())
  with check (
    wm_is_super_admin()
    and role = any (array['admin'::text, 'department_head'::text, 'executive_board'::text, 'staff'::text, 'super_admin'::text])
  );
