limo leaderboard! 

dev stuff

```bash
npm run dev      # Starts Supabase + Next.js, opens browser
npm run check    # Lint, typecheck, tests, build with summary
```

First time: `npm install`, then `infisical login` and `supabase start`. Secrets are injected via Infisical — no `.env.local` needed.

stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Supabase (DB + storage)
- Vitest (unit tests)
- Playwright (E2E tests)

tree

```
src/
├── app/
│   ├── api/uploads/   # Upload endpoint
│   ├── layout.tsx     # Root layout
│   └── page.tsx       # Placeholder
├── lib/supabase/      # Supabase clients
├── services/          # Business logic
└── types/             # TypeScript types
```

scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Full dev env |
| `npm run check` | All checks |
| `npm run test` | Unit tests |
| `npm run test:e2e` | E2E tests (starts Supabase + Next.js) |
| `npm run test:e2e:local` | E2E tests only (requires dev server running) |
| `npm run build` | Production build |

docs
- `docs/TESTING.md` — testing strategy, conventions, troubleshooting
- `docs/planning/` — roadmap, status, workflow
