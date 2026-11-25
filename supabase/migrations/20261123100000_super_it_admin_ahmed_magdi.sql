-- ============================================================================
-- Willow MUN Super IT Admin Provisioning & Enforcement:
-- Grants ahmedmagdialkik@gmail.com permanent Super IT Admin (super_admin) role
-- with unrestricted conference and RBAC permissions when logging in or signing
-- up via the Executive Board flow. Never stores plaintext credentials in SQL.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.wm_super_it_admin_permissions()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'applications.view', true,
    'applications.view_confidential', true,
    'applications.review', true,
    'applications.recommend', true,
    'applications.bulk_actions', true,
    'applications.notes', true,
    'applications.export', true,
    'applications.signup_links', true,
    'forms.manage', true,
    'departments.view_all', true,
    'departments.manage', true,
    'departments.assign_head', true,
    'departments.toggle_registration', true,
    'committees.manage', true,
    'secretariat.view', true,
    'secretariat.manage', true,
    'executive_board.manage', true,
    'sponsors.manage', true,
    'schedule.manage', true,
    'content.conference_assets', true,
    'departments.workspace', true,
    'operations.teams', true,
    'operations.shifts', true,
    'operations.deployment', true,
    'qr.view_pass', true,
    'qr.scan', true,
    'qr.manage', true,
    'website.view', true,
    'website.edit', true,
    'website.publish', true,
    'media.manage', true,
    'email.view', true,
    'email.send', true,
    'email.bulk_send', true,
    'inquiries.manage', true,
    'registration.view', true,
    'registration.manage', true,
    'reports.view', true,
    'reports.export', true,
    'logs.view', true,
    'system.settings', true,
    'system.monitoring', true,
    'accounts.view', true,
    'accounts.manage_admins', true,
    'accounts.manage_heads', true,
    'roles.manage', true,
    'permissions.manage', true,
    'testing.impersonate_head', true
  );
$$;

-- Trigger ordered alphabetically BEFORE trg_wm_profiles_protect_privileges
CREATE OR REPLACE FUNCTION public.wm_enforce_super_it_admin_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  user_email text;
BEGIN
  SELECT lower(trim(coalesce(u.email, '')))
    INTO user_email
    FROM auth.users u
   WHERE u.id = NEW.user_id
   LIMIT 1;

  IF user_email = 'ahmedmagdialkik@gmail.com' THEN
    NEW.role := 'super_admin';
    NEW.title := 'Super IT Admin';
    NEW.is_active := true;
    NEW.eb_rank := 'head';
    NEW.eb_permissions := coalesce(NEW.eb_permissions, '{}'::jsonb)
      || '{"manage_department": true, "manage_committees": true, "scan_qr": true}'::jsonb;
    NEW.permissions := public.wm_super_it_admin_permissions();
    IF NEW.full_name IS NULL OR trim(NEW.full_name) = '' THEN
      NEW.full_name := 'Ahmed Magdi';
    END IF;
    IF NEW.avatar_url IS NULL OR trim(NEW.avatar_url) = '' THEN
      NEW.avatar_url := '/photos/ahmed-magdi.jpg';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wm_profiles_00_super_it_admin ON public.wm_profiles;
CREATE TRIGGER trg_wm_profiles_00_super_it_admin
BEFORE INSERT OR UPDATE ON public.wm_profiles
FOR EACH ROW EXECUTE FUNCTION public.wm_enforce_super_it_admin_profile();

-- Backfill or promote existing Auth user + update EB signup allowlist cleanly
DO $$
DECLARE
  target_user_id uuid;
  it_department_id text;
  existing_member_key text;
  all_perms jsonb := public.wm_super_it_admin_permissions();
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wm_departments'
  ) THEN
    SELECT d.id::text
      INTO it_department_id
      FROM public.wm_departments d
     WHERE lower(coalesce(d.slug, '')) = 'it'
        OR lower(coalesce(d.name, '')) LIKE '%information technology%'
     ORDER BY d.slug = 'it' DESC
     LIMIT 1;
  END IF;

  SELECT u.id
    INTO target_user_id
    FROM auth.users u
   WHERE lower(trim(coalesce(u.email, ''))) = 'ahmedmagdialkik@gmail.com'
   LIMIT 1;

  IF target_user_id IS NOT NULL THEN
    INSERT INTO public.wm_profiles (
      user_id,
      full_name,
      role,
      department_id,
      is_active,
      title,
      avatar_url,
      eb_rank,
      eb_permissions,
      permissions
    )
    VALUES (
      target_user_id,
      'Ahmed Magdi',
      'super_admin',
      it_department_id,
      true,
      'Super IT Admin',
      '/photos/ahmed-magdi.jpg',
      'head',
      '{"manage_department": true, "manage_committees": true, "scan_qr": true}'::jsonb,
      all_perms
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      role = 'super_admin',
      title = 'Super IT Admin',
      is_active = true,
      eb_rank = 'head',
      eb_permissions = coalesce(public.wm_profiles.eb_permissions, '{}'::jsonb)
        || '{"manage_department": true, "manage_committees": true, "scan_qr": true}'::jsonb,
      permissions = all_perms,
      department_id = coalesce(public.wm_profiles.department_id, EXCLUDED.department_id),
      avatar_url = coalesce(public.wm_profiles.avatar_url, EXCLUDED.avatar_url);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wm_eb_signup_allowlist'
  ) THEN
    SELECT member_key
      INTO existing_member_key
      FROM public.wm_eb_signup_allowlist
     WHERE lower(trim(coalesce(email, ''))) = 'ahmedmagdialkik@gmail.com'
        OR member_key = 'ahmed-magdi'
     ORDER BY lower(trim(coalesce(email, ''))) = 'ahmedmagdialkik@gmail.com' DESC
     LIMIT 1;

    IF existing_member_key IS NOT NULL THEN
      UPDATE public.wm_eb_signup_allowlist
         SET email = 'ahmedmagdialkik@gmail.com',
             full_name = coalesce(nullif(trim(full_name), ''), 'Ahmed Magdi'),
             title = 'Super IT Admin',
             department_id = coalesce(department_id, it_department_id),
             avatar_url = coalesce(avatar_url, '/photos/ahmed-magdi.jpg'),
             eb_rank = 'head',
             eb_permissions = coalesce(eb_permissions, '{}'::jsonb)
               || '{"manage_department": true, "manage_committees": true, "scan_qr": true}'::jsonb,
             permissions = all_perms,
             claimed_user_id = coalesce(claimed_user_id, target_user_id),
             claimed_at = CASE
               WHEN claimed_at IS NOT NULL THEN claimed_at
               WHEN target_user_id IS NOT NULL THEN now()
               ELSE NULL
             END
       WHERE member_key = existing_member_key;
    ELSE
      INSERT INTO public.wm_eb_signup_allowlist (
        email,
        email_aliases,
        member_key,
        full_name,
        title,
        department_id,
        avatar_url,
        eb_rank,
        eb_permissions,
        permissions,
        claimed_user_id,
        claimed_at
      )
      VALUES (
        'ahmedmagdialkik@gmail.com',
        ARRAY[]::text[],
        'ahmed-magdi-super-it',
        'Ahmed Magdi',
        'Super IT Admin',
        it_department_id,
        '/photos/ahmed-magdi.jpg',
        'head',
        '{"manage_department": true, "manage_committees": true, "scan_qr": true}'::jsonb,
        all_perms,
        target_user_id,
        CASE WHEN target_user_id IS NOT NULL THEN now() ELSE NULL END
      );
    END IF;
  END IF;
END $$;
