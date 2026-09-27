import type { MatchupResult } from '@/types/lemonade';
import { votePercent } from '@/lib/listing-metrics';

/**
 * Pure helpers for the yay-or-nay preference game. A reveal is either a real
 * crowd verdict (3+ real votes on the matchup) or a score fallback that never
 * pretends the listed scores are votes.
 */

export const GAME_ROUNDS = 10;

/** Real matchup votes (including this browser's pick) before a crowd exists. */
export const CROWD_MIN_VOTES = 3;

export interface GamePair {
  a: string;
  b: string;
}

/** How the reveal decided its winner. */
export type RoundMode = 'crowd' | 'score';

/** The picked listing's standing after the vote. */
export type RoundResult = 'agreed' | 'disagreed' | 'tied';

export interface RoundOutcome {
  mode: RoundMode;
  result: RoundResult;
  /** winning listing, or null when the round is a neutral tie */
  winnerId: string | null;
  picked: string;
  /** votes for the picked listing (including this browser's vote) */
  myVotes: number;
  /** votes for the other listing */
  otherVotes: number;
  /** real votes that existed before this browser voted (total - 1) */
  priorVotes: number;
}

export interface RoundRecord {
  round: number;
  picked: string;
  outcome: RoundOutcome;
}

/** Score per matchup side; null means the listing has no real rating yet. */
export interface MatchupScores {
  a: number | null;
  b: number | null;
}

/** Deterministic RNG so a listing set always yields the same initial deck. */
export function seededRng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(values: readonly T[], rng: () => number): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Ten distinct pairs; two listings minimum, repeats only after the deck wraps. */
export function buildPairs(ids: readonly string[], rounds = GAME_ROUNDS): GamePair[] {
  const distinct = [...new Set(ids)];
  if (distinct.length < 2) return [];

  const pairs: GamePair[] = [];
  const seen = new Set<string>();
  let cursor = 0;

  while (pairs.length < rounds && cursor < distinct.length * rounds) {
    const a = distinct[(cursor * 2) % distinct.length];
    let b = distinct[(cursor * 2 + 1) % distinct.length];
    cursor++;
    if (a === b) {
      b = distinct[(cursor * 2 + 1) % distinct.length];
    }
    if (!a || !b || a === b) continue;
    const key = [a, b].sort().join(':');
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ a, b });
  }

  // Small boards cannot supply ten unique pairs; repeat the available ones so
  // the ten-round structure survives without ever pairing a listing with itself.
  for (let i = 0; pairs.length < rounds && pairs.length > 0; i++) {
    pairs.push(pairs[i % pairs.length]);
  }

  return pairs;
}

/**
 * Turn a real matchup result (which already includes this browser's vote) into
 * an honest round outcome.
 *
 * - 3+ real votes: crowd mode, winner = real vote majority, percentages real.
 * - fewer: score mode, winner = higher overall score, equal/unknown = tie.
 *   The overlay must not show percentages or call the result a crowd.
 */
export function outcomeFor(result: MatchupResult, picked: string, scores: MatchupScores): RoundOutcome {
  const pickedA = picked === result.lemonade_a;
  const myVotes = pickedA ? result.votes_a : result.votes_b;
  const otherVotes = pickedA ? result.votes_b : result.votes_a;
  const priorVotes = Math.max(0, result.total_votes - 1);
  const crowd = result.total_votes >= CROWD_MIN_VOTES;

  let winnerId: string | null = null;
  if (crowd) {
    if (result.votes_a > result.votes_b) winnerId = result.lemonade_a;
    else if (result.votes_b > result.votes_a) winnerId = result.lemonade_b;
  } else if (scores.a !== null && scores.b !== null && scores.a !== scores.b) {
    winnerId = scores.a > scores.b ? result.lemonade_a : result.lemonade_b;
  }

  const roundResult: RoundResult =
    winnerId === null ? 'tied' : winnerId === picked ? 'agreed' : 'disagreed';

  return {
    mode: crowd ? 'crowd' : 'score',
    result: roundResult,
    winnerId,
    picked,
    myVotes,
    otherVotes,
    priorVotes,
  };
}

export interface AlignmentSummary {
  /** rounds with a winner, in either mode */
  decided: number;
  /** rounds where the browser picked the winner */
  agreed: number;
  crowdRounds: number;
  crowdAgreed: number;
  scoreRounds: number;
  scoreAgreed: number;
  /** rounds with no winner in either mode */
  ties: number;
}

export function alignmentSummary(records: readonly RoundRecord[]): AlignmentSummary {
  return records.reduce<AlignmentSummary>(
    (acc, record) => {
      const { outcome } = record;
      if (outcome.result === 'tied') {
        acc.ties += 1;
      } else {
        acc.decided += 1;
        if (outcome.result === 'agreed') acc.agreed += 1;
      }
      if (outcome.mode === 'crowd') {
        acc.crowdRounds += 1;
        if (outcome.result === 'agreed') acc.crowdAgreed += 1;
      } else {
        acc.scoreRounds += 1;
        if (outcome.result === 'agreed') acc.scoreAgreed += 1;
      }
      return acc;
    },
    { decided: 0, agreed: 0, crowdRounds: 0, crowdAgreed: 0, scoreRounds: 0, scoreAgreed: 0, ties: 0 }
  );
}

export function alignmentTitle(agreed: number, decided: number): string {
  if (decided <= 0) return 'no verdicts yet';
  const ratio = agreed / decided;
  if (ratio >= 1) return 'lemon oracle';
  if (ratio >= 0.7) return 'crowd pleaser';
  if (ratio >= 0.4) return 'own taste';
  return 'certified contrarian';
}

/**
 * End-screen sentence for a finished game. The crowd and score-fallback
 * tallies are always separated, so a score-only session never produces
 * "...listed scoresyou picked...".
 */
export function alignmentNote(alignment: AlignmentSummary): string {
  const parts: string[] = [
    alignment.crowdRounds > 0
      ? `you matched the crowd in ${alignment.crowdAgreed} of ${alignment.crowdRounds} matchup${alignment.crowdRounds === 1 ? '' : 's'} with real votes`
      : 'no crowd voted yet — every call came down to the listed scores',
  ];

  if (alignment.scoreRounds > 0) {
    parts.push(
      `you picked the higher score in ${alignment.scoreAgreed} of ${alignment.scoreRounds} score-fallback matchup${alignment.scoreRounds === 1 ? '' : 's'}`
    );
  }

  const ties =
    alignment.ties > 0 ? `, with ${alignment.ties} neutral tie${alignment.ties === 1 ? '' : 's'}.` : '.';
  return parts.join('; ') + ties;
}

export interface RevealView {
  /** CSS class that colors the card overlay */
  className: 'win' | 'lose' | 'tie';
  label: string;
  /** real crowd share, only in crowd mode; null means "no percentage" */
  percent: number | null;
  note: string | null;
}

/**
 * Honest per-card overlay content. Percentages exist only for real crowd
 * verdicts; the score fallback says so instead of inventing votes.
 */
export function revealFor(outcome: RoundOutcome, listingId: string): RevealView {
  const className =
    outcome.winnerId === null ? 'tie' : outcome.winnerId === listingId ? 'win' : 'lose';
  const isPicked = outcome.picked === listingId;

  if (outcome.mode === 'crowd') {
    const votes = isPicked ? outcome.myVotes : outcome.otherVotes;
    return {
      className,
      label: outcome.result === 'tied' ? 'tied vote' : 'crowd vote',
      percent: votePercent(votes, outcome.myVotes + outcome.otherVotes),
      note: outcome.result === 'tied' ? 'no majority' : isPicked ? 'you picked this' : null,
    };
  }

  return {
    className,
    label:
      outcome.result === 'tied'
        ? 'score tie'
        : outcome.winnerId === listingId
          ? 'higher score'
          : 'lower score',
    percent: null,
    note:
      outcome.result === 'tied'
        ? 'no crowd votes yet'
        : isPicked
          ? 'you picked this — by score'
          : 'no crowd votes yet',
  };
}
