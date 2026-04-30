# Cloudinary CDN integration — staging → main

PR: https://github.com/merlinkraemer/limo/pull/24

## What was done

### Code (branch `feat/cloudinary-uploads`, now on `staging`)
- Added `cloudinary` SDK
- New `src/lib/cloudinary.ts` — lazy-configured server SDK client (env-driven)
- Rewrote `src/app/api/uploads/route.ts` — streams files to Cloudinary into `CLOUDINARY_UPLOAD_FOLDER` (default `limo/uploads`), validates type + 10MB cap
- Updated `src/lib/image-url.ts` — accepts `https://res.cloudinary.com/<cloud>/...` alongside existing Supabase URLs (old DB rows still validate)
- Tests + typecheck green

### Infrastructure
- **Vercel Preview** envs added (scope: all preview branches):
  - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_FOLDER`
- **Vercel Preview** Supabase envs **repointed**: previously `Preview (staging)` was pointing at the **prod** Supabase project. Now scoped to all preview branches and pointing at the dedicated `limo-staging` project. Used legacy JWT keys.
- **Supabase `limo-staging`** unpaused (free tier auto-paused after inactivity), schema verified up-to-date, empty data
- `staging` branch fast-forwarded from `main + Cloudinary commit` (was 10 commits behind main, 0 ahead)

### Workflow established
- Feature branches → merge to `staging` for live review deploy → PR `staging → main` for prod promotion
- All preview branches now get a working app (staging Supabase + Cloudinary)

## To merge staging → main

### Before merging PR #24
- [ ] **Smoke-test the Vercel preview URL on PR #24**
  - Lemonade list loads
  - Add a new lemonade with image upload
  - Returned image URL is `https://res.cloudinary.com/<cloud-name>/...`
  - Asset appears in Cloudinary console under `limo/uploads/`
  - Existing Supabase-hosted lemonade images (if any) still render
- [ ] **Get colleague greenlight** on PR #24
- [ ] **Add 4× Cloudinary env vars to Vercel `Production` scope** (currently only set for `Preview`). Pull the four values from the Vercel `Preview` env or the Cloudinary console — do not paste them into this doc:
  ```
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
  CLOUDINARY_API_KEY=...
  CLOUDINARY_API_SECRET=...
  CLOUDINARY_UPLOAD_FOLDER=limo/uploads
  ```
  CLI: `npx vercel@latest env add <NAME> production --value <value> --yes`

### Merging
- [ ] Merge PR #24 (staging → main) — squash or merge commit, your call
- [ ] Verify production deploy succeeds and prod upload works (one test upload, then delete the test row)

### After merge
- [ ] **Rotate the `limo-staging` Supabase DB password** — was shared in chat during this session. Dashboard: Settings → Database → Reset password
- [ ] Close issue #4 (Cloudinary integration)
- [ ] Update issue #19 ("staging db push checklist") with the actual flow now that staging is wired up properly, or close if obsolete

## Deferred (separate PRs)

- **Infisical migration** — `infisical.morizk.de` was offline when secrets were configured. Once the origin is back, move all `CLOUDINARY_*` and `NEXT_PUBLIC_CLOUDINARY_*` from Vercel + `.env.local` into Infisical, update `package.json` scripts to use `infisical run`.
- **`next/image` + Cloudinary URL transforms** — current uploads return raw `secure_url`. The actual perf win comes from serving `…/upload/f_auto,q_auto,w_<size>/…` through `next/image`. Roughly:
  - Add `res.cloudinary.com` to `next.config.ts` `images.remotePatterns`
  - Wrap relevant `<img>` usages in `<Image>`
  - Optionally inject `f_auto,q_auto` into the URL at render time
- **Migrate existing Supabase Storage images to Cloudinary** — optional. The dual-host validator means it's not required.

## Reference

- Cloudinary console: https://console.cloudinary.com/
- Supabase staging dashboard: see Vercel env / Supabase account
- Vercel project: https://vercel.com/merlinkraemer/limo
- Infisical (when up): see team docs
