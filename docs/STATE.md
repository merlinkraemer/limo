# limo — state

_Updated: 2026-10-10 by orchestrator. Live state only, max ~80 lines. History → docs/journal.md, facts → memory, long-term → docs/planning/ROADMAP.md._

## Direction
Compass: "Running for fun" — with Mo, used often for logging, needs major improvements someday, no plan. Not a focus project; this thread drains quietly. The live site (lemolist.com, = `origin/main`) is the source of truth.

## Ship target
lemolist.com works well on phones for Mo and strangers logging lemonades. Done for the current queue: repo cleaned up (dev = main, stale branches/worktrees resolved, docs true to the live site), then a mobile polish branch ready for Merlin's review.

## Rulebook
AGENTS.md ## Unattended. Thread-specific limits: holiday 2026-10-30 → 11-16, nothing user-visible lands.

## Waiting on Merlin
1. Land mobile polish (3 CSS bug fixes: start-page sideways scroll, broken-photo label overflow, comment tap target) — rec: land after holiday review on a phone — branch: `q5/mobile-polish` (audit doc + before/after screenshots in docs/mobile-audit-2026-10.md)
2. Mobile design proposals: score stars in 2 rows of 5, sticky submit on sheets, shorter game cards — rec: stars yes, others later — branch: none (in audit doc)
Parked: admin mode rebuild (not now). Drill branches `drill/prod-backup`, `drill/prod-migrate` kept until the prod-migration path is decided.

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

### Q4 Local Supabase on lab2 [landed] [box]
goal: `supabase` CLI missing after `npm ci`; get `supabase start` + seed running in Docker so `npm run dev`, `test:db`, `test:e2e` and previews work.
acceptance: `npm run test:e2e` green on lab2; `preview start limo web-review` serves with data.
validation: `npm run test:e2e`
do not touch: remote Supabase projects, `.env.local` keys for remote.

### Q5 Mobile polish audit [landed] [box]
goal: headless 375/390px screenshots of every main flow (leaderboard, add, rate, matchup, detail sheet) on the review preview; list issues ranked.
acceptance: issue list with screenshots + a fix branch for the top items, unlanded.
validation: `npm run check`, Playwright mobile viewport
do not touch: data/schema.

### Q7 Quick-rate e2e failure [landed] [box]
goal: `tests/e2e/07-quick-rate.spec.ts:87` fails on lab2 (re-rating shows 2/10, expects 9/10); find root cause, fix on `q7/quick-rate-e2e`.
acceptance: root cause + spec green; app fix stays unlanded (user-visible).
validation: `npm run check` + spec
do not touch: migrations, remote Supabase.

### Q6 [mac] recon of Mac-only files [queued] [mac]
goal: Mac checkout + sibling worktrees: anything bulky or Mac-only left (output/, logs/, .codex, .pi) worth keeping.
acceptance: list; nothing deleted.

## Rundown
- Cleanup done: old dev reconciled, stale branches/worktrees/remotes gone, docs say main is live, `origin/dev` = main + cleanup.
- Q4: local Supabase runs on lab2 (CLI via `node_modules/.bin`, slim stack); test:db green, e2e 24/25, review preview serves on :4178.
- Box is RAM-tight (7.6 GB, swap full): run one browser-heavy worker at a time.
- Q7 landed: e2e failure was a test bug (game pairs reshuffle after refresh); spec fixed, app untouched.
- Q5 done: audit + 3 CSS fixes on `q5/mobile-polish`, unlanded (user-visible). 3 design proposals in the doc.
- Q8 landed: 01-smoke selector now matches the visible header button; test-only.
- Queue empty except Q6 [mac]; next work waits on Merlin's mobile decisions.
