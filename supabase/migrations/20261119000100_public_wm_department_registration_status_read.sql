-- Allow the public application page to read only the registration status fields
-- for the three public-facing application tracks.
GRANT SELECT (slug, registration_open)
ON TABLE public.wm_departments
TO anon;

DROP POLICY IF EXISTS wm_departments_public_registration_read
ON public.wm_departments;

CREATE POLICY wm_departments_public_registration_read
ON public.wm_departments
FOR SELECT
TO anon
USING (slug IN ('media', 'press', 'volunteers'));
