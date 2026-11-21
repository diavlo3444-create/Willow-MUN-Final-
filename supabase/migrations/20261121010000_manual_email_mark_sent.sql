-- ============================================================================
-- Manual Gmail Fallback Confirmation Persistence & Duplicate-Safe Email History
-- 1. Persists admin-confirmed manual Gmail deliveries in PostgreSQL.
-- 2. Updates existing wm_email_deliveries failed/pending rows to 'sent' when
--    present without creating duplicate history rows.
-- 3. Records confirmation timestamp and confirming admin identity.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.wm_email_manual_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id text NOT NULL,
  decision_status text NOT NULL CHECK (decision_status IN ('accepted', 'rejected')),
  server_delivery_id text,
  recipient_name text NOT NULL DEFAULT '',
  recipient_email text NOT NULL,
  department_id text NOT NULL DEFAULT 'general',
  subject text NOT NULL,
  body_text text NOT NULL DEFAULT '',
  attempt_count integer NOT NULL DEFAULT 1,
  sent_at timestamptz NOT NULL DEFAULT now(),
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_by_name text NOT NULL DEFAULT 'Administrator',
  confirmed_by_email text,
  delivery_method text NOT NULL DEFAULT 'manual_gmail' CHECK (delivery_method IN ('manual_gmail')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, decision_status)
);

CREATE INDEX IF NOT EXISTS idx_wm_email_manual_confirmations_sent_at
  ON public.wm_email_manual_confirmations (sent_at DESC);

ALTER TABLE public.wm_email_manual_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and HR read manual email confirmations" ON public.wm_email_manual_confirmations;
CREATE POLICY "Admins and HR read manual email confirmations"
  ON public.wm_email_manual_confirmations
  FOR SELECT
  TO authenticated
  USING (public.wm_is_admin() OR public.wm_is_hr());

DROP POLICY IF EXISTS "Admins and HR insert manual email confirmations" ON public.wm_email_manual_confirmations;
CREATE POLICY "Admins and HR insert manual email confirmations"
  ON public.wm_email_manual_confirmations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      public.wm_is_hr()
      OR EXISTS (
        SELECT 1 FROM public.wm_profiles p
        WHERE p.user_id = auth.uid()
          AND p.is_active = true
          AND (
            p.role = 'super_admin'
            OR (
              p.role = 'admin'
              AND coalesce((p.permissions->>'email.view')::boolean, true) = true
              AND coalesce((p.permissions->>'email.send')::boolean, true) = true
            )
          )
      )
    )
    AND (confirmed_by IS NULL OR confirmed_by = auth.uid())
  );

DROP POLICY IF EXISTS "Admins and HR update manual email confirmations" ON public.wm_email_manual_confirmations;
CREATE POLICY "Admins and HR update manual email confirmations"
  ON public.wm_email_manual_confirmations
  FOR UPDATE
  TO authenticated
  USING (public.wm_is_admin() OR public.wm_is_hr())
  WITH CHECK (
    (
      public.wm_is_hr()
      OR EXISTS (
        SELECT 1 FROM public.wm_profiles p
        WHERE p.user_id = auth.uid()
          AND p.is_active = true
          AND (
            p.role = 'super_admin'
            OR (
              p.role = 'admin'
              AND coalesce((p.permissions->>'email.view')::boolean, true) = true
              AND coalesce((p.permissions->>'email.send')::boolean, true) = true
            )
          )
      )
    )
    AND (confirmed_by IS NULL OR confirmed_by = auth.uid())
  );

-- Extend wm_email_deliveries safely when present in the project schema
DO $$
BEGIN
  IF to_regclass('public.wm_email_deliveries') IS NOT NULL THEN
    ALTER TABLE public.wm_email_deliveries
      ADD COLUMN IF NOT EXISTS delivery_method text NOT NULL DEFAULT 'automated',
      ADD COLUMN IF NOT EXISTS manual_sent_at timestamptz,
      ADD COLUMN IF NOT EXISTS manual_sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS manual_sent_by_name text;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.wm_mark_email_manually_sent(
  p_application_id text,
  p_decision_status text,
  p_recipient_name text,
  p_recipient_email text,
  p_department_id text DEFAULT 'general',
  p_subject text DEFAULT '',
  p_body_text text DEFAULT '',
  p_attempt_count integer DEFAULT 1,
  p_server_delivery_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_actor public.wm_profiles%ROWTYPE;
  v_actor_email text;
  v_now timestamptz := now();
  v_decision text := CASE WHEN lower(trim(coalesce(p_decision_status, ''))) = 'rejected' THEN 'rejected' ELSE 'accepted' END;
  v_clean_email text := lower(trim(coalesce(p_recipient_email, '')));
  v_app_key text := COALESCE(NULLIF(trim(coalesce(p_application_id, '')), ''), 'email:' || lower(trim(coalesce(p_recipient_email, ''))));
  v_confirm public.wm_email_manual_confirmations%ROWTYPE;
  v_updated_deliveries integer := 0;
  v_can_dispatch boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_actor
  FROM public.wm_profiles
  WHERE user_id = v_uid
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active staff profile required.' USING ERRCODE = '42501';
  END IF;

  v_can_dispatch :=
    v_actor.role = 'super_admin'
    OR (
      v_actor.role = 'admin'
      AND coalesce((v_actor.permissions->>'email.view')::boolean, true) = true
      AND coalesce((v_actor.permissions->>'email.send')::boolean, true) = true
    )
    OR public.wm_is_hr();

  IF NOT v_can_dispatch THEN
    RAISE EXCEPTION 'Only authorized Admins or HR staff can mark emails as sent.' USING ERRCODE = '42501';
  END IF;

  IF v_clean_email = '' OR v_clean_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN
    RAISE EXCEPTION 'A valid recipient email address is required.' USING ERRCODE = '22023';
  END IF;

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_uid LIMIT 1;

  INSERT INTO public.wm_email_manual_confirmations (
    application_id,
    decision_status,
    server_delivery_id,
    recipient_name,
    recipient_email,
    department_id,
    subject,
    body_text,
    attempt_count,
    sent_at,
    confirmed_by,
    confirmed_by_name,
    confirmed_by_email,
    delivery_method,
    updated_at
  )
  VALUES (
    v_app_key,
    v_decision,
    NULLIF(trim(coalesce(p_server_delivery_id, '')), ''),
    COALESCE(NULLIF(trim(coalesce(p_recipient_name, '')), ''), 'Applicant'),
    v_clean_email,
    COALESCE(NULLIF(trim(coalesce(p_department_id, '')), ''), 'general'),
    COALESCE(NULLIF(trim(coalesce(p_subject, '')), ''), 'Willow MUN Application Decision'),
    coalesce(p_body_text, ''),
    GREATEST(1, coalesce(p_attempt_count, 1)),
    v_now,
    v_uid,
    COALESCE(NULLIF(trim(coalesce(v_actor.full_name, '')), ''), 'Administrator'),
    v_actor_email,
    'manual_gmail',
    v_now
  )
  ON CONFLICT (application_id, decision_status)
  DO UPDATE SET
    server_delivery_id = COALESCE(EXCLUDED.server_delivery_id, public.wm_email_manual_confirmations.server_delivery_id),
    recipient_name = EXCLUDED.recipient_name,
    recipient_email = EXCLUDED.recipient_email,
    department_id = EXCLUDED.department_id,
    subject = CASE
      WHEN length(trim(EXCLUDED.subject)) > 0 THEN EXCLUDED.subject
      ELSE public.wm_email_manual_confirmations.subject
    END,
    body_text = CASE
      WHEN length(trim(EXCLUDED.body_text)) > 0 THEN EXCLUDED.body_text
      ELSE public.wm_email_manual_confirmations.body_text
    END,
    attempt_count = GREATEST(public.wm_email_manual_confirmations.attempt_count, EXCLUDED.attempt_count),
    sent_at = v_now,
    confirmed_by = v_uid,
    confirmed_by_name = EXCLUDED.confirmed_by_name,
    confirmed_by_email = EXCLUDED.confirmed_by_email,
    delivery_method = 'manual_gmail',
    updated_at = v_now
  RETURNING * INTO v_confirm;

  -- Synchronize wm_email_deliveries in-place when present so existing dashboards
  -- reflect 'sent' immediately without creating duplicate rows.
  IF to_regclass('public.wm_email_deliveries') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE public.wm_email_deliveries
      SET
        status = 'sent',
        sent_at = COALESCE(sent_at, $1),
        error_message = NULL,
        delivery_method = 'manual_gmail',
        manual_sent_at = $1,
        manual_sent_by = $2,
        manual_sent_by_name = $3,
        updated_at = $1
      WHERE (
        ($4 IS NOT NULL AND id::text = $4)
        OR (
          application_id::text = $5
          AND decision_status = $6
          AND status <> 'sent'
        )
      )
    $sql$
    USING v_now, v_uid, v_confirm.confirmed_by_name, NULLIF(trim(coalesce(p_server_delivery_id, '')), ''), v_app_key, v_decision;

    GET DIAGNOSTICS v_updated_deliveries = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'confirmation', to_jsonb(v_confirm),
    'updated_deliveries', v_updated_deliveries
  );
END;
$$;

REVOKE ALL ON FUNCTION public.wm_mark_email_manually_sent(text, text, text, text, text, text, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wm_mark_email_manually_sent(text, text, text, text, text, text, text, integer, text) TO authenticated;
