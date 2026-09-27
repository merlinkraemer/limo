# Roadmap

Sequenced direction for lemolist. There are no dates or delivery commitments: phases are
ordered by dependency, not schedule. The current release checklist lives separately in
[../todo.md](../todo.md).

Phase 0 comes first on purpose. The system-design questions below must be answered before
further ranking or map features are built on top of the current base.

## Phase 0 — System design review and decisions

Goal: verify current risks against the deployed projects and decide the target
architecture. This is an inspection and decision phase, not a feature phase.

### Evidence-backed risks (visible in this repo)

| Area | Evidence | Why it matters |
|------|----------|----------------|
| Service-role bypass of RLS | `src/app/listing-actions.ts` and `src/services/listing-service.ts` mutate through service-role RPCs; `007` revoked direct public writes on `lemonades` | RLS does not protect app traffic; every mutation must be validated in its RPC (Zod runs in the action as well) |
| Identity is cookie-only | `src/lib/browser-identity.ts` issues an HttpOnly `limo_browser_id`; ratings/votes are unique per browser | Clearing cookies or switching browsers resets the identity, so one-vote enforcement is not per person |
| In-process upload rate limiting | `src/lib/upload-guard.ts` token bucket lives in one Node process; `POST /api/uploads` also checks MIME, magic bytes, and the shared 10MB cap (`src/lib/upload-limits.ts`) | A multi-instance deployment shares no budget, and scripted clients can still consume Cloudinary quota within the limit |
| Legacy storage carry-over | `009` drops `002`'s public write policies; the REVOKE is a no-op on Supabase and public read stays for old `image_url` values | Legacy buckets remain a read surface, and admin image deletion still needs a reviewed design |
| No admin/moderation path | No edit/delete/moderation exists; `dev`'s admin line conflicts with the `007` revokes (see [../DEPLOYMENT.md](../DEPLOYMENT.md)) | Duplicates and abuse can only be repaired by migration |
| Thin anti-abuse semantics | `lemonade_ratings` and `matchup_votes` (`007`) enforce one row per browser via RPCs (`008`), but there are no vote rate limits, anomaly checks, or sybil resistance | Matchup percentages and `avg_score` are only as trustworthy as the browser identity |

### Needs verification (against staging/prod Supabase)

- Applied migration history on staging and production. The staging run for `007`–`009`
  failed before applying anything (empty `SUPABASE_ACCESS_TOKEN`); production has not
  been migrated by this work.
- Actual RLS and storage policies on the hosted projects — they may not match the
  migration files.
- Whether `idx_lemonades_visible_score` exists once `007` is applied. Migration `001`
  created an index on `overall_score`, `003` dropped and re-added that column (dropping
  its index), and `007` adds the merged-filtered replacement.
- Whether legacy `limo-images`/`lemonade-images` buckets still hold objects referenced by
  `image_url` in production rows.
- Cloudinary plan limits and whether old uploads need cleanup.

### Decisions to record

- Write path: decided — service-role writes with app validation plus `SECURITY DEFINER`
  RPC validation (implemented). Where distributed rate limiting lives remains open.
- Upload controls: partially decided — aligned 10MB cap, magic-byte sniffing, and an
  in-process limit are implemented; shared storage, Cloudinary restrictions, and orphan
  cleanup are open.
- Identity/attribution: partially decided — an opaque browser cookie is the current
  mechanism; durable identity (token or accounts) and one-vote-per-person enforcement are
  open.
- Ranking model: decided for now — mean `avg_score` with competition ranks, legacy and
  visitor ratings kept distinct in `listing_summaries`. Minimum-vote threshold, further
  tie-breaks, and self-rating treatment remain open.
- Location model and privacy stance: open — normalized place IDs/coordinates, display
  precision, consent.

Exit criteria:

- Decisions written as durable docs under `docs/` (for example ADRs); this document
  records the interim decisions above.
- Current DB/storage state verified with recorded evidence (queries and results),
  including index status and legacy policy/bucket state.
- Prioritized hardening backlog with acceptance criteria; no unresolved abuse-control
  questions left before phase 2's remaining anti-abuse work.

## Phase 1 — Safe, extensible foundations

Goal: implement the phase 0 decisions so later features don't build on an abusable base.

Shipped so far: anonymous direct writes removed (`007`); legacy storage write policies
removed with public read kept (`009`); upload size limits aligned, uploads sniffed and
rate-limited; mutations routed through validated service-role RPCs (`008`); leaderboard
reads bounded with search and top-20/show-all pagination.

Remaining (depends on phase 0 decisions): shared multi-instance rate/abuse storage;
durable identity/attribution; an edit/delete/moderation path; staging/production migration
verification and recorded state.

Exit criteria:

- Anonymous direct-write surface removed or explicitly limited with documented rationale.
- Storage policies restricted to intended operations.
- Rate/abuse controls active on add and upload paths, covered by tests.
- Leaderboard query verified indexed and bounded (pagination or a documented cap).
- Identity/attribution in place; a moderation/removal path exists.
- `npm run check` green; migrations applied and verified on staging.

## Phase 2 — Community votes and rankings

Goal: rank lemonades by many users instead of only the submitter's self-score.

Shipped: dedicated `lemonade_ratings` model; one rating per browser per listing with
replace-on-repeat; combined `avg_score` aggregation in `listing_summaries` with legacy and
visitor sources kept distinct; `matchup_votes` preferences; first-vote visibility; legacy
self-scores converted into one `source = 'legacy'` rating.

Remaining: vote rate limits and anomaly/sybil resistance; a documented minimum-vote
threshold before a listing counts as ranked crowd data; documented tie-break semantics
beyond `created_at`; handling self-ratings beyond the "provisional" label.

Exit criteria:

- [x] Votes stored in a dedicated model; no client-trusted aggregates.
- [ ] Minimum-vote threshold and full tie-break/outlier semantics documented and tested
      (zero votes, ties, and constrained ranges are covered today).
- [x] One-rating/one-vote enforcement per browser implemented and tested; vote rate
      limits remain open.
- [x] Leaderboard shows the aggregated score and labels legacy/provisional sources
      instead of fabricating crowd data.
- [x] Migration/backfill approach documented and applied locally (`007` backfill).
- [ ] `npm run check` green and E2E covers the vote flow (unit and DB coverage exists;
      no matchup E2E yet).

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

- Phase 1's remaining hardening (shared anti-abuse storage, durable identity, moderation
  path) comes before new feature phases; shipping ratings/votes did not remove those
  requirements.
- Phase 2's remaining anti-abuse work depends on phase 0/1 decisions.
- Nothing here promises shipped features or dates; items can be re-ordered if phase 0
  changes the design.
