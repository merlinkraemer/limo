# limo / lemolist

[lemolist](https://lemolist.com) is a worldwide, user-submitted lemonade leaderboard.
This repo is the Next.js app behind it.

**What works today**

- Add a lemonade anonymously (name required; description, photo, city, and submitter
  name optional) or rate one that already exists — the add flow searches first, warns
  about duplicate names, and routes to the existing listing
- Visitor ratings are one 1–10 score plus four optional 0–3 traits (sour, sweet, fizz,
  fruity) and an optional ≤140-character comment; one rating per browser per listing,
  and re-rating replaces the previous score
- Historical rows keep their old self-reported score as one converted
  `source = 'legacy'` rating (`flavor * 0.65 + sourness * 0.35`); the detail sheet names
  the score source (legacy, provisional, or community) instead of inventing a crowd
- Ranked global leaderboard on `/`: automatic rank by combined average with ties sharing
  the best rank, top 20 by default with "show all", medals for the top three, and a
  detail sheet (photo, plain-text description, city, date, submitter, traits)
- "yay or nay" / "lemoguesser": pick a real preference between two lemonades; poll
  percentages and counts come only from stored matchup votes
- Photos upload to Cloudinary via `POST /api/uploads` (jpeg/png/webp/avif, shared 10MB
  cap, magic-byte sniffing, in-process rate limit); legacy Supabase Storage URLs still
  display

**Not built yet** (see [docs/planning/ROADMAP.md](docs/planning/ROADMAP.md)): user
accounts and durable identity, edit/delete and admin moderation, a shared (multi-instance)
anti-abuse store, search filters, and maps. Ratings and matchup votes are deduplicated by
an HttpOnly browser cookie only — clearing cookies resets it — and upload rate limiting is
in-process and best-effort.

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
| `npm run test:db` | Migration/backfill/RLS/RPC harness (requires `supabase start` + `psql`) |
| `npm run test:e2e` | E2E: starts Supabase + Next.js, runs Playwright |
| `npm run test:e2e:local` | Playwright only (requires a running dev server) |
| `npm run build` / `npm start` | Production build / serve |

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Supabase (Postgres) — schema, migrations, and seed in `supabase/`
- Cloudinary — photo uploads via `POST /api/uploads`
- Vitest (unit) and Playwright (E2E)
- GitHub Actions CI (`.github/workflows/ci.yml`): lint, typecheck, unit tests, build, E2E, and the migration/RLS/RPC harness (`db` job)

## Repo layout

```
src/
├── app/
│   ├── actions.ts                   # transitional addLemonade bridge for the legacy form
│   ├── listing-actions.ts           # validated server actions for the redesigned UI
│   ├── api/uploads/route.ts         # Cloudinary upload endpoint
│   ├── components/LemoApp.tsx       # leaderboard, add/rate sheet, detail, game
│   ├── components/layer-stack.ts    # layer/sheet history helper
│   ├── layout.tsx
│   └── page.tsx                     # loads listing summaries for the leaderboard
├── lib/
│   ├── browser-identity.ts          # HttpOnly browser-id cookie (rating/vote dedup)
│   ├── cloudinary.ts                # lazy Cloudinary client
│   ├── image-url.ts                 # allowlist for stored image URLs
│   ├── listing-metrics.ts           # ranking, provisional state, score labels
│   ├── matchup.ts                   # deterministic matchup deck and outcomes
│   ├── upload-guard.ts              # in-process rate limit + magic-byte sniffing
│   ├── upload-limits.ts             # shared 10MB cap and upload messages
│   └── supabase/                    # browser/server/service clients, upload helper
├── services/
│   ├── listing-service.ts           # live data layer: listing_summaries + RPCs
│   └── lemonade-service.ts          # legacy read helper (unused by the app)
└── types/lemonade.ts                # DB types, Zod schemas

supabase/
├── migrations/                      # 001–004 original line; 007–009 redesign; 005/006 reserved on dev
└── seed.sql                         # 20 sample entries

tests/
├── unit/                            # Vitest
├── db/                              # bash + psql migration/RLS/RPC harness
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
