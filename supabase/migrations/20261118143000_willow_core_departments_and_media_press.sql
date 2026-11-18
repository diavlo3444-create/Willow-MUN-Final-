-- Keep the four operational departments in the Admin department panel.
-- Preserve legacy department rows because historical EB allowlist records still reference them.
BEGIN;

UPDATE public.wm_departments
SET slug = 'media',
    name = 'Media',
    cluster = 'Communications & Creative',
    updated_at = now()
WHERE slug = 'media-press';

INSERT INTO public.wm_departments
  (id, slug, name, description, cluster, registration_open, capacity, positions, instructions)
VALUES
  (gen_random_uuid(), 'press', 'Press',
   'Editorial reporting, committee coverage, interviews, and conference journalism.',
   'Communications & Creative', false, 0, ARRAY[]::text[], '')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    cluster = EXCLUDED.cluster,
    updated_at = now();

-- Move existing Press heads from the former combined Media & Press department.
UPDATE public.wm_eb_signup_allowlist
SET department_id = (SELECT id FROM public.wm_departments WHERE slug = 'press')
WHERE title ILIKE '%press%'
  AND department_id = (SELECT id FROM public.wm_departments WHERE slug = 'media');

-- Keep existing applications attached to their actual team after the split.
UPDATE public.wm_applications
SET department_id = CASE
  WHEN lower(application_type) = 'press' THEN (SELECT id FROM public.wm_departments WHERE slug = 'press')
  WHEN lower(application_type) = 'media' THEN (SELECT id FROM public.wm_departments WHERE slug = 'media')
  ELSE department_id
END
WHERE lower(application_type) IN ('media', 'press');

CREATE OR REPLACE FUNCTION public.wm_map_application_department(app_type text, explicit_dept text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT COALESCE(
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
  );
$function$;

COMMIT;
