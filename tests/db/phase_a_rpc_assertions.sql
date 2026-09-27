-- Phase A: RPC validation, atomic create+rating, rating edits, first-photo-wins,
-- preference votes and aggregates. Raises on any failure.

DO $$
DECLARE
  v_created uuid;
  v_fractional uuid;
  v_dupe uuid;
  v_rc integer;
  v_lrc integer;
  v_vrc integer;
  v_avg numeric;
  v_score numeric;
  v_comment text;
  v_updated boolean;
  v_photo_url text;
  v_vote_a uuid;
  v_vote_b uuid;
  v_picked uuid;
  v_votes_a integer;
  v_votes_b integer;
  v_total integer;
  v_pa numeric;
  v_pb numeric;
  i integer;
  v_browser constant text := 'aaaaaaaa-0000-4000-8000-000000000001';
  v_browser2 constant text := 'bbbbbbbb-0000-4000-8000-000000000002';
  v_browser3 constant text := 'cccccccc-0000-4000-8000-000000000003';
  v_winner constant uuid := '03134887-0000-4000-8000-000000000001';
  v_loser constant uuid := '0c0cd8a0-0000-4000-8000-000000000002';
  v_high constant uuid := 'a1b91ec4-0000-4000-8000-000000000003';
  v_mid constant uuid := '87d72ace-0000-4000-8000-000000000004';
  v_low constant uuid := 'f13bd349-0000-4000-8000-000000000005';
  v_nophoto constant uuid := '3377705f-0000-4000-8000-000000000006';
BEGIN
  -- Clean any listings left by a previous harness run so the create + duplicate
  -- assertions always start from a known state.
  DELETE FROM public.lemonades WHERE lower(btrim(name)) = 'rpc fixture limo';
  DELETE FROM public.lemonades WHERE lower(btrim(name)) = 'fractional fixture limo';
  DELETE FROM public.lemonades WHERE id::text LIKE 'dddddddd-%';

  ---------------------------------------------------------------------------
  -- Atomic create + first real rating
  ---------------------------------------------------------------------------
  SELECT listing_id, duplicate_of INTO v_created, v_dupe
    FROM public.create_lemonade_with_rating(
      'RPC Fixture Limo', 'created by db harness', 'https://res.cloudinary.com/demo/x.jpg',
      'Berlin', 'Mo', 8, 2::smallint, NULL::smallint, 3::smallint, NULL::smallint,
      'first rating', v_browser
    );
  IF v_created IS NULL OR v_dupe IS NOT NULL THEN
    RAISE EXCEPTION 'create: expected a new listing';
  END IF;
  IF (SELECT flavor_rating FROM public.lemonades WHERE id = v_created) IS NOT NULL
     OR (SELECT sourness_rating FROM public.lemonades WHERE id = v_created) IS NOT NULL
     OR (SELECT overall_score FROM public.lemonades WHERE id = v_created) IS NOT NULL THEN
    RAISE EXCEPTION 'create: new listings must leave legacy metrics NULL';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lemonade_ratings
     WHERE lemonade_id = v_created AND source = 'visitor' AND browser_id = v_browser
       AND score = 8 AND trait_sour = 2 AND trait_fizz = 3 AND comment = 'first rating'
  ) THEN
    RAISE EXCEPTION 'create: first visitor rating missing or wrong';
  END IF;

  -- Duplicate name is refused and points at the canonical listing.
  SELECT listing_id, duplicate_of INTO v_created, v_dupe
    FROM public.create_lemonade_with_rating(
      'rpc fixture limo', 'dup', NULL, NULL, NULL, 3,
      NULL, NULL, NULL, NULL, NULL, v_browser
    );
  IF v_created IS NOT NULL OR v_dupe IS NULL THEN
    RAISE EXCEPTION 'duplicate: expected duplicate_of instead of a new listing';
  END IF;
  IF (SELECT count(*) FROM public.lemonades WHERE lower(btrim(name)) = 'rpc fixture limo' AND merged_into IS NULL) <> 1 THEN
    RAISE EXCEPTION 'duplicate: a twin was created';
  END IF;
  SELECT id INTO v_created FROM public.lemonades WHERE lower(btrim(name)) = 'rpc fixture limo' AND merged_into IS NULL;

  ---------------------------------------------------------------------------
  -- Legacy bridge: the pre-Phase-B add form folds integer flavor/sourness
  -- ratings into a fractional weighted score and must store it exactly.
  ---------------------------------------------------------------------------
  SELECT listing_id, duplicate_of INTO v_fractional, v_dupe
    FROM public.create_lemonade_with_rating(
      'Fractional Fixture Limo', 'legacy bridge fraction', NULL, NULL, NULL,
      7.65, NULL, NULL, NULL, NULL, NULL, v_browser
    );
  IF v_fractional IS NULL OR v_dupe IS NOT NULL THEN
    RAISE EXCEPTION 'create: fractional score must create a new listing';
  END IF;
  IF (SELECT score FROM public.lemonade_ratings
       WHERE lemonade_id = v_fractional AND browser_id = v_browser)
     IS DISTINCT FROM 7.65::numeric(5, 2) THEN
    RAISE EXCEPTION 'create: fractional score must round-trip exactly';
  END IF;

  BEGIN
    PERFORM public.create_lemonade_with_rating(
      'Fractional Out Of Range', 'too high', NULL, NULL, NULL,
      10.5, NULL, NULL, NULL, NULL, NULL, v_browser
    );
    RAISE EXCEPTION 'expected out-of-range fractional score to be rejected';
  EXCEPTION WHEN others THEN
    IF sqlerrm = 'expected out-of-range fractional score to be rejected' THEN RAISE; END IF;
    IF sqlerrm NOT LIKE '%between 1 and 10%' THEN RAISE; END IF;
  END;

  ---------------------------------------------------------------------------
  -- Rating edits replace the browser's rating, independent of votes
  ---------------------------------------------------------------------------
  PERFORM public.rate_lemonade(v_created, 9, 1::smallint, 1::smallint, 1::smallint, 1::smallint, 'edited', v_browser);
  IF (SELECT count(*) FROM public.lemonade_ratings WHERE lemonade_id = v_created AND source = 'visitor') <> 1 THEN
    RAISE EXCEPTION 'rate: editing must replace the previous rating, not append';
  END IF;
  SELECT score, comment INTO v_score, v_comment
    FROM public.lemonade_ratings WHERE lemonade_id = v_created AND browser_id = v_browser;
  IF v_score <> 9 OR v_comment <> 'edited' THEN
    RAISE EXCEPTION 'rate: edited score/comment not stored';
  END IF;

  PERFORM public.rate_lemonade(v_created, 7, NULL, NULL, NULL, NULL, NULL, v_browser2);
  SELECT rating_count, legacy_rating_count, visitor_rating_count, avg_score
    INTO v_rc, v_lrc, v_vrc, v_avg
    FROM public.listing_summaries WHERE id = v_created;
  IF v_rc <> 2 OR v_lrc <> 0 OR v_vrc <> 2 OR v_avg IS DISTINCT FROM 8.00::numeric THEN
    RAISE EXCEPTION 'aggregate: expected 2 visitor ratings averaging 8.00, got %/%/%/%', v_rc, v_lrc, v_vrc, v_avg;
  END IF;

  -- Historical + visitor ratings average truthfully.
  PERFORM public.rate_lemonade(v_winner, 8, NULL, NULL, NULL, NULL, NULL, v_browser2);
  SELECT rating_count, legacy_rating_count, visitor_rating_count, avg_score
    INTO v_rc, v_lrc, v_vrc, v_avg
    FROM public.listing_summaries WHERE id = v_winner;
  IF v_rc <> 2 OR v_lrc <> 1 OR v_vrc <> 1 OR v_avg IS DISTINCT FROM 7.15::numeric THEN
    RAISE EXCEPTION 'aggregate: historical+visitor average wrong (%/%/%/%)', v_rc, v_lrc, v_vrc, v_avg;
  END IF;

  ---------------------------------------------------------------------------
  -- Validation / anti-abuse
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM public.rate_lemonade(v_created, 11, NULL, NULL, NULL, NULL, NULL, v_browser);
    RAISE EXCEPTION 'expected invalid score to be rejected';
  EXCEPTION WHEN others THEN
    IF sqlerrm = 'expected invalid score to be rejected' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.rate_lemonade(v_created, 5, 4::smallint, NULL, NULL, NULL, NULL, v_browser);
    RAISE EXCEPTION 'expected invalid trait to be rejected';
  EXCEPTION WHEN others THEN
    IF sqlerrm = 'expected invalid trait to be rejected' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.rate_lemonade(v_created, 5, NULL, NULL, NULL, NULL, repeat('x', 141), v_browser);
    RAISE EXCEPTION 'expected oversized comment to be rejected';
  EXCEPTION WHEN others THEN
    IF sqlerrm = 'expected oversized comment to be rejected' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.rate_lemonade(v_loser, 5, NULL, NULL, NULL, NULL, NULL, v_browser);
    RAISE EXCEPTION 'expected rating a merged alias to be rejected';
  EXCEPTION WHEN others THEN
    IF sqlerrm = 'expected rating a merged alias to be rejected' THEN RAISE; END IF;
    IF sqlerrm NOT LIKE '%merged into%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.create_lemonade_with_rating('x', 'too short', NULL, NULL, NULL, 5, NULL, NULL, NULL, NULL, NULL, v_browser);
    RAISE EXCEPTION 'expected invalid listing name to be rejected';
  EXCEPTION WHEN others THEN
    IF sqlerrm = 'expected invalid listing name to be rejected' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.create_lemonade_with_rating('No Score Limo', 'score is required', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, v_browser);
    RAISE EXCEPTION 'expected missing score to be rejected';
  EXCEPTION WHEN others THEN
    IF sqlerrm = 'expected missing score to be rejected' THEN RAISE; END IF;
  END;

  ---------------------------------------------------------------------------
  -- Atomic first-photo-wins
  ---------------------------------------------------------------------------
  SELECT updated, current_image_url INTO v_updated, v_photo_url
    FROM public.set_lemonade_photo(v_nophoto, 'https://res.cloudinary.com/demo/first.jpg');
  IF NOT v_updated OR v_photo_url <> 'https://res.cloudinary.com/demo/first.jpg' THEN
    RAISE EXCEPTION 'photo: first contribution must win';
  END IF;

  SELECT updated, current_image_url INTO v_updated, v_photo_url
    FROM public.set_lemonade_photo(v_nophoto, 'https://res.cloudinary.com/demo/second.jpg');
  IF v_updated OR v_photo_url <> 'https://res.cloudinary.com/demo/first.jpg' THEN
    RAISE EXCEPTION 'photo: later contribution must not overwrite the winner';
  END IF;

  SELECT updated, current_image_url INTO v_updated, v_photo_url
    FROM public.set_lemonade_photo(v_created, 'https://res.cloudinary.com/demo/third.jpg');
  IF v_updated OR v_photo_url <> 'https://res.cloudinary.com/demo/x.jpg' THEN
    RAISE EXCEPTION 'photo: existing image must never be replaced';
  END IF;

  BEGIN
    PERFORM public.set_lemonade_photo(v_mid, 'http://insecure.example/x.jpg');
    RAISE EXCEPTION 'expected insecure photo url to be rejected';
  EXCEPTION WHEN others THEN
    IF sqlerrm = 'expected insecure photo url to be rejected' THEN RAISE; END IF;
  END;

  ---------------------------------------------------------------------------
  -- Preference votes: one per browser/pair, canonical unordered pair
  ---------------------------------------------------------------------------
  SELECT listing_a, listing_b, picked_listing INTO v_vote_a, v_vote_b, v_picked
    FROM public.cast_matchup_vote(v_high, v_mid, v_high, v_browser);
  IF v_vote_a <> v_mid OR v_vote_b <> v_high OR v_picked <> v_high THEN
    RAISE EXCEPTION 'vote: pair must be stored in canonical order';
  END IF;

  -- Same browser + reversed arguments = same row, changed pick.
  SELECT listing_a, listing_b, picked_listing INTO v_vote_a, v_vote_b, v_picked
    FROM public.cast_matchup_vote(v_mid, v_high, v_mid, v_browser);
  IF (SELECT count(*) FROM public.matchup_votes WHERE browser_id = v_browser AND lemonade_a = v_mid AND lemonade_b = v_high) <> 1 THEN
    RAISE EXCEPTION 'vote: one row per browser/pair expected';
  END IF;
  IF v_picked <> v_mid THEN
    RAISE EXCEPTION 'vote: changing a pick must update the same vote';
  END IF;

  PERFORM public.cast_matchup_vote(v_high, v_mid, v_high, v_browser2);
  SELECT votes_a, votes_b, total_votes, percent_a, percent_b
    INTO v_votes_a, v_votes_b, v_total, v_pa, v_pb
    FROM public.get_matchup_result(v_high, v_mid);
  IF v_total <> 2 OR v_votes_a <> 1 OR v_votes_b <> 1 OR v_pa <> 50 OR v_pb <> 50 THEN
    RAISE EXCEPTION 'vote aggregate: expected 50/50 from 2 real votes, got %/%/%/%/%', v_votes_a, v_votes_b, v_total, v_pa, v_pb;
  END IF;

  -- No fake crowd: an unvoted pair reports NULL percentages.
  SELECT total_votes, percent_a, percent_b INTO v_total, v_pa, v_pb
    FROM public.get_matchup_result(v_low, v_nophoto);
  IF v_total <> 0 OR v_pa IS NOT NULL OR v_pb IS NOT NULL THEN
    RAISE EXCEPTION 'vote aggregate: unvoted pair must not invent a percentage';
  END IF;

  BEGIN
    PERFORM public.cast_matchup_vote(v_high, v_high, v_high, v_browser);
    RAISE EXCEPTION 'expected equal pair to be rejected';
  EXCEPTION WHEN others THEN
    IF sqlerrm = 'expected equal pair to be rejected' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.cast_matchup_vote(v_high, v_mid, v_low, v_browser);
    RAISE EXCEPTION 'expected pick outside pair to be rejected';
  EXCEPTION WHEN others THEN
    IF sqlerrm = 'expected pick outside pair to be rejected' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.cast_matchup_vote(v_high, v_loser, v_high, v_browser);
    RAISE EXCEPTION 'expected merged listing in pair to be rejected';
  EXCEPTION WHEN others THEN
    IF sqlerrm = 'expected merged listing in pair to be rejected' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.cast_matchup_vote(v_high, 'ffffffff-0000-4000-8000-0000000000ff', v_high, v_browser);
    RAISE EXCEPTION 'expected unknown listing to be rejected';
  EXCEPTION WHEN others THEN
    IF sqlerrm = 'expected unknown listing to be rejected' THEN RAISE; END IF;
  END;

  ---------------------------------------------------------------------------
  -- Server-side throttle: at most 10 distinct listings per browser per minute
  ---------------------------------------------------------------------------
  INSERT INTO public.lemonades (id, name, description, created_at, updated_at)
  SELECT
    ('dddddddd-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    'Throttle Fixture ' || n,
    'fixture',
    now(),
    now()
    FROM generate_series(1, 11) AS n
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

  FOR i IN 1..10 LOOP
    PERFORM public.rate_lemonade(
      ('dddddddd-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
      5, NULL, NULL, NULL, NULL, NULL, v_browser3
    );
  END LOOP;

  BEGIN
    PERFORM public.rate_lemonade('dddddddd-0000-4000-8000-000000000011'::uuid, 5, NULL, NULL, NULL, NULL, NULL, v_browser3);
    RAISE EXCEPTION 'expected throttle to block the 11th rating write';
  EXCEPTION WHEN others THEN
    IF sqlerrm = 'expected throttle to block the 11th rating write' THEN RAISE; END IF;
    IF sqlerrm NOT LIKE '%too many rating writes%' THEN RAISE; END IF;
  END;
END $$;
