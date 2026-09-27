# Testing Strategy

How we test this project and how to add tests for new features.

## Overview

| Layer | Tool | Location | Purpose |
|-------|------|----------|---------|
| Unit | Vitest | `tests/unit/**/*.test.ts` | Pure logic, schemas, server actions (mocked) |
| Database | bash + `psql` | `scripts/test-db.sh`, `tests/db/*.sql` | Migration idempotence, backfill/merge, RLS, RPC validation |
| E2E | Playwright | `tests/e2e/**/*.spec.ts` | Full user flows against real app + DB |

## Unit Tests (Vitest)

- **Run:** `npm test` or `npm run test:watch`
- **Config:** `vitest.config.ts`
- **Environment:** Node (no browser)

### What to Test

- **Zod schemas** — validation rules, edge cases
- **Pure functions** — e.g. `isAllowedImageUrl` in `src/lib/image-url.ts`
- **Server actions** — mock the data layer (`@/services/listing-service`), test validation and error paths

### Conventions

- Use `vi.mock()` for Supabase and Next.js (`revalidatePath`, etc.)
- Use `describe` / `it` from vitest
- One test file per source module (e.g. `image-url.test.ts` for `image-url.ts`)

### Example

```ts
// tests/unit/my-module.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/listing-service');

import { addLemonade } from '@/app/actions';

describe('addLemonade', () => {
  it('returns error for invalid schema', async () => {
    const result = await addLemonade({ name: 'A', ... });
    expect(result).toHaveProperty('error');
  });
});
```

## Database Harness

- **Run:** `npm run test:db` (requires `supabase start` and `psql`)
- **What it does:** applies migrations `007`/`008`/`009` three times over
  production-like fixtures (`tests/db/phase_a_fixtures.sql`) and asserts historical
  backfill, the Twister merge guard, nullable legacy metrics, RPC validation/anti-abuse,
  first-photo-wins, vote aggregates, the anon write/read lockdown, and the legacy Storage
  write lockdown from `009`. Idempotent and safe to re-run.
- **State:** inserts fixture rows (including the Twister pair); run `supabase db reset`
  afterwards if you need a pristine local database.

## E2E Tests (Playwright)

- **Run full (Supabase + Next.js + tests):** `npm run test:e2e`
- **Run only (requires dev server):** `npm run test:e2e:local`
- **Config:** `playwright.config.ts`
- **Script:** `scripts/e2e-ci.mjs` — starts Supabase, applies migrations, starts Next.js, runs Playwright

### Test Order

E2E files run in **alphabetical order**. Numbered prefixes enforce the right sequence:

- `01-smoke.spec.ts` — runs first (page load and add-sheet dialog)
- `02-add-lemonade.spec.ts` — runs second (adds data to DB)

**Why:** the numbered prefixes keep the sequence deterministic, and tests that add data
run after the smoke checks. `npm run test:e2e` resets the DB first; `test:e2e:local` does
not, so don't assume an empty database in either case.

### Database State

- **`npm run test:e2e`:** Runs `supabase db reset --no-seed` before tests. DB is clean every run.
- **`npm run test:e2e:local`:** Uses whatever DB state exists. Reset the DB between runs if tests depend on a clean state.

### Conventions

- Use `getByRole` and `getByLabel` over raw CSS when possible
- For table cells that may appear multiple times, use `.first()` to avoid strict-mode violations
- **Scores:** visitor ratings are a single integer 1–10 with optional 0–3 traits; legacy rows convert the historical score as `flavor * 0.65 + sourness * 0.35` (migration `007`). New ratings do not use the old two-axis form, so E2E tests pick a star value (e.g. "7 out of 10 stars") and assert the saved state rather than a computed weighted score

### Adding a New E2E Test

1. Create `tests/e2e/03-your-feature.spec.ts` (next number)
2. Use `page.goto('/')` and the shared `baseURL` from config
3. Ensure your test doesn’t break others (e.g. don’t assume empty DB if a prior test adds data)

## CI

`.github/workflows/ci.yml`:

1. **quality** — lint, typecheck, unit tests, build
2. **db** — runs after quality; starts local Supabase, resets it, then runs `npm run test:db`
   (migration/idempotence/RLS/RPC/Storage-lockdown harness)
3. **e2e** — runs after quality; uses `supabase/setup-cli`, installs Playwright Chromium, runs `npm run test:e2e`

E2E and DB jobs use local Supabase (`supabase start` + `db reset`). No staging project or secrets required.
