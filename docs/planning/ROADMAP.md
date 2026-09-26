# Roadmap

Sequenced direction for lemolist. There are no dates or delivery commitments: phases are
ordered by dependency, not schedule. The current release checklist lives separately in
[../todo.md](../todo.md).

Phase 0 comes first on purpose. The system-design questions below must be answered before
community ranking or map features are built on top of the current base.

## Phase 0 — System design review and decisions

Goal: verify current risks against the deployed projects and decide the target
architecture. This is an inspection and decision phase, not a feature phase.

### Evidence-backed risks (visible in this repo)

| Area | Evidence | Why it matters |
|------|----------|----------------|
| Public anonymous writes | `supabase/migrations/001_create_lemonades_table.sql` grants the `public` role (which includes `anon`) `SELECT`/`INSERT` with `WITH CHECK (true)`; the anon key ships to the browser via `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`src/lib/supabase/client.ts`) | Anyone with the public key can insert rows directly, bypassing `addLemonade` validation |
| Service-role bypass of RLS | `src/lib/supabase/service.ts` and `src/services/lemonade-service.ts` read/write with `SUPABASE_SERVICE_ROLE_KEY` | RLS does not protect app traffic; all validation is application-level |
| Unauthenticated uploads | `src/app/api/uploads/route.ts` accepts any request and streams to Cloudinary; only MIME type (client-supplied `file.type`) and a 10MB cap are checked; no rate limiting | Scripted clients can consume Cloudinary quota/storage, and `file.type` is spoofable |
| Upload limit mismatch | Client rejects files over 5MB in `src/app/components/Leaderboard.tsx`; server allows 10MB (`MAX_BYTES` in the upload route) | Inconsistent UX and a larger server-side allowance than the UI implies |
| Legacy storage policies | `supabase/migrations/002_create_limo_images_bucket.sql` grants `public` INSERT/UPDATE/DELETE on `storage.objects` for `limo-images` and `lemonade-images` | Broad anonymous write/delete surface on buckets the upload path no longer uses |
| No identity model | `added_by` is free text (`supabase/migrations/004_add_added_by_column.sql`); no accounts or tokens | Submissions and future votes can't be attributed or limited per person |
| No vote model | Ratings are columns on the row (`flavor_rating`, `sourness_rating`, generated `overall_score`) | There is no per-user vote data; community aggregation needs a new model |
| No pagination | `getAllLemonades` selects all rows ordered by `overall_score`; local PostgREST `max_rows = 1000` (`supabase/config.toml`) | Leaderboard reads grow unbounded and may silently truncate |

### Needs verification (against staging/prod Supabase)

- Whether `idx_lemonades_overall_score` still exists. Migration 001 creates it on
  `overall_score`, then migration 003 drops and re-adds that column; in PostgreSQL
  dropping a column drops its indexes, so the index is likely gone on migrated databases.
  Check `pg_indexes` and re-create if missing.
- Actual RLS and storage policies on the hosted projects — they may not match the
  migration files.
- Whether legacy `limo-images`/`lemonade-images` buckets still hold objects referenced by
  `image_url` in production rows.
- Applied migration history on staging and production.
- Cloudinary plan limits and whether old uploads need cleanup.

### Decisions to record

- Write path: keep service-role writes with app validation, or move to anon-key writes
  under tight RLS — and where rate limiting lives.
- Upload controls: rate limiting/abuse protection, content sniffing, size-limit
  alignment, Cloudinary restrictions, orphan cleanup.
- Identity/attribution: anonymous token vs accounts, and how one-vote-per-identity is
  enforced.
- Ranking model: votes table design, aggregation semantics (mean, Bayesian, minimum
  votes to rank), tie-breaks, self-vote handling, and backfill of existing self-scores.
- Location model and privacy stance: normalized place IDs/coordinates, display
  precision, consent.

Exit criteria:

- Decisions written as durable docs under `docs/` (for example ADRs).
- Current DB/storage state verified with recorded evidence (queries and results),
  including index status and legacy policy/bucket state.
- Prioritized hardening backlog with acceptance criteria; no unresolved abuse-control
  questions left before phase 2.

## Phase 1 — Safe, extensible foundations

Goal: implement the phase 0 decisions so later features don't build on an abusable base.

Work (depends on phase 0 decisions): restrict or remove anonymous direct-write policies;
add rate limiting/abuse controls to add and upload paths; align upload limits and validate
content; ensure the leaderboard index exists and add pagination; introduce stable
identity/attribution; add an edit/delete/moderation path; establish migration discipline
(idempotent migrations, staging before main).

Exit criteria:

- Anonymous direct-write surface removed or explicitly limited with documented rationale.
- Storage policies restricted to intended operations.
- Rate/abuse controls active on add and upload paths, covered by tests.
- Leaderboard query verified indexed and bounded (pagination or a documented cap).
- Identity/attribution in place; a moderation/removal path exists.
- `npm run check` green; migrations applied and verified on staging.

## Phase 2 — Community votes and rankings

Goal: rank lemonades by many users instead of only the submitter's self-score.

Work: dedicated votes/ratings model; one vote per identity per lemonade; abuse resistance
(rate limits, anomaly checks, sybil resistance); aggregation and tie-break semantics; UI
that clearly separates community ranking from self-reported score; handling of new and
unranked entries; migration/backfill of existing self-scores.

Exit criteria:

- Votes stored in a dedicated model; no client-trusted aggregates.
- Aggregation, minimum-vote threshold, and tie-break semantics documented and unit-tested
  (including zero votes, ties, and outliers).
- One-vote enforcement and rate limits implemented and tested.
- Leaderboard shows community ranking with self-score visibly separate, and handles
  unranked entries.
- Migration/backfill approach documented and applied.
- `npm run check` green and E2E covers the vote flow.

## Phase 3 — Geographic discovery

Goal: find lemonades by place, worldwide, without leaking user location.

Work: normalized locations (place IDs/coordinates) replacing free-text city; geocoding
provider decision; map and list browse with indexed, paginated queries; privacy/consent
rules (precision, opt-in/out, retention); moderation of location data.

Exit criteria:

- Location schema documented; free-text city backfilled or dual-written.
- Privacy/consent rules documented and enforced in UI and API.
- Geographic browse/search works with indexed, paginated queries and E2E coverage.
- Map view has a list/no-JS fallback and works on mobile.
- `npm run check` green; verified on staging.

## Ordering rules

- Phase 2 starts only after phase 0 decisions and phase 1 foundations are done.
- Nothing here promises shipped features or dates; items can be re-ordered if phase 0
  changes the design.
