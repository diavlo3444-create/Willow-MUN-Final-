-- Allow all active Department Heads and EB Heads to view Pending, Accepted, and Rejected
-- applications strictly within their own assigned department (preserving Media vs Press isolation,
-- confidential medical isolation, and optional Female/Male division filtering when configured).
-- Stage 1 Accept/Reject recommendations remain allowed only while an application is pending.
BEGIN;

CREATE OR REPLACE FUNCTION public.wm_is_head_profile(p public.wm_profiles)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    p.is_active = true
    AND (
      p.role = 'department_head'
      OR (
        p.role = 'executive_board'
        AND (
          lower(coalesce(p.eb_rank, '')) IN ('head', 'co_head')
          OR coalesce((p.eb_permissions->>'manage_department')::boolean, false) = true
          OR lower(coalesce(p.title, '')) ~ '\m(head|co-head|director)\M'
          OR coalesce((p.permissions->>'applications.view')::boolean, false) = true
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.wm_map_application_department(app_type text, explicit_dept text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE lower(coalesce(
    NULLIF(trim(explicit_dept), ''),
    CASE lower(coalesce(app_type, ''))
      WHEN 'volunteer' THEN 'volunteers'
      WHEN 'volunteers' THEN 'volunteers'
      WHEN 'media' THEN 'media'
      WHEN 'press' THEN 'press'
      WHEN 'security' THEN 'security'
      WHEN 'delegate' THEN 'dcc'
      ELSE lower(coalesce(app_type, 'general'))
    END
  ))
    WHEN 'volunteer' THEN 'volunteers'
    WHEN 'volunteering' THEN 'volunteers'
    WHEN 'human-resources' THEN 'hr'
    WHEN 'human_resources' THEN 'hr'
    WHEN 'delegate-affairs' THEN 'dcc'
    WHEN 'delegate_affairs' THEN 'dcc'
    WHEN 'public-relations' THEN 'pr'
    WHEN 'public_relations' THEN 'pr'
    WHEN 'ceremonies' THEN 'ceremony'
    ELSE lower(coalesce(
      NULLIF(trim(explicit_dept), ''),
      CASE lower(coalesce(app_type, ''))
        WHEN 'volunteer' THEN 'volunteers'
        WHEN 'volunteers' THEN 'volunteers'
        WHEN 'media' THEN 'media'
        WHEN 'press' THEN 'press'
        WHEN 'security' THEN 'security'
        WHEN 'delegate' THEN 'dcc'
        ELSE lower(coalesce(app_type, 'general'))
      END
    ))
  END;
$function$;

CREATE OR REPLACE FUNCTION public.wm_head_gender()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(
      coalesce(to_jsonb(p)->>'gender', '') || ' ' ||
      coalesce(p.division, '') || ' ' ||
      coalesce(p.title, '')
    ) ~ '\m(female|women|woman|girl|girls)\M' THEN 'female'
    WHEN lower(
      coalesce(to_jsonb(p)->>'gender', '') || ' ' ||
      coalesce(p.division, '') || ' ' ||
      coalesce(p.title, '')
    ) ~ '\m(male|men|man|boy|boys)\M' THEN 'male'
    ELSE NULL
  END
  FROM public.wm_profiles p
  WHERE p.user_id = auth.uid() AND p.is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.wm_head_application_type_scope()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $body$
  SELECT CASE
    WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mpress\M' THEN 'press'
    WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mmedia\M' THEN 'media'
    WHEN lower(coalesce(d.slug, '')) IN ('media', 'press') THEN lower(d.slug)
    ELSE NULL
  END
  FROM public.wm_profiles p
  LEFT JOIN public.wm_departments d ON d.id = p.department_id
  WHERE p.user_id = auth.uid()
    AND public.wm_is_head_profile(p.*)
  LIMIT 1;
$body$;

CREATE OR REPLACE FUNCTION public.wm_resolve_head_department_slug(p public.wm_profiles)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(lower(trim(d.slug)), '') FROM public.wm_departments d WHERE d.id = p.department_id LIMIT 1),
    CASE
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\m(hr|human\s+resources)\M' THEN 'hr'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\m(dcc|delegate\s+affairs|delegate\s+care)\M' THEN 'dcc'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mpress\M' THEN 'press'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mmedia\M' THEN 'media'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\msecurity\M' THEN 'security'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\m(volunteers?|volunteering)\M' THEN 'volunteers'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\m(pr|public\s+relations)\M' THEN 'pr'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mmarketing\M' THEN 'marketing'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mlogistics\M' THEN 'logistics'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\m(ceremony|ceremonies)\M' THEN 'ceremony'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mfinance\M' THEN 'finance'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mit\M' THEN 'it'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mdesign\M' THEN 'design'
      ELSE NULL
    END
  );
$$;

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
  old_gender text;
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
        RAISE EXCEPTION 'Only authorized Department Heads can submit application recommendations.';
      END IF;
      IF coalesce((actor.permissions->>'applications.view')::boolean, true) = false
        OR coalesce((actor.permissions->>'applications.recommend')::boolean, true) = false THEN
        RAISE EXCEPTION 'You do not have permission to submit recommendations.';
      END IF;

      IF lower(trim(coalesce(OLD.status, ''))) <> 'pending' THEN
        RAISE EXCEPTION 'This application is no longer pending.';
      END IF;

      IF NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Only Administrators can make final application decisions. Department Heads submit recommendations.';
      END IF;

      SELECT d.id, lower(trim(d.slug)) INTO actor_department_id, actor_department_slug
      FROM public.wm_departments d
      WHERE d.id = actor.department_id;

      IF actor_department_slug IS NULL THEN
        actor_department_slug := public.wm_resolve_head_department_slug(actor);
      END IF;

      IF actor_department_slug IS NULL THEN
        RAISE EXCEPTION 'A valid department assignment is required to recommend applications.';
      END IF;

      old_app_dept := lower(public.wm_map_application_department(OLD.application_type, OLD.department_id));
      dept_matches := (
        (actor_department_id IS NOT NULL AND lower(trim(coalesce(OLD.department_id, ''))) = lower(actor_department_id::text))
        OR old_app_dept = actor_department_slug
        OR (actor_department_slug = 'media-press' AND old_app_dept IN ('media', 'press', 'media-press'))
        OR (actor_department_slug IN ('media', 'press') AND (old_app_dept = 'media-press' OR lower(trim(coalesce(OLD.application_type, ''))) = actor_department_slug))
      );

      IF NOT dept_matches THEN
        RAISE EXCEPTION 'Cross-department application update is forbidden.';
      END IF;

      actor_application_type := COALESCE(
        public.wm_head_application_type_scope(),
        CASE
          WHEN actor_department_slug IN ('media', 'press') THEN actor_department_slug
          ELSE NULL
        END
      );
      IF actor_department_slug IN ('media', 'press', 'media-press')
        AND (actor_application_type IS NULL OR lower(trim(coalesce(OLD.application_type, ''))) <> actor_application_type) THEN
        RAISE EXCEPTION 'Media and Press applications are isolated.';
      END IF;

      old_gender := CASE
        WHEN lower(trim(coalesce(OLD.gender, ''))) IN ('female', 'woman', 'women') THEN 'female'
        WHEN lower(trim(coalesce(OLD.gender, ''))) IN ('male', 'man', 'men') THEN 'male'
        ELSE lower(trim(coalesce(OLD.gender, '')))
      END;
      IF public.wm_head_gender() IS NOT NULL AND old_gender <> public.wm_head_gender() THEN
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
  lower(trim(coalesce(wm_applications.status, ''))) IN ('pending', 'waitlisted', 'accepted', 'rejected')
  AND EXISTS (
    SELECT 1
    FROM public.wm_profiles p
    LEFT JOIN public.wm_departments d ON d.id = p.department_id
    WHERE p.user_id = auth.uid()
      AND public.wm_is_head_profile(p.*)
      AND coalesce((p.permissions->>'applications.view')::boolean, true) = true
      AND public.wm_resolve_head_department_slug(p.*) IS NOT NULL
      AND (
        (d.id IS NOT NULL AND lower(trim(coalesce(wm_applications.department_id, ''))) = lower(d.id::text))
        OR lower(public.wm_map_application_department(wm_applications.application_type, wm_applications.department_id)) = public.wm_resolve_head_department_slug(p.*)
        OR (
          public.wm_resolve_head_department_slug(p.*) = 'media-press'
          AND lower(public.wm_map_application_department(wm_applications.application_type, wm_applications.department_id)) IN ('media', 'press', 'media-press')
        )
        OR (
          public.wm_resolve_head_department_slug(p.*) IN ('media', 'press')
          AND (
            lower(public.wm_map_application_department(wm_applications.application_type, wm_applications.department_id)) = 'media-press'
            OR lower(trim(coalesce(wm_applications.application_type, ''))) = public.wm_resolve_head_department_slug(p.*)
          )
        )
      )
      AND (
        public.wm_resolve_head_department_slug(p.*) NOT IN ('media', 'press', 'media-press')
        OR lower(trim(coalesce(wm_applications.application_type, ''))) = COALESCE(
          public.wm_head_application_type_scope(),
          CASE
            WHEN public.wm_resolve_head_department_slug(p.*) IN ('media', 'press') THEN public.wm_resolve_head_department_slug(p.*)
            ELSE NULL
          END
        )
      )
      AND (
        public.wm_head_gender() IS NULL
        OR (
          CASE
            WHEN lower(trim(coalesce(wm_applications.gender, ''))) IN ('female', 'woman', 'women') THEN 'female'
            WHEN lower(trim(coalesce(wm_applications.gender, ''))) IN ('male', 'man', 'men') THEN 'male'
            ELSE lower(trim(coalesce(wm_applications.gender, '')))
          END
        ) = public.wm_head_gender()
      )
  )
);

DROP POLICY IF EXISTS "Department heads strict dept and gender update" ON public.wm_applications;
CREATE POLICY "Department heads strict dept and gender update"
ON public.wm_applications
FOR UPDATE
TO authenticated
USING (
  lower(trim(coalesce(wm_applications.status, ''))) = 'pending'
  AND EXISTS (
    SELECT 1
    FROM public.wm_profiles p
    LEFT JOIN public.wm_departments d ON d.id = p.department_id
    WHERE p.user_id = auth.uid()
      AND public.wm_is_head_profile(p.*)
      AND coalesce((p.permissions->>'applications.view')::boolean, true) = true
      AND coalesce((p.permissions->>'applications.recommend')::boolean, true) = true
      AND public.wm_resolve_head_department_slug(p.*) IS NOT NULL
      AND (
        (d.id IS NOT NULL AND lower(trim(coalesce(wm_applications.department_id, ''))) = lower(d.id::text))
        OR lower(public.wm_map_application_department(wm_applications.application_type, wm_applications.department_id)) = public.wm_resolve_head_department_slug(p.*)
        OR (
          public.wm_resolve_head_department_slug(p.*) = 'media-press'
          AND lower(public.wm_map_application_department(wm_applications.application_type, wm_applications.department_id)) IN ('media', 'press', 'media-press')
        )
        OR (
          public.wm_resolve_head_department_slug(p.*) IN ('media', 'press')
          AND (
            lower(public.wm_map_application_department(wm_applications.application_type, wm_applications.department_id)) = 'media-press'
            OR lower(trim(coalesce(wm_applications.application_type, ''))) = public.wm_resolve_head_department_slug(p.*)
          )
        )
      )
      AND (
        public.wm_resolve_head_department_slug(p.*) NOT IN ('media', 'press', 'media-press')
        OR lower(trim(coalesce(wm_applications.application_type, ''))) = COALESCE(
          public.wm_head_application_type_scope(),
          CASE
            WHEN public.wm_resolve_head_department_slug(p.*) IN ('media', 'press') THEN public.wm_resolve_head_department_slug(p.*)
            ELSE NULL
          END
        )
      )
      AND (
        public.wm_head_gender() IS NULL
        OR (
          CASE
            WHEN lower(trim(coalesce(wm_applications.gender, ''))) IN ('female', 'woman', 'women') THEN 'female'
            WHEN lower(trim(coalesce(wm_applications.gender, ''))) IN ('male', 'man', 'men') THEN 'male'
            ELSE lower(trim(coalesce(wm_applications.gender, '')))
          END
        ) = public.wm_head_gender()
      )
  )
)
WITH CHECK (lower(trim(coalesce(status, ''))) = 'pending');

COMMIT;
