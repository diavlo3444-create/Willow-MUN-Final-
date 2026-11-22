-- ============================================================================
-- Willow MUN Application Legal Consent Tracking
-- Additive, backwards-compatible columns on public.wm_applications so new
-- submissions persist explicit Privacy Policy and Terms & Conditions consent
-- status, timestamp, and policy versions without affecting historical records.
-- ============================================================================

BEGIN;

ALTER TABLE IF EXISTS public.wm_applications
  ADD COLUMN IF NOT EXISTS privacy_policy_accepted boolean,
  ADD COLUMN IF NOT EXISTS terms_accepted boolean,
  ADD COLUMN IF NOT EXISTS privacy_policy_version text,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz;

COMMIT;
