-- Harden atomic QR check-in, enforce Super Admin-only attendance reset in SQL,
-- and align Security scanner role helper with Security staff accounts.

BEGIN;

-- 1. Include active Security staff accounts alongside Security heads & EB members.
CREATE OR REPLACE FUNCTION public.wm_is_security_scanner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.wm_profiles p
    LEFT JOIN public.wm_departments d ON d.id::text = p.department_id::text
    WHERE p.user_id = auth.uid()
      AND p.is_active = true
      AND (
        (
          p.role IN ('super_admin', 'admin')
          AND coalesce((p.permissions->>'qr.scan')::boolean, true) = true
        )
        OR (
          p.role IN ('department_head', 'executive_board', 'staff')
          AND lower(coalesce(d.slug, p.department_id::text, '')) = 'security'
          AND coalesce((p.permissions->>'qr.scan')::boolean, true) = true
        )
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.wm_is_security_scanner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wm_is_security_scanner() TO authenticated, service_role;

-- 2. Ensure wm_atomic_qr_checkin explicitly returns committed=true ONLY on fresh check-in,
--    and never overwrites checked_in_at or checks a holder out on duplicate scans.
CREATE OR REPLACE FUNCTION public.wm_atomic_qr_checkin(
  p_token text,
  p_gate_location text,
  p_scanner_id uuid,
  p_scanner_name text,
  p_scanner_role text,
  p_commit boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_clean_token text := trim(coalesce(p_token, ''));
  v_gate text := coalesce(NULLIF(trim(coalesce(p_gate_location, '')), ''), 'Main Entrance');
  v_now timestamptz := now();
  v_pass public.wm_qr_passes;
  v_app public.wm_applications;
  v_profile public.wm_profiles;
  v_dept_name text;
  v_committee_name text;
  v_eligible boolean := true;
  v_ineligible_reason text := null;
  v_result text;
  v_status text;
  v_message text;
  v_committed boolean := false;
  v_updated public.wm_qr_passes;
BEGIN
  IF v_clean_token = '' THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'result', 'invalid_token',
      'message', 'Empty QR token provided.',
      'gate_location', v_gate,
      'committed', false
    );
  END IF;

  SELECT *
  INTO v_pass
  FROM public.wm_qr_passes
  WHERE token_value = v_clean_token
     OR upper(token_value) = upper(v_clean_token)
     OR token_hash = encode(extensions.digest(v_clean_token, 'sha256'), 'hex')
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.wm_qr_scans (
      pass_id,
      token_fingerprint,
      holder_name,
      result,
      gate_location,
      scanned_by,
      scanned_by_name,
      scanner_role,
      scanned_at,
      token_value_masked,
      detail_message
    ) VALUES (
      NULL,
      encode(extensions.digest(lower(trim(v_clean_token)), 'sha256'), 'hex'),
      NULL,
      'invalid_token',
      v_gate,
      p_scanner_id,
      p_scanner_name,
      p_scanner_role,
      v_now,
      public.wm_mask_qr_token(v_clean_token),
      'No conference pass matches this QR token.'
    );

    RETURN jsonb_build_object(
      'status', 'invalid',
      'result', 'invalid_token',
      'message', 'QR code does not match any issued Willow MUN pass.',
      'gate_location', v_gate,
      'scanned_at', v_now,
      'committed', false
    );
  END IF;

  IF v_pass.department_id IS NOT NULL THEN
    SELECT d.name INTO v_dept_name
    FROM public.wm_departments d
    WHERE d.id::text = v_pass.department_id::text
    LIMIT 1;
  END IF;

  IF v_pass.application_id IS NOT NULL THEN
    SELECT * INTO v_app
    FROM public.wm_applications a
    WHERE a.id::text = v_pass.application_id
    LIMIT 1;

    IF NOT FOUND THEN
      v_eligible := false;
      v_ineligible_reason := 'Linked application record was not found.';
    ELSE
      IF v_dept_name IS NULL THEN
        SELECT d.name INTO v_dept_name
        FROM public.wm_departments d
        WHERE lower(d.slug) = lower(public.wm_map_application_department(v_app.application_type, v_app.department_id))
           OR d.id::text = v_app.department_id
        LIMIT 1;
      END IF;

      IF lower(coalesce(v_app.application_type, '')) = 'delegate' THEN
        v_committee_name := NULLIF(trim(coalesce(v_app.position, '')), '');
        IF v_committee_name IS NULL AND jsonb_typeof(v_app.answers) = 'array' THEN
          SELECT NULLIF(trim(elem->>'answer'), '')
          INTO v_committee_name
          FROM jsonb_array_elements(v_app.answers) elem
          WHERE lower(coalesce(elem->>'label', '')) LIKE '%committee%'
          LIMIT 1;
        END IF;
      END IF;

      IF lower(coalesce(v_app.status, '')) <> 'accepted' THEN
        v_eligible := false;
        v_ineligible_reason := 'Applicant status is "' || coalesce(v_app.status, 'unknown') || '" (accepted required).';
      END IF;
    END IF;
  END IF;

  IF v_eligible AND v_pass.user_id IS NOT NULL THEN
    SELECT * INTO v_profile
    FROM public.wm_profiles p
    WHERE p.user_id = v_pass.user_id
    LIMIT 1;

    IF NOT FOUND OR v_profile.is_active IS DISTINCT FROM true THEN
      v_eligible := false;
      v_ineligible_reason := 'Staff account is inactive or no longer provisioned.';
    END IF;
  END IF;

  IF v_pass.active IS DISTINCT FROM true THEN
    v_status := 'revoked';
    v_result := 'revoked_pass';
    v_message := coalesce(nullif(trim(v_pass.revoke_reason), ''), 'This pass has been revoked or deactivated by an administrator.');

    INSERT INTO public.wm_qr_scans (
      pass_id, token_fingerprint, holder_name, result, gate_location, scanned_by, scanned_by_name, scanner_role,
      scanned_at, token_value_masked, application_id, application_code, department_name, committee_name, detail_message
    ) VALUES (
      v_pass.id, encode(extensions.digest(lower(trim(v_pass.token_value)), 'sha256'), 'hex'), v_pass.holder_name, v_result, v_gate, p_scanner_id, p_scanner_name, p_scanner_role,
      v_now, public.wm_mask_qr_token(v_pass.token_value), v_pass.application_id, v_app.application_code,
      v_dept_name, v_committee_name, v_message
    );

  ELSIF NOT v_eligible THEN
    v_status := 'not_eligible';
    v_result := 'not_eligible';
    v_message := coalesce(v_ineligible_reason, 'Holder is not eligible for conference entry.');

    INSERT INTO public.wm_qr_scans (
      pass_id, token_fingerprint, holder_name, result, gate_location, scanned_by, scanned_by_name, scanner_role,
      scanned_at, token_value_masked, application_id, application_code, department_name, committee_name, detail_message
    ) VALUES (
      v_pass.id, encode(extensions.digest(lower(trim(v_pass.token_value)), 'sha256'), 'hex'), v_pass.holder_name, v_result, v_gate, p_scanner_id, p_scanner_name, p_scanner_role,
      v_now, public.wm_mask_qr_token(v_pass.token_value), v_pass.application_id, v_app.application_code,
      v_dept_name, v_committee_name, v_message
    );

  ELSIF v_pass.checked_in_at IS NOT NULL THEN
    -- Already checked in: preserve original checked_in_at untouched and block duplicate check-in.
    v_status := 'already_checked_in';
    v_result := 'already_checked_in';
    v_message := 'Already checked in. Original check-in time preserved.';
    v_committed := false;

    INSERT INTO public.wm_qr_scans (
      pass_id, token_fingerprint, holder_name, result, gate_location, scanned_by, scanned_by_name, scanner_role,
      scanned_at, token_value_masked, application_id, application_code, department_name, committee_name,
      previous_checked_in_at, previous_checked_in_gate, detail_message
    ) VALUES (
      v_pass.id, encode(extensions.digest(lower(trim(v_pass.token_value)), 'sha256'), 'hex'), v_pass.holder_name, v_result, v_gate, p_scanner_id, p_scanner_name, p_scanner_role,
      v_now, public.wm_mask_qr_token(v_pass.token_value), v_pass.application_id, v_app.application_code,
      v_dept_name, v_committee_name, v_pass.checked_in_at, v_pass.checked_in_gate, v_message
    );

  ELSIF NOT p_commit THEN
    v_status := 'valid';
    v_result := 'valid_preview';
    v_message := 'Pass verified.';

  ELSE
    UPDATE public.wm_qr_passes
    SET checked_in_at = v_now,
        checked_in_gate = v_gate,
        checked_in_by = p_scanner_id,
        checked_in_by_name = p_scanner_name
    WHERE id = v_pass.id
      AND active = true
      AND checked_in_at IS NULL
    RETURNING * INTO v_updated;

    IF NOT FOUND THEN
      SELECT * INTO v_pass FROM public.wm_qr_passes WHERE id = v_pass.id LIMIT 1;
      v_status := 'already_checked_in';
      v_result := 'already_checked_in';
      v_message := 'Already checked in at another scanner.';
      v_committed := false;

      INSERT INTO public.wm_qr_scans (
        pass_id, token_fingerprint, holder_name, result, gate_location, scanned_by, scanned_by_name, scanner_role,
        scanned_at, token_value_masked, application_id, application_code, department_name, committee_name,
        previous_checked_in_at, previous_checked_in_gate, detail_message
      ) VALUES (
        v_pass.id, encode(extensions.digest(lower(trim(v_pass.token_value)), 'sha256'), 'hex'), v_pass.holder_name, v_result, v_gate, p_scanner_id, p_scanner_name, p_scanner_role,
        v_now, public.wm_mask_qr_token(v_pass.token_value), v_pass.application_id, v_app.application_code,
        v_dept_name, v_committee_name, v_pass.checked_in_at, v_pass.checked_in_gate, v_message
      );
    ELSE
      v_pass := v_updated;
      v_status := 'valid';
      v_result := 'valid_checkin';
      v_message := 'Checked in successfully.';
      v_committed := true;

      INSERT INTO public.wm_qr_scans (
        pass_id, token_fingerprint, holder_name, result, gate_location, scanned_by, scanned_by_name, scanner_role,
        scanned_at, token_value_masked, application_id, application_code, department_name, committee_name,
        detail_message
      ) VALUES (
        v_pass.id, encode(extensions.digest(lower(trim(v_pass.token_value)), 'sha256'), 'hex'), v_pass.holder_name, v_result, v_gate, p_scanner_id, p_scanner_name, p_scanner_role,
        v_now, public.wm_mask_qr_token(v_pass.token_value), v_pass.application_id, v_app.application_code,
        v_dept_name, v_committee_name, v_message
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'result', v_result,
    'message', v_message,
    'committed', v_committed,
    'pass_id', v_pass.id,
    'holder_name', v_pass.holder_name,
    'role_label', v_pass.role_label,
    'category', v_pass.category,
    'department_id', v_pass.department_id,
    'department_name', v_dept_name,
    'committee_name', v_committee_name,
    'application_id', v_pass.application_id,
    'application_code', v_app.application_code,
    'application_status', v_app.status,
    'user_id', v_pass.user_id,
    'pass_active', v_pass.active,
    'checked_in_at', v_pass.checked_in_at,
    'checked_in_gate', v_pass.checked_in_gate,
    'checked_in_by_name', v_pass.checked_in_by_name,
    'gate_location', v_gate,
    'scanned_at', v_now
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.wm_atomic_qr_checkin(text, text, uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wm_atomic_qr_checkin(text, text, uuid, text, text, boolean) TO service_role;

-- 3. Enforce Super Admin identity inside wm_reset_all_qr_attendance and clear attendance logs cleanly.
CREATE OR REPLACE FUNCTION public.wm_reset_all_qr_attendance(
  p_reset_by uuid,
  p_reset_by_name text,
  p_reset_by_role text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_passes integer := 0;
  v_checkins integer := 0;
  v_checkouts integer := 0;
  v_is_super_admin boolean := false;
BEGIN
  SELECT exists (
    SELECT 1
    FROM public.wm_profiles p
    WHERE p.user_id = p_reset_by
      AND p.role = 'super_admin'
      AND p.is_active = true
  )
  INTO v_is_super_admin;

  IF NOT v_is_super_admin OR lower(coalesce(trim(p_reset_by_role), '')) <> 'super_admin' THEN
    RAISE EXCEPTION 'Only an active Super Admin can reset attendance records.' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) FILTER (WHERE result = 'valid_checkin')::integer,
         count(*) FILTER (WHERE result = 'valid_checkout')::integer
    INTO v_checkins, v_checkouts
  FROM public.wm_qr_scans
  WHERE result IN ('valid_checkin', 'valid_checkout');

  UPDATE public.wm_qr_passes
  SET checked_in_at = NULL,
      checked_in_gate = NULL,
      checked_in_by = NULL,
      checked_in_by_name = NULL,
      checked_out_at = NULL,
      checked_out_gate = NULL,
      checked_out_by = NULL,
      checked_out_by_name = NULL;
  GET DIAGNOSTICS v_passes = row_count;

  DELETE FROM public.wm_qr_scans
  WHERE result IN ('valid_checkin', 'valid_checkout', 'already_checked_in', 'duplicate_recent');

  INSERT INTO public.wm_qr_attendance_resets (
    reset_by, reset_by_name, reset_by_role, passes_reset, checkins_cleared, checkouts_cleared
  ) VALUES (
    p_reset_by,
    coalesce(nullif(trim(p_reset_by_name), ''), 'Super Admin'),
    'super_admin',
    v_passes,
    v_checkins,
    v_checkouts
  );

  RETURN jsonb_build_object(
    'success', true,
    'passes_reset', v_passes,
    'checkins_cleared', v_checkins,
    'checkouts_cleared', v_checkouts
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.wm_reset_all_qr_attendance(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wm_reset_all_qr_attendance(uuid, text, text) TO service_role;

COMMIT;
