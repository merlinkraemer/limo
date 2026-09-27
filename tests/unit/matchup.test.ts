import { describe, expect, it } from 'vitest';
import {
  CROWD_MIN_VOTES,
  alignmentNote,
  alignmentSummary,
  alignmentTitle,
  buildPairs,
  outcomeFor,
  revealFor,
  seededRng,
  shuffle,
  type RoundOutcome,
} from '@/lib/matchup';
import type { MatchupResult } from '@/types/lemonade';

const result = (partial: Partial<MatchupResult>): MatchupResult => ({
  lemonade_a: 'a',
  lemonade_b: 'b',
  votes_a: 0,
  votes_b: 0,
  total_votes: 0,
  percent_a: null,
  percent_b: null,
  ...partial,
});

const noScores = { a: null, b: null };
const scores = (a: number | null, b: number | null) => ({ a, b });

const ids = Array.from({ length: 24 }, (_, i) => `id-${i}`);

describe('buildPairs', () => {
  it('builds 10 pairs of distinct listings', () => {
    const pairs = buildPairs(ids);
    expect(pairs).toHaveLength(10);
    for (const pair of pairs) {
      expect(pair.a).not.toBe(pair.b);
    }
    expect(new Set(pairs.map(pair => [pair.a, pair.b].sort().join(':'))).size).toBe(10);
  });

  it('returns no pairs when there are fewer than two listings', () => {
    expect(buildPairs([])).toEqual([]);
    expect(buildPairs(['only-one'])).toEqual([]);
  });

  it('reuses listings when there are fewer than 20', () => {
    const pairs = buildPairs(['a', 'b', 'c']);
    expect(pairs).toHaveLength(10);
    for (const pair of pairs) expect(pair.a).not.toBe(pair.b);
  });

  it('is stable for a given seed', () => {
    const first = buildPairs(shuffle(ids, seededRng('seed')));
    const second = buildPairs(shuffle(ids, seededRng('seed')));
    expect(first).toEqual(second);
  });
});

describe('outcomeFor', () => {
  it(`uses score fallback for fewer than ${CROWD_MIN_VOTES} real votes and never a crowd`, () => {
    for (const total of [1, 2]) {
      const outcome = outcomeFor(
        result({ votes_a: total, votes_b: 0, total_votes: total }),
        'a',
        scores(9, 4)
      );
      expect(outcome.mode).toBe('score');
      expect(outcome.result).toBe('agreed');
      expect(outcome.winnerId).toBe('a');
      expect(outcome.myVotes + outcome.otherVotes).toBe(total);
    }
  });

  it('marks the higher score as the winner regardless of the pick', () => {
    const pickedBetter = outcomeFor(result({ votes_a: 1, votes_b: 1, total_votes: 2 }), 'b', scores(3, 8));
    expect(pickedBetter.winnerId).toBe('b');
    expect(pickedBetter.result).toBe('agreed');

    const pickedWorse = outcomeFor(result({ votes_a: 1, votes_b: 1, total_votes: 2 }), 'a', scores(3, 8));
    expect(pickedWorse.winnerId).toBe('b');
    expect(pickedWorse.result).toBe('disagreed');
  });

  it('treats equal or unknown scores as a neutral tie below the threshold', () => {
    for (const pair of [scores(5, 5), noScores, scores(8, null), scores(null, 8)]) {
      const outcome = outcomeFor(result({ votes_a: 1, total_votes: 1 }), 'a', pair);
      expect(outcome.mode).toBe('score');
      expect(outcome.result).toBe('tied');
      expect(outcome.winnerId).toBeNull();
    }
  });

  it('switches to a real crowd verdict at 3+ votes', () => {
    const outcome = outcomeFor(
      result({ votes_a: 3, votes_b: 2, total_votes: 5, percent_a: 60, percent_b: 40 }),
      'a',
      scores(2, 9)
    );
    expect(outcome.mode).toBe('crowd');
    expect(outcome.result).toBe('agreed');
    expect(outcome.winnerId).toBe('a');
  });

  it('marks the winner by crowd majority, not by the pick', () => {
    const outcome = outcomeFor(
      result({ votes_a: 1, votes_b: 4, total_votes: 5 }),
      'a',
      scores(10, 1)
    );
    expect(outcome.mode).toBe('crowd');
    expect(outcome.winnerId).toBe('b');
    expect(outcome.result).toBe('disagreed');
  });

  it('keeps a crowd tie neutral', () => {
    const outcome = outcomeFor(result({ votes_a: 2, votes_b: 2, total_votes: 4 }), 'b', scores(9, 1));
    expect(outcome.mode).toBe('crowd');
    expect(outcome.winnerId).toBeNull();
    expect(outcome.result).toBe('tied');
  });

  it('compares the picked side using the pair order returned by the database', () => {
    const outcome = outcomeFor(
      result({ lemonade_a: 'zzz', lemonade_b: 'aaa', votes_a: 2, votes_b: 2, total_votes: 4 }),
      'aaa',
      noScores
    );
    expect(outcome.myVotes).toBe(2);
    expect(outcome.otherVotes).toBe(2);
  });
});

describe('revealFor', () => {
  const crowd = (votesA: number, votesB: number, picked: 'a' | 'b'): RoundOutcome =>
    outcomeFor(
      result({ votes_a: votesA, votes_b: votesB, total_votes: votesA + votesB }),
      picked,
      noScores
    );

  it('shows genuine percentages and a crowd label at 3+ votes', () => {
    const view = revealFor(crowd(3, 1, 'a'), 'a');
    expect(view.className).toBe('win');
    expect(view.label).toBe('crowd vote');
    expect(view.percent).toBe(75);
    expect(view.note).toBe('you picked this');

    expect(revealFor(crowd(3, 1, 'a'), 'b').percent).toBe(25);
  });

  it('marks the crowd majority as the winner even when the player disagreed', () => {
    const outcome = crowd(1, 3, 'a');
    expect(revealFor(outcome, 'b').className).toBe('win');
    expect(revealFor(outcome, 'a').className).toBe('lose');
  });

  it('keeps a crowd tie neutral for both cards', () => {
    const outcome = crowd(2, 2, 'a');
    const left = revealFor(outcome, 'a');
    const right = revealFor(outcome, 'b');
    expect(left.className).toBe('tie');
    expect(right.className).toBe('tie');
    expect(left.label).toBe('tied vote');
    expect(left.percent).toBe(50);
  });

  it('has no percentage and no crowd language in score mode', () => {
    const outcome = outcomeFor(result({ votes_a: 1, votes_b: 1, total_votes: 2 }), 'b', scores(4, 9));
    const winner = revealFor(outcome, 'b');
    expect(winner.className).toBe('win');
    expect(winner.label).toBe('higher score');
    expect(winner.percent).toBeNull();
    expect(winner.label).not.toMatch(/crowd vote/i);
    expect(winner.note).toBe('you picked this — by score');

    const loser = revealFor(outcome, 'a');
    expect(loser.className).toBe('lose');
    expect(loser.label).toBe('lower score');
    expect(loser.percent).toBeNull();
    expect(loser.label).not.toMatch(/crowd/i);
    expect(loser.note).toBe('no crowd votes yet');
  });

  it('labels an undecided score round as a tie with no percentage', () => {
    const outcome = outcomeFor(result({ votes_a: 1, total_votes: 1 }), 'a', noScores);
    const view = revealFor(outcome, 'a');
    expect(view.className).toBe('tie');
    expect(view.label).toBe('score tie');
    expect(view.percent).toBeNull();
  });
});

describe('alignmentSummary', () => {
  const outcome = (partial: Partial<RoundOutcome>): RoundOutcome => ({
    mode: 'crowd',
    result: 'agreed',
    winnerId: 'a',
    picked: 'a',
    myVotes: 2,
    otherVotes: 1,
    priorVotes: 2,
    ...partial,
  });

  it('tracks wins per active mode and keeps ties neutral', () => {
    const summary = alignmentSummary([
      { round: 0, picked: 'a', outcome: outcome({ result: 'agreed' }) },
      { round: 1, picked: 'b', outcome: outcome({ result: 'disagreed', winnerId: 'a', picked: 'b' }) },
      { round: 2, picked: 'a', outcome: outcome({ result: 'tied', winnerId: null }) },
      { round: 3, picked: 'a', outcome: outcome({ mode: 'score', result: 'agreed', winnerId: 'a' }) },
      { round: 4, picked: 'b', outcome: outcome({ mode: 'score', result: 'tied', winnerId: null, picked: 'b' }) },
    ]);
    expect(summary).toEqual({
      decided: 3,
      agreed: 2,
      crowdRounds: 3,
      crowdAgreed: 1,
      scoreRounds: 2,
      scoreAgreed: 1,
      ties: 2,
    });
  });

  it('has no title-worthy score when nothing was decided', () => {
    expect(alignmentTitle(0, 0)).toBe('no verdicts yet');
  });
});

describe('alignmentNote', () => {
  it('separates crowd and score tallies', () => {
    const note = alignmentNote({
      decided: 4,
      agreed: 3,
      crowdRounds: 4,
      crowdAgreed: 2,
      scoreRounds: 0,
      scoreAgreed: 0,
      ties: 0,
    });

    expect(note).toBe('you matched the crowd in 2 of 4 matchups with real votes.');
  });

  it('keeps score-only sessions readable instead of gluing "scoresyou"', () => {
    const note = alignmentNote({
      decided: 3,
      agreed: 2,
      crowdRounds: 0,
      crowdAgreed: 0,
      scoreRounds: 4,
      scoreAgreed: 2,
      ties: 1,
    });

    expect(note).not.toContain('scoresyou');
    expect(note).toBe(
      'no crowd voted yet — every call came down to the listed scores; you picked the higher score in 2 of 4 score-fallback matchups, with 1 neutral tie.'
    );
  });

  it('reports a single score-fallback matchup in the singular', () => {
    const note = alignmentNote({
      decided: 1,
      agreed: 1,
      crowdRounds: 0,
      crowdAgreed: 0,
      scoreRounds: 1,
      scoreAgreed: 1,
      ties: 0,
    });

    expect(note).toContain('in 1 of 1 score-fallback matchup.');
  });
});
