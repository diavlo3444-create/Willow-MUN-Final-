-- Enforce application access for the four core departments after separating Media and Press.
BEGIN;

CREATE OR REPLACE FUNCTION public.wm_applications_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  actor public.wm_profiles;
  requested_status text;
  actor_department_slug text;
  actor_application_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.department_id := public.wm_map_application_department(NEW.application_type, NEW.department_id);
    IF NEW.gender IS NOT NULL THEN NEW.gender := lower(trim(NEW.gender)); END IF;
    IF NEW.email IS NOT NULL THEN NEW.email := lower(trim(NEW.email)); END IF;
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

      SELECT d.slug INTO actor_department_slug
      FROM public.wm_departments d
      WHERE d.id = actor.department_id;

      IF actor_department_slug IS NULL
        OR lower(actor_department_slug) NOT IN ('media', 'press', 'security', 'volunteers') THEN
        RAISE EXCEPTION 'Applications are only available to Media, Press, Security, and Volunteers heads.';
      END IF;

      requested_status := NEW.status;
      IF requested_status NOT IN ('accepted', 'rejected') THEN
        RAISE EXCEPTION 'Department Heads can only accept or decline applications.';
      END IF;

      IF lower(actor_department_slug) <> lower(public.wm_map_application_department(OLD.application_type, OLD.department_id)) THEN
        RAISE EXCEPTION 'Cross-department application update is forbidden.';
      END IF;

      actor_application_type := public.wm_head_application_type_scope();
      IF lower(actor_department_slug) IN ('media', 'press')
        AND (actor_application_type IS NULL OR lower(OLD.application_type) <> actor_application_type) THEN
        RAISE EXCEPTION 'Media and Press applications are isolated.';
      END IF;

      IF public.wm_head_gender() IS NULL
        OR lower(coalesce(OLD.gender, '')) <> public.wm_head_gender() THEN
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
$function$;

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
      AND public.wm_is_head_profile(p.*)
      AND lower(d.slug) IN ('media', 'press', 'security', 'volunteers')
      AND lower(public.wm_map_application_department(wm_applications.application_type, wm_applications.department_id)) = lower(d.slug)
      AND (
        lower(d.slug) NOT IN ('media', 'press')
        OR lower(wm_applications.application_type) = public.wm_head_application_type_scope()
      )
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
      AND public.wm_is_head_profile(p.*)
      AND coalesce((p.permissions->>'applications.review')::boolean, true) = true
      AND lower(d.slug) IN ('media', 'press', 'security', 'volunteers')
      AND lower(public.wm_map_application_department(wm_applications.application_type, wm_applications.department_id)) = lower(d.slug)
      AND (
        lower(d.slug) NOT IN ('media', 'press')
        OR lower(wm_applications.application_type) = public.wm_head_application_type_scope()
      )
      AND public.wm_head_gender() IS NOT NULL
      AND lower(coalesce(wm_applications.gender, '')) = public.wm_head_gender()
  )
)
WITH CHECK (status = ANY (ARRAY['accepted'::text, 'rejected'::text]));

COMMIT;
