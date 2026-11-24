-- Enforce strict pending-only application visibility and updates for Department Heads and Co-Heads.
-- Accepted, rejected, waitlisted, and withdrawn applications are invisible to Heads at the RLS & trigger level.
BEGIN;

CREATE OR REPLACE FUNCTION public.wm_applications_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  actor public.wm_profiles;
  actor_department_id uuid;
  actor_department_slug text;
  actor_application_type text;
  old_app_dept text;
  dept_matches boolean;
  requested_rec text;
  requested_notes text;
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
        RAISE EXCEPTION 'Only authorized Department Heads can access pending applications.';
      END IF;
      IF coalesce((actor.permissions->>'applications.view')::boolean, true) = false
        OR coalesce((actor.permissions->>'applications.recommend')::boolean, true) = false THEN
        RAISE EXCEPTION 'You do not have permission to submit recommendations.';
      END IF;

      -- Heads may never access or modify non-pending applications (no status leakage).
      IF lower(coalesce(OLD.status, '')) <> 'pending' THEN
        RAISE EXCEPTION 'This application is no longer pending.';
      END IF;

      IF NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Only Administrators can make final application decisions. Department Heads submit recommendations.';
      END IF;

      SELECT d.id, d.slug INTO actor_department_id, actor_department_slug
      FROM public.wm_departments d
      WHERE d.id = actor.department_id;

      IF actor_department_slug IS NULL
        OR lower(actor_department_slug) NOT IN ('media', 'press', 'media-press', 'security', 'volunteers') THEN
        RAISE EXCEPTION 'Applications are only available to Media, Press, Security, and Volunteers heads.';
      END IF;

      old_app_dept := lower(public.wm_map_application_department(OLD.application_type, OLD.department_id));
      dept_matches := (
        (actor_department_id IS NOT NULL AND lower(trim(coalesce(OLD.department_id, ''))) = lower(actor_department_id::text))
        OR old_app_dept = lower(actor_department_slug)
        OR (lower(actor_department_slug) = 'media-press' AND old_app_dept IN ('media', 'press', 'media-press'))
        OR (lower(actor_department_slug) IN ('media', 'press') AND lower(coalesce(OLD.application_type, '')) = lower(actor_department_slug))
      );

      IF NOT dept_matches THEN
        RAISE EXCEPTION 'Cross-department application update is forbidden.';
      END IF;

      actor_application_type := COALESCE(
        public.wm_head_application_type_scope(),
        CASE
          WHEN lower(actor_department_slug) IN ('media', 'press') THEN lower(actor_department_slug)
          ELSE NULL
        END
      );
      IF lower(actor_department_slug) IN ('media', 'press', 'media-press')
        AND (actor_application_type IS NULL OR lower(coalesce(OLD.application_type, '')) <> actor_application_type) THEN
        RAISE EXCEPTION 'Media and Press applications are isolated.';
      END IF;

      IF public.wm_head_gender() IS NULL
        OR lower(coalesce(OLD.gender, '')) <> public.wm_head_gender() THEN
        RAISE EXCEPTION 'Cross-gender application update is forbidden.';
      END IF;

      requested_rec := lower(trim(coalesce(NEW.head_recommendation, '')));
      IF requested_rec NOT IN ('', 'none', 'recommend_accept', 'recommend_reject') THEN
        RAISE EXCEPTION 'Invalid recommendation value.';
      END IF;
      requested_notes := NEW.head_notes;

      NEW := OLD;
      NEW.head_recommendation := CASE WHEN requested_rec IN ('recommend_accept', 'recommend_reject') THEN requested_rec ELSE 'none' END;
      NEW.head_notes := requested_notes;
      NEW.recommended_by := auth.uid();
      NEW.recommended_by_name := actor.full_name;
      NEW.recommended_at := now();
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
  lower(coalesce(wm_applications.status, '')) = 'pending'
  AND EXISTS (
    SELECT 1
    FROM public.wm_profiles p
    JOIN public.wm_departments d ON d.id = p.department_id
    WHERE p.user_id = auth.uid()
      AND public.wm_is_head_profile(p.*)
      AND coalesce((p.permissions->>'applications.view')::boolean, true) = true
      AND lower(d.slug) IN ('media', 'press', 'media-press', 'security', 'volunteers')
      AND (
        lower(trim(coalesce(wm_applications.department_id, ''))) = lower(d.id::text)
        OR lower(public.wm_map_application_department(wm_applications.application_type, wm_applications.department_id)) = lower(d.slug)
        OR (
          lower(d.slug) = 'media-press'
          AND lower(public.wm_map_application_department(wm_applications.application_type, wm_applications.department_id)) IN ('media', 'press', 'media-press')
        )
      )
      AND (
        lower(d.slug) NOT IN ('media', 'press', 'media-press')
        OR lower(coalesce(wm_applications.application_type, '')) = COALESCE(
          public.wm_head_application_type_scope(),
          CASE
            WHEN lower(d.slug) IN ('media', 'press') THEN lower(d.slug)
            ELSE NULL
          END
        )
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
  lower(coalesce(wm_applications.status, '')) = 'pending'
  AND EXISTS (
    SELECT 1
    FROM public.wm_profiles p
    JOIN public.wm_departments d ON d.id = p.department_id
    WHERE p.user_id = auth.uid()
      AND public.wm_is_head_profile(p.*)
      AND coalesce((p.permissions->>'applications.view')::boolean, true) = true
      AND coalesce((p.permissions->>'applications.recommend')::boolean, true) = true
      AND lower(d.slug) IN ('media', 'press', 'media-press', 'security', 'volunteers')
      AND (
        lower(trim(coalesce(wm_applications.department_id, ''))) = lower(d.id::text)
        OR lower(public.wm_map_application_department(wm_applications.application_type, wm_applications.department_id)) = lower(d.slug)
        OR (
          lower(d.slug) = 'media-press'
          AND lower(public.wm_map_application_department(wm_applications.application_type, wm_applications.department_id)) IN ('media', 'press', 'media-press')
        )
      )
      AND (
        lower(d.slug) NOT IN ('media', 'press', 'media-press')
        OR lower(coalesce(wm_applications.application_type, '')) = COALESCE(
          public.wm_head_application_type_scope(),
          CASE
            WHEN lower(d.slug) IN ('media', 'press') THEN lower(d.slug)
            ELSE NULL
          END
        )
      )
      AND public.wm_head_gender() IS NOT NULL
      AND lower(coalesce(wm_applications.gender, '')) = public.wm_head_gender()
  )
)
WITH CHECK (lower(coalesce(status, '')) = 'pending');

COMMIT;
