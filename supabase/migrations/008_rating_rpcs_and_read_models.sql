-- Phase A: validated, transactional RPCs + server read models.
--
-- Every mutation the app performs goes through these SECURITY DEFINER
-- functions (called with the service role). Direct table writes are revoked
-- from anon/authenticated in migration 007.

-- ---------------------------------------------------------------------------
-- Read model: one row per canonical listing with truthful aggregates
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.listing_summaries WITH (security_invoker = true) AS
SELECT
  l.id,
  l.name,
  l.description,
  l.image_url,
  l.location_city,
  l.added_by,
  l.created_at,
  l.updated_at,
  l.flavor_rating,
  l.sourness_rating,
  l.overall_score,
  l.merged_into,
  l.merge_reason,
  (count(r.id))::integer AS rating_count,
  (count(r.id) FILTER (WHERE r.source = 'legacy'))::integer AS legacy_rating_count,
  (count(r.id) FILTER (WHERE r.source = 'visitor'))::integer AS visitor_rating_count,
  max(r.score) FILTER (WHERE r.source = 'legacy') AS legacy_score,
  avg(r.score) FILTER (WHERE r.source = 'visitor') AS visitor_avg_score,
  avg(r.score) AS avg_score,
  min(r.score) AS min_score,
  max(r.score) AS max_score,
  avg(r.trait_sour) AS trait_sour_avg,
  avg(r.trait_sweet) AS trait_sweet_avg,
  avg(r.trait_fizz) AS trait_fizz_avg,
  avg(r.trait_fruity) AS trait_fruity_avg,
  (count(r.trait_sour))::integer AS trait_sour_count,
  (count(r.trait_sweet))::integer AS trait_sweet_count,
  (count(r.trait_fizz))::integer AS trait_fizz_count,
  (count(r.trait_fruity))::integer AS trait_fruity_count
FROM public.lemonades AS l
LEFT JOIN public.lemonade_ratings AS r ON r.lemonade_id = l.id
WHERE l.merged_into IS NULL
GROUP BY l.id;

-- ---------------------------------------------------------------------------
-- Shared validation helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_valid_browser_id(p_browser_id TEXT)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_browser_id IS NULL
     OR char_length(p_browser_id) < 8
     OR char_length(p_browser_id) > 100
     OR p_browser_id !~ '^[A-Za-z0-9._:-]+$' THEN
    RAISE EXCEPTION 'invalid browser identity' USING ERRCODE = '22023';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.assert_valid_rating_input(
  p_score NUMERIC,
  p_trait_sour SMALLINT,
  p_trait_sweet SMALLINT,
  p_trait_fizz SMALLINT,
  p_trait_fruity SMALLINT,
  p_comment TEXT
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_score IS NULL OR p_score < 1 OR p_score > 10 THEN
    RAISE EXCEPTION 'rating score must be between 1 and 10' USING ERRCODE = '22023';
  END IF;
  IF p_comment IS NOT NULL AND char_length(p_comment) > 140 THEN
    RAISE EXCEPTION 'comment must be 140 characters or fewer' USING ERRCODE = '22023';
  END IF;
  IF p_trait_sour IS NOT NULL AND (p_trait_sour < 0 OR p_trait_sour > 3)
     OR p_trait_sweet IS NOT NULL AND (p_trait_sweet < 0 OR p_trait_sweet > 3)
     OR p_trait_fizz IS NOT NULL AND (p_trait_fizz < 0 OR p_trait_fizz > 3)
     OR p_trait_fruity IS NOT NULL AND (p_trait_fruity < 0 OR p_trait_fruity > 3) THEN
    RAISE EXCEPTION 'traits must be between 0 and 3' USING ERRCODE = '22023';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Atomic create: new listing + its first real visitor rating
-- ---------------------------------------------------------------------------
-- Drop the pre-release INTEGER-parameter overload, if a database applied an
-- earlier revision of this migration. Without this, Postgres keeps both
-- overloads and the untyped/whole-number callers keep hitting the old one.
DROP FUNCTION IF EXISTS public.create_lemonade_with_rating(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, SMALLINT, SMALLINT, SMALLINT, SMALLINT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.create_lemonade_with_rating(
  p_name TEXT,
  p_description TEXT,
  p_image_url TEXT,
  p_location_city TEXT,
  p_added_by TEXT,
  -- NUMERIC, not INTEGER: the pre-Phase-B bridge folds flavor/sourness into a
  -- fractional weighted score (e.g. 7.65) before calling this RPC.
  p_score NUMERIC,
  p_trait_sour SMALLINT DEFAULT NULL,
  p_trait_sweet SMALLINT DEFAULT NULL,
  p_trait_fizz SMALLINT DEFAULT NULL,
  p_trait_fruity SMALLINT DEFAULT NULL,
  p_comment TEXT DEFAULT NULL,
  p_browser_id TEXT DEFAULT NULL
)
RETURNS TABLE (listing_id UUID, duplicate_of UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name TEXT := btrim(coalesce(p_name, ''));
  v_description TEXT;
  v_image_url TEXT;
  v_city TEXT;
  v_added_by TEXT;
  v_comment TEXT;
  v_listing public.lemonades%ROWTYPE;
  v_duplicate public.lemonades%ROWTYPE;
BEGIN
  IF char_length(v_name) < 2 OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'name must be between 2 and 100 characters' USING ERRCODE = '22023';
  END IF;

  v_description := btrim(coalesce(p_description, ''));
  IF char_length(v_description) > 500 THEN
    RAISE EXCEPTION 'description must be 500 characters or fewer' USING ERRCODE = '22023';
  END IF;

  v_image_url := nullif(btrim(coalesce(p_image_url, '')), '');
  IF v_image_url IS NOT NULL
     AND (char_length(v_image_url) > 2048 OR v_image_url !~ '^https://') THEN
    RAISE EXCEPTION 'image url must be a https url' USING ERRCODE = '22023';
  END IF;

  v_city := nullif(btrim(coalesce(p_location_city, '')), '');
  IF v_city IS NOT NULL AND char_length(v_city) > 100 THEN
    RAISE EXCEPTION 'city must be 100 characters or fewer' USING ERRCODE = '22023';
  END IF;

  v_added_by := nullif(btrim(coalesce(p_added_by, '')), '');
  IF v_added_by IS NOT NULL AND char_length(v_added_by) > 100 THEN
    RAISE EXCEPTION 'added_by must be 100 characters or fewer' USING ERRCODE = '22023';
  END IF;

  v_comment := nullif(btrim(coalesce(p_comment, '')), '');
  PERFORM public.assert_valid_browser_id(p_browser_id);
  PERFORM public.assert_valid_rating_input(
    p_score, p_trait_sour, p_trait_sweet, p_trait_fizz, p_trait_fruity, v_comment
  );

  -- Actionable duplicate prevention: an exact case-insensitive name of a
  -- canonical listing returns that listing instead of creating a twin.
  SELECT l.* INTO v_duplicate
    FROM public.lemonades AS l
   WHERE l.merged_into IS NULL
     AND lower(btrim(l.name)) = lower(v_name)
   LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT NULL::uuid, v_duplicate.id;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.lemonades (name, description, image_url, location_city, added_by)
    VALUES (v_name, v_description, v_image_url, v_city, v_added_by)
    RETURNING * INTO v_listing;
  EXCEPTION
    WHEN unique_violation THEN
      -- Closes the concurrent-create race when the unique name index exists.
      SELECT l.* INTO v_duplicate
        FROM public.lemonades AS l
       WHERE l.merged_into IS NULL
         AND lower(btrim(l.name)) = lower(v_name)
       LIMIT 1;
      RETURN QUERY SELECT NULL::uuid, v_duplicate.id;
      RETURN;
  END;

  INSERT INTO public.lemonade_ratings (
    lemonade_id, score, trait_sour, trait_sweet, trait_fizz, trait_fruity,
    comment, source, browser_id
  )
  VALUES (
    v_listing.id, p_score::numeric(5, 2), p_trait_sour, p_trait_sweet, p_trait_fizz,
    p_trait_fruity, v_comment, 'visitor', p_browser_id
  );

  RETURN QUERY SELECT v_listing.id, NULL::uuid;
END $$;

-- ---------------------------------------------------------------------------
-- Rate / edit the current browser's rating for a listing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rate_lemonade(
  p_lemonade_id UUID,
  p_score INTEGER,
  p_trait_sour SMALLINT DEFAULT NULL,
  p_trait_sweet SMALLINT DEFAULT NULL,
  p_trait_fizz SMALLINT DEFAULT NULL,
  p_trait_fruity SMALLINT DEFAULT NULL,
  p_comment TEXT DEFAULT NULL,
  p_browser_id TEXT DEFAULT NULL
)
RETURNS TABLE (rating_id UUID, listing_id UUID, rating_score NUMERIC, rated_at TIMESTAMPTZ, revised_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_comment TEXT := nullif(btrim(coalesce(p_comment, '')), '');
  v_listing public.lemonades%ROWTYPE;
  v_rating public.lemonade_ratings%ROWTYPE;
  v_recent_writes INTEGER;
BEGIN
  PERFORM public.assert_valid_browser_id(p_browser_id);
  PERFORM public.assert_valid_rating_input(
    p_score, p_trait_sour, p_trait_sweet, p_trait_fizz, p_trait_fruity, v_comment
  );

  IF p_lemonade_id IS NULL THEN
    RAISE EXCEPTION 'listing id is required' USING ERRCODE = '22023';
  END IF;

  SELECT l.* INTO v_listing FROM public.lemonades AS l WHERE l.id = p_lemonade_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing % not found', p_lemonade_id USING ERRCODE = 'P0002';
  END IF;
  IF v_listing.merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'listing % was merged into %; rate the canonical listing instead',
      p_lemonade_id, v_listing.merged_into USING ERRCODE = 'P0001';
  END IF;

  -- Anti-spam: at most 10 distinct listings rated per browser per minute.
  SELECT count(*)::integer INTO v_recent_writes
    FROM public.lemonade_ratings AS r
   WHERE r.source = 'visitor'
     AND r.browser_id = p_browser_id
     AND r.updated_at > now() - interval '1 minute';

  IF v_recent_writes >= 10 THEN
    RAISE EXCEPTION 'too many rating writes; try again later' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.lemonade_ratings (
    lemonade_id, score, trait_sour, trait_sweet, trait_fizz, trait_fruity,
    comment, source, browser_id
  )
  VALUES (
    p_lemonade_id, p_score::numeric(5, 2), p_trait_sour, p_trait_sweet, p_trait_fizz,
    p_trait_fruity, v_comment, 'visitor', p_browser_id
  )
  ON CONFLICT (lemonade_id, browser_id) WHERE source = 'visitor'
  DO UPDATE SET
    score = excluded.score,
    trait_sour = excluded.trait_sour,
    trait_sweet = excluded.trait_sweet,
    trait_fizz = excluded.trait_fizz,
    trait_fruity = excluded.trait_fruity,
    comment = excluded.comment,
    updated_at = now()
  RETURNING * INTO v_rating;

  RETURN QUERY SELECT v_rating.id, v_rating.lemonade_id, v_rating.score,
                      v_rating.created_at, v_rating.updated_at;
END $$;

-- ---------------------------------------------------------------------------
-- Atomic first-photo-wins for listings without an image
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_lemonade_photo(
  p_lemonade_id UUID,
  p_image_url TEXT
)
RETURNS TABLE (updated BOOLEAN, current_image_url TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_url TEXT := nullif(btrim(coalesce(p_image_url, '')), '');
  v_listing public.lemonades%ROWTYPE;
BEGIN
  IF v_url IS NULL OR char_length(v_url) > 2048 OR v_url !~ '^https://' THEN
    RAISE EXCEPTION 'image url must be a https url' USING ERRCODE = '22023';
  END IF;

  SELECT l.* INTO v_listing FROM public.lemonades AS l WHERE l.id = p_lemonade_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing % not found', p_lemonade_id USING ERRCODE = 'P0002';
  END IF;
  IF v_listing.merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'listing % was merged into %; contribute to the canonical listing instead',
      p_lemonade_id, v_listing.merged_into USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.lemonades AS l
     SET image_url = v_url, updated_at = now()
   WHERE l.id = p_lemonade_id AND l.image_url IS NULL
  RETURNING * INTO v_listing;

  IF NOT FOUND THEN
    -- Another contribution won the race: report the winning image.
    SELECT l.* INTO v_listing FROM public.lemonades AS l WHERE l.id = p_lemonade_id;
    RETURN QUERY SELECT false, v_listing.image_url;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_listing.image_url;
END $$;

-- ---------------------------------------------------------------------------
-- Preference votes (Yay or Nay): one vote per browser and unordered pair
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cast_matchup_vote(
  p_lemonade_a UUID,
  p_lemonade_b UUID,
  p_picked UUID,
  p_browser_id TEXT
)
RETURNS TABLE (vote_id UUID, listing_a UUID, listing_b UUID, picked_listing UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_a UUID;
  v_b UUID;
  v_vote public.matchup_votes%ROWTYPE;
  v_recent_votes INTEGER;
BEGIN
  PERFORM public.assert_valid_browser_id(p_browser_id);

  IF p_lemonade_a IS NULL OR p_lemonade_b IS NULL OR p_picked IS NULL THEN
    RAISE EXCEPTION 'pair and picked listing are required' USING ERRCODE = '22023';
  END IF;
  IF p_lemonade_a = p_lemonade_b THEN
    RAISE EXCEPTION 'the two listings must be distinct' USING ERRCODE = '22023';
  END IF;
  IF p_picked <> p_lemonade_a AND p_picked <> p_lemonade_b THEN
    RAISE EXCEPTION 'picked listing must be one of the pair' USING ERRCODE = '22023';
  END IF;

  -- Canonical unordered pair, so either argument order hits the same row.
  v_a := least(p_lemonade_a, p_lemonade_b);
  v_b := greatest(p_lemonade_a, p_lemonade_b);

  IF (SELECT count(*) FROM public.lemonades WHERE id IN (v_a, v_b)) <> 2 THEN
    RAISE EXCEPTION 'unknown listing in pair' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lemonades WHERE id IN (v_a, v_b) AND merged_into IS NOT NULL) THEN
    RAISE EXCEPTION 'one of the listings was merged; refresh and try again' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*)::integer INTO v_recent_votes
    FROM public.matchup_votes AS v
   WHERE v.browser_id = p_browser_id
     AND v.created_at > now() - interval '1 minute';

  IF v_recent_votes >= 60 THEN
    RAISE EXCEPTION 'too many votes; try again later' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.matchup_votes (lemonade_a, lemonade_b, picked, browser_id)
  VALUES (v_a, v_b, p_picked, p_browser_id)
  ON CONFLICT (lemonade_a, lemonade_b, browser_id)
  DO UPDATE SET picked = excluded.picked, created_at = now()
  RETURNING * INTO v_vote;

  RETURN QUERY SELECT v_vote.id, v_vote.lemonade_a, v_vote.lemonade_b, v_vote.picked;
END $$;

-- ---------------------------------------------------------------------------
-- Truthful vote aggregation for one pair (NULL percent when nobody voted)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_matchup_result(p_lemonade_a UUID, p_lemonade_b UUID)
RETURNS TABLE (
  lemonade_a UUID,
  lemonade_b UUID,
  votes_a INTEGER,
  votes_b INTEGER,
  total_votes INTEGER,
  percent_a NUMERIC,
  percent_b NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_a UUID;
  v_b UUID;
  v_votes_a INTEGER;
  v_votes_b INTEGER;
  v_total INTEGER;
BEGIN
  IF p_lemonade_a IS NULL OR p_lemonade_b IS NULL OR p_lemonade_a = p_lemonade_b THEN
    RAISE EXCEPTION 'two distinct listings are required' USING ERRCODE = '22023';
  END IF;

  v_a := least(p_lemonade_a, p_lemonade_b);
  v_b := greatest(p_lemonade_a, p_lemonade_b);

  SELECT count(*) FILTER (WHERE mv.picked = v_a)::integer,
         count(*) FILTER (WHERE mv.picked = v_b)::integer,
         count(*)::integer
    INTO v_votes_a, v_votes_b, v_total
    FROM public.matchup_votes AS mv
   WHERE mv.lemonade_a = v_a AND mv.lemonade_b = v_b;

  IF v_total = 0 THEN
    RETURN QUERY SELECT v_a, v_b, 0, 0, 0, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_a,
    v_b,
    v_votes_a,
    v_votes_b,
    v_total,
    round(v_votes_a * 100.0 / v_total, 2),
    round(v_votes_b * 100.0 / v_total, 2);
END $$;

-- ---------------------------------------------------------------------------
-- Search: all query words must appear in the name, exact matches first
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_lemonades(p_query TEXT, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  image_url TEXT,
  location_city TEXT,
  added_by TEXT,
  created_at TIMESTAMPTZ,
  flavor_rating INTEGER,
  sourness_rating INTEGER,
  overall_score DOUBLE PRECISION,
  rating_count INTEGER,
  legacy_rating_count INTEGER,
  visitor_rating_count INTEGER,
  avg_score NUMERIC,
  legacy_score NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH tokens AS (
    SELECT DISTINCT lower(t.token) AS token
      FROM unnest(regexp_split_to_array(btrim(coalesce(p_query, '')), '\s+')) AS t(token)
     WHERE char_length(lower(t.token)) >= 2
  )
  SELECT
    s.id, s.name, s.description, s.image_url, s.location_city, s.added_by,
    s.created_at, s.flavor_rating, s.sourness_rating, s.overall_score,
    s.rating_count, s.legacy_rating_count, s.visitor_rating_count,
    s.avg_score, s.legacy_score
  FROM public.listing_summaries AS s
  WHERE (SELECT count(*) FROM tokens) = 0
     OR s.name ILIKE ALL (SELECT '%' || token || '%' FROM tokens)
  ORDER BY
    (lower(btrim(s.name)) = lower(btrim(coalesce(p_query, '')))) DESC,
    s.avg_score DESC NULLS LAST,
    s.created_at ASC,
    s.id
  LIMIT greatest(1, least(coalesce(p_limit, 10), 25));
$$;

-- ---------------------------------------------------------------------------
-- Read the current browser's own ratings (never other browsers' identities)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_browser_ratings(p_browser_id TEXT)
RETURNS TABLE (
  lemonade_id UUID,
  score NUMERIC,
  trait_sour SMALLINT,
  trait_sweet SMALLINT,
  trait_fizz SMALLINT,
  trait_fruity SMALLINT,
  comment TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT r.lemonade_id, r.score, r.trait_sour, r.trait_sweet, r.trait_fizz,
         r.trait_fruity, r.comment, r.updated_at
    FROM public.lemonade_ratings AS r
   WHERE r.source = 'visitor'
     AND r.browser_id = p_browser_id
   ORDER BY r.updated_at DESC;
$$;

-- ---------------------------------------------------------------------------
-- Grants: server-only (service_role); nothing public
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.listing_summaries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.listing_summaries TO service_role;

REVOKE ALL ON FUNCTION public.assert_valid_browser_id(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_valid_rating_input(NUMERIC, SMALLINT, SMALLINT, SMALLINT, SMALLINT, TEXT)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_lemonade_with_rating(
  TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, SMALLINT, SMALLINT, SMALLINT, SMALLINT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_lemonade_with_rating(
  TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, SMALLINT, SMALLINT, SMALLINT, SMALLINT, TEXT, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.rate_lemonade(
  UUID, INTEGER, SMALLINT, SMALLINT, SMALLINT, SMALLINT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_lemonade(
  UUID, INTEGER, SMALLINT, SMALLINT, SMALLINT, SMALLINT, TEXT, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.set_lemonade_photo(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_lemonade_photo(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.cast_matchup_vote(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cast_matchup_vote(UUID, UUID, UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.get_matchup_result(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_matchup_result(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.search_lemonades(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_lemonades(TEXT, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.get_browser_ratings(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_browser_ratings(TEXT) TO service_role;
