# Deployment

## Workflow

```
push staging → CI → DB migrate (staging) → Vercel preview
push main    → CI → DB migrate (prod)    → Vercel production
```

DB migrations only run if `supabase/migrations/**` files changed.

## GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `SUPABASE_ACCESS_TOKEN` | From supabase.com/dashboard/account/tokens |
| `SUPABASE_STAGING_DB_PASSWORD` | Staging DB password |
| `SUPABASE_PRODUCTION_DB_PASSWORD` | Production DB password |

## Vercel Environments

| Environment | Branch | Uses |
|-------------|--------|------|
| Production | `main` | Production DB |
| Preview | `staging` | Staging DB |
| Preview | other branches | Staging/dev DB |

Configure env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) in the Vercel dashboard per environment, or sync from Infisical using the [Infisical Vercel integration](https://infisical.com/docs/integrations/cloud/vercel).

## Manual Deploy

```bash
vercel        # Deploy to preview
vercel --prod # Deploy to production
```
