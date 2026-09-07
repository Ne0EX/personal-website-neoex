-- TASK-2026-09-07-DRAFT-MEDIA-OPERATION · Altair
-- The live Storage download path checks object metadata before serving bytes.
-- Permit only that metadata precheck and authenticated download; signing,
-- listing, originals, drafts and unmapped objects remain outside this policy.
-- https://supabase.com/docs/guides/storage/security/access-control

ALTER POLICY photos_published_variant_read
  ON storage.objects
  USING (
    bucket_id = 'photos'
    AND storage.allow_any_operation(ARRAY[
      'object.get_authenticated',
      'object.get_authenticated_info'
    ])
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
