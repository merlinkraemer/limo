# limo / lemolist

[lemolist](https://lemolist.com) is a worldwide, user-submitted lemonade leaderboard.
This repo is the Next.js app behind it.

**What works today**

- Add a lemonade anonymously: name, description, optional photo, city, and submitter name
- Rate your own submission on flavor and sourness (1–10 each)
- Overall score is computed in Postgres as `flavor * 0.65 + sourness * 0.35`
- Sortable global leaderboard with expandable details (photo, description, city, submitter)
- Descriptions support limited markdown: bold, italic, strikethrough, inline code

**Not built yet** (see [docs/planning/ROADMAP.md](docs/planning/ROADMAP.md)): community
votes / independent rankings, user accounts, edit/delete, search/filter, and maps. The
leaderboard reflects self-reported scores only.

## Quickstart

```bash
npm install
supabase start                 # local Postgres (requires Docker)
cp .env.example .env.local     # fill in Supabase + Cloudinary values
npm run dev                    # Next.js on http://localhost:4777, opens browser
```

`supabase start` / `supabase status` provide the Supabase credentials. Uploads need
Cloudinary credentials from https://console.cloudinary.com/. Database and bucket details
are in [supabase/README.md](supabase/README.md).

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Supabase + Next.js dev environment (port 4777) |
| `npm run check` | Lint, typecheck, unit tests, build with summary |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run test` | Vitest unit tests (`npm run test:watch` for watch mode) |
| `npm run test:e2e` | E2E: starts Supabase + Next.js, runs Playwright |
| `npm run test:e2e:local` | Playwright only (requires a running dev server) |
| `npm run build` / `npm start` | Production build / serve |

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Supabase (Postgres) — schema, migrations, and seed in `supabase/`
- Cloudinary — photo uploads via `POST /api/uploads`
- Vitest (unit) and Playwright (E2E)
- GitHub Actions CI (`.github/workflows/ci.yml`): lint, typecheck, unit tests, build, E2E

## Repo layout

```
src/
├── app/
│   ├── actions.ts                   # addLemonade server action (Zod validation)
│   ├── api/uploads/route.ts         # Cloudinary upload endpoint
│   ├── components/Leaderboard.tsx   # table, add form, rules modal, details
│   ├── utils/markdown-format.tsx    # limited markdown renderer
│   ├── layout.tsx
│   └── page.tsx                     # leaderboard page
├── lib/
│   ├── cloudinary.ts                # lazy Cloudinary client
│   ├── image-url.ts                 # allowlist for stored image URLs
│   └── supabase/                    # browser/server/service clients, upload helper
├── services/lemonade-service.ts     # DB read/write
└── types/lemonade.ts                # DB types, Zod form schema

supabase/
├── migrations/                      # 001–004 from the original line, 007/008 redesign; 005/006 reserved on dev
└── seed.sql                         # 20 sample entries

tests/
├── unit/                            # Vitest
└── e2e/                             # Playwright (numbered; order matters)
```

## Docs

Full index: [docs/README.md](docs/README.md).

- [docs/planning/PROJECT.md](docs/planning/PROJECT.md) — product scope, current state, constraints
- [docs/planning/ROADMAP.md](docs/planning/ROADMAP.md) — sequenced future phases and exit criteria
- [docs/TESTING.md](docs/TESTING.md) — testing strategy and conventions
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — staging/production topology, migration-first rollout order
- [supabase/README.md](supabase/README.md) — database and storage setup
- [docs/todo.md](docs/todo.md) — current release checklist
