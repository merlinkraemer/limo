# Idea: Tag-Based Rating System

## Problem

The current rating system has two fixed dimensions (flavor + sourness) with hardcoded weights (65/35). This works for one person's preferences but doesn't generalize — sourness matters a lot to some people, not at all to others.

## The Idea

Replace the two fixed ratings with a flexible tag-based system:

1. There's a fixed list of ~10-15 **flavor tags** (e.g. sourness, sweetness, fizz, citrus, herbal, refreshing, balanced, fruity, tart, crisp, exotic, smooth, bold, light, etc.)
2. When rating a lemonade, the user **picks up to 3 tags** from the list
3. The user **rates each chosen tag** from 1-10
4. The **order of selection matters** — first pick is weighted highest

## Scoring

The order the user selects tags in determines weight. First pick = most important to them.

Possible weighting:
- 1st tag: 50%
- 2nd tag: 30%
- 3rd tag: 20%

```
overall_score = (tag1_score * 0.50) + (tag2_score * 0.30) + (tag3_score * 0.20)
```

This means if someone picks "sourness" first and rates it 9, that carries more weight than if they picked it third — reflecting that it was the defining characteristic of the lemonade for them.

If a user only picks 1 or 2 tags, redistribute the weights:
- 1 tag: 100%
- 2 tags: 60% / 40%
- 3 tags: 50% / 30% / 20%

## What Tags Add Beyond Scoring

- Leaderboard can be filtered/sorted by tag ("best sour lemonades")
- Each lemonade gets a flavor profile visible at a glance
- Two lemonades with the same score but different tags tell different stories
- People rate what they actually care about instead of being forced into fixed dimensions

## User-Submitted Tags

Users can propose new tags, but they don't go live immediately. Flow:

1. User submits a new tag suggestion (text input alongside the existing tag list)
2. Tag goes into a **pending** state — not visible to other users yet
3. An admin reviews and either approves or rejects it
4. Approved tags join the main list for everyone

This keeps the tag list curated and prevents junk/duplicates while still letting the community shape what dimensions exist. Needs some kind of admin interface (even if it's just a simple page behind auth, or a database flag to flip).

## Open Questions

- Exact list of tags (10? 15?)
- Should there be a minimum number of tags (e.g. at least 2)?
- Exact weight distribution for ordering
- DB schema: JSONB column on lemonades table vs. separate ratings table?
- How to display the tag + score breakdown in the leaderboard UI
- Admin flow: dedicated page, or just a DB toggle for now?
