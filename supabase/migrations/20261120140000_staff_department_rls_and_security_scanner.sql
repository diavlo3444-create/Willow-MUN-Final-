-- Ensure active authenticated Willow users can read wm_departments metadata
-- (needed so staff, security, department heads, and EB accounts resolve
-- their department UUID -> slug/name cleanly on login) and include Security
-- department `staff` accounts in wm_is_security_scanner().

GRANT SELECT ON TABLE public.wm_departments TO authenticated;

DROP POLICY IF EXISTS wm_departments_authenticated_read ON public.wm_departments;
CREATE POLICY wm_departments_authenticated_read
  ON public.wm_departments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.wm_profiles p
      WHERE p.user_id = auth.uid()
        AND p.is_active = true
    )
  );

CREATE OR REPLACE FUNCTION public.wm_is_security_scanner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.wm_profiles p
    LEFT JOIN public.wm_departments d ON d.id::text = p.department_id::text
    WHERE p.user_id = auth.uid()
      AND p.is_active = true
      AND (
        p.role IN ('super_admin', 'admin')
        OR (
          p.role IN ('department_head', 'executive_board', 'staff')
          AND lower(coalesce(d.slug, p.department_id::text, '')) = 'security'
        )
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.wm_is_security_scanner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wm_is_security_scanner() TO authenticated, service_role;
