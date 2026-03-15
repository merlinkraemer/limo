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
| Preview | other branches | Local/preview DB |

Configure env vars in Vercel dashboard per environment.

## Manual Deploy

```bash
npm run env:staging && vercel      # Deploy to preview
npm run env:prod && vercel --prod  # Deploy to production
```
