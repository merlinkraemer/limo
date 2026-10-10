# Planning docs

Source-of-truth planning docs:

- [PROJECT.md](PROJECT.md) — product scope, current state, constraints, vision
- [ROADMAP.md](ROADMAP.md) — sequenced phases and exit criteria (system design first)

## Working notes

- Workflow: GitHub Flow. Feature branches merge to `staging` for review deploys, then a
  `staging → main` PR promotes to production.
- CI: GitHub Actions runs lint, typecheck, unit tests, and production build
  (`.github/workflows/ci.yml`); a `db` job runs the migration/RLS/RPC harness, and E2E
  runs in a third job after quality.
- UI direction: minimal, old-school, information-first.
- Current state: `origin/main` (live) has the redesign — anonymous add with
  search/duplicate routing, visitor ratings (1–10 score + optional traits), one converted
  legacy rating per historical row, matchup preference votes, a ranked global
  leaderboard with top-20/show-all pagination, quick-rate, and Cloudinary uploads. No
  accounts, edit/delete, moderation, or maps yet. Hosted migration state is unverified
  from the repo; see [../DEPLOYMENT.md](../DEPLOYMENT.md).
