-- ============================================================================
-- Willow MUN Application System Upgrade:
-- 1. Structured columns on public.wm_applications for Media, Press, and Volunteers
-- 2. Isolated public.wm_application_medical table (Admin confidential access ONLY)
-- 3. Private Storage bucket 'wm-application-files' with strict access controls
-- 4. Duplicate pending submission index & Head update preservation trigger
-- ============================================================================

-- 1. Extend wm_applications with non-medical structured application data
ALTER TABLE IF EXISTS public.wm_applications
  ADD COLUMN IF NOT EXISTS grade text,
  ADD COLUMN IF NOT EXISTS guardian_phone text,
  ADD COLUMN IF NOT EXISTS camera_model text,
  ADD COLUMN IF NOT EXISTS attends_all_days boolean,
  ADD COLUMN IF NOT EXISTS absence_reason text,
  ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS proof_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS media_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS writing_samples jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Isolated private table for applicant medical conditions & regular medications
--    NEVER exposed to public anon, Department Heads, EB Heads, or general HR.
CREATE TABLE IF NOT EXISTS public.wm_application_medical (
  application_id uuid PRIMARY KEY REFERENCES public.wm_applications(id) ON DELETE CASCADE,
  has_medical_condition boolean NOT NULL DEFAULT false,
  medical_details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wm_application_medical ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only confidential-authorized admins read medical disclosures" ON public.wm_application_medical;
CREATE POLICY "Only confidential-authorized admins read medical disclosures"
  ON public.wm_application_medical
  FOR SELECT
  TO authenticated
  USING (
    public.wm_is_admin()
    AND coalesce(((public.wm_actor_profile()).permissions->>'applications.view_confidential')::boolean, true) = true
  );

DROP POLICY IF EXISTS "Only service role or confidential admins update medical disclosures" ON public.wm_application_medical;
CREATE POLICY "Only service role or confidential admins update medical disclosures"
  ON public.wm_application_medical
  FOR ALL
  TO authenticated
  USING (public.wm_is_super_admin())
  WITH CHECK (public.wm_is_super_admin());

-- 3. Private Storage Bucket for applicant files (Proof of Experience, Media 10-15 photos, Writing Samples)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wm-application-files',
  'wm-application-files',
  false,
  15728640,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Admins read wm-application-files" ON storage.objects;
CREATE POLICY "Admins read wm-application-files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'wm-application-files'
    AND public.wm_is_admin()
  );

-- 4. Duplicate guard index for pending submissions per (track, email)
CREATE INDEX IF NOT EXISTS idx_wm_applications_pending_track_email
  ON public.wm_applications (lower(application_type), lower(email))
  WHERE status = 'pending';

-- 5. Keep Department Head update trigger strictly limited to status/decision fields (preserves NEW := OLD)
CREATE OR REPLACE FUNCTION public.wm_applications_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  actor public.wm_profiles;
  requested_status text;
  actor_department_slug text;
  actor_application_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.department_id := public.wm_map_application_department(NEW.application_type, NEW.department_id);
    IF NEW.gender IS NOT NULL THEN
      NEW.gender := lower(trim(NEW.gender));
    END IF;
    IF NEW.email IS NOT NULL THEN
      NEW.email := lower(trim(NEW.email));
    END IF;
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
        OR lower(actor_department_slug) NOT IN ('media-press', 'security', 'volunteers') THEN
        RAISE EXCEPTION 'Applications are only available to Media & Press, Security, and Volunteers heads.';
      END IF;

      requested_status := NEW.status;
      IF requested_status NOT IN ('accepted', 'rejected') THEN
        RAISE EXCEPTION 'Department Heads can only accept or decline applications.';
      END IF;

      IF lower(actor_department_slug) <> lower(public.wm_map_application_department(OLD.application_type, OLD.department_id)) THEN
        RAISE EXCEPTION 'Cross-department application update is forbidden.';
      END IF;

      actor_application_type := public.wm_head_application_type_scope();
      IF lower(actor_department_slug) = 'media-press'
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
$body$;
