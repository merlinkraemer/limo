limo leaderboard! 

dev stuff

```bash
npm run dev      # Starts Supabase + Next.js, opens browser
npm run check    # Lint, typecheck, tests, build with summary
```

First time: `npm install`, then `supabase start` and copy credentials to `.env.local`.

stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Supabase (DB + storage)
- Vitest (unit tests)

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
| `npm run build` | Production build |

docs
- `docs/planning/` — roadmap, status, workflow
