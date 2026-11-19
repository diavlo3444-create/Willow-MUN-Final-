-- Restrict QR scanner access to admins and the Security department only.
-- Security team members are executive_board profiles assigned to Security;
-- the Security department head is a department_head profile assigned there.
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
          AND coalesce((p.permissions->>'qr.scan')::boolean, true) = true
        )
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.wm_is_security_scanner()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wm_is_security_scanner()
TO authenticated, service_role;

-- Remove legacy scanner grants from non-Security department heads and EB members.
UPDATE public.wm_profiles p
SET permissions = jsonb_set(coalesce(p.permissions, '{}'::jsonb), '{qr.scan}', 'false'::jsonb, true),
    eb_permissions = coalesce(p.eb_permissions, '{}'::jsonb) - 'scan_qr'
WHERE p.role IN ('department_head', 'executive_board')
  AND NOT EXISTS (
    SELECT 1 FROM public.wm_departments d
    WHERE d.id::text = p.department_id::text AND lower(d.slug) = 'security'
  );
