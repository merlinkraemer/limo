import { describe, expect, it } from 'vitest';
import {
  assignRanks,
  formatScore,
  isProvisional,
  medalFor,
  ratingLabel,
  votePercent,
} from '@/lib/listing-metrics';

function listing(id: string, avg_score: number | null, created_at: string) {
  return { id, avg_score, created_at };
}

describe('assignRanks', () => {
  it('gives every listing its own ordinal, ordered by score desc then created_at', () => {
    const ranked = assignRanks([
      listing('c', 8, '2026-01-03T00:00:00Z'),
      listing('a', 9.3, '2026-01-01T00:00:00Z'),
      listing('b', 9.3, '2026-01-02T00:00:00Z'),
      listing('d', 7, '2026-01-04T00:00:00Z'),
    ]);

    expect(ranked.map(r => [r.listing.id, r.rank])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
      ['d', 4],
    ]);
  });

  it('ranks unrated listings last with their own ordinals', () => {
    const ranked = assignRanks([
      listing('none-b', null, '2026-01-02T00:00:00Z'),
      listing('scored', 5, '2026-01-01T00:00:00Z'),
      listing('none-a', null, '2026-01-01T00:00:00Z'),
    ]);

    expect(ranked.map(r => [r.listing.id, r.rank])).toEqual([
      ['scored', 1],
      ['none-a', 2],
      ['none-b', 3],
    ]);
  });

  it('is deterministic for an exact tie (created_at then id)', () => {
    const same = '2026-01-01T00:00:00Z';
    const ranked = assignRanks([listing('b', 5, same), listing('a', 5, same)]);
    expect(ranked.map(r => [r.listing.id, r.rank])).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });
});

describe('medalFor', () => {
  it('awards exactly one medal per metal to rated ordinal positions', () => {
    expect(medalFor(1, 9.1)).toEqual({ emoji: '🥇', name: 'gold' });
    expect(medalFor(2, 9.0)).toEqual({ emoji: '🥈', name: 'silver' });
    expect(medalFor(3, 8.9)).toEqual({ emoji: '🥉', name: 'bronze' });
    expect(medalFor(4, 8.8)).toBeNull();
  });

  it('never medals an unrated listing', () => {
    expect(medalFor(1, null)).toBeNull();
    expect(medalFor(2, null)).toBeNull();
    expect(medalFor(3, null)).toBeNull();
  });

  it('keeps three tied listings gold/silver/bronze instead of two bronze', () => {
    const ranked = assignRanks([
      listing('a', 5, '2026-01-01T00:00:00Z'),
      listing('b', 5, '2026-01-02T00:00:00Z'),
      listing('c', 5, '2026-01-03T00:00:00Z'),
    ]);
    expect(ranked.map(r => medalFor(r.rank, r.listing.avg_score)?.emoji)).toEqual(['🥇', '🥈', '🥉']);
  });
});

describe('isProvisional', () => {
  it('is only true for a lone visitor rating', () => {
    expect(isProvisional({ rating_count: 1, legacy_rating_count: 0 })).toBe(true);
    expect(isProvisional({ rating_count: 2, legacy_rating_count: 0 })).toBe(false);
    expect(isProvisional({ rating_count: 1, legacy_rating_count: 1 })).toBe(false);
  });
});

describe('votePercent', () => {
  it('returns NULL instead of a fake crowd when nobody voted', () => {
    expect(votePercent(0, 0)).toBeNull();
    expect(votePercent(1, 3)).toBe(33.33);
    expect(votePercent(3, 3)).toBe(100);
  });
});

describe('labels', () => {
  it('describes first-vote and historical states honestly', () => {
    expect(ratingLabel({ rating_count: 0, legacy_rating_count: 0, visitor_rating_count: 0 })).toBe(
      'no ratings yet'
    );
    expect(ratingLabel({ rating_count: 1, legacy_rating_count: 0, visitor_rating_count: 1 })).toBe(
      'provisional (1 rating)'
    );
    expect(ratingLabel({ rating_count: 1, legacy_rating_count: 1, visitor_rating_count: 0 })).toBe(
      'historical self-report'
    );
    expect(ratingLabel({ rating_count: 3, legacy_rating_count: 1, visitor_rating_count: 2 })).toBe(
      '3 ratings'
    );
  });

  it('formats a missing score without pretending it is zero', () => {
    expect(formatScore(null)).toBe('-');
    expect(formatScore(6.3)).toBe('6.30');
  });
});
