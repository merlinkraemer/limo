# Contributing

This project is a learning environment for two junior developers. Keep changes small, review each other’s work, and document decisions.

## Branching (GitHub Flow)

- Create branches from `main` using: `code/<feature-short-name>`
- No direct commits to `main`
- Each branch must have a PR

## PR Checklist

- `npm run lint` passes
- `npm run typecheck` passes
- `npm run build` passes
- Feature manually verified
- Include screenshot for UI changes

## Review

- 1 reviewer required (the other dev)
- Use comments for questions, not assumptions
- Merge only after CI is green
- Follow the fuller workflow in `docs/planning/WORKFLOW.md`

## Migrations

- Local dev: use `supabase db reset`
- Staging: only push migrations from `main`
