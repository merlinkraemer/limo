# Documentation index

Canonical map of project documentation. Start here; each doc is the source of truth for
its area.

## Product and planning

| Doc | Purpose |
|-----|---------|
| [planning/PROJECT.md](planning/PROJECT.md) | Product scope, current state, constraints, vision |
| [planning/ROADMAP.md](planning/ROADMAP.md) | Sequenced phases with exit criteria (system design first) |
| [planning/README.md](planning/README.md) | Planning index and working notes (workflow, CI) |

## Engineering

| Doc | Purpose |
|-----|---------|
| [TESTING.md](TESTING.md) | Testing strategy, conventions, E2E ordering, CI |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Staging/production topology, migration-first commit strategy, rollout guardrails |
| [../supabase/README.md](../supabase/README.md) | Supabase/Postgres setup, migrations, storage bucket |
| [todo.md](todo.md) | Current release checklist (transient, not a roadmap) |

## Repo entrypoints

- [../README.md](../README.md) — quickstart, stack, scripts, repo layout
- [../AGENTS.md](../AGENTS.md) — agent entrypoint and documentation rules

## Conventions

- Durable documentation lives under `docs/`.
- Temporary task bookkeeping (progress/scratch) stays outside tracked docs in a
  gitignored file.
- Prefer linking over duplicating; when a fact changes, update its source-of-truth doc.
