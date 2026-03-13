# Requirements

## Product Requirements

### Implemented Now

- [x] User can create a limo entry with name and description
- [x] User can rate flavor on a 1-10 scale
- [x] User can rate sourness on a 1-10 scale
- [x] System calculates overall score as the average of flavor and sourness
- [x] User can optionally upload one photo
- [x] User can optionally enter a city
- [x] Leaderboard lists entries sorted by overall score descending, then created time ascending
- [x] App exposes home, add, and leaderboard flows

### UI Requirements

- [x] Interface stays intentionally minimal and information-first
- [x] Mobile-first layout works without requiring separate mobile screens
- [ ] Final visual system is documented as "dark HN variant" or "classic HN variant" so design decisions stay consistent
- [ ] Manual UI review checklist exists for spacing, readability, empty states, and mobile behavior

## Engineering Requirements

### Implemented Now

- [x] Repo has a README
- [x] Repo has a contributing guide
- [x] Repo has a PR template
- [x] GitHub Actions runs lint, typecheck, and build on PRs
- [x] Supabase migration exists for the MVP schema
- [x] Local Supabase workflow is documented

### Planned Next

- [x] Add automated test coverage, starting with schema validation and server-action behavior
- [x] Add at least one browser smoke test for the core add-to-leaderboard flow
- [ ] Make PR checks required in GitHub branch protection
- [x] Document review expectations for a two-person team
- [ ] Add deployment and staging checklists
- [ ] Add preview deployment policy for PRs

## Collaboration Requirements

- [x] No direct commits to `main`
- [x] Branches follow `code/<short-name>`
- [x] Every change goes through PR review
- [ ] Each task is tracked in Linear before work starts
- [x] One person opens the PR, the other reviews before merge
- [x] Definition of Done includes tests, screenshots for UI changes, and manual verification notes
- [ ] Work-in-progress PRs are allowed, but not merged until all required checks pass

## Test Strategy Requirements

- [x] Unit tests for validation and small pure logic
- [x] Integration tests for server action behavior at the module boundary
- [x] End-to-end smoke test for the happy path
- [x] CI should fail fast on lint/typecheck/test/build regressions
- [ ] Local pre-PR checklist should match CI closely enough to avoid surprise failures
