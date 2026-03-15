# Supabase Setup Instructions

This directory contains database migrations and configuration for the Limo project.

## Environments

| Env | Project | Branch | Switch |
|-----|---------|--------|--------|
| Local | `supabase start` | any | `npm run env:dev` |
| Staging | `limo-staging` | `staging` | `npm run env:staging` |
| Production | `limo-prod` | `main` | `npm run env:prod` |

Migrations auto-deploy on push via GitHub Actions (see `.github/workflows/db-migrate.yml`).

## Manual Migration

```bash
npm run db:push:staging  # Push to staging
npm run db:push:prod     # Push to production
```

## Storage Bucket Setup

Create a storage bucket for limo images:

1. **Preferred: run the repo migrations**
   - `supabase db push`
   - This now creates the `limo-images` bucket and public policies automatically.

2. **If you need to create it manually, go to Storage** in Supabase Dashboard
   - Click "New bucket"
   - Name it: `limo-images`
   - Make it **Public** (uncheck "Private bucket")
   - Click "Create bucket"

3. **Configure bucket policies:**
   - Click the newly created bucket
   - Go to "Policies"
   - Click "New Policy"
   - Choose "Get started quickly" → "Full access"
   - Click "Review" → "Use this template"
   - Save the policy

4. **Verify bucket is working:**
   - You should see a public URL for the bucket
   - Test by uploading an image through the Supabase Dashboard

## Verification

After setup, verify everything works:

```bash
# Check database connection (after setting up .env.local)
npm run dev
```

Your app should now be able to:
- Connect to Supabase
- Insert lemonade entries into the database
- Upload images to the `limo-images` bucket

## Troubleshooting

**Migration fails:**
- Check that you have the correct project ID in `supabase/config.toml`
- Ensure you're logged in to Supabase CLI

**Storage upload fails:**
- Verify the bucket name is `limo-images`
- Or set `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` if your project still uses a custom or legacy bucket name
- Check that RLS policies allow anonymous writes
- Ensure bucket is public

**Environment variables not working:**
- Restart dev server after updating `.env.local`
- Verify variable names match exactly (case-sensitive)
