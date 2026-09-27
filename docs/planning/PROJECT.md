# Project: lemolist

lemolist ([lemolist.com](https://lemolist.com), repo `limo`) is a worldwide,
user-submitted lemonade leaderboard. The idea: anyone, anywhere can add a lemonade
drink, rate it, and see how it compares on a global board.

The current codebase implements the anonymous public leaderboard plus community
feedback: visitors rate listings on a single 1–10 score, historical self-reported scores
have been converted into one legacy rating per row, and a matchup game records real
preference votes. Accounts, moderation, and geographic discovery are future goals, not
present functionality — see [ROADMAP.md](ROADMAP.md).

## Current state (implemented)

- Anonymous add and rate, no accounts. The add flow searches by name first; creating a
  near-duplicate returns the existing listing and offers to rate it instead.
- New listings store no `flavor_rating`/`sourness_rating` (both nullable since migration
  `007`). The submitter's first feedback is a visitor rating: one integer score 1–10,
  four optional 0–3 traits (`sour`, `sweet`, `fizz`, `fruity`), and an optional
  ≤140-character comment.
- Historical rows keep their old score as exactly one converted `source = 'legacy'`
  rating per listing, computed as `flavor_rating * 0.65 + sourness_rating * 0.35`
  (migration `007` backfill). The `overall_score` generated column is legacy-only.
- Ratings and votes are deduplicated per browser with an HttpOnly cookie identity; a
  repeat rating replaces the previous one. Clearing cookies resets the identity.
- Ranked global leaderboard on `/`: rank derives from `avg_score` (legacy + visitor
  combined) with ties sharing the best rank; top 20 by default with a "show all" toggle;
  top three get medals; a detail sheet shows photo, plain-text description, city, date,
  submitter, traits, and score provenance.
- Name search (`search_lemonades` RPC) and explicit pagination of `listing_summaries`
  (1,000-row pages) so leaderboard reads are not truncated by PostgREST `max_rows`.
- "yay or nay" / "lemoguesser" game: side-by-side preference picks stored in
  `matchup_votes`. Percentages and counts come only from real votes; a first vote is
  reported as such.
- Photos: new uploads go to Cloudinary via `POST /api/uploads` (jpeg/png/webp/avif,
  10MB cap shared with the client, magic-byte sniffing, in-process rate limit). Legacy
  Supabase Storage URLs still display: migration `009` keeps public read and revokes
  public writes.
- No auth, no edit/delete, no moderation, no geographic filter/map.

## Deployment state

- Migrations `007`–`009` and the redesign app are committed. The migrations plus
  `.github/workflows/db-migrate-staging.yml` are on `origin/staging`, but the staging
  migration run for that push failed before applying anything (empty
  `SUPABASE_ACCESS_TOKEN`).
- The redesign app commit `9471805` is on local `feat/cloudinary-uploads` only; it is
  not on `staging` or `main`. Production is neither migrated nor deployed with this work.
  Details in [../DEPLOYMENT.md](../DEPLOYMENT.md).

## Product vision (future, not shipped)

- Worldwide coverage: submissions and rankings from any region, not a single-city list.
- Durable identity/attribution: accounts or tokens so ratings/votes survive cookie
  clearing and can be limited per person, plus edit/delete and admin moderation.
- Abuse resistance at scale: shared (multi-instance) rate-limit and anti-abuse storage,
  anomaly checks, and sybil resistance for votes and uploads.
- Geographic discovery: browse and filter by place, with normalized locations and
  privacy-respecting precision.
- Accounts, social features, and richer media are options under discussion, not
  commitments.

## Scope

In (current):

- public read with anonymous write flows, no auth (writes only through validated
  server-side RPCs)
- one photo per lemonade
- visitor ratings (1–10 score + optional traits/comment) and one converted legacy
  historical rating per row
- matchup preference votes with real counts
- ranked global leaderboard with name search and top-20/show-all pagination
- basic staging workflow (currently blocked on secrets) and a production approval gate
- free-tier infrastructure only

Out for now (roadmap items are not commitments):

- user accounts/profiles and durable identity
- edit/delete and admin moderation
- comments or social features
- search filters, geographic browse, and maps
- barcode scanning
- multiple images per entry
- fancy animation or brand-heavy UI

## Constraints and assumptions

- Anonymous public writes make abuse controls a first-class design concern, not later
  polish; see phase 0 in [ROADMAP.md](ROADMAP.md).
- Server-side DB access uses the Supabase service-role key, which bypasses RLS, so
  validation lives in Zod schemas plus `SECURITY DEFINER` RPCs
  (`src/app/listing-actions.ts`, `supabase/migrations/008_rating_rpcs_and_read_models.sql`).
  Migration `007` revoked the public insert policy and public writes on `lemonades`, so
  direct anon-key writes no longer work.
- Identity is a per-browser HttpOnly cookie, not authentication: clearing cookies resets
  it, and the same person can rate again from another browser.
- Upload protection is best-effort: one in-process token bucket keyed by client IP and
  browser id, so it only covers a single Node process; a multi-instance deployment needs
  a shared store.
- Free-tier Supabase/Cloudinary limits cap storage, bandwidth, and upload size.
- Production deployment requires explicit approval; staging migration application is
  currently blocked (see [../DEPLOYMENT.md](../DEPLOYMENT.md)).

## Related docs

- [ROADMAP.md](ROADMAP.md) — phased plan and exit criteria
- [../TESTING.md](../TESTING.md) — testing strategy
- [../../supabase/README.md](../../supabase/README.md) — database setup
- [../README.md](../README.md) — documentation index
