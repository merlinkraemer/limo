-- 009_lock_down_legacy_storage_writes.sql
--
-- Forward-only hardening for the legacy Supabase Storage buckets.
--
-- Migration 002 created `limo-images` (and covered the older
-- `lemonade-images`) with public INSERT/UPDATE/DELETE policies and left the
-- default table grants in place, so anyone holding the shipped anon key could
-- overwrite or delete historical objects through the Storage API. Uploads now
-- go to Cloudinary (`POST /api/uploads`), so the only operation the app still
-- needs is public read for legacy `image_url` values.
--
-- This migration drops the three public write policies and attempts to revoke
-- the write table privileges from `anon`/`authenticated`; the public SELECT
-- policy and SELECT grants are untouched. 002 is an applied migration and is
-- never edited.
--
-- Note on grants: on a Supabase project `storage.objects` is owned by
-- `supabase_storage_admin`, so the `postgres` migration role is not the grantor
-- and the REVOKE is a silent no-op there. Dropping the RLS write policies is
-- what enforces the lockdown (RLS is enabled and default-deny); the REVOKE
-- still takes effect on setups where the migration role owns the table or made
-- the grants itself.
--
-- Robust by construction:
--   * no-op when `storage.objects` is missing (non-Supabase/plain Postgres);
--   * `DROP POLICY IF EXISTS` tolerates a project where 002 never ran;
--   * grants are only revoked from roles that actually exist.

DO $$
DECLARE
  legacy_role text;
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE '009: storage.objects is missing; skipping legacy storage lockdown';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Public can upload limo images" ON storage.objects;
  DROP POLICY IF EXISTS "Public can update limo images" ON storage.objects;
  DROP POLICY IF EXISTS "Public can delete limo images" ON storage.objects;

  FOREACH legacy_role IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = legacy_role) THEN
      EXECUTE format(
        'REVOKE INSERT, UPDATE, DELETE ON storage.objects FROM %I',
        legacy_role
      );
    END IF;
  END LOOP;
END $$;
