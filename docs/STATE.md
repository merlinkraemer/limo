# limo — state

_Updated: 2026-10-10 by orchestrator. Live state only, max ~80 lines. History → docs/journal.md, facts → memory, long-term → docs/planning/ROADMAP.md._

## Direction
Compass: "Running for fun" — with Mo, used often for logging, needs major improvements someday, no plan. Not a focus project; this thread drains quietly. The live site (lemolist.com, = `origin/main`) is the source of truth.

## Ship target
lemolist.com works well on phones for Mo and strangers logging lemonades. Done for the current queue: repo cleaned up (dev = main, stale branches/worktrees resolved, docs true to the live site), then a mobile polish branch ready for Merlin's review.

## Rulebook
AGENTS.md ## Unattended. Thread-specific limits: holiday 2026-10-30 → 11-16, nothing user-visible lands.

## Waiting on Merlin
1. Force-push local `dev` (= main + state) over `origin/dev` — rec: yes; Q1 found nothing worth porting — branch: `dev` (old line kept as `archive/dev-pre-lab2`)
2. Drill branches `drill/prod-backup` (prod-backup-drill.yml) and `drill/prod-migrate` (db-migrate-production.yml), also on origin — rec: keep until prod-migration path is decided — branch: same names
3. Worktree `limo-prod-deploy` (detached, only holds a `.vercel/` link) — rec: remove — branch: none
4. Stale remotes `feat/cloudinary-uploads` (0 unique), `feat/staging-environment` (old), `docs/tag-based-ratings-idea` (idea doc, PR #22) — rec: delete first two, keep idea PR — needs a push
6. Close issues #19 (staging db push checklist) and #20 (vercel deploy + envs) — rec: close both, obsolete — branch: none
5. Rebuild admin mode on main (old #18 can't port: Leaderboard.tsx gone, RLS changed) — rec: not now

## Queue

### Q1 Reconcile old dev's 6 unique commits with main [landed] [box]
goal: old dev has admin mode (#18), Infisical, staging env/workflow, Leaderboard component extract, service-role-key drop, anon→publishable key rename; none are on main. Decide per commit: already superseded on main / port / drop.
acceptance: table per commit with verdict + reason; ports on a branch off `dev`, unlanded (admin mode is user-visible).
validation: `npm run check`
do not touch: `main`, `staging`, remote branches, migrations.

### Q2 Prune stale branches and worktrees [landed] [box]
goal: `feat/cloudinary-uploads`, `fix/ux-followup`, `fix/ux-image-perf`, `drill/prod-backup`, `drill/prod-migrate`, detached `limo-prod-deploy`, 2 old stashes, gone remotes. Most only add a "mark this checkout" docs commit.
acceptance: list of what is unique per branch/stash; local worktrees with nothing unique removed (tag first, `archive/*`); anything unique → Waiting on Merlin.
validation: `git worktree list`, `git branch -vv`
do not touch: remote branches (deleting them is a push).

### Q3 Docs truth pass [landed] [box]
goal: AGENTS.md "State" paragraph, docs/todo.md (Cloudinary release; PR #24 is merged), README, DEPLOYMENT match what is live; check issues #19/#20 for obsolete ones.
acceptance: docs describe main as live; todo.md replaced or removed; issue verdicts listed (closing them is Merlin's).
validation: `npm run check`
do not touch: code.

### Q4 Local Supabase on lab2 [running] [box]
goal: `supabase` CLI missing after `npm ci`; get `supabase start` + seed running in Docker so `npm run dev`, `test:db`, `test:e2e` and previews work.
acceptance: `npm run test:e2e` green on lab2; `preview start limo web-review` serves with data.
validation: `npm run test:e2e`
do not touch: remote Supabase projects, `.env.local` keys for remote.

### Q5 Mobile polish audit [queued] [box]
goal: headless 375/390px screenshots of every main flow (leaderboard, add, rate, matchup, detail sheet) on the review preview; list issues ranked.
acceptance: issue list with screenshots + a fix branch for the top items, unlanded.
validation: `npm run check`, Playwright mobile viewport
do not touch: data/schema.

### Q6 [mac] recon of Mac-only files [queued] [mac]
goal: Mac checkout + sibling worktrees: anything bulky or Mac-only left (output/, logs/, .codex, .pi) worth keeping.
acceptance: list; nothing deleted.

## Rundown
- Q1: old dev's 6 commits all superseded or unportable; nothing to port.
- Q2: removed 2 empty worktrees, 3 empty branches, 2 stashes (all tagged `archive/*`); rest in Waiting on Merlin.
- Q3 landed on dev: docs say main is live, todo.md removed, prod migration state marked unverified. Next: Q4 local Supabase, then Q5 mobile audit.
