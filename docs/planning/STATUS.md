# Status

Updated: 2026-03-06

## Overall Status

The app is already beyond the original "not started" plan. The local MVP exists and the baseline repo workflow exists. The next phase is quality and deployment discipline, not core feature construction.

## What Exists Today

### Product

- form for adding limos
- leaderboard rendering
- optional image upload
- optional city field
- score calculation and sort order
- home page that doubles as leaderboard entry point

### Design

- minimal old-school presentation
- ranked list layout
- utilitarian typography
- very low visual complexity

This is already close to the intended Hacker News-like direction, although it is currently a dark variant rather than a literal clone of the classic HN palette.

### Repo and Process

- GitHub Flow documented
- PR template exists
- CI runs on pull requests and on `main`
- unit tests exist for schema and server action behavior
- Playwright smoke coverage exists for the add-limo happy path
- local Supabase setup is documented
- shared staging push rule is documented at a basic level

## What Is Missing

- required branch protection setup in GitHub
- documented preview deployment flow
- documented release and rollback checklist
- synced planning in repo was missing before this update
- deeper integration coverage beyond the initial baseline

## Active Delivery Focus

1. Enable GitHub branch protection with the new required checks
2. Add deeper integration coverage around Supabase and storage
3. Finish deployment and staging docs

## Suggested Near-Term Backlog

- add more integration coverage around storage and Supabase boundaries
- add branch protection and required checks in GitHub
- connect Vercel previews and document env handling
- add release and rollback checklist

## Linear Alignment

Linear already reflects that the first two milestones are effectively done and that deployment work remains open. The repo planning now matches that reality.
