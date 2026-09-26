# Project: lemolist

lemolist ([lemolist.com](https://lemolist.com), repo `limo`) is a worldwide,
user-submitted lemonade leaderboard. The idea: anyone, anywhere can add a lemonade
drink, rate it, and see how it compares on a global board.

The current codebase is the first slice of that vision: a single anonymous, public
leaderboard. Community ranking, accounts, and geographic discovery are future goals, not
present functionality — see [ROADMAP.md](ROADMAP.md).

## Current state (implemented)

- Anonymous submission with no accounts: name (required), description (optional, limited
  markdown), flavor and sourness ratings (1–10 each, required), optional photo, optional
  city, optional submitter name.
- Ratings are **self-reported at submission time**, not community votes. `overall_score`
  is generated in Postgres as `flavor_rating * 0.65 + sourness_rating * 0.35`
  (`supabase/migrations/003_weighted_overall_score.sql`).
- Global leaderboard on `/`: sortable by rank, name, overall, flavor, sourness, and date;
  top three rows get medals; rows expand to show photo, description, city, date, and
  submitter; desktop hover previews the photo.
- Photos upload through `POST /api/uploads` to Cloudinary (jpeg/png/webp/avif, 10MB
  server cap). Legacy Supabase Storage URLs are still accepted for old rows by
  `isAllowedImageUrl` in `src/lib/image-url.ts`.
- No auth, no edit/delete, no moderation, no pagination, no search/filter/map.
- Public read/write MVP on free-tier infrastructure.

## Product vision (future, not shipped)

- Worldwide coverage: submissions and rankings from any region, not a single-city list.
- Community ranking: many users rate the same lemonade, with aggregation and anti-abuse
  semantics, so rankings are independent rather than self-reported.
- Geographic discovery: browse and filter by place, with normalized locations and
  privacy-respecting precision.
- Identity/attribution: durable contributor identity (anonymous token or accounts) so
  submissions and votes can be attributed and limited.
- Accounts, social features, and richer media are options under discussion, not
  commitments.

## Scope

In (current MVP):

- public read/write with no auth
- one photo per lemonade
- self-reported flavor/sourness rating and generated overall score
- sortable global leaderboard
- basic staging and deployment workflow
- free-tier infrastructure only

Out for now (roadmap items are not commitments):

- community votes and independent rankings
- user accounts or profiles
- comments or social features
- search, filters, and maps
- barcode scanning
- multiple images per entry
- fancy animation or brand-heavy UI

## Constraints and assumptions

- Anonymous public writes make abuse controls a first-class design concern, not later
  polish; see phase 0 in [ROADMAP.md](ROADMAP.md).
- Server-side DB access uses the Supabase service-role key, which bypasses RLS.
  Application-level validation (`addLemonade` + Zod) is the current guard, and the
  table-level public insert policy from migration 001 still exists.
- Free-tier Supabase/Cloudinary limits cap storage, bandwidth, and upload size.
- Existing self-reported scores need a migration/backfill story before community ranking
  can be meaningful.

## Related docs

- [ROADMAP.md](ROADMAP.md) — phased plan and exit criteria
- [../TESTING.md](../TESTING.md) — testing strategy
- [../../supabase/README.md](../../supabase/README.md) — database setup
- [../README.md](../README.md) — documentation index
