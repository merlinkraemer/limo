# Workflow

## Goal

Use this repo as a small but serious training ground for two-person professional development workflow, without making the app itself more complex than necessary.

## Working Agreement

- keep feature scope small
- keep process quality high
- one issue, one branch, one PR
- no direct commits to `main`
- merge only after review and green checks

## Source of Truth

- Linear tracks actionable work
- `docs/planning/` tracks scope, status, and process rules
- code and tests are the final truth for implementation

## Day-to-Day Flow

1. Pick or create a Linear issue
2. Move it to `In Progress`
3. Create a branch from `main` using `code/<short-name>`
4. Make the smallest complete change that solves the issue
5. Run local checks before opening a PR
6. Open a PR with summary, testing notes, risks, and screenshots if needed
7. Reviewer leaves concrete comments or approves
8. Author addresses feedback and reruns checks
9. Merge only after approval and green CI
10. Move the issue to `Done`

## Two-Person Review Model

- alternate author and reviewer whenever possible
- reviewer checks behavior, regressions, naming, and scope discipline
- reviewer should challenge missing tests and vague verification
- if a change is large, split it before merge instead of reviewing a giant PR

## Definition of Done

A task is done only when all of the following are true:

- code is merged through PR
- CI is green
- feature behavior is manually verified
- automated tests were added or consciously skipped with reason
- screenshots are attached for visible UI changes
- docs were updated if behavior or workflow changed

## Current CI

GitHub Actions currently runs:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

This is now a solid baseline. The remaining gap is not "have tests or not", it is deeper coverage plus GitHub branch protection and deployment workflow.

## Target CI Pipeline

### Phase 1

- lint
- typecheck
- unit tests
- build

### Phase 2

- integration coverage for Supabase and storage boundaries
- browser smoke test expansion beyond the happy path
- upload screenshots or test artifacts on failure

### Phase 3

- preview deployment status in PRs
- protected `main` branch with required checks
- optional scheduled dependency or link checks if they add value

## Recommended Test Strategy

Keep it right-sized:

- unit tests for schemas, parsing, and small logic
- integration tests around Supabase-facing code with mocks or isolated test setup
- one or two end-to-end smoke tests only

Do not build a huge test suite for a tiny app. The goal is confidence and learning, not ceremony.

## Pull Request Standard

Every PR should answer:

- what changed
- why it changed
- how it was verified
- what risks remain
- whether UI changed

Good PR size:

- ideally under 300 lines changed
- split refactors away from feature work
- separate workflow/docs changes from product behavior when possible

## Branch Protection Plan

Configure GitHub so `main` requires:

- at least 1 approval
- passing required checks
- up-to-date branch before merge if practical
- conversation resolution before merge

## Environments

### Local

- each developer runs local Next.js
- each developer uses local Supabase for everyday work

### Staging

- shared Supabase project
- migrations only pushed from trusted mainline state
- used for final smoke checks before or after deploy

### Production / Preview

- Vercel previews on PRs
- main branch deploy for the shared live version

## Design Workflow

The visual direction should stay intentionally narrow:

- old-school web, not startup landing page polish
- prioritize reading, ranking, and submitting over decoration
- prefer simple HTML structure and small CSS rules
- every style change should justify itself against the "HN-like, minimal, maintainable" goal
