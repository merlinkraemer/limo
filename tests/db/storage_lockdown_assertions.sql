-- 009 storage lockdown: legacy buckets keep public read but no public writes.
--
-- On Supabase `storage.objects` is owned by `supabase_storage_admin`, so the
-- `postgres` migration role cannot revoke that role's grants (REVOKE silently
-- no-ops). The enforced control is therefore RLS: the public write policies
-- from 002 are dropped, RLS stays enabled, and default-deny blocks writes. This
-- file asserts both the policy state and an actual denied INSERT as `anon`.
--
-- Requires the local Supabase `storage` schema; skips cleanly on plain Postgres.
DO $$
DECLARE
  v_public_write_policies int;
  v_anon_insert_denied boolean := false;
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'storage lockdown: storage.objects missing; skipping assertions';
    RETURN;
  END IF;

  IF to_regrole('anon') IS NULL THEN
    RAISE NOTICE 'storage lockdown: anon role missing; skipping assertions';
    RETURN;
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'storage.objects'::regclass) THEN
    RAISE EXCEPTION 'storage: RLS is not enabled on storage.objects';
  END IF;

  SELECT count(*) INTO v_public_write_policies
    FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
     AND roles && ARRAY['public', 'anon', 'authenticated']::name[];
  IF v_public_write_policies <> 0 THEN
    RAISE EXCEPTION 'storage: public write policies still present (%)', v_public_write_policies;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage'
       AND tablename = 'objects'
       AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'storage: public read policy is missing';
  END IF;

  -- Anon reads must keep working (legacy image URLs).
  PERFORM set_config('role', 'anon', true);
  PERFORM count(*) FROM storage.objects;
  PERFORM set_config('role', 'none', true);

  -- Anon writes must be denied by RLS even though the table grant may remain.
  PERFORM set_config('role', 'anon', true);
  BEGIN
    INSERT INTO storage.objects (bucket_id, name)
    VALUES ('limo-images', 'lockdown-probe');
  EXCEPTION WHEN others THEN
    v_anon_insert_denied := true;
  END;
  PERFORM set_config('role', 'none', true);

  IF NOT v_anon_insert_denied THEN
    RAISE EXCEPTION 'storage: anon INSERT into storage.objects succeeded';
  END IF;
END $$;
