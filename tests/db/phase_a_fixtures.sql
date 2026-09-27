-- Phase A DB harness fixtures.
--
-- Run after migrations 007/008 have been applied at least once, but before
-- they are re-applied. Dropping the canonical-name guard index simulates a
-- production-like database where the Twister duplicate pair predates the
-- guard; re-applying 007 then exercises the merge + historical backfill on
-- populated data (and the index is recreated once the duplicate is merged).

-- Repeatable harness: clear ratings and votes left on the fixture rows by a
-- previous run. The upsert below never touches child rows, so without this a
-- second `npm run test:db` fails the "winner has exactly one historical
-- rating" assertion on the previous run's visitor rating.
DO $$
DECLARE
  v_fixture_ids constant uuid[] := ARRAY[
    '03134887-0000-4000-8000-000000000001',
    '0c0cd8a0-0000-4000-8000-000000000002',
    'a1b91ec4-0000-4000-8000-000000000003',
    '87d72ace-0000-4000-8000-000000000004',
    'f13bd349-0000-4000-8000-000000000005',
    '3377705f-0000-4000-8000-000000000006',
    '0e54895a-0000-4000-8000-000000000007'
  ]::uuid[];
BEGIN
  DELETE FROM public.lemonade_ratings WHERE lemonade_id = ANY(v_fixture_ids);
  DELETE FROM public.matchup_votes
   WHERE lemonade_a = ANY(v_fixture_ids) OR lemonade_b = ANY(v_fixture_ids);
END $$;

DROP INDEX IF EXISTS public.lemonades_canonical_name_unique;

INSERT INTO public.lemonades (
  id, name, description, flavor_rating, sourness_rating, image_url,
  location_city, added_by, created_at, updated_at
)
VALUES
  (
    '03134887-0000-4000-8000-000000000001', 'Twister Soda Trai Cay',
    'fixture: photo-bearing duplicate winner', 7, 5,
    'https://example.supabase.co/storage/v1/object/public/limo-images/twister.jpg',
    'Hanoi, vietnam', 'merlin', '2026-07-03T10:00:00Z', '2026-07-03T10:00:00Z'
  ),
  (
    '0c0cd8a0-0000-4000-8000-000000000002', 'Twister Soda Trai Cay',
    'fixture: duplicate loser (no photo)', 6, 5, NULL,
    'Hanoi, vietnam', 'merlin', '2026-07-03T11:00:00Z', '2026-07-03T11:00:00Z'
  ),
  (
    'a1b91ec4-0000-4000-8000-000000000003', 'Fixture High', 'fixture', 10, 8,
    NULL, 'Bredstedt', 'Lener', '2026-03-16T00:00:00Z', '2026-03-16T00:00:00Z'
  ),
  (
    '87d72ace-0000-4000-8000-000000000004', 'Fixture Mid', 'fixture', 6, 6,
    NULL, NULL, NULL, '2026-04-01T00:00:00Z', '2026-04-01T00:00:00Z'
  ),
  (
    'f13bd349-0000-4000-8000-000000000005', 'Fixture Low', 'fixture', 1, 1,
    NULL, NULL, NULL, '2026-05-01T00:00:00Z', '2026-05-01T00:00:00Z'
  ),
  (
    '3377705f-0000-4000-8000-000000000006', 'Fixture No Photo', 'fixture', 5, 4,
    NULL, 'Somewhere', NULL, '2026-06-01T00:00:00Z', '2026-06-01T00:00:00Z'
  ),
  (
    '0e54895a-0000-4000-8000-000000000007', 'Fixture New Style', 'fixture',
    NULL, NULL, NULL, NULL, NULL, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  flavor_rating = EXCLUDED.flavor_rating,
  sourness_rating = EXCLUDED.sourness_rating,
  image_url = EXCLUDED.image_url,
  location_city = EXCLUDED.location_city,
  added_by = EXCLUDED.added_by,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;
