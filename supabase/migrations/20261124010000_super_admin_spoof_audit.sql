-- Extend Super Admin decision audit table to privately track decision spoofs
-- without exposing spoof metadata to non-Super-Admin users.

ALTER TABLE public.wm_application_decision_overrides
  ADD COLUMN IF NOT EXISTS is_spoof boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS previous_decision_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS previous_decision_by_name text,
  ADD COLUMN IF NOT EXISTS spoofed_decision_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS spoofed_decision_by_name text;

CREATE INDEX IF NOT EXISTS idx_wm_application_decision_overrides_spoof_created
  ON public.wm_application_decision_overrides (is_spoof, created_at DESC);
