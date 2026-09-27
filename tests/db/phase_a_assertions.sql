-- Phase A: historical backfill, Twister merge, nullable legacy columns.
-- Raises an exception (non-zero psql exit with ON_ERROR_STOP) on any failure.

DO $$
DECLARE
  v_count integer;
  v_score numeric;
  v_winner constant uuid := '03134887-0000-4000-8000-000000000001';
  v_loser constant uuid := '0c0cd8a0-0000-4000-8000-000000000002';
  v_high constant uuid := 'a1b91ec4-0000-4000-8000-000000000003';
  v_mid constant uuid := '87d72ace-0000-4000-8000-000000000004';
  v_low constant uuid := 'f13bd349-0000-4000-8000-000000000005';
  v_nophoto constant uuid := '3377705f-0000-4000-8000-000000000006';
  v_nullstyle constant uuid := '0e54895a-0000-4000-8000-000000000007';
BEGIN
  -- 1. Exactly one legacy rating per canonical fixture (loser and new-style excluded).
  SELECT count(*) INTO v_count
    FROM public.lemonade_ratings
   WHERE source = 'legacy'
     AND lemonade_id IN (v_winner, v_high, v_mid, v_low, v_nophoto);
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'backfill: expected 5 legacy fixture ratings, got %', v_count;
  END IF;

  IF (SELECT count(*) FROM public.lemonade_ratings WHERE source = 'legacy' AND lemonade_id = v_loser) <> 0 THEN
    RAISE EXCEPTION 'backfill: merged loser must not receive a second legacy rating';
  END IF;

  IF (SELECT count(*) FROM public.lemonade_ratings WHERE source = 'legacy' AND lemonade_id = v_nullstyle) <> 0 THEN
    RAISE EXCEPTION 'backfill: new-style listing without legacy metrics must not receive a legacy rating';
  END IF;

  -- 2. Exact decimal scores (flavor * 0.65 + sourness * 0.35).
  SELECT score INTO v_score FROM public.lemonade_ratings WHERE source = 'legacy' AND lemonade_id = v_winner;
  IF v_score IS DISTINCT FROM 6.30::numeric(5,2) THEN
    RAISE EXCEPTION 'backfill: winner score % <> 6.30', v_score;
  END IF;

  SELECT score INTO v_score FROM public.lemonade_ratings WHERE source = 'legacy' AND lemonade_id = v_high;
  IF v_score IS DISTINCT FROM 9.30::numeric(5,2) THEN
    RAISE EXCEPTION 'backfill: high score % <> 9.30', v_score;
  END IF;

  SELECT score INTO v_score FROM public.lemonade_ratings WHERE source = 'legacy' AND lemonade_id = v_mid;
  IF v_score IS DISTINCT FROM 6.00::numeric(5,2) THEN
    RAISE EXCEPTION 'backfill: mid score % <> 6.00', v_score;
  END IF;

  SELECT score INTO v_score FROM public.lemonade_ratings WHERE source = 'legacy' AND lemonade_id = v_low;
  IF v_score IS DISTINCT FROM 1.00::numeric(5,2) THEN
    RAISE EXCEPTION 'backfill: low score % <> 1.00', v_score;
  END IF;

  SELECT score INTO v_score FROM public.lemonade_ratings WHERE source = 'legacy' AND lemonade_id = v_nophoto;
  IF v_score IS DISTINCT FROM 4.65::numeric(5,2) THEN
    RAISE EXCEPTION 'backfill: nophoto score % <> 4.65', v_score;
  END IF;

  -- 3. Provenance: created_at preserved, no guessed traits/comments/browser ids.
  IF EXISTS (
    SELECT 1
      FROM public.lemonade_ratings AS r
      JOIN public.lemonades AS l ON l.id = r.lemonade_id
     WHERE r.source = 'legacy'
       AND r.lemonade_id IN (v_winner, v_high, v_mid, v_low, v_nophoto)
       AND (
         r.trait_sour IS NOT NULL OR r.trait_sweet IS NOT NULL
         OR r.trait_fizz IS NOT NULL OR r.trait_fruity IS NOT NULL
         OR r.comment IS NOT NULL OR r.browser_id IS NOT NULL
         OR r.created_at IS DISTINCT FROM l.created_at
       )
  ) THEN
    RAISE EXCEPTION 'backfill: legacy provenance must stay untouched';
  END IF;

  -- 4. Twister merge: loser aliases the photo-bearing winner, reason recorded.
  IF (SELECT merged_into FROM public.lemonades WHERE id = v_loser) IS DISTINCT FROM v_winner THEN
    RAISE EXCEPTION 'merge: loser.merged_into must point at the photo-bearing winner';
  END IF;
  IF (SELECT merge_reason FROM public.lemonades WHERE id = v_loser) IS NULL THEN
    RAISE EXCEPTION 'merge: reason must be recorded';
  END IF;
  IF (SELECT merged_into FROM public.lemonades WHERE id = v_winner) IS NOT NULL THEN
    RAISE EXCEPTION 'merge: winner must stay canonical';
  END IF;

  -- 5. Public read model: 48-style canonical view excludes the loser.
  IF EXISTS (SELECT 1 FROM public.listing_summaries WHERE id = v_loser) THEN
    RAISE EXCEPTION 'view: merged loser must not appear in listing_summaries';
  END IF;

  IF (SELECT rating_count FROM public.listing_summaries WHERE id = v_winner) <> 1 THEN
    RAISE EXCEPTION 'view: winner must show exactly its one historical rating';
  END IF;
  IF (SELECT avg_score FROM public.listing_summaries WHERE id = v_winner) IS DISTINCT FROM 6.30::numeric THEN
    RAISE EXCEPTION 'view: winner average must be the historical score';
  END IF;

  -- 6. Nullable legacy columns: overall_score is NULL without flavor/sourness.
  IF (SELECT overall_score FROM public.lemonades WHERE id = v_nullstyle) IS NOT NULL THEN
    RAISE EXCEPTION 'nullable: generated score must be NULL for new-style listings';
  END IF;
  IF (SELECT rating_count FROM public.listing_summaries WHERE id = v_nullstyle) <> 0 THEN
    RAISE EXCEPTION 'nullable: new-style listing must have no ratings yet';
  END IF;
  IF (SELECT avg_score FROM public.listing_summaries WHERE id = v_nullstyle) IS NOT NULL THEN
    RAISE EXCEPTION 'nullable: unrated average must stay NULL, never 0';
  END IF;
END $$;
