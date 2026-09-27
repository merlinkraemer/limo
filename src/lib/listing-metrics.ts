import type { ListingSummary } from '@/types/lemonade';

export interface RankedListing<T> {
  listing: T;
  rank: number;
}

/**
 * Dense ordinal ranking over real scores: every listing gets exactly one
 * position 1, 2, 3, … even when scores tie. Order is average score descending,
 * then created_at ascending, then id — the same deterministic sort as before.
 * Unrated listings rank last (still with their own ordinal).
 */
export function assignRanks<T extends { id: string; created_at: string; avg_score: number | null }>(
  listings: readonly T[]
): RankedListing<T>[] {
  const sorted = [...listings].sort((a, b) => {
    if (a.avg_score !== b.avg_score) {
      if (a.avg_score === null) return 1;
      if (b.avg_score === null) return -1;
      return b.avg_score - a.avg_score;
    }

    const createdDelta = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (createdDelta !== 0) return createdDelta;

    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return sorted.map((listing, index) => ({ listing, rank: index + 1 }));
}

/**
 * Exactly one medal per metal: gold/silver/bronze for the first three ordinal
 * positions, and only when the listing has a real score. Unrated listings are
 * never decorated just for being listed.
 */
export function medalFor(
  rank: number,
  avgScore: number | null
): { emoji: string; name: string } | null {
  if (avgScore === null || rank < 1 || rank > 3) return null;
  const medals = [
    { emoji: '🥇', name: 'gold' },
    { emoji: '🥈', name: 'silver' },
    { emoji: '🥉', name: 'bronze' },
  ];
  return medals[rank - 1];
}

/**
 * A listing is provisional while its only feedback is the creator's first
 * visitor rating. A single historical legacy rating is self-reported, not a
 * provisional crowd score.
 */
export function isProvisional(
  summary: Pick<ListingSummary, 'rating_count' | 'legacy_rating_count'>
): boolean {
  return summary.rating_count === 1 && summary.legacy_rating_count === 0;
}

/** Truthful vote share; NULL means "no real votes yet" rather than 0 or 100. */
export function votePercent(votes: number, totalVotes: number): number | null {
  if (!Number.isFinite(totalVotes) || totalVotes <= 0) return null;
  return Math.round((votes / totalVotes) * 10000) / 100;
}

export function formatScore(score: number | null): string {
  return score === null ? '-' : score.toFixed(2);
}

/** Honest label for a listing's feedback state. */
export function ratingLabel(
  summary: Pick<ListingSummary, 'rating_count' | 'legacy_rating_count' | 'visitor_rating_count'>
): string {
  if (summary.rating_count === 0) return 'no ratings yet';
  if (isProvisional(summary)) return 'provisional (1 rating)';
  if (summary.visitor_rating_count === 0) return 'historical self-report';
  return `${summary.rating_count} rating${summary.rating_count === 1 ? '' : 's'}`;
}
