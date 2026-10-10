# limo — journal

2026-10-10 orchestrator - moved: Mac → lab2 via move-out/move-in bundle + rsync; 5 worktrees, 2 stashes, ignored files; HEADs match Mac
2026-10-10 orchestrator - decided: Merlin: live site (main) is source of truth; local dev reset to origin/main, old dev kept as archive/dev-pre-lab2
2026-10-10 orchestrator - init: rulebook, STATE.md, hard gates, ports.tsv rows (web 4777, web-review 4178); npm run check green
2026-10-10 orchestrator Q1 spawn: reconcile old dev commits (worktree subagent)
2026-10-10 orchestrator Q2 spawn: stale branch/worktree report, read-only
2026-10-10 orchestrator Q3 spawn: docs truth pass (worktree subagent)
2026-10-10 orchestrator Q1 landed: verdict only, no port; admin rebuild parked for Merlin
2026-10-10 orchestrator Q2 landed: removed limo-ux-fix/followup worktrees, 3 docs-only branches, 2 cli-cache stashes (archive/* tags)
2026-10-10 orchestrator Q4 spawn: local Supabase CLI + docker stack, e2e, review preview
2026-10-10 orchestrator Q3 landed: docs-truth merged into dev (docs only, check green); #19/#20 obsolete → Merlin
2026-10-10 orchestrator - decided: Merlin took all recs: dev force-pushed to origin, stale remotes deleted, prod-deploy worktree removed (archive/prod-deploy), #19/#20 closed, drills kept, admin not now
2026-10-10 orchestrator Q4 landed: local supabase up (slim), psql + chromium installed, test:db green, e2e 24/25
2026-10-10 orchestrator Q7 followup: quick-rate e2e spec fails on lab2 (inside Q4 acceptance: e2e green)
2026-10-10 orchestrator Q7 spawn: root-cause quick-rate e2e
2026-10-10 orchestrator Q7 landed: test-only fix merged into dev (spec green, check green)
2026-10-10 orchestrator Q5 spawn: mobile audit + bug-level fixes on q5/mobile-polish
2026-10-10 orchestrator Q5 blocked: done, user-visible → Waiting on Merlin (branch q5/mobile-polish)
2026-10-10 orchestrator Q8 followup: 01-smoke fails on dev (selector hits hidden .top-actions button); test-only fix
2026-10-10 orchestrator Q8 landed: smoke selector test fix merged into dev (01-smoke 2/2)
