# Deployment

How limo/lemolist code and database migrations reach staging and production. Read this
together with [supabase/README.md](../supabase/README.md) (migration semantics) and
[docs/TESTING.md](TESTING.md) (pre-push checks).

## Topology

| Target | Git ref | Supabase project | Notes |
|--------|---------|------------------|-------|
| Production | `main` | `mpbpzxkttsqmsaazxbkk` (`lemolist.com`) | Vercel production branch `main`, domain `lemolist.com`; protected branch |
| Staging | `staging` | `xduxzpriixkxrygulgon` (`limo-staging`) | Vercel project `limo`; preview/staging deploy |
| Integration line | `dev` | — | Admin/auth work; owns migrations `005`/`006` (`dev`'s `db-migrate.yml`) |

The redesign migrations are `007`–`009` (after `004`) precisely because `005`/`006` are
taken by the `dev` line. Between them the versions have a gap, which is fine: Supabase
tracks applied versions, not a contiguous sequence. Never renumber an applied migration.

**Merging the `dev` line later:** once `007`–`009` are applied to a project, `dev`'s
`005`/`006` sit below the remote's latest applied version. A plain `supabase db push` will
refuse to apply them out of order. Reconcile on staging first — either renumber `dev`'s
unapplied admin migrations above `009` (preferred, keeps versions monotonic) or use
`supabase db push --include-all` deliberately — and verify
`supabase migration list --linked` before touching production.

### Known `dev`-line conflicts (reconcile before merging `dev`)

This branch does **not** merge `dev`, modify production, or change `dev`'s workflows. The
merge-time breaks below are recorded so the reconciliation is explicit:

1. **`dev`'s production workflow auto-pushes migrations to production on `main`.**
   `dev`'s `.github/workflows/db-migrate.yml` has a job gated only by
   `github.ref == 'refs/heads/main'` that runs `supabase link --project-ref
   mpbpzxkttsqmsaazxbkk` and `supabase db push --linked` with
   `SUPABASE_PRODUCTION_DB_PASSWORD`. As soon as that file reaches `main`, any merged
   migration applies to production with no approval gate — this violates the
   production-approval rule above. Before `dev` merges, gate that job behind a GitHub
   Environment with required reviewers (or delete it), keep
   `.github/workflows/db-migrate-staging.yml` as the only staging path, and verify with
   `git ls-tree origin/main .github/workflows` after the merge.
2. **`dev`'s admin UPDATE/DELETE policies are inert after `007`.**
   `005_admin_update_delete_policies.sql` creates `FOR UPDATE`/`FOR DELETE` policies on
   `public.lemonades TO authenticated`, but `007` revokes `UPDATE`/`DELETE` on
   `lemonades` from `authenticated`. Postgres requires both a policy and the table
   privilege, so `deleteLemonade`/`editLemonade` in `dev:src/app/actions.ts` (anon-key
   cookie client → role `authenticated`) fail with permission denied. Reconcile by
   routing admin mutations through validated service-role RPCs, or by granting the
   narrow privileges deliberately — never by weakening `007`/`009` implicitly.
3. **`dev`'s authenticated Storage delete policy needs a deliberate decision.**
   `006` adds an `authenticated` DELETE policy on `storage.objects`. `009` drops only
   `002`'s public write policies and *attempts* to revoke the write grants; on Supabase
   that REVOKE is a no-op (the grants were made by `supabase_storage_admin`), so `006`
   keeps working there — but it is untested against the new read-only legacy-storage
   posture. Where the revoke does take effect (self-hosted Postgres whose migration role
   owns `storage.objects`), `006` becomes inert. Before merging, decide whether admin
   image deletion stays; re-add it only as part of the same reviewed admin design as
   (2).
4. **The `lemonade-service.ts` admin API was reduced.** This branch's service no longer
   exports `createLemonade`, `deleteLemonade`, `updateLemonade`, or `deleteStorageImage`,
   which `dev:src/app/actions.ts` imports (`src/services/lemonade-service.ts`). A
   straight merge conflicts and breaks typecheck; port the admin path onto this branch's
   rating/merge model instead.

## Migration-first commits (Git auto-deploy race safety)

Vercel deploys on push and GitHub Actions runs migrations on push. They run
**concurrently**, so if one push contains both app code that needs a new schema and the
migration that adds it, Vercel can serve the new frontend against the old database (or
worse, the migration can land half-way through a deploy). There is no ordering guarantee
between the two systems.

**Rule: a commit that changes `supabase/migrations/**` contains nothing else.**

Note: the already-pushed migration-only commit `b91fb0e` also carries
`.github/workflows/db-migrate-staging.yml`. That is workflow config rather than app code,
but it still deviates from this rule — keep new migration commits migration-only so a
schema push never races an app deploy.

Push sequence for any schema change (staging shown; production requires the same ordering
plus explicit approval):

1. **Commit only the migration files.** Message convention: mark them, e.g.
   `db: add listing rating indexes [migration-only]`.
2. **Push to `staging`.** The `db-migrate-staging` workflow applies the pending migrations
   to `limo-staging` (see guardrails below). Vercel may build the migration-only commit
   too — that build ships unchanged app code, so it is harmless.
3. **Wait for the migration workflow to finish green.**
   `gh run list --workflow=db-migrate-staging.yml --branch staging` shows the run; only
   continue after it succeeds. Do not start an app deploy while it is running.
4. **Commit and push the app code in a separate commit/PR.** By now the schema exists, so
   the concurrent Vercel build is safe.

Never mix app code and migrations in one commit on `staging` or `main`. If a fix requires
both, push two commits in the order above. Do not use forced pushes or amend a
migration-only commit after it has been pushed; add a new migration instead.

Before pushing app code, run the local gates (staging pushes do not trigger `ci.yml`):

```bash
npm run check      # lint, typecheck, unit, build
npm run test:db    # migration/backfill/RLS/RPC harness (needs supabase start + psql)
npm run test:e2e   # full browser flows on a fresh local DB
```

## Staging migration workflow

`.github/workflows/db-migrate-staging.yml` is staging-only by construction:

- triggers on `push` to `staging` with `paths: supabase/migrations/**`;
- job guard `github.ref == 'refs/heads/staging'` and a hard-coded
  `STAGING_PROJECT_REF: xduxzpriixkxrygulgon`;
- `supabase link` is pinned to that ref, then the linked `supabase/.temp/project-ref` is
  re-read and must match, otherwise the job aborts;
- runs `supabase migration list --linked` and `supabase db push --linked --dry-run`
  before applying anything;
- uses only `SUPABASE_ACCESS_TOKEN` and `SUPABASE_STAGING_DB_PASSWORD` (existing
  repository secrets). It must never reference `SUPABASE_PRODUCTION_DB_PASSWORD` or the
  production ref `mpbpzxkttsqmsaazxbkk`; secrets are passed via `env` and never echoed
  (no `set -x`, no connection strings in logs);
- serializes runs through `concurrency: supabase-migrations-staging` so two pushes cannot
  push migrations at the same time.

`dev`'s `.github/workflows/db-migrate.yml` is a different file: it has a staging job and a
production job (on `main`). Both files must not be allowed to run for the same staging
push once `dev` merges — reconcile them into the single guarded staging workflow plus a
separately approved production workflow rather than double-applying.

## Rollout status and blockers (staging)

- `origin/staging` HEAD is `b91fb0e`, which already contains migrations `007`–`009` and
  `.github/workflows/db-migrate-staging.yml`.
- The push triggered `db-migrate-staging` run
  [36246209060](https://github.com/merlinkraemer/limo/actions/runs/36246209060), which
  **failed** in "Link staging project" because `SUPABASE_ACCESS_TOKEN` was empty. The job
  aborts before `supabase db push`, so migrations `007`–`009` are not confirmed applied to
  `limo-staging`.
- Unblocking needs the `SUPABASE_ACCESS_TOKEN` repository secret (plus
  `SUPABASE_STAGING_DB_PASSWORD` for the link step). Once set, the workflow prints
  `supabase migration list --linked` and runs `db push --dry-run` before applying
  anything, so a history mismatch (e.g. staging has `dev`'s `005`/`006` while this branch
  does not) fails the run instead of pushing. If that happens, bring the `dev` migration
  files into the local tree under the merge rule above, re-run the dry run, and only then
  apply.
- The redesign app commit `9471805` is not an ancestor of `origin/staging`; it sits on
  local `feat/cloudinary-uploads` (`origin/feat/cloudinary-uploads` is 3 commits behind).
  Do not push app code to staging until the migration workflow is green.
- The local CLI cannot run `supabase migration list --linked` without the staging
  `SUPABASE_DB_PASSWORD`; supply it from a secret manager, never paste it into a tracked
  file or shell history.
- Vercel Git auto-deploy has produced no deployment since 2026-03-30 and no staging
  branch alias exists. Until that integration is confirmed with a throwaway push, treat
  auto-deploy as unavailable and use an explicitly authorized Vercel preview deploy after
  the migration workflow is green. Migration-first ordering applies either way.
- Rotate the staging DB password if it was ever shared outside the secret store, then
  update the `SUPABASE_STAGING_DB_PASSWORD` repository secret.

## Production

Production is **not** migrated or deployed by the staging workflow. Production changes
require: migrations applied to a restored production snapshot or to production itself
under separate approval, `npm run check`/`test:e2e` green, and a PR to the protected
`main` branch. Do not run `supabase db push` against the production project from a
staging run, and do not put the production ref or password into the staging workflow.

Current state: nothing from this work has been applied to production
(`mpbpzxkttsqmsaazxbkk`). The redesign app commit is not on `main` and neither workflow
on `main` pushes migrations, so production still serves the pre-redesign app; the hosted
migration history is not verified in this repo.

## Rollback

Migrations are append-only. Roll back by adding a forward migration, not by editing or
deleting an applied file:

- The `007` historical backfill and the Twister merge are idempotent; re-running them
  changes nothing.
- The duplicate merge is non-destructive: the loser row still exists with `merged_into`
  pointing at the canonical listing. If a merge must be reversed, clear `merged_into` /
  `merge_reason` and drop the canonical-name index in a reviewed migration.
- Schema rollback of `007`–`009` (dropping tables/views/RPCs) would break the deployed
  app; prefer forward fixes.
