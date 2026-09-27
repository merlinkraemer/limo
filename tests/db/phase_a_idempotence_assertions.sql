-- Phase A: re-running migrations 007/008 must not duplicate or mutate anything.
DO $$
DECLARE
  v_count integer;
  v_created uuid;
BEGIN
  IF (SELECT count(*) FROM public.lemonade_ratings WHERE source = 'legacy'
        AND lemonade_id IN (
          '03134887-0000-4000-8000-000000000001',
          'a1b91ec4-0000-4000-8000-000000000003',
          '87d72ace-0000-4000-8000-000000000004',
          'f13bd349-0000-4000-8000-000000000005',
          '3377705f-0000-4000-8000-000000000006'
        )) <> 5 THEN
    RAISE EXCEPTION 'idempotence: legacy fixture ratings changed on re-run';
  END IF;

  IF (SELECT count(*) FROM public.lemonade_ratings WHERE source = 'legacy' AND lemonade_id = '0c0cd8a0-0000-4000-8000-000000000002') <> 0 THEN
    RAISE EXCEPTION 'idempotence: merged loser gained a legacy rating';
  END IF;

  IF (SELECT merged_into FROM public.lemonades WHERE id = '0c0cd8a0-0000-4000-8000-000000000002')
     IS DISTINCT FROM '03134887-0000-4000-8000-000000000001'::uuid THEN
    RAISE EXCEPTION 'idempotence: Twister loser merge changed';
  END IF;

  IF (SELECT count(*) FROM public.lemonades WHERE id = '0c0cd8a0-0000-4000-8000-000000000002') <> 1 THEN
    RAISE EXCEPTION 'idempotence: duplicate row must be preserved, not deleted';
  END IF;

  SELECT id INTO v_created FROM public.lemonades WHERE lower(btrim(name)) = 'rpc fixture limo' AND merged_into IS NULL;
  IF (SELECT count(*) FROM public.lemonade_ratings WHERE source = 'visitor' AND lemonade_id = v_created) <> 2 THEN
    RAISE EXCEPTION 'idempotence: visitor ratings changed on re-run';
  END IF;

  -- On databases without pre-existing canonical duplicates the merge leaves
  -- none behind, so re-applying the migration restores the name guard.
  IF to_regclass('public.lemonades_canonical_name_unique') IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.lemonades WHERE merged_into IS NULL
        GROUP BY lower(btrim(name)) HAVING count(*) > 1
     ) THEN
    RAISE EXCEPTION 'idempotence: canonical name guard index should exist after the merge';
  END IF;

  -- Directly inserted throttle fixtures have no legacy metrics -> no backfill.
  IF (SELECT count(*) FROM public.lemonade_ratings WHERE source = 'legacy' AND lemonade_id::text LIKE 'dddddddd-%') <> 0 THEN
    RAISE EXCEPTION 'idempotence: new-style listings must never receive legacy ratings';
  END IF;
END $$;
