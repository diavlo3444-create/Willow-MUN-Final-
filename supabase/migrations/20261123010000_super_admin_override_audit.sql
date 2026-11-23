-- Super Admin application decision override audit table & strict RLS
CREATE TABLE IF NOT EXISTS public.wm_application_decision_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.wm_applications(id) ON DELETE CASCADE,
  previous_status text NOT NULL,
  new_status text NOT NULL CHECK (new_status IN ('pending', 'accepted', 'rejected', 'waitlisted')),
  reason text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  actor_role text NOT NULL DEFAULT 'super_admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wm_application_decision_overrides_app_created
  ON public.wm_application_decision_overrides (application_id, created_at DESC);

ALTER TABLE public.wm_application_decision_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super Admins can read decision overrides" ON public.wm_application_decision_overrides;
CREATE POLICY "Super Admins can read decision overrides"
  ON public.wm_application_decision_overrides
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.wm_profiles p
      WHERE p.user_id = auth.uid()
        AND p.is_active = true
        AND p.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super Admins can insert decision overrides" ON public.wm_application_decision_overrides;
CREATE POLICY "Super Admins can insert decision overrides"
  ON public.wm_application_decision_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.wm_profiles p
      WHERE p.user_id = auth.uid()
        AND p.is_active = true
        AND p.role = 'super_admin'
    )
    AND (actor_user_id IS NULL OR actor_user_id = auth.uid())
  );
