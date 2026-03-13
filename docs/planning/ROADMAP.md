# Roadmap

## Milestones

### 1) Foundation and Repo Workflow

Status: Complete

Goal:
Establish a clean shared repo with baseline docs and CI.

Delivered:

- README
- CONTRIBUTING
- PR template
- GitHub Actions for lint, typecheck, and build
- Supabase local setup docs

### 2) MVP Product Build

Status: Complete locally

Goal:
Ship the smallest useful limo leaderboard product.

Delivered:

- add limo flow
- ratings, description, optional city
- optional photo upload
- leaderboard ranking
- minimal old-school UI direction in the implementation

### 3) Quality Pipeline

Status: In progress

Goal:
Turn the repo from "working app" into a solid two-person training project with a more industry-standard workflow.

Success criteria:

- automated tests exist
- CI runs tests in addition to lint/typecheck/build
- PR process is explicit and repeatable
- branch protection uses required checks
- Definition of Done is documented and followed

### 4) Deployment and Staging Discipline

Status: Planned

Goal:
Make releases predictable and safe without adding unnecessary complexity.

Success criteria:

- Vercel project is connected
- env vars are documented and configured
- staging data flow is documented
- migration push policy is documented and followed
- deploy verification checklist exists

## Progress Summary

| Milestone | Status | Progress |
|----------|--------|----------|
| Foundation and Repo Workflow | Complete | 100% |
| MVP Product Build | Complete locally | 100% |
| Quality Pipeline | In progress | 60% |
| Deployment and Staging Discipline | Planned | 10% |

## Recommended Order From Here

1. Add tests before adding more product scope
2. Turn the new CI checks into required GitHub protections
3. Set up preview and staging deployment
4. Only then expand features or redesign visuals
