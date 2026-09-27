import { describe, expect, it } from 'vitest';
import {
  alignmentSummary,
  alignmentTitle,
  buildPairs,
  outcomeFor,
  seededRng,
  shuffle,
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
  it('marks the first real vote as first_vote, never as agreement', () => {
    const outcome = outcomeFor(result({ votes_a: 1, total_votes: 1, percent_a: 100, percent_b: 0 }), 'a');
    expect(outcome.result).toBe('first_vote');
    expect(outcome.priorVotes).toBe(0);
    expect(outcome.myVotes).toBe(1);
  });

  it('marks agreement when the picked side leads after my vote', () => {
    const outcome = outcomeFor(result({ votes_a: 4, votes_b: 2, total_votes: 6 }), 'a');
    expect(outcome.result).toBe('agreed');
    expect(outcome.priorVotes).toBe(5);
  });

  it('marks disagreement when the other side leads', () => {
    const outcome = outcomeFor(result({ votes_a: 4, votes_b: 2, total_votes: 6 }), 'b');
    expect(outcome.result).toBe('disagreed');
  });

  it('marks a tie when both sides have equal real votes', () => {
    const outcome = outcomeFor(result({ votes_a: 3, votes_b: 3, total_votes: 6 }), 'b');
    expect(outcome.result).toBe('tied');
  });

  it('compares the picked side using the pair order returned by the database', () => {
    const outcome = outcomeFor(
      result({ lemonade_a: 'zzz', lemonade_b: 'aaa', votes_a: 2, votes_b: 5, total_votes: 7 }),
      'aaa'
    );
    expect(outcome.myVotes).toBe(5);
    expect(outcome.otherVotes).toBe(2);
    expect(outcome.result).toBe('agreed');
  });
});

describe('alignmentSummary', () => {
  it('only counts meaningful rounds towards the alignment score', () => {
    const summary = alignmentSummary([
      { round: 0, picked: 'a', outcome: { result: 'agreed', myVotes: 2, otherVotes: 0, priorVotes: 1 } },
      { round: 1, picked: 'b', outcome: { result: 'first_vote', myVotes: 1, otherVotes: 0, priorVotes: 0 } },
      { round: 2, picked: 'a', outcome: { result: 'disagreed', myVotes: 1, otherVotes: 3, priorVotes: 3 } },
      { round: 3, picked: 'b', outcome: { result: 'tied', myVotes: 2, otherVotes: 2, priorVotes: 3 } },
    ]);
    expect(summary).toEqual({ meaningful: 3, agreed: 1, firstVotes: 1, ties: 1 });
  });

  it('has no title-worthy score when nobody voted before this browser', () => {
    expect(alignmentTitle(0, 0)).toBe('no crowd to match yet');
  });
});
