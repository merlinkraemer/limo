import type { MatchupResult } from '@/types/lemonade';

/**
 * Pure helpers for the yay-or-nay preference game. The game never invents a
 * crowd: every reveal comes from a real `get_matchup_result` row, and an
 * alignment point is only awarded when other people had already voted.
 */

export const GAME_ROUNDS = 10;

export interface GamePair {
  a: string;
  b: string;
}

export type RoundResult = 'agreed' | 'disagreed' | 'tied' | 'first_vote';

export interface RoundOutcome {
  result: RoundResult;
  myVotes: number;
  otherVotes: number;
  /** votes that existed before this browser voted (total - 1) */
  priorVotes: number;
}

export interface RoundRecord {
  round: number;
  picked: string;
  outcome: RoundOutcome;
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
 * an honest round outcome. A single first vote is not a crowd.
 */
export function outcomeFor(result: MatchupResult, picked: string): RoundOutcome {
  const pickedA = picked === result.lemonade_a;
  const myVotes = pickedA ? result.votes_a : result.votes_b;
  const otherVotes = pickedA ? result.votes_b : result.votes_a;
  const priorVotes = Math.max(0, result.total_votes - 1);

  if (priorVotes <= 0) {
    return { result: 'first_vote', myVotes, otherVotes, priorVotes };
  }
  if (myVotes > otherVotes) {
    return { result: 'agreed', myVotes, otherVotes, priorVotes };
  }
  if (myVotes < otherVotes) {
    return { result: 'disagreed', myVotes, otherVotes, priorVotes };
  }
  return { result: 'tied', myVotes, otherVotes, priorVotes };
}

export interface AlignmentSummary {
  /** rounds where other people had already voted */
  meaningful: number;
  /** rounds where the browser picked the side with more real votes */
  agreed: number;
  /** rounds where this browser cast the first real vote */
  firstVotes: number;
  ties: number;
}

export function alignmentSummary(records: readonly RoundRecord[]): AlignmentSummary {
  return records.reduce<AlignmentSummary>(
    (acc, record) => {
      if (record.outcome.result === 'first_vote') acc.firstVotes += 1;
      else {
        acc.meaningful += 1;
        if (record.outcome.result === 'agreed') acc.agreed += 1;
        else if (record.outcome.result === 'tied') acc.ties += 1;
      }
      return acc;
    },
    { meaningful: 0, agreed: 0, firstVotes: 0, ties: 0 }
  );
}

export function alignmentTitle(agreed: number, meaningful: number): string {
  if (meaningful <= 0) return 'no crowd to match yet';
  const ratio = agreed / meaningful;
  if (ratio >= 1) return 'lemon oracle';
  if (ratio >= 0.7) return 'crowd pleaser';
  if (ratio >= 0.4) return 'own taste';
  return 'certified contrarian';
}

export function isRoundPoint(outcome: RoundOutcome): boolean {
  return outcome.result === 'agreed';
}
