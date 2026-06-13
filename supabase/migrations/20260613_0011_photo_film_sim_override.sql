-- 0011_photo_film_sim_override
-- Adds authored film-sim override column to entries.
-- filmSim on entries = owner-authored display value (overrides photo_assets.exif.filmSim).
-- photo_assets.exif.filmSim stays RAW sensor truth — this column never touches it.
-- Nullable: NULL means "fall back to EXIF filmSim" (same pattern as instrument_overrides).
-- Only meaningful for kind='photo'; other kinds store NULL.

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS film_sim text;

COMMENT ON COLUMN entries.film_sim IS
  'Authored film-simulation override for photo entries. '
  'NULL = fall back to photo_assets.exif.filmSim (raw sensor truth). '
  'Set via updateEntry patch. Other entry kinds always NULL.';
