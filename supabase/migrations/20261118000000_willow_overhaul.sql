-- ============================================================================
-- Willow MUN Overhaul Migration:
-- 1. Strict Department Head dept + gender RLS isolation (Accept/Decline only)
-- 2. HR read-only cross-department & cross-gender Accepted Applicants access
-- 3. DCC Committee Management (wm_committees) with public published reads
-- 4. Universal permanent non-guessable Personal QR Pass provisioning
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Profile & Role Helper Functions (SECURITY DEFINER to avoid RLS recursion)
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.wm_profiles
  ADD COLUMN IF NOT EXISTS division text,
  ADD COLUMN IF NOT EXISTS eb_rank text NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS eb_permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.wm_actor_profile()
RETURNS public.wm_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.wm_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.wm_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wm_profiles
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.wm_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wm_profiles
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role IN ('super_admin', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.wm_is_hr()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wm_profiles
    WHERE user_id = auth.uid()
      AND is_active = true
      AND (
        lower(coalesce(department_id, '')) IN ('hr', 'human-resources', 'human_resources')
        OR lower(coalesce(title, '') || ' ' || coalesce(division, '')) ~ '\m(hr|human\s+resources)\M'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.wm_is_dcc()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wm_profiles
    WHERE user_id = auth.uid()
      AND is_active = true
      AND (
        role IN ('super_admin', 'admin')
        OR lower(coalesce(department_id, '')) IN ('dcc', 'delegate-affairs', 'delegate_affairs')
        OR coalesce((eb_permissions->>'manage_committees')::boolean, false) = true
        OR lower(coalesce(title, '') || ' ' || coalesce(division, '')) ~ '\m(dcc|delegate\s+affairs|delegate\s+care)\M'
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
    WHEN lower(coalesce(title, '') || ' ' || coalesce(division, '')) ~ '\m(female|women|woman)\M' THEN 'female'
    WHEN lower(coalesce(title, '') || ' ' || coalesce(division, '')) ~ '\m(male|men|man)\M' THEN 'male'
    ELSE NULL
  END
  FROM public.wm_profiles
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

-- ----------------------------------------------------------------------------
-- 2. Applications Table Hardening & Head / HR Access Control
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.wm_applications
  ADD COLUMN IF NOT EXISTS department_id text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS application_code text,
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS decision_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decision_by_name text,
  ADD COLUMN IF NOT EXISTS decision_at timestamptz;

CREATE OR REPLACE FUNCTION public.wm_map_application_department(app_type text, explicit_dept text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(trim(explicit_dept), ''),
    CASE lower(coalesce(app_type, ''))
      WHEN 'volunteer' THEN 'volunteers'
      WHEN 'volunteers' THEN 'volunteers'
      WHEN 'media' THEN 'media-press'
      WHEN 'press' THEN 'media-press'
      WHEN 'security' THEN 'security'
      WHEN 'delegate' THEN 'dcc'
      ELSE lower(coalesce(app_type, 'general'))
    END
  );
$$;

UPDATE public.wm_applications
SET department_id = public.wm_map_application_department(application_type, department_id)
WHERE department_id IS NULL OR trim(department_id) = '';

CREATE OR REPLACE FUNCTION public.wm_applications_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor public.wm_profiles;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.department_id := public.wm_map_application_department(NEW.application_type, NEW.department_id);
    IF NEW.gender IS NOT NULL THEN
      NEW.gender := lower(trim(NEW.gender));
    END IF;
    RETURN NEW;
  END IF;

  -- On UPDATE, enforce Head scope & status-only updates
  IF auth.uid() IS NOT NULL THEN
    SELECT * INTO actor FROM public.wm_profiles WHERE user_id = auth.uid() LIMIT 1;
    IF actor.role = 'department_head' THEN
      IF NEW.status NOT IN ('accepted', 'rejected') THEN
        RAISE EXCEPTION 'Department Heads can only accept or decline applications.';
      END IF;
      IF lower(coalesce(OLD.department_id, '')) <> lower(coalesce(actor.department_id, '')) THEN
        RAISE EXCEPTION 'Cross-department application update is forbidden.';
      END IF;
      IF public.wm_head_gender() IS NULL OR lower(coalesce(OLD.gender, '')) <> public.wm_head_gender() THEN
        RAISE EXCEPTION 'Cross-gender application update is forbidden.';
      END IF;
      -- Preserve applicant-submitted fields from modification
      NEW.applicant_name := OLD.applicant_name;
      NEW.email := OLD.email;
      NEW.phone := OLD.phone;
      NEW.school := OLD.school;
      NEW.age := OLD.age;
      NEW.gender := OLD.gender;
      NEW.department_id := OLD.department_id;
      NEW.application_type := OLD.application_type;
      NEW.motivation := OLD.motivation;
      NEW.experience := OLD.experience;
      NEW.portfolio_url := OLD.portfolio_url;
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
$$;

DROP TRIGGER IF EXISTS trg_wm_applications_before_write ON public.wm_applications;
CREATE TRIGGER trg_wm_applications_before_write
BEFORE INSERT OR UPDATE ON public.wm_applications
FOR EACH ROW EXECUTE FUNCTION public.wm_applications_before_write();

ALTER TABLE IF EXISTS public.wm_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public insert applications" ON public.wm_applications;
CREATE POLICY "Public insert applications"
  ON public.wm_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending');

DROP POLICY IF EXISTS "Admins full select applications" ON public.wm_applications;
CREATE POLICY "Admins full select applications"
  ON public.wm_applications
  FOR SELECT
  TO authenticated
  USING (public.wm_is_admin());

DROP POLICY IF EXISTS "Admins full update applications" ON public.wm_applications;
CREATE POLICY "Admins full update applications"
  ON public.wm_applications
  FOR UPDATE
  TO authenticated
  USING (public.wm_is_admin())
  WITH CHECK (public.wm_is_admin());

DROP POLICY IF EXISTS "Department heads strict dept and gender select" ON public.wm_applications;
CREATE POLICY "Department heads strict dept and gender select"
  ON public.wm_applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.wm_profiles p
      WHERE p.user_id = auth.uid()
        AND p.is_active = true
        AND p.role = 'department_head'
        AND p.department_id IS NOT NULL
        AND lower(public.wm_map_application_department(wm_applications.application_type, wm_applications.department_id)) = lower(p.department_id)
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
      SELECT 1 FROM public.wm_profiles p
      WHERE p.user_id = auth.uid()
        AND p.is_active = true
        AND p.role = 'department_head'
        AND p.department_id IS NOT NULL
        AND lower(public.wm_map_application_department(wm_applications.application_type, wm_applications.department_id)) = lower(p.department_id)
        AND public.wm_head_gender() IS NOT NULL
        AND lower(coalesce(wm_applications.gender, '')) = public.wm_head_gender()
    )
  )
  WITH CHECK (status IN ('accepted', 'rejected'));

DROP POLICY IF EXISTS "HR select all accepted applications" ON public.wm_applications;
CREATE POLICY "HR select all accepted applications"
  ON public.wm_applications
  FOR SELECT
  TO authenticated
  USING (
    public.wm_is_hr()
    AND status = 'accepted'
  );

-- ----------------------------------------------------------------------------
-- 3. Committees Table (DCC + Admin/Super Admin CRUD, Public Published Read)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wm_committees (
  id text PRIMARY KEY,
  chamber text NOT NULL,
  name text NOT NULL,
  abbreviation text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT 'Intermediate' CHECK (difficulty IN ('Beginner', 'Intermediate', 'Advanced', 'Crisis')),
  description text NOT NULL DEFAULT '',
  topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  chair_name text NOT NULL DEFAULT 'TBA',
  vice_chair_name text NOT NULL DEFAULT 'TBA',
  logo_url text,
  image_url text,
  capacity integer NOT NULL DEFAULT 40 CHECK (capacity >= 1),
  published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wm_committees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published committees" ON public.wm_committees;
CREATE POLICY "Public read published committees"
  ON public.wm_committees
  FOR SELECT
  TO anon, authenticated
  USING (published = true OR public.wm_is_dcc() OR public.wm_is_admin());

DROP POLICY IF EXISTS "DCC and Admins manage committees" ON public.wm_committees;
CREATE POLICY "DCC and Admins manage committees"
  ON public.wm_committees
  FOR ALL
  TO authenticated
  USING (public.wm_is_dcc() OR public.wm_is_admin())
  WITH CHECK (public.wm_is_dcc() OR public.wm_is_admin());

INSERT INTO public.wm_committees (id, chamber, name, abbreviation, difficulty, description, topics, chair_name, vice_chair_name, capacity, published, sort_order)
VALUES
  ('chamber-01', 'Chamber 01', 'Committee', 'CH-01', 'Intermediate', 'Agenda and chairs to be announced.', '["Agenda Topic TBA"]'::jsonb, 'TBA', 'TBA', 40, true, 1),
  ('chamber-02', 'Chamber 02', 'Committee', 'CH-02', 'Intermediate', 'Agenda and chairs to be announced.', '["Agenda Topic TBA"]'::jsonb, 'TBA', 'TBA', 40, true, 2),
  ('chamber-03', 'Chamber 03', 'Committee', 'CH-03', 'Intermediate', 'Agenda and chairs to be announced.', '["Agenda Topic TBA"]'::jsonb, 'TBA', 'TBA', 40, true, 3),
  ('chamber-04', 'Chamber 04', 'Committee', 'CH-04', 'Intermediate', 'Agenda and chairs to be announced.', '["Agenda Topic TBA"]'::jsonb, 'TBA', 'TBA', 40, true, 4),
  ('chamber-05', 'Chamber 05', 'Committee', 'CH-05', 'Intermediate', 'Agenda and chairs to be announced.', '["Agenda Topic TBA"]'::jsonb, 'TBA', 'TBA', 40, true, 5),
  ('chamber-06', 'Chamber 06', 'Committee', 'CH-06', 'Intermediate', 'Agenda and chairs to be announced.', '["Agenda Topic TBA"]'::jsonb, 'TBA', 'TBA', 40, true, 6)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Universal Permanent Personal QR Passes
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.wm_qr_passes
  ADD COLUMN IF NOT EXISTS application_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wm_qr_passes_unique_user
  ON public.wm_qr_passes (user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wm_qr_passes_unique_application
  ON public.wm_qr_passes (application_id)
  WHERE application_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wm_qr_passes_unique_token
  ON public.wm_qr_passes (token_value);

CREATE OR REPLACE FUNCTION public.wm_generate_opaque_qr_token()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT 'WMQR-' || upper(encode(gen_random_bytes(16), 'hex'));
$$;

CREATE OR REPLACE FUNCTION public.wm_provision_profile_qr()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  pass_category text;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id LIMIT 1;
  pass_category := CASE NEW.role
    WHEN 'super_admin' THEN 'Executive'
    WHEN 'admin' THEN 'Executive'
    WHEN 'department_head' THEN 'Department Head'
    WHEN 'executive_board' THEN 'Executive Board'
    ELSE 'Staff'
  END;

  INSERT INTO public.wm_qr_passes (
    user_id,
    holder_name,
    holder_email,
    role_label,
    category,
    department_id,
    active,
    token_value
  )
  VALUES (
    NEW.user_id,
    COALESCE(NULLIF(trim(NEW.full_name), ''), 'Willow Member'),
    user_email,
    COALESCE(NULLIF(trim(NEW.title), ''), initcap(replace(NEW.role, '_', ' '))),
    pass_category,
    NEW.department_id,
    COALESCE(NEW.is_active, true),
    public.wm_generate_opaque_qr_token()
  )
  ON CONFLICT (user_id) WHERE user_id IS NOT NULL
  DO UPDATE SET
    holder_name = EXCLUDED.holder_name,
    role_label = EXCLUDED.role_label,
    department_id = EXCLUDED.department_id,
    active = COALESCE(NEW.is_active, true);
    -- CRITICAL: token_value is intentionally NOT updated on conflict so QR remains permanent.

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wm_profiles_provision_qr ON public.wm_profiles;
CREATE TRIGGER trg_wm_profiles_provision_qr
AFTER INSERT OR UPDATE OF full_name, title, role, department_id, is_active ON public.wm_profiles
FOR EACH ROW EXECUTE FUNCTION public.wm_provision_profile_qr();

CREATE OR REPLACE FUNCTION public.wm_provision_accepted_applicant_qr()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' THEN
    INSERT INTO public.wm_qr_passes (
      application_id,
      holder_name,
      holder_email,
      role_label,
      category,
      department_id,
      active,
      token_value
    )
    VALUES (
      NEW.id::text,
      NEW.applicant_name,
      NEW.email,
      COALESCE(NULLIF(trim(NEW.position), ''), initcap(NEW.application_type) || ' Participant'),
      CASE WHEN lower(NEW.application_type) = 'delegate' THEN 'Delegate' ELSE 'Staff' END,
      public.wm_map_application_department(NEW.application_type, NEW.department_id),
      true,
      public.wm_generate_opaque_qr_token()
    )
    ON CONFLICT (application_id) WHERE application_id IS NOT NULL
    DO UPDATE SET active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wm_applications_accepted_qr ON public.wm_applications;
CREATE TRIGGER trg_wm_applications_accepted_qr
AFTER INSERT OR UPDATE OF status ON public.wm_applications
FOR EACH ROW EXECUTE FUNCTION public.wm_provision_accepted_applicant_qr();

-- Backfill permanent QR passes for all existing registered staff & accepted participants
INSERT INTO public.wm_qr_passes (user_id, holder_name, holder_email, role_label, category, department_id, active, token_value)
SELECT
  p.user_id,
  COALESCE(NULLIF(trim(p.full_name), ''), 'Willow Member'),
  u.email,
  COALESCE(NULLIF(trim(p.title), ''), initcap(replace(p.role, '_', ' '))),
  CASE p.role
    WHEN 'super_admin' THEN 'Executive'
    WHEN 'admin' THEN 'Executive'
    WHEN 'department_head' THEN 'Department Head'
    WHEN 'executive_board' THEN 'Executive Board'
    ELSE 'Staff'
  END,
  p.department_id,
  COALESCE(p.is_active, true),
  public.wm_generate_opaque_qr_token()
FROM public.wm_profiles p
LEFT JOIN auth.users u ON u.id = p.user_id
ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO NOTHING;

INSERT INTO public.wm_qr_passes (application_id, holder_name, holder_email, role_label, category, department_id, active, token_value)
SELECT
  a.id::text,
  a.applicant_name,
  a.email,
  COALESCE(NULLIF(trim(a.position), ''), initcap(a.application_type) || ' Participant'),
  CASE WHEN lower(a.application_type) = 'delegate' THEN 'Delegate' ELSE 'Staff' END,
  public.wm_map_application_department(a.application_type, a.department_id),
  true,
  public.wm_generate_opaque_qr_token()
FROM public.wm_applications a
WHERE a.status = 'accepted'
ON CONFLICT (application_id) WHERE application_id IS NOT NULL DO NOTHING;

ALTER TABLE IF EXISTS public.wm_qr_passes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only view own personal QR pass" ON public.wm_qr_passes;
CREATE POLICY "Users can only view own personal QR pass"
  ON public.wm_qr_passes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.wm_is_admin());

DROP POLICY IF EXISTS "Only admins can insert or update QR passes" ON public.wm_qr_passes;
CREATE POLICY "Only admins can insert or update QR passes"
  ON public.wm_qr_passes
  FOR ALL
  TO authenticated
  USING (public.wm_is_admin())
  WITH CHECK (public.wm_is_admin());
