-- Add optional Media video edits storage column and allow video MIME types in wm-application-files bucket
ALTER TABLE IF EXISTS public.wm_applications
  ADD COLUMN IF NOT EXISTS media_videos jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v'
]
WHERE id = 'wm-application-files';
