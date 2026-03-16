# Testing Strategy

How we test this project and how to add tests for new features.

## Overview

| Layer | Tool | Location | Purpose |
|-------|------|----------|---------|
| Unit | Vitest | `tests/unit/**/*.test.ts` | Pure logic, schemas, server actions (mocked) |
| E2E | Playwright | `tests/e2e/**/*.spec.ts` | Full user flows against real app + DB |

## Unit Tests (Vitest)

- **Run:** `npm test` or `npm run test:watch`
- **Config:** `vitest.config.ts`
- **Environment:** Node (no browser)

### What to Test

- **Zod schemas** — validation rules, edge cases
- **Pure functions** — e.g. `isAllowedImageUrl` in `src/lib/image-url.ts`
- **Server actions** — mock `createLemonade`, test validation and error paths; admin actions (`deleteLemonade`, `editLemonade`, `logoutAdmin`) in `tests/unit/admin-actions.test.ts`

### Conventions

- Use `vi.mock()` for Supabase and Next.js (`revalidatePath`, etc.)
- Use `describe` / `it` from vitest
- One test file per source module (e.g. `image-url.test.ts` for `image-url.ts`)

### Example

```ts
// tests/unit/my-module.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/lemonade-service');

import { addLemonade } from '@/app/actions';

describe('addLemonade', () => {
  it('returns error for invalid schema', async () => {
    const result = await addLemonade({ name: 'A', ... });
    expect(result).toHaveProperty('error');
  });
});
```

## E2E Tests (Playwright)

- **Run full (Supabase + Next.js + tests):** `npm run test:e2e`
- **Run only (requires dev server):** `npm run test:e2e:local`
- **Config:** `playwright.config.ts`
- **Script:** `scripts/e2e-ci.mjs` — starts Supabase, applies migrations, starts Next.js, runs Playwright

### Test Order

E2E files run in **alphabetical order**. Numbered prefixes enforce the right sequence:

- `01-smoke.spec.ts` — runs first (page load, empty state)
- `02-add-lemonade.spec.ts` — runs second (adds data to DB)
- `03-login.spec.ts` — login page, invalid credentials, login with test admin and see logout
- `04-admin-delete-edit.spec.ts` — admin edit then delete (depends on 02 for row data)

**Why:** The empty-state test expects no entries. If add-lemonade ran first, it would pollute the DB and the empty-state test would fail.

### Admin E2E

Admin tests (03, 04) need an authenticated user. When you run `npm run test:e2e`, the script creates a test admin user via the Supabase Auth Admin API after `db reset` (using the local Supabase secret key from `supabase status`). It sets `TEST_ADMIN_EMAIL` and `TEST_ADMIN_PASSWORD` in the environment so Playwright can log in. If the secret key is not available, the admin user is not created and 03/04 tests that require it will skip. For `npm run test:e2e:local`, set these env vars yourself if you want admin tests to run (e.g. create a user in Supabase Studio and export the credentials).

### Database State

- **`npm run test:e2e`:** Runs `supabase db reset --no-seed` before tests. DB is clean every run.
- **`npm run test:e2e:local`:** Uses whatever DB state exists. Reset the DB between runs if tests depend on a clean state.

### Conventions

- Use `getByRole` and `getByLabel` over raw CSS when possible
- For table cells that may appear multiple times, use `.first()` to avoid strict-mode violations
- **Overall score formula:** `flavor * 0.65 + sourness * 0.35` (see migration 003). E2E assertions must use the correct value (e.g. flavor 7 + sourness 5 → 6.3, not 6.0)

### Adding a New E2E Test

1. Create `tests/e2e/03-your-feature.spec.ts` (next number)
2. Use `page.goto('/')` and the shared `baseURL` from config
3. Ensure your test doesn’t break others (e.g. don’t assume empty DB if a prior test adds data)

## CI

`.github/workflows/ci.yml`:

1. **quality** — lint, typecheck, unit tests, build
2. **e2e** — runs after quality; uses `supabase/setup-cli`, installs Playwright Chromium, runs `npm run test:e2e`

E2E uses local Supabase (`supabase start` + `db reset`). No staging project or secrets required.
