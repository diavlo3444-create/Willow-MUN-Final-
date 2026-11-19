-- Ensure all four public website application tracks (media, press, volunteers, security)
-- are readable by anonymous visitors for open/closed status checks, and ensure Admins
-- can read and toggle registration_open on wm_departments.
GRANT SELECT (slug, registration_open)
ON TABLE public.wm_departments
TO anon;

DROP POLICY IF EXISTS wm_departments_public_registration_read
ON public.wm_departments;

CREATE POLICY wm_departments_public_registration_read
ON public.wm_departments
FOR SELECT
TO anon
USING (slug IN ('media', 'press', 'volunteers', 'security'));

DROP POLICY IF EXISTS wm_departments_admin_read
ON public.wm_departments;

CREATE POLICY wm_departments_admin_read
ON public.wm_departments
FOR SELECT
TO authenticated
USING (public.wm_is_admin());

DROP POLICY IF EXISTS wm_departments_admin_update
ON public.wm_departments;

CREATE POLICY wm_departments_admin_update
ON public.wm_departments
FOR UPDATE
TO authenticated
USING (public.wm_is_admin())
WITH CHECK (public.wm_is_admin());
