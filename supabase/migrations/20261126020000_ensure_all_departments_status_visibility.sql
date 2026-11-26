-- Ensure ALL departments (Media, Press, Volunteers, Security, HR, DCC, PR, Marketing, Design,
-- Logistics, Ceremonies, IT, Finance) see Pending, Waitlisted, Accepted, and Rejected applications
-- strictly within their own department, normalizing slug aliases and legacy UUID department_id rows.
BEGIN;

CREATE OR REPLACE FUNCTION public.wm_normalize_department_slug(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(coalesce(raw, '')))
    WHEN '' THEN ''
    WHEN 'volunteer' THEN 'volunteers'
    WHEN 'volunteering' THEN 'volunteers'
    WHEN 'volunteers' THEN 'volunteers'
    WHEN 'human-resources' THEN 'hr'
    WHEN 'human_resources' THEN 'hr'
    WHEN 'human resources' THEN 'hr'
    WHEN 'hr' THEN 'hr'
    WHEN 'delegate-affairs' THEN 'dcc'
    WHEN 'delegate_affairs' THEN 'dcc'
    WHEN 'delegate affairs' THEN 'dcc'
    WHEN 'delegate' THEN 'dcc'
    WHEN 'dcc' THEN 'dcc'
    WHEN 'public-relations' THEN 'pr'
    WHEN 'public_relations' THEN 'pr'
    WHEN 'public relations' THEN 'pr'
    WHEN 'pr' THEN 'pr'
    WHEN 'information-technology' THEN 'it'
    WHEN 'information_technology' THEN 'it'
    WHEN 'information technology' THEN 'it'
    WHEN 'it' THEN 'it'
    WHEN 'ceremonies' THEN 'ceremony'
    WHEN 'ceremony' THEN 'ceremony'
    WHEN 'media_press' THEN 'media-press'
    ELSE lower(trim(coalesce(raw, '')))
  END;
$$;

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
          lower(replace(trim(coalesce(p.eb_rank, '')), '-', '_')) IN ('head', 'co_head', 'cohead')
          OR coalesce((p.eb_permissions->>'manage_department')::boolean, false) = true
          OR lower(coalesce(p.title, '')) ~ '\m(head|co-head|cohead|director|lead)\M'
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
  SELECT CASE
    WHEN public.wm_normalize_department_slug(explicit_dept) <> ''
      AND NOT (
        lower(trim(coalesce(explicit_dept, ''))) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR lower(trim(coalesce(explicit_dept, ''))) ~ '^legacy-'
      )
      AND NOT (
        public.wm_normalize_department_slug(app_type) IN ('media', 'press')
        AND public.wm_normalize_department_slug(explicit_dept) IN ('media-press', 'general')
      )
      THEN public.wm_normalize_department_slug(explicit_dept)
    WHEN public.wm_normalize_department_slug(app_type) <> ''
      THEN public.wm_normalize_department_slug(app_type)
    ELSE 'general'
  END;
$function$;

CREATE OR REPLACE FUNCTION public.wm_resolve_application_department_slug(app_type text, explicit_dept text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN public.wm_normalize_department_slug(app_type) IN ('media', 'press')
          AND public.wm_normalize_department_slug(d.slug) IN ('media-press', 'general')
          THEN public.wm_normalize_department_slug(app_type)
        ELSE public.wm_normalize_department_slug(d.slug)
      END
      FROM public.wm_departments d
      WHERE lower(d.id::text) = lower(trim(coalesce(explicit_dept, '')))
      LIMIT 1
    ),
    public.wm_map_application_department(app_type, explicit_dept)
  );
$$;

CREATE OR REPLACE FUNCTION public.wm_resolve_head_department_slug(p public.wm_profiles)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT NULLIF(public.wm_normalize_department_slug(d.slug), '')
      FROM public.wm_departments d
      WHERE lower(d.id::text) = lower(trim(coalesce(p.department_id::text, '')))
         OR public.wm_normalize_department_slug(d.slug) = public.wm_normalize_department_slug(p.department_id::text)
      LIMIT 1
    ),
    CASE
      WHEN NULLIF(trim(coalesce(p.department_id::text, '')), '') IS NOT NULL
        AND NOT (lower(trim(coalesce(p.department_id::text, ''))) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
        THEN NULLIF(public.wm_normalize_department_slug(p.department_id::text), '')
      ELSE NULL
    END,
    CASE
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\m(hr|human\s+resources)\M' THEN 'hr'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\m(dcc|delegate\s+affairs|delegate\s+care)\M' THEN 'dcc'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mpress\M'
        AND NOT (lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mmedia\M') THEN 'press'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mmedia\M'
        AND NOT (lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mpress\M') THEN 'media'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mpress\M' THEN 'press'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mmedia\M' THEN 'media'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\msecurity\M' THEN 'security'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\m(volunteers?|volunteering)\M' THEN 'volunteers'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\m(pr|public\s+relations)\M' THEN 'pr'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mmarketing\M' THEN 'marketing'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mlogistics\M' THEN 'logistics'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\m(ceremony|ceremonies)\M' THEN 'ceremony'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mfinance\M' THEN 'finance'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\m(it|information\s+technology)\M' THEN 'it'
      WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mdesign\M' THEN 'design'
      ELSE NULL
    END
  );
$$;

CREATE OR REPLACE FUNCTION public.wm_head_application_type_scope()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $body$
  SELECT CASE
    WHEN public.wm_resolve_head_department_slug(p.*) = 'media-press' THEN
      CASE
        WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mpress\M' THEN 'press'
        WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mmedia\M' THEN 'media'
        ELSE NULL
      END
    WHEN public.wm_resolve_head_department_slug(p.*) IN ('media', 'press') THEN
      CASE
        WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mpress\M'
          AND NOT (lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mmedia\M') THEN 'press'
        WHEN lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mmedia\M'
          AND NOT (lower(coalesce(p.title, '') || ' ' || coalesce(p.division, '')) ~ '\mpress\M') THEN 'media'
        ELSE public.wm_resolve_head_department_slug(p.*)
      END
    ELSE NULL
  END
  FROM public.wm_profiles p
  WHERE p.user_id = auth.uid()
    AND public.wm_is_head_profile(p.*)
  LIMIT 1;
$body$;

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
  old_app_type text;
  dept_matches boolean;
  requested_rec text;
  requested_notes text;
  old_gender text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.department_id := public.wm_resolve_application_department_slug(NEW.application_type, NEW.department_id);
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

      SELECT d.id, public.wm_normalize_department_slug(d.slug)
      INTO actor_department_id, actor_department_slug
      FROM public.wm_departments d
      WHERE lower(d.id::text) = lower(trim(coalesce(actor.department_id::text, '')))
         OR public.wm_normalize_department_slug(d.slug) = public.wm_normalize_department_slug(actor.department_id::text)
      LIMIT 1;

      IF actor_department_slug IS NULL OR actor_department_slug = '' THEN
        actor_department_slug := public.wm_resolve_head_department_slug(actor);
      END IF;

      IF actor_department_slug IS NULL OR actor_department_slug = '' THEN
        RAISE EXCEPTION 'A valid department assignment is required to recommend applications.';
      END IF;

      old_app_dept := public.wm_resolve_application_department_slug(OLD.application_type, OLD.department_id);
      old_app_type := lower(trim(coalesce(OLD.application_type, '')));
      dept_matches := (
        (actor_department_id IS NOT NULL AND lower(trim(coalesce(OLD.department_id, ''))) = lower(actor_department_id::text))
        OR old_app_dept = actor_department_slug
        OR (actor_department_slug = 'media-press' AND old_app_dept IN ('media', 'press', 'media-press'))
        OR (actor_department_slug IN ('media', 'press') AND (old_app_dept = 'media-press' OR old_app_type = actor_department_slug))
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
        AND (
          actor_application_type IS NULL
          OR (
            CASE
              WHEN old_app_type IN ('media', 'press') THEN old_app_type
              WHEN old_app_dept IN ('media', 'press') THEN old_app_dept
              ELSE ''
            END
          ) <> actor_application_type
        ) THEN
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
        OR public.wm_resolve_application_department_slug(wm_applications.application_type, wm_applications.department_id) = public.wm_resolve_head_department_slug(p.*)
        OR (
          public.wm_resolve_head_department_slug(p.*) = 'media-press'
          AND public.wm_resolve_application_department_slug(wm_applications.application_type, wm_applications.department_id) IN ('media', 'press', 'media-press')
        )
        OR (
          public.wm_resolve_head_department_slug(p.*) IN ('media', 'press')
          AND (
            public.wm_resolve_application_department_slug(wm_applications.application_type, wm_applications.department_id) = 'media-press'
            OR lower(trim(coalesce(wm_applications.application_type, ''))) = public.wm_resolve_head_department_slug(p.*)
          )
        )
      )
      AND (
        public.wm_resolve_head_department_slug(p.*) NOT IN ('media', 'press', 'media-press')
        OR (
          CASE
            WHEN lower(trim(coalesce(wm_applications.application_type, ''))) IN ('media', 'press') THEN lower(trim(wm_applications.application_type))
            WHEN public.wm_resolve_application_department_slug(wm_applications.application_type, wm_applications.department_id) IN ('media', 'press')
              THEN public.wm_resolve_application_department_slug(wm_applications.application_type, wm_applications.department_id)
            ELSE ''
          END
        ) = COALESCE(
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
        OR public.wm_resolve_application_department_slug(wm_applications.application_type, wm_applications.department_id) = public.wm_resolve_head_department_slug(p.*)
        OR (
          public.wm_resolve_head_department_slug(p.*) = 'media-press'
          AND public.wm_resolve_application_department_slug(wm_applications.application_type, wm_applications.department_id) IN ('media', 'press', 'media-press')
        )
        OR (
          public.wm_resolve_head_department_slug(p.*) IN ('media', 'press')
          AND (
            public.wm_resolve_application_department_slug(wm_applications.application_type, wm_applications.department_id) = 'media-press'
            OR lower(trim(coalesce(wm_applications.application_type, ''))) = public.wm_resolve_head_department_slug(p.*)
          )
        )
      )
      AND (
        public.wm_resolve_head_department_slug(p.*) NOT IN ('media', 'press', 'media-press')
        OR (
          CASE
            WHEN lower(trim(coalesce(wm_applications.application_type, ''))) IN ('media', 'press') THEN lower(trim(wm_applications.application_type))
            WHEN public.wm_resolve_application_department_slug(wm_applications.application_type, wm_applications.department_id) IN ('media', 'press')
              THEN public.wm_resolve_application_department_slug(wm_applications.application_type, wm_applications.department_id)
            ELSE ''
          END
        ) = COALESCE(
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
