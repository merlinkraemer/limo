# Planning docs

Source-of-truth planning docs:

- [PROJECT.md](PROJECT.md) — product scope, current state, constraints, vision
- [ROADMAP.md](ROADMAP.md) — sequenced phases and exit criteria (system design first)
- [../todo.md](../todo.md) — current release checklist (transient; not a roadmap)

## Working notes

- Workflow: GitHub Flow. Feature branches merge to `staging` for review deploys, then a
  `staging → main` PR promotes to production. The active checklist is [../todo.md](../todo.md).
- CI: GitHub Actions runs lint, typecheck, unit tests, and production build
  (`.github/workflows/ci.yml`); a `db` job runs the migration/RLS/RPC harness, and E2E
  runs in a third job after quality.
- UI direction: minimal, old-school, information-first.
- Current state: the redesign is implemented and committed locally — anonymous add with
  search/duplicate routing, visitor ratings (1–10 score + optional traits), one converted
  legacy rating per historical row, matchup preference votes, and a ranked global
  leaderboard with top-20/show-all pagination. No accounts, edit/delete, moderation, or
  maps yet. Migrations `007`–`009` are on `origin/staging` but the staging migration run
  failed before applying them, and production is not deployed with this work; see
  [../DEPLOYMENT.md](../DEPLOYMENT.md).
