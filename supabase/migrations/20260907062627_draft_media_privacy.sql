-- TASK-2026-09-07-DRAFT-MEDIA-PRIVACY · Altair
-- Only registered derivatives of currently published photo entries are public.
-- Existing owner policies (including private originals and all writes) remain.
-- The photos bucket MUST be made private separately through the Storage API.
-- Do not mutate storage.buckets/objects metadata or delete/re-upload any object.

CREATE POLICY photos_published_variant_read
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'photos'
    -- SELECT also powers signing/listing: do not mint a bearer URL that can
    -- outlive the publication state. The checked route uses download only.
    AND storage.allow_only_operation('object.get_authenticated')
    AND EXISTS (
      SELECT 1
      FROM public.photo_assets AS assets
      JOIN public.entries AS entry ON entry.id = assets.entry_id
      WHERE entry.kind = 'photo'
        AND entry.status = 'published'
        AND storage.objects.name IN (
          assets.variants -> 'thumb' ->> 'jpg',
          assets.variants -> 'thumb' ->> 'webp',
          assets.variants -> 'thumb' ->> 'avif',
          assets.variants -> 'medium' ->> 'jpg',
          assets.variants -> 'medium' ->> 'webp',
          assets.variants -> 'medium' ->> 'avif',
          assets.variants -> 'full' ->> 'jpg',
          assets.variants -> 'full' ->> 'webp',
          assets.variants -> 'full' ->> 'avif'
        )
    )
  );
