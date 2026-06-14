-- 0013 · RAW upload support — open the originals bucket MIME allowlist.
--
-- Browsers send RAF/CR2/NEF/ARW/DNG/etc. as varied or `application/octet-stream` MIME types.
-- The originals bucket allowlist ([image/jpeg, png, heic, heif, tiff]) rejected them at the
-- storage gate, so the console RAW upload failed before ingest. originals is PRIVATE
-- (owner-write-only via RLS) and the app validates the extension allowlist on both client and
-- server, so the bucket MIME restriction is redundant defense. Drop it (NULL = allow any) so
-- any RAW container can be archived. The PUBLIC `photos` bucket keeps its strict variant-only
-- allowlist (image/jpeg, webp, avif, png) — variants are always sharp-encoded JPEG/WebP/AVIF.

update storage.buckets set allowed_mime_types = null where id = 'originals';
