# Planning docs

Source-of-truth planning docs:

- [PROJECT.md](PROJECT.md) — product scope, current state, constraints, vision
- [ROADMAP.md](ROADMAP.md) — sequenced phases and exit criteria (system design first)
- [../todo.md](../todo.md) — current release checklist (transient; not a roadmap)

## Working notes

- Workflow: GitHub Flow. Feature branches merge to `staging` for review deploys, then a
  `staging → main` PR promotes to production. The active checklist is [../todo.md](../todo.md).
- CI: GitHub Actions runs lint, typecheck, unit tests, and production build
  (`.github/workflows/ci.yml`); E2E runs in a second job after quality.
- UI direction: minimal, old-school, information-first.
- Current state: local MVP implemented — anonymous add + self-rating and a global
  sortable leaderboard. No accounts, community votes, or maps yet; see
  [ROADMAP.md](ROADMAP.md).
