-- Keep scanner authorization callable only by signed-in users.
REVOKE EXECUTE ON FUNCTION public.wm_is_security_scanner()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.wm_is_security_scanner()
TO authenticated, service_role;

-- This helper uses only built-in functions, so pin its search path.
ALTER FUNCTION public.wm_mask_qr_token(text)
SET search_path = pg_catalog, pg_temp;

-- Evaluate auth helpers once per statement rather than once per scanned row.
DROP POLICY IF EXISTS "Security scanners read own recent scans"
ON public.wm_qr_scans;

CREATE POLICY "Security scanners read own recent scans"
ON public.wm_qr_scans
FOR SELECT
TO authenticated
USING (
  (SELECT public.wm_is_security_scanner())
  AND scanned_by = (SELECT auth.uid())
);
