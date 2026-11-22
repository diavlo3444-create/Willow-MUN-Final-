-- Allow authorized department members and department heads (Volunteering,
-- Press & Media, and Security) to view active QR passes assigned to members of
-- their own department without requiring Administrator privileges, while
-- preserving strict Administrator-only pass registry management (create, edit,
-- revoke, delete, and attendance reset).

CREATE OR REPLACE FUNCTION public.wm_normalize_qr_section(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(regexp_replace(trim(coalesce(p_raw, '')), '[_\s]+', '-', 'g')) IN (
      'volunteers', 'volunteer', 'volunteering'
    ) THEN 'volunteers'
    WHEN lower(regexp_replace(trim(coalesce(p_raw, '')), '[_\s]+', '-', 'g')) IN (
      'press-media', 'media-press', 'media-&-press', 'press-&-media', 'media', 'press'
    ) THEN 'press_media'
    WHEN lower(regexp_replace(trim(coalesce(p_raw, '')), '[_\s]+', '-', 'g')) = 'security'
      THEN 'security'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.wm_actor_qr_section()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.wm_profiles;
  v_dept_slug text;
  v_section text;
  v_label text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_profile
  FROM public.wm_profiles p
  WHERE p.user_id = auth.uid()
    AND p.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_profile.role = 'super_admin' THEN
    RETURN '__admin__';
  END IF;

  IF coalesce((v_profile.permissions->>'qr.view_pass')::boolean, true) = false THEN
    RETURN NULL;
  END IF;

  IF v_profile.role = 'admin' THEN
    RETURN '__admin__';
  END IF;

  IF v_profile.role NOT IN ('department_head', 'executive_board', 'staff') THEN
    RETURN NULL;
  END IF;

  SELECT d.slug
  INTO v_dept_slug
  FROM public.wm_departments d
  WHERE d.id::text = v_profile.department_id::text
     OR lower(d.slug) = lower(coalesce(v_profile.department_id::text, ''))
  LIMIT 1;

  v_section := public.wm_normalize_qr_section(coalesce(v_dept_slug, v_profile.department_id::text));
  IF v_section IS NOT NULL THEN
    RETURN v_section;
  END IF;

  v_label := lower(trim(coalesce(v_profile.title, '') || ' ' || coalesce(v_profile.division, '')));
  IF v_label ~ '\m(volunteers?|volunteering|usher|floor\s+team)\M' THEN
    RETURN 'volunteers';
  END IF;
  IF v_label ~ '\m(press|media|journalis[tm]|reporter|correspondent|editorial|photograph(y|er)|videograph(y|er)|broadcast|reel)\M' THEN
    RETURN 'press_media';
  END IF;
  IF v_label ~ '\m(security|guard|checkpoint|entrance\s+control)\M' THEN
    RETURN 'security';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.wm_pass_qr_section(
  p_pass_dept_id text,
  p_pass_app_id text,
  p_pass_user_id uuid,
  p_pass_role_label text,
  p_pass_category text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app record;
  v_prof record;
  v_key text;
  v_dept record;
  v_section text;
  v_slug text;
  v_role text;
BEGIN
  IF p_pass_app_id IS NOT NULL AND trim(p_pass_app_id) <> '' THEN
    SELECT a.id, a.application_type, a.department_id, a.status
    INTO v_app
    FROM public.wm_applications a
    WHERE a.id::text = p_pass_app_id
    LIMIT 1;

    IF NOT FOUND OR lower(coalesce(v_app.status, '')) <> 'accepted' THEN
      RETURN NULL;
    END IF;
  END IF;

  IF p_pass_user_id IS NOT NULL THEN
    SELECT pr.user_id, pr.department_id, pr.is_active
    INTO v_prof
    FROM public.wm_profiles pr
    WHERE pr.user_id = p_pass_user_id
    LIMIT 1;

    IF FOUND AND coalesce(v_prof.is_active, false) = false THEN
      RETURN NULL;
    END IF;
  END IF;

  FOREACH v_key IN ARRAY ARRAY[
    nullif(trim(coalesce(p_pass_dept_id, '')), ''),
    nullif(trim(coalesce(v_prof.department_id::text, '')), ''),
    nullif(trim(coalesce(v_app.department_id::text, '')), ''),
    nullif(trim(coalesce(v_app.application_type, '')), '')
  ]
  LOOP
    IF v_key IS NULL THEN
      CONTINUE;
    END IF;

    v_section := public.wm_normalize_qr_section(v_key);
    IF v_section IS NOT NULL THEN
      RETURN v_section;
    END IF;

    SELECT d.slug, d.name
    INTO v_dept
    FROM public.wm_departments d
    WHERE d.id::text = v_key
       OR lower(d.slug) = lower(v_key)
       OR lower(d.name) = lower(v_key)
    LIMIT 1;

    IF FOUND THEN
      v_section := coalesce(
        public.wm_normalize_qr_section(v_dept.slug),
        public.wm_normalize_qr_section(v_dept.name)
      );
      IF v_section IS NOT NULL THEN
        RETURN v_section;
      END IF;
      RETURN NULL;
    END IF;

    v_slug := lower(trim(v_key));
    IF v_slug IN ('hr', 'human-resources', 'human_resources', 'dcc', 'delegate-affairs', 'delegate_affairs', 'delegate', 'it', 'design', 'marketing', 'secretariat') THEN
      RETURN NULL;
    END IF;
  END LOOP;

  IF lower(trim(coalesce(p_pass_category, ''))) = 'delegate' THEN
    RETURN NULL;
  END IF;

  v_role := lower(trim(coalesce(p_pass_role_label, '')));
  IF v_role ~ '\m(press|media|journalist|photographer|videographer|cameraman|reporter)\M' THEN
    RETURN 'press_media';
  END IF;
  IF v_role ~ '\m(volunteer|volunteers|volunteering)\M' THEN
    RETURN 'volunteers';
  END IF;
  IF v_role ~ '\m(security|guard|entrance\s+security)\M' THEN
    RETURN 'security';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.wm_can_view_qr_pass(
  p_pass_user_id uuid,
  p_pass_dept_id text,
  p_pass_app_id text,
  p_pass_role_label text,
  p_pass_category text,
  p_pass_active boolean,
  p_pass_token text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_section text;
  v_pass_section text;
BEGIN
  IF p_pass_user_id = auth.uid() THEN
    RETURN true;
  END IF;

  IF public.wm_is_admin() THEN
    RETURN true;
  END IF;

  IF coalesce(p_pass_active, false) = false OR coalesce(trim(p_pass_token), '') = '' THEN
    RETURN false;
  END IF;

  v_actor_section := public.wm_actor_qr_section();
  IF v_actor_section IS NULL THEN
    RETURN false;
  END IF;

  v_pass_section := public.wm_pass_qr_section(
    p_pass_dept_id,
    p_pass_app_id,
    p_pass_user_id,
    p_pass_role_label,
    p_pass_category
  );

  RETURN v_pass_section IS NOT NULL AND v_pass_section = v_actor_section;
END;
$$;

CREATE OR REPLACE FUNCTION public.wm_get_department_qr_passes(p_section text)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  application_id text,
  token_value text,
  holder_name text,
  role_label text,
  category text,
  department_id text,
  department_name text,
  active boolean,
  checked_in_at timestamptz,
  checked_in_gate text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target text;
  v_actor_section text;
BEGIN
  v_target := public.wm_normalize_qr_section(p_section);
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Invalid department section.' USING ERRCODE = '22023';
  END IF;

  v_actor_section := public.wm_actor_qr_section();
  IF v_actor_section IS NULL OR (v_actor_section <> '__admin__' AND v_actor_section <> v_target) THEN
    RAISE EXCEPTION 'You do not have permission to view QR passes for this department.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.application_id::text,
    p.token_value,
    coalesce(nullif(trim(p.holder_name), ''), 'Willow MUN Member') AS holder_name,
    coalesce(nullif(trim(p.role_label), ''), nullif(trim(p.category), ''), 'Staff') AS role_label,
    coalesce(nullif(trim(p.category), ''), 'Staff') AS category,
    coalesce(p.department_id::text, pr.department_id::text, a.department_id::text) AS department_id,
    d.name AS department_name,
    p.active,
    p.checked_in_at,
    p.checked_in_gate,
    p.created_at
  FROM public.wm_qr_passes p
  LEFT JOIN public.wm_applications a ON a.id::text = p.application_id::text
  LEFT JOIN public.wm_profiles pr ON pr.user_id = p.user_id
  LEFT JOIN public.wm_departments d ON (
    d.id::text = coalesce(p.department_id::text, pr.department_id::text, a.department_id::text)
    OR lower(d.slug) = lower(coalesce(p.department_id::text, pr.department_id::text, a.department_id::text, a.application_type, ''))
  )
  WHERE p.active = true
    AND coalesce(trim(p.token_value), '') <> ''
    AND public.wm_pass_qr_section(
      p.department_id::text,
      p.application_id::text,
      p.user_id,
      p.role_label,
      p.category
    ) = v_target
  ORDER BY lower(coalesce(p.holder_name, '')) ASC, p.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.wm_normalize_qr_section(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wm_normalize_qr_section(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.wm_actor_qr_section() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wm_actor_qr_section() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.wm_pass_qr_section(text, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wm_pass_qr_section(text, text, uuid, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.wm_can_view_qr_pass(uuid, text, text, text, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wm_can_view_qr_pass(uuid, text, text, text, text, boolean, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.wm_get_department_qr_passes(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wm_get_department_qr_passes(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can only view own personal QR pass" ON public.wm_qr_passes;
DROP POLICY IF EXISTS "Users and department members read authorized QR passes" ON public.wm_qr_passes;
CREATE POLICY "Users and department members read authorized QR passes"
  ON public.wm_qr_passes
  FOR SELECT
  TO authenticated
  USING (
    public.wm_can_view_qr_pass(
      user_id,
      department_id::text,
      application_id::text,
      role_label,
      category,
      active,
      token_value
    )
  );
