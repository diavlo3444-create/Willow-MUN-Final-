-- Remove any legacy "(attributed by Super Admin: ...)" suffix from stored wm_applications.decision_by_name
UPDATE public.wm_applications
SET decision_by_name = NULLIF(
  trim(
    regexp_replace(
      decision_by_name,
      '\s*\(\s*(?:attributed\s+(?:by|to)\s+super\s*admin|spoofed\s+by)\s*:[^)]*\)\s*$',
      '',
      'i'
    )
  ),
  ''
)
WHERE decision_by_name ~* '\(\s*(?:attributed\s+(?:by|to)\s+super\s*admin|spoofed\s+by)\s*:[^)]*\)';
