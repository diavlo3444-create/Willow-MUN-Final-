-- ============================================================================
-- Willow MUN Account Management & EB / Department Head Unification Migration:
-- 1. Add DB-backed RBAC permissions column to wm_profiles
-- 2. Strictly enforce Super Admin-only privilege on wm_profiles (RLS + triggers)
-- 3. Unify Executive Board Heads & Department Heads in RLS & triggers
-- 4. Preserve unrelated records (ON DELETE SET NULL) when deleting staff users
-- ============================================================================

-- 1. Profile Permissions Column
ALTER TABLE IF EXISTS public.wm_profiles
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wm_eb_signup_allowlist'
  ) THEN
    ALTER TABLE public.wm_eb_signup_allowlist
      ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Ensure valid roles check if not already constrained cleanly
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wm_profiles'
  ) THEN
    -- Normalize any legacy empty permissions
    UPDATE public.wm_profiles
    SET permissions = '{}'::jsonb
    WHERE permissions IS NULL;
  END IF;
END $$;

-- 2. Unified Helper Functions for EB Heads & Department Heads
CREATE OR REPLACE FUNCTION public.wm_is_head_profile(p public.wm_profiles)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    p.is_active = true
    AND (
      p.role = 'department_head'
      OR (
        p.role = 'executive_board'
        AND (
          lower(coalesce(p.eb_rank, '')) IN ('head', 'co_head')
          OR coalesce((p.eb_permissions->>'manage_department')::boolean, false) = true
          OR lower(coalesce(p.title, '')) ~ '\mhead\M'
          OR coalesce((p.permissions->>'applications.view')::boolean, false) = true
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.wm_head_gender()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(coalesce(title, '') || ' ' || coalesce(division, '')) ~ '\m(female|women|woman|girls?)\M' THEN 'female'
    WHEN lower(coalesce(title, '') || ' ' || coalesce(division, '')) ~ '\m(male|men|man|boys?)\M' THEN 'male'
    ELSE NULL
  END
  FROM public.wm_profiles
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.wm_head_application_type_scope()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $body$
  SELECT CASE
    WHEN position('press' in lower(coalesce(p.title, '') || ' ' || coalesce(p.division, ''))) > 0 THEN 'press'
    WHEN position('media' in lower(coalesce(p.title, '') || ' ' || coalesce(p.division, ''))) > 0 THEN 'media'
    ELSE NULL
  END
  FROM public.wm_profiles p
  WHERE p.user_id = auth.uid()
    AND public.wm_is_head_profile(p)
  LIMIT 1;
$body$;

-- Update DCC check so DB permissions column also grants committee management
CREATE OR REPLACE FUNCTION public.wm_is_dcc()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $body$
  SELECT EXISTS (
    SELECT 1
    FROM public.wm_profiles p
    LEFT JOIN public.wm_departments d ON d.id = p.department_id
    WHERE p.user_id = auth.uid()
      AND p.is_active = true
      AND (
        p.role IN ('super_admin', 'admin')
        OR lower(coalesce(d.slug, '')) IN ('dcc', 'delegate-affairs', 'delegate_affairs')
        OR coalesce((p.eb_permissions->>'manage_committees')::boolean, false) = true
        OR coalesce((p.permissions->>'committees.manage')::boolean, false) = true
        OR position('dcc' in lower(coalesce(p.title, '') || ' ' || coalesce(p.division, ''))) > 0
        OR position('delegate affairs' in lower(coalesce(p.title, '') || ' ' || coalesce(p.division, ''))) > 0
      )
  );
$body$;

-- 3. Unify wm_applications trigger & RLS for Department Heads and EB Heads
CREATE OR REPLACE FUNCTION public.wm_applications_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  actor public.wm_profiles;
  requested_status text;
  actor_department_slug text;
  actor_application_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.department_id := public.wm_map_application_department(NEW.application_type, NEW.department_id);
    IF NEW.gender IS NOT NULL THEN
      NEW.gender := lower(trim(NEW.gender));
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT * INTO actor FROM public.wm_profiles WHERE user_id = auth.uid() LIMIT 1;
    IF actor.role IN ('department_head', 'executive_board') THEN
      IF NOT public.wm_is_head_profile(actor) THEN
        RAISE EXCEPTION 'Only authorized Department Heads can review applications.';
      END IF;
      IF coalesce((actor.permissions->>'applications.review')::boolean, true) = false THEN
        RAISE EXCEPTION 'Your account does not have permission to decide applications.';
      END IF;
      requested_status := NEW.status;
      IF requested_status NOT IN ('accepted', 'rejected') THEN
        RAISE EXCEPTION 'Department Heads can only accept or decline applications.';
      END IF;
      SELECT d.slug INTO actor_department_slug FROM public.wm_departments d WHERE d.id = actor.department_id;
      IF actor_department_slug IS NULL OR lower(actor_department_slug) <> lower(public.wm_map_application_department(OLD.application_type, OLD.department_id)) THEN
        RAISE EXCEPTION 'Cross-department application update is forbidden.';
      END IF;
      actor_application_type := public.wm_head_application_type_scope();
      IF lower(actor_department_slug) = 'media-press' AND (actor_application_type IS NULL OR lower(OLD.application_type) <> actor_application_type) THEN
        RAISE EXCEPTION 'Media and Press applications are isolated.';
      END IF;
      IF public.wm_head_gender() IS NULL OR lower(coalesce(OLD.gender, '')) <> public.wm_head_gender() THEN
        RAISE EXCEPTION 'Cross-gender application update is forbidden.';
      END IF;
      NEW := OLD;
      NEW.status := requested_status;
      NEW.decision_by := auth.uid();
      NEW.decision_by_name := actor.full_name;
      NEW.decision_at := now();
    ELSIF actor.role IN ('admin', 'super_admin') AND NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.decision_by := auth.uid();
      NEW.decision_by_name := actor.full_name;
      NEW.decision_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$body$;

DROP POLICY IF EXISTS "Department heads strict dept and gender select" ON public.wm_applications;
CREATE POLICY "Department heads strict dept and gender select"
  ON public.wm_applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.wm_profiles p
      JOIN public.wm_departments d ON d.id = p.department_id
      WHERE p.user_id = auth.uid()
        AND public.wm_is_head_profile(p)
        AND lower(d.slug) = lower(public.wm_map_application_department(wm_applications.application_type, wm_applications.department_id))
        AND (lower(d.slug) <> 'media-press' OR lower(wm_applications.application_type) = public.wm_head_application_type_scope())
        AND public.wm_head_gender() IS NOT NULL
        AND lower(coalesce(wm_applications.gender, '')) = public.wm_head_gender()
    )
  );

DROP POLICY IF EXISTS "Department heads strict dept and gender update" ON public.wm_applications;
CREATE POLICY "Department heads strict dept and gender update"
  ON public.wm_applications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.wm_profiles p
      JOIN public.wm_departments d ON d.id = p.department_id
      WHERE p.user_id = auth.uid()
        AND public.wm_is_head_profile(p)
        AND coalesce((p.permissions->>'applications.review')::boolean, true) = true
        AND lower(d.slug) = lower(public.wm_map_application_department(wm_applications.application_type, wm_applications.department_id))
        AND (lower(d.slug) <> 'media-press' OR lower(wm_applications.application_type) = public.wm_head_application_type_scope())
        AND public.wm_head_gender() IS NOT NULL
        AND lower(coalesce(wm_applications.gender, '')) = public.wm_head_gender()
    )
  )
  WITH CHECK (status IN ('accepted', 'rejected'));

-- 4. Strictly Protect wm_profiles: Only Super Admin Manages Accounts, Roles & Permissions
CREATE OR REPLACE FUNCTION public.wm_profiles_protect_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_super boolean;
BEGIN
  -- Service role (auth.uid() IS NULL) is allowed, except self-promotion checks don't apply
  IF auth.uid() IS NULL THEN
    IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.permissions IS NOT NULL THEN
      -- Strip super-admin-only keys from non-super_admin profiles
      IF NEW.role <> 'super_admin' THEN
        NEW.permissions := NEW.permissions
          - 'accounts.manage_admins'
          - 'accounts.manage_heads'
          - 'roles.manage'
          - 'permissions.manage'
          - 'testing.impersonate_head';
      END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  is_super := public.wm_is_super_admin();

  IF NOT is_super THEN
    RAISE EXCEPTION 'Only Super Admin accounts can create, modify, or delete staff accounts.';
  END IF;

  -- Even an authenticated Super Admin via client RLS cannot grant super_admin role arbitrarily or self-delete
  IF TG_OP = 'DELETE' THEN
    IF OLD.user_id = auth.uid() OR OLD.role = 'super_admin' THEN
      RAISE EXCEPTION 'Super Admin accounts cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.role = 'super_admin' THEN
    RAISE EXCEPTION 'Assigning super_admin via account management is forbidden.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'super_admin' AND NEW.role <> 'super_admin' THEN
      RAISE EXCEPTION 'Cannot demote a Super Admin account.';
    END IF;
    IF OLD.role <> 'super_admin' AND NEW.role = 'super_admin' THEN
      RAISE EXCEPTION 'Cannot escalate any account to Super Admin.';
    END IF;
  END IF;

  IF NEW.role <> 'super_admin' AND NEW.permissions IS NOT NULL THEN
    NEW.permissions := NEW.permissions
      - 'accounts.manage_admins'
      - 'accounts.manage_heads'
      - 'roles.manage'
      - 'permissions.manage'
      - 'testing.impersonate_head';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wm_profiles_protect_privileges ON public.wm_profiles;
CREATE TRIGGER trg_wm_profiles_protect_privileges
BEFORE INSERT OR UPDATE OR DELETE ON public.wm_profiles
FOR EACH ROW EXECUTE FUNCTION public.wm_profiles_protect_privileges();

ALTER TABLE IF EXISTS public.wm_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile or super admin reads all" ON public.wm_profiles;
CREATE POLICY "Users read own profile or super admin reads all"
  ON public.wm_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.wm_is_admin());

DROP POLICY IF EXISTS "Only super admin inserts profiles" ON public.wm_profiles;
CREATE POLICY "Only super admin inserts profiles"
  ON public.wm_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.wm_is_super_admin() AND role IN ('admin', 'department_head', 'executive_board'));

DROP POLICY IF EXISTS "Only super admin updates profiles" ON public.wm_profiles;
CREATE POLICY "Only super admin updates profiles"
  ON public.wm_profiles
  FOR UPDATE
  TO authenticated
  USING (public.wm_is_super_admin())
  WITH CHECK (public.wm_is_super_admin() AND role IN ('admin', 'department_head', 'executive_board', 'super_admin'));

DROP POLICY IF EXISTS "Only super admin deletes non-super profiles" ON public.wm_profiles;
CREATE POLICY "Only super admin deletes non-super profiles"
  ON public.wm_profiles
  FOR DELETE
  TO authenticated
  USING (public.wm_is_super_admin() AND user_id <> auth.uid() AND role <> 'super_admin');

-- 5. Delete Safety Audit: Convert blocking or cascading FKs on business records to ON DELETE SET NULL
DO $$
DECLARE
  rec record;
  col_list text;
  ref_table text;
BEGIN
  -- Ensure audit/author columns on conference business tables can become NULL when staff users are removed
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wm_eb_records' AND column_name = 'created_by' AND is_nullable = 'NO') THEN
    ALTER TABLE public.wm_eb_records ALTER COLUMN created_by DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wm_eb_records' AND column_name = 'updated_by' AND is_nullable = 'NO') THEN
    ALTER TABLE public.wm_eb_records ALTER COLUMN updated_by DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wm_qr_scans' AND column_name = 'scanned_by' AND is_nullable = 'NO') THEN
    ALTER TABLE public.wm_qr_scans ALTER COLUMN scanned_by DROP NOT NULL;
  END IF;

  -- Rewrite FKs pointing to auth.users on conference data tables (except wm_profiles / wm_qr_passes personal pass / wm_eb_record_acks personal ack)
  FOR rec IN
    SELECT
      con.conname,
      rel.relname AS table_name,
      att.attname AS column_name,
      con.confdeltype
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_class ref ON ref.oid = con.confrelid
    JOIN pg_namespace rnsp ON rnsp.oid = ref.relnamespace
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND nsp.nspname = 'public'
      AND rnsp.nspname = 'auth'
      AND ref.relname = 'users'
      AND rel.relname NOT IN ('wm_profiles', 'wm_qr_passes', 'wm_eb_record_acks')
      AND con.confdeltype IN ('a', 'r', 'c')
      AND array_length(con.conkey, 1) = 1
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', rec.table_name, rec.column_name);
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', rec.table_name, rec.conname);
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL',
        rec.table_name, rec.conname, rec.column_name
      );
    EXCEPTION WHEN OTHERS THEN
      -- Leave untouched if table shape differs cleanly
      NULL;
    END;
  END LOOP;
END $$;
