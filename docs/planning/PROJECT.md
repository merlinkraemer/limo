# Limo

## What This Is

A small shared learning project for two developers to practice:

- shipping a simple web app end to end
- working in branches with PRs and reviews
- using CI, tests, and deployment discipline
- keeping scope small while process quality stays high

The app itself is intentionally simple: add a limo, rate it, optionally attach a photo and city, then view a global leaderboard.

## Current Product State

The current codebase already includes the local MVP:

- add limo flow
- name and description
- flavor and sourness ratings
- optional photo upload
- optional city
- leaderboard sorted by overall score
- home page + add route + leaderboard route

## Design Direction

The intended visual style is explicitly minimal and old-school:

- Hacker News-inspired, list-first, text-first layout
- minimal chrome and almost no decoration
- fast to scan, fast to build, easy to maintain
- small-screen friendly without turning into a modern card-heavy app
- plain typography and restrained styling over branding work

Current implementation already leans this way:

- simple top bar
- ranked text list
- compact metadata lines
- modal form
- Verdana-style utilitarian typography

Note: the current UI is a dark minimal variant. If the target is a more literal Hacker News feel, that should mean lighter background, less modal chrome, and even simpler interaction patterns.

## Product Scope

### In Scope

- public read/write MVP with no auth
- one photo per limo
- free-tier infra only
- simple global leaderboard
- basic staging and deployment workflow

### Out of Scope

- accounts or profiles
- comments or social features
- search, filters, and maps
- barcode scanning
- multiple images
- fancy animation or brand-heavy UI

## Team Constraints

- two contributors
- short-lived branches only
- all changes land through PRs
- repo process quality matters as much as feature work
