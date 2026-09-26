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
npm run test:db       # migration/backfill/RLS/RPC harness (needs supabase start + psql)
npm run test:e2e      # E2E: starts Supabase + Next.js, runs Playwright
```

## Scope reminder

Shipped today: anonymous add (search first, duplicate warning routes to the existing
listing) and visitor ratings on a 1–10 score with four optional traits; one converted
legacy rating per historical row; real matchup ("yay or nay" / "lemoguesser") preference
votes; a ranked global leaderboard (top 20 + show all, medals, detail sheet) with name
search; Cloudinary photo uploads while legacy Supabase Storage URLs still display.
Accounts and durable identity, edit/delete, admin moderation, maps, and a shared
multi-instance anti-abuse store are future goals (see the roadmap) — don't describe or
assume them as implemented.

State: the redesign app commit `9471805` is on local `feat/cloudinary-uploads` only
(`origin/feat/cloudinary-uploads` is 3 commits behind); migrations `007`–`009` plus
the staging workflow are on `origin/staging`, but that staging migration run failed
before applying anything (empty `SUPABASE_ACCESS_TOKEN`), and production is neither
migrated nor deployed. Don't push to `staging`/`main` or deploy unless the task says so.
