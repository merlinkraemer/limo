# Agent entrypoint — limo / lemolist

lemolist ([lemolist.com](https://lemolist.com)) is a worldwide, user-submitted lemonade
leaderboard. This repo (`limo`) is the Next.js app behind it: Supabase/Postgres stores
entries, Cloudinary hosts uploaded photos.

## Start here

1. Read [docs/README.md](docs/README.md) — canonical documentation index.
2. Read the source-of-truth doc for the task at hand:

| Task | Read first |
|------|------------|
| Product scope, what exists today | [docs/planning/PROJECT.md](docs/planning/PROJECT.md) |
| Future direction, open system-design risks | [docs/planning/ROADMAP.md](docs/planning/ROADMAP.md) |
| Tests, E2E ordering, DB state | [docs/TESTING.md](docs/TESTING.md) |
| Deployment, staging rollout, migration order | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Supabase/Postgres setup, migrations, storage | [supabase/README.md](supabase/README.md) |
| Current release checklist (transient) | [docs/todo.md](docs/todo.md) |

Do not treat `docs/todo.md` as a roadmap; it tracks one release and is expected to be
replaced, not extended.

## Documentation rules

- Durable docs (plans, specs, decisions, findings, runbooks) belong in `docs/`.
- Temporary task bookkeeping (progress, scratch notes) stays out of tracked docs; use a
  gitignored scratch file.
- Update the source-of-truth doc when behavior changes; link to guides instead of
  duplicating them.

## Commands

```bash
npm install
supabase start        # local Postgres (see supabase/README.md)
npm run dev           # Supabase + Next.js on port 4777, opens browser
npm run check         # lint, typecheck, unit tests, build
npm run test:e2e      # E2E: starts Supabase + Next.js, runs Playwright
```

## Scope reminder

Shipped today: anonymous submit + self-reported flavor/sourness rating, a sortable global
leaderboard, optional photo/city/submitter. Community votes, accounts, edit/delete, and
maps are future goals (see the roadmap) — don't describe or assume them as implemented.
