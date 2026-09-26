# Supabase Setup Instructions

This directory contains the Supabase configuration, Postgres migrations, and seed data
for limo/lemolist. Supabase is the app's database.

Photo uploads are **not** handled by Supabase Storage: the current upload path is
Cloudinary via `POST /api/uploads` (see [`.env.example`](../.env.example) for the
required variables). The `limo-images` bucket created by migration `002` is a legacy
artifact kept for historical rows — see
[Image storage (legacy bucket)](#image-storage-legacy-bucket).

## Local development

Prerequisites: Docker and the Supabase CLI (`npm install -g supabase`).

1. **Start Supabase**
   - Run `supabase start`.
   - First start creates the local Postgres/Studio/Storage containers and applies the
     migrations in `supabase/migrations/`.
2. **Configure environment variables**
   - Copy the template: `cp .env.example .env.local`.
   - `supabase status` prints the local `API URL`, `anon key`, and `service_role key`.
   - Fill in the Supabase values, plus the Cloudinary values if you want to test photo
     uploads.
3. **Run the app**
   - `npm run dev` starts Supabase if it is not already running, then Next.js on
     http://localhost:4777.

Useful local commands:

| Command | Effect |
|---------|--------|
| `npm run test:db` | Apply `007`/`008` repeatedly over production-like fixtures and assert backfill, merge, RPC, RLS, photo and vote behavior (requires `supabase start` + `psql`) |
| `supabase status` | Show local URLs/keys and whether the stack is running |
| `supabase db reset` | Recreate the local database from all migrations, then load `supabase/seed.sql` |
| `supabase db reset --no-seed` | Same without seed data (used by `npm run test:e2e`) |
| `supabase migration up` | Apply pending migrations without resetting the database |

## Hosted project setup

1. **Create a Supabase project**
   - Go to the [Supabase Dashboard](https://supabase.com/dashboard) → "New Project".
2. **Configure environment variables** (Project Settings → API)
   - `NEXT_PUBLIC_SUPABASE_URL` — Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY` — service_role key; server-only, bypasses RLS, keep it
     secret
   - Put these in `.env.local` (gitignored) or your host's environment settings.
3. **Apply the migrations** — see below. `supabase db push` is recommended; run the SQL
   files in order if you apply them manually.

### Migrations

Apply every file in `supabase/migrations/` in filename order. The files are cumulative:

| File | Effect |
|------|--------|
| `001_create_lemonades_table.sql` | Creates `public.lemonades`, enables RLS with public read/insert policies, adds the `updated_at` trigger |
| `002_create_limo_images_bucket.sql` | Creates the legacy public `limo-images` Storage bucket and public object policies covering `limo-images` and the older `lemonade-images` bucket |
| `003_weighted_overall_score.sql` | Drops and re-adds `overall_score` as the weighted `flavor * 0.65 + sourness * 0.35` generated column (legacy rows only after `007`) |
| `004_add_added_by_column.sql` | Adds the `added_by` column |
| `007_ratings_merges_and_votes.sql` | Adds community ratings, duplicate-merge bookkeeping, matchup votes, RLS/grants lockdown, and the historical-score backfill (see [Data model](#data-model-ratings-provenance-and-duplicates)) |
| `008_rating_rpcs_and_read_models.sql` | Adds the `listing_summaries` read model and the validated, transactional RPCs the app calls |
| `009_lock_down_legacy_storage_writes.sql` | Drops the legacy public Storage write policies and attempts to revoke `INSERT`/`UPDATE`/`DELETE` on `storage.objects` from `anon`/`authenticated`; RLS default-deny enforces the lockdown, public read stays (robust to a missing `storage.objects`/policies) |

> **Numbering:** `005` and `006` are reserved by the admin/RLS line on the `dev` branch
> (`005_admin_update_delete_policies.sql`, `006_authenticated_storage_delete.sql`). The
> redesign migrations were numbered `007`/`008` so version prefixes stay unique when the
> lines merge. Never reuse `005`/`006` for different content.

- **Recommended (CLI):** `supabase login`, `supabase link --project-ref YOUR_PROJECT_ID`,
  then `supabase db push`.
- **Manual (Dashboard SQL Editor):** create a new query, paste each file's contents, and
  run them in order (`001` → `009`, skipping the reserved `005`/`006`). Running only `001`
  leaves the database without the weighted overall score and the `added_by` column.

Migration files are append-only: never edit an applied migration, add a new one instead.
`007` and `008` are written idempotently (safe to re-run); `001`–`004` are not.

### Data model: ratings, provenance and duplicates

- **Legacy metrics stay intact.** Historical rows keep `flavor_rating`, `sourness_rating`
  and the generated `overall_score`. Migration `007` makes the two rating columns
  nullable so new listings can store no self-reported metrics; for those rows
  `overall_score` is `NULL`.
- **Backfill (historical score provenance).** `007` gives every canonical historical
  listing exactly one `lemonade_ratings` row with `source = 'legacy'`, `score` equal to
  the row's historical `overall_score`, and the original `created_at`. The backfill is
  idempotent (partial unique index + `ON CONFLICT DO NOTHING`) and invents no traits,
  comments, or extra ratings.
- **Visitor ratings.** New ratings are integer `score` 1–10 with four optional 0–3 traits
  (`trait_sour`, `trait_sweet`, `trait_fizz`, `trait_fruity`), an optional ≤140-character
  comment, and `source = 'visitor'`. Visitor rows carry a keyed browser identity and are
  unique per `(listing, browser)`; repeat ratings replace the previous one.
- **Read model.** `listing_summaries` is one row per canonical listing with truthful
  aggregates: `legacy_score`, `visitor_avg_score`, combined `avg_score`, rating counts,
  and per-trait averages/counts. Score display always names its source; a listing with a
  single visitor rating shows count 1 and is explicitly provisional — the app never
  fabricates crowd data.
- **Duplicate merges.** `lemonades.merged_into` (self-FK) plus `merge_reason` alias a
  duplicate to the canonical row instead of deleting it. The Twister duplicate is merged
  into the photo-bearing row and keeps `source = 'legacy'` ratings out of the loser. The
  canonical row wins the `lemonades_canonical_name_unique` index; aliases are excluded
  from public lists and aggregates.
- **Matchup votes.** `matchup_votes` stores one real preference pick per browser per
  canonical unordered pair, with a `picked`-must-be-in-pair constraint. Poll percentages
  and counts come only from these rows — never from quality scores.

### Anonymous access and RLS policy

- The site is public to **read**: `anon`/`authenticated` keep `SELECT` on
  `public.lemonades` (the table holds only public content) and legacy storage object read.
- Public **writes are revoked**: `007` drops the `Enable insert for all users` policy and
  revokes `INSERT`/`UPDATE`/`DELETE` on `lemonades`, and denies all access to
  `lemonade_ratings` and `matchup_votes`. `listing_summaries` and the RPCs are likewise
  unavailable to `anon`/`authenticated`.
- The legacy Storage surface is also write-locked: `009` drops migration `002`'s public
  `INSERT`/`UPDATE`/`DELETE` policies and attempts to revoke the matching table
  privileges on `storage.objects`. On Supabase the table is owned by
  `supabase_storage_admin`, so the REVOKE is a no-op there; RLS stays enabled with no
  permissive write policy, which is what denies anonymous writes. Public object read
  (and therefore old `image_url` values) keeps working.
- All mutations go through `SECURITY DEFINER` RPCs (`create_lemonade_with_rating`,
  `rate_lemonade`, `set_lemonade_photo`, `cast_matchup_vote`, …) called server-side with
  the service role, which validates input and enforces limits. The service-role key is
  server-only; never expose it to the browser.
- RLS is never weakened to work around a migration problem. If a new mutation is needed,
  add a validated service-role RPC.

### Image policy

- **New uploads** go to Cloudinary via `POST /api/uploads`. The route and the client
  helper share one 10MB cap (`src/lib/upload-limits.ts`), and the route sniffs magic
  bytes so a spoofed `file.type` cannot smuggle a non-image to Cloudinary. Bursts are
  throttled in-process per client IP and anonymous browser id. Unsupported image hosts
  are rejected by `src/lib/image-url.ts`.
- **Legacy Supabase Storage URLs** are still accepted and displayed; migration `002`'s
  bucket stays for historical rows, but `009` revokes public writes so the bucket is
  read-only. Do not upload new images there.
- **First photo wins:** attaching a photo to an existing listing is only allowed while
  `image_url IS NULL`, and the update is atomic so concurrent submissions cannot replace
  an existing photo.

These instructions describe the repository migrations. Whether a particular hosted
project matches them depends on which migrations have been applied there; nothing here
asserts the state of the production project.

## Image storage (legacy bucket)

- **Current uploads:** `POST /api/uploads` streams images to Cloudinary and returns the
  `secure_url` stored in `lemonades.image_url` (see `src/app/api/uploads/route.ts`).
  `src/lib/supabase/storage.ts` is the client helper for that endpoint, despite its name.
- **Legacy Supabase Storage:** migration `002` creates a public `limo-images` bucket and
  public object policies for `limo-images` and `lemonade-images`. Migration `009` removes
  the public write policies and revokes write privileges, leaving public read so images
  on older rows still resolve; `src/lib/image-url.ts` accepts Supabase public-storage
  URLs for the same reason.
- **Do not set up new uploads against Supabase Storage.** No bucket, RLS policy, or
  environment variable is needed for current uploads — they use Cloudinary only.
- The `[storage]` section in `supabase/config.toml` exists for the local stack; the app
  does not upload through it.

## Environment variables

Supabase (from `supabase status` locally or Project Settings → API):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (browser + server) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (browser client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used by the app; bypasses RLS — never expose it to the browser |

Cloudinary variables are required for photo uploads; see [`../.env.example`](../.env.example)
and the [root README](../README.md).

## Verification

After setup:

```bash
supabase status   # stack is running, keys available
npm run dev       # Supabase + Next.js on port 4777
```

The app should connect to Supabase and insert/list lemonades on the leaderboard. A photo
upload should return a Cloudinary URL from `POST /api/uploads`; Supabase Storage only
matters when displaying legacy image URLs.

## Troubleshooting

**Migration fails**
- Verify the project reference in `supabase/config.toml` and that you are logged in and
  linked to the intended project (`supabase login`, `supabase link --project-ref ...`).
- Check that the migrations were applied in order; `003` drops and recreates
  `overall_score` and depends on `001`.

**Supabase connection fails**
- Run `supabase status`; make sure `.env.local` contains the current URL and keys.
- Restart the dev server after changing `.env.local`; variable names are case-sensitive.

**Photo upload fails**
- This is the Cloudinary path, not a Supabase Storage/RLS path: check the
  `CLOUDINARY_*` / `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` variables and the server logs.
- `POST /api/uploads` accepts jpeg/png/webp/avif up to 10MB
  (`src/app/api/uploads/route.ts`), rate limits bursts per IP/browser, and validates the
  file's magic bytes before calling Cloudinary.

**Local database in a bad state**
- `supabase db reset` recreates it from the migrations (this deletes local data); add
  `--no-seed` to skip `supabase/seed.sql`.

## Related docs

- [../README.md](../README.md) — quickstart, stack, scripts
- [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) — staging/production topology and the
  migration-first commit strategy
- [../docs/TESTING.md](../docs/TESTING.md) — test setup, DB state, E2E ordering
- [../docs/planning/PROJECT.md](../docs/planning/PROJECT.md) — product scope and constraints
