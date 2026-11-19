-- Make Security department membership itself the scanner entitlement.
-- This includes the Security department head and every active Security EB member.
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
          p.role IN ('department_head', 'executive_board')
          AND lower(coalesce(d.slug, p.department_id::text, '')) = 'security'
        )
      )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.wm_is_security_scanner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wm_is_security_scanner() TO authenticated, service_role;
