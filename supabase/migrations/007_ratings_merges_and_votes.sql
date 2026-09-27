-- Phase A: community ratings, duplicate merges and matchup votes.
--
-- This migration is idempotent: every statement is safe to re-run, the merge
-- guards on identity + name, and the historical backfill relies on a partial
-- unique index plus ON CONFLICT DO NOTHING. It is a no-op on an empty database
-- (e.g. a freshly reset staging project).

-- ---------------------------------------------------------------------------
-- 1. lemonades: legacy metrics become optional, merge bookkeeping added
-- ---------------------------------------------------------------------------
-- New listings store their ratings in public.lemonade_ratings, so the legacy
-- flavor/sourness columns (and the generated overall_score) are NULL for them.
ALTER TABLE public.lemonades ALTER COLUMN flavor_rating DROP NOT NULL;
ALTER TABLE public.lemonades ALTER COLUMN sourness_rating DROP NOT NULL;

-- Losers of a duplicate merge point at the canonical row instead of being
-- deleted, so history and audit stay intact.
ALTER TABLE public.lemonades
  ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES public.lemonades(id) ON DELETE SET NULL;
ALTER TABLE public.lemonades
  ADD COLUMN IF NOT EXISTS merge_reason TEXT;

ALTER TABLE public.lemonades DROP CONSTRAINT IF EXISTS lemonades_merged_into_not_self;
ALTER TABLE public.lemonades
  ADD CONSTRAINT lemonades_merged_into_not_self
  CHECK (merged_into IS NULL OR merged_into <> id);

-- ---------------------------------------------------------------------------
-- 2. Merge the Twister duplicate
-- ---------------------------------------------------------------------------
-- Production has two "Twister Soda Trai Cay" rows submitted on the same day:
-- 03134887 (photo-bearing, canonical) and 0c0cd8a0 (no photo, alias).
-- Guard on both UUID prefixes and the normalized name; do nothing when the
-- rows are absent (local/staging) or already merged (re-run).
--
-- The merge is only safe when the canonical row really holds the photo. Fail
-- loudly on a reversed or ambiguous photo layout (or one already merged the
-- wrong way) instead of silently hiding the only image behind an alias.
DO $$
DECLARE
  v_winner public.lemonades%ROWTYPE;
  v_loser public.lemonades%ROWTYPE;
BEGIN
  SELECT l.* INTO v_winner
    FROM public.lemonades AS l
   WHERE left(l.id::text, 8) = '03134887'
     AND lower(btrim(l.name)) = 'twister soda trai cay'
   LIMIT 1;
  SELECT l.* INTO v_loser
    FROM public.lemonades AS l
   WHERE left(l.id::text, 8) = '0c0cd8a0'
     AND lower(btrim(l.name)) = 'twister soda trai cay'
   LIMIT 1;

  -- Rows absent (local/staging) or already merged: nothing to validate.
  IF v_winner.id IS NULL OR v_loser.id IS NULL THEN
    RETURN;
  END IF;

  IF v_loser.merged_into IS DISTINCT FROM v_winner.id
     AND (nullif(btrim(v_winner.image_url), '') IS NULL
          OR nullif(btrim(v_loser.image_url), '') IS NOT NULL) THEN
    RAISE EXCEPTION
      'Twister merge refused: expected 03134887 to hold the photo and 0c0cd8a0 to have none (winner.image_url=%, loser.image_url=%)',
      v_winner.image_url, v_loser.image_url
      USING ERRCODE = 'P0001';
  END IF;

  IF v_loser.merged_into = v_winner.id
     AND nullif(btrim(v_winner.image_url), '') IS NULL
     AND nullif(btrim(v_loser.image_url), '') IS NOT NULL THEN
    RAISE EXCEPTION
      'Twister merge already hid the only photo: 0c0cd8a0 is an alias of 03134887 but holds the image; repair the merge before re-running'
      USING ERRCODE = 'P0001';
  END IF;
END $$;

UPDATE public.lemonades AS loser
   SET merged_into = winner.id,
       merge_reason = 'duplicate of Twister row 03134887 (photo-bearing) on 2026-07-03; 0c0cd8a0 preserved as alias',
       updated_at = now()
  FROM public.lemonades AS winner
 WHERE left(loser.id::text, 8) = '0c0cd8a0'
   AND left(winner.id::text, 8) = '03134887'
   AND loser.id <> winner.id
   AND lower(btrim(loser.name)) = 'twister soda trai cay'
   AND lower(btrim(winner.name)) = 'twister soda trai cay'
   AND nullif(btrim(winner.image_url), '') IS NOT NULL
   AND nullif(btrim(loser.image_url), '') IS NULL
   AND loser.merged_into IS DISTINCT FROM winner.id;

-- ---------------------------------------------------------------------------
-- 3. lemonade_ratings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lemonade_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lemonade_id UUID NOT NULL REFERENCES public.lemonades(id) ON DELETE CASCADE,
  score NUMERIC(5, 2) NOT NULL,
  trait_sour SMALLINT,
  trait_sweet SMALLINT,
  trait_fizz SMALLINT,
  trait_fruity SMALLINT,
  comment TEXT,
  -- legacy = one exact historical self-reported score; visitor = real user input
  source TEXT NOT NULL DEFAULT 'visitor',
  -- opaque browser identity for visitor rows only
  browser_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lemonade_ratings_score_range CHECK (score >= 1 AND score <= 10),
  CONSTRAINT lemonade_ratings_trait_ranges CHECK (
    (trait_sour IS NULL OR trait_sour BETWEEN 0 AND 3)
    AND (trait_sweet IS NULL OR trait_sweet BETWEEN 0 AND 3)
    AND (trait_fizz IS NULL OR trait_fizz BETWEEN 0 AND 3)
    AND (trait_fruity IS NULL OR trait_fruity BETWEEN 0 AND 3)
  ),
  CONSTRAINT lemonade_ratings_comment_length CHECK (comment IS NULL OR char_length(comment) <= 140),
  CONSTRAINT lemonade_ratings_source CHECK (source IN ('legacy', 'visitor')),
  CONSTRAINT lemonade_ratings_identity CHECK (
    (source = 'legacy' AND browser_id IS NULL)
    OR (source = 'visitor' AND browser_id IS NOT NULL AND char_length(browser_id) BETWEEN 8 AND 100)
  ),
  -- historical rows never carry guessed traits
  CONSTRAINT lemonade_ratings_legacy_no_traits CHECK (
    source = 'visitor'
    OR (trait_sour IS NULL AND trait_sweet IS NULL AND trait_fizz IS NULL AND trait_fruity IS NULL)
  )
);

-- Exactly one historical rating per listing, which also makes the backfill
-- idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS lemonade_ratings_one_legacy_per_listing
  ON public.lemonade_ratings (lemonade_id)
  WHERE source = 'legacy';

-- One current rating per browser and listing (edits replace the previous score).
CREATE UNIQUE INDEX IF NOT EXISTS lemonade_ratings_one_per_browser
  ON public.lemonade_ratings (lemonade_id, browser_id)
  WHERE source = 'visitor';

CREATE INDEX IF NOT EXISTS idx_lemonade_ratings_listing_created
  ON public.lemonade_ratings (lemonade_id, created_at);

CREATE INDEX IF NOT EXISTS idx_lemonades_merged_into
  ON public.lemonades (merged_into)
  WHERE merged_into IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lemonades_visible_score
  ON public.lemonades (overall_score DESC NULLS LAST, created_at)
  WHERE merged_into IS NULL;

-- A case-insensitive unique name guard for canonical listings closes the
-- duplicate-creation race. Some populated databases (e.g. local seed data)
-- already contain duplicates, so the index is only created when it can be.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.lemonades
     WHERE merged_into IS NULL
     GROUP BY lower(btrim(name))
    HAVING count(*) > 1
  ) THEN
    RAISE WARNING 'skipping lemonades_canonical_name_unique: canonical duplicate names already exist';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS lemonades_canonical_name_unique
      ON public.lemonades (lower(btrim(name)))
      WHERE merged_into IS NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Historical backfill: one exact weighted score per canonical listing
-- ---------------------------------------------------------------------------
-- score = flavor * 0.65 + sourness * 0.35, computed in exact NUMERIC arithmetic
-- (migration 003 defines the same formula for the generated column). Legacy
-- rows get no traits and no comment; created_at preserves the original date.
INSERT INTO public.lemonade_ratings (lemonade_id, score, source, created_at, updated_at)
SELECT l.id,
       (l.flavor_rating::numeric * 0.65 + l.sourness_rating::numeric * 0.35)::numeric(5, 2),
       'legacy',
       l.created_at,
       l.created_at
  FROM public.lemonades AS l
 WHERE l.flavor_rating IS NOT NULL
   AND l.sourness_rating IS NOT NULL
   AND l.merged_into IS NULL
ON CONFLICT (lemonade_id) WHERE source = 'legacy' DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. matchup_votes (Yay or Nay): one real preference vote per browser/pair
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.matchup_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- canonical unordered pair, enforced by lemonade_a < lemonade_b
  lemonade_a UUID NOT NULL REFERENCES public.lemonades(id) ON DELETE CASCADE,
  lemonade_b UUID NOT NULL REFERENCES public.lemonades(id) ON DELETE CASCADE,
  picked UUID NOT NULL REFERENCES public.lemonades(id) ON DELETE CASCADE,
  browser_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT matchup_votes_distinct_pair CHECK (lemonade_a <> lemonade_b),
  CONSTRAINT matchup_votes_canonical_order CHECK (lemonade_a < lemonade_b),
  CONSTRAINT matchup_votes_picked_in_pair CHECK (picked = lemonade_a OR picked = lemonade_b),
  CONSTRAINT matchup_votes_browser_length CHECK (char_length(browser_id) BETWEEN 8 AND 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS matchup_votes_one_per_browser_pair
  ON public.matchup_votes (lemonade_a, lemonade_b, browser_id);

CREATE INDEX IF NOT EXISTS idx_matchup_votes_pair
  ON public.matchup_votes (lemonade_a, lemonade_b);

-- ---------------------------------------------------------------------------
-- 6. Lock down direct public writes / reads
-- ---------------------------------------------------------------------------
-- All mutations go through validated server-side RPCs using the service role.
ALTER TABLE public.lemonade_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchup_votes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.lemonade_ratings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.matchup_votes FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lemonade_ratings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matchup_votes TO service_role;

-- lemonades keeps public read (the site is public) but no direct public writes.
DROP POLICY IF EXISTS "Enable insert for all users" ON public.lemonades;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.lemonades
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.lemonades TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lemonades TO service_role;
