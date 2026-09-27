'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  castVote,
  contributePhoto,
  createListing,
  fetchMatchupResult,
  fetchMyRatings,
  rateListing,
  searchListingsAction,
} from '@/app/listing-actions';
import { uploadImage } from '@/lib/supabase/storage';
import { assignRanks, medalFor, ratingLabel } from '@/lib/listing-metrics';
import {
  GAME_ROUNDS,
  alignmentNote,
  alignmentSummary,
  alignmentTitle,
  buildPairs,
  outcomeFor,
  revealFor,
  seededRng,
  shuffle,
  type RoundOutcome,
  type RoundRecord,
} from '@/lib/matchup';
import type { BrowserRating, ListingSearchResult, ListingSummary, TraitKey } from '@/types/lemonade';
import { useLayer, useLayerStack, useMediaQuery } from './layer-stack';

type AddView = 'search' | 'rate' | 'form' | 'done';

interface FormState {
  name: string;
  city: string;
  by: string;
  comment: string;
  score: number | null;
  traits: Partial<Record<TraitKey, number>>;
  photoUrl: string | null;
  photoName: string | null;
  err: Record<string, string>;
  saving: boolean;
}

const TRAITS: { key: TraitKey; label: string; words: [string, string, string, string] }[] = [
  { key: 'sour', label: 'is it sour??', words: ['nope', 'ok-ish', 'yepp', 'hell yeah'] },
  { key: 'sweet', label: 'is it sweet?', words: ['nope', 'kinda', 'yes!', 'candy'] },
  { key: 'fizz', label: 'does it FIZZ??', words: ['flat af', 'why??', 'yes', 'ouch'] },
  { key: 'fruity', label: 'how fruity are we talking?', words: ['nada', 'a bit', 'hella fruity', 'fresh pressed'] },
];

const X_ICON = (
  <svg className="ico" viewBox="0 0 20 20" aria-hidden="true">
    <path d="M5 5l10 10M15 5L5 15" />
  </svg>
);

function fmtScore(score: number | null): string {
  return score === null ? '–' : score.toFixed(1);
}

function fmtDate(value: string): string {
  const d = new Date(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function hashOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
}

function initialsOf(name: string): string {
  return name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0] ?? '')
    .join('')
    .toLowerCase();
}

function traitOf(listing: ListingSummary, key: TraitKey): { avg: number | null; count: number } {
  return {
    avg: listing[`trait_${key}_avg`],
    count: listing[`trait_${key}_count`],
  };
}

function Placeholder({
  name,
  ratio,
  small,
}: {
  name: string;
  ratio?: string;
  small?: boolean;
}) {
  const style = { '--h': hashOf(name), ...(ratio ? { '--ph-ratio': ratio } : {}) } as CSSProperties;
  return (
    <span className={`ph${small ? ' sm' : ''}`} style={style} role="img" aria-label={`no photo of ${name} yet`}>
      <b>{initialsOf(name)}</b>
      <span>no photo yet</span>
    </span>
  );
}

function Stars({ value }: { value: number | null }) {
  const score = value === null ? 0 : Math.round(value) / 2;
  return (
    <span className="stars" aria-hidden="true">
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} className={score >= i + 1 ? 'on' : score >= i + 0.5 ? 'half' : ''}>
          ★
        </span>
      ))}
    </span>
  );
}

function Meter({ level }: { level: number | null }) {
  return (
    <span className="meter" aria-hidden="true">
      {[0, 1, 2, 3].map(i => (
        <span key={i} className={level !== null && i <= level ? 'on' : ''} />
      ))}
    </span>
  );
}

function Thumb({
  listing,
  ratio = '1',
  small = true,
  priority = false,
}: {
  listing: Pick<ListingSummary, 'name' | 'image_url'>;
  ratio?: string;
  small?: boolean;
  priority?: boolean;
}) {
  if (!listing.image_url) return <Placeholder name={listing.name} ratio={ratio} small={small} />;
  return (
    <LoadableImage
      className="od-media od-media-cover"
      style={{ '--od-ratio': ratio } as CSSProperties}
      src={listing.image_url}
      alt=""
      fill
      sizes="44px"
      priority={priority}
    />
  );
}

/** next/image with a visible skeleton until the bitmap is decoded. A source
 *  that fails keeps a labelled surface instead of a broken frame. */
function LoadableImage({ onLoad, onError, ...props }: React.ComponentProps<typeof Image>) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  // A cached bitmap can already be complete when React attaches onLoad during
  // hydration, so the native event never reaches us and the skeleton would
  // stay on top of the photo. Settle from the element itself at mount. (A
  // not-yet-started lazy load also reports complete with naturalWidth 0, so
  // only a decoded bitmap may settle to loaded here; failures still come
  // through the native onError.)
  const settleCached = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setState('loaded');
  }, []);
  return (
    <>
      <Image
        {...props}
        ref={settleCached}
        data-photo-state={state}
        onLoad={event => {
          setState('loaded');
          onLoad?.(event);
        }}
        onError={event => {
          setState('error');
          onError?.(event);
        }}
      />
      {state === 'error' ? (
        <span className="sr" role="status">
          photo unavailable
        </span>
      ) : null}
      {state !== 'loaded' ? (
        <span className={`img-skeleton${state === 'error' ? ' is-error' : ''}`} aria-hidden="true">
          {state === 'error' ? 'photo unavailable' : null}
        </span>
      ) : null}
    </>
  );
}

/** Respect Data Saver: never warm images when the browser asked us not to. */
function useSaveData(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData,
    () => false
  );
}

/**
 * Bounded prewarm for exactly the next game pair. It renders the same
 * next/image component with the same `sizes` breakpoints as the live card, so
 * the browser picks the identical srcset variant; the two images are mounted
 * offscreen only until the round advances (then the previous warm pair is
 * replaced, never accumulated).
 */
function GameWarmPair({
  a,
  b,
  isDesktop,
}: {
  a: ListingSummary | null;
  b: ListingSummary | null;
  isDesktop: boolean;
}) {
  const saveData = useSaveData();
  if (saveData || !a || !b) return null;
  const sources = [a, b].filter(listing => listing.image_url);
  if (!sources.length) return null;
  const sizes = isDesktop ? '320px' : '(max-width: 767px) 90vw, 45vw';
  return (
    <div className="game-warm" data-warm-pair data-warm-ids={sources.map(listing => listing.id).join(',')} aria-hidden="true">
      {sources.map(listing => (
        <span className="game-warm-slot" key={listing.id}>
          <Image src={listing.image_url!} alt="" fill sizes={sizes} loading="eager" fetchPriority="low" />
        </span>
      ))}
    </div>
  );
}

export function LemoApp({ initialListings }: { initialListings: ListingSummary[] }) {
  const router = useRouter();
  const listings = initialListings;

  const ranked = useMemo(() => assignRanks(listings), [listings]);
  const rankOf = useMemo(() => new Map(ranked.map(entry => [entry.listing.id, entry.rank])), [ranked]);
  const listingById = useMemo(() => new Map(listings.map(listing => [listing.id, listing])), [listings]);

  const [showAll, setShowAll] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [lightboxId, setLightboxId] = useState<string | null>(null);

  const [myRatings, setMyRatings] = useState<BrowserRating[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addView, setAddView] = useState<AddView>('search');
  const [addQuery, setAddQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ListingSearchResult[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addId, setAddId] = useState<string | null>(null);
  const [rateScore, setRateScore] = useState<number | null>(null);
  const [rateTraits, setRateTraits] = useState<Partial<Record<TraitKey, number>>>({});
  const [rateComment, setRateComment] = useState('');
  const [showRateComment, setShowRateComment] = useState(false);
  const [rateDone, setRateDone] = useState<number | null>(null);
  const [rateReturnTo, setRateReturnTo] = useState<'game' | 'detail' | null>(null);
  const [rateSaving, setRateSaving] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; name: string; score: number } | null>(null);
  const [uploading, setUploading] = useState(false);

  const [gameOpen, setGameOpen] = useState(false);
  const [gameNonce, setGameNonce] = useState(0);
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const [history, setHistory] = useState<RoundRecord[]>([]);
  const [endOpen, setEndOpen] = useState(false);
  const [voting, setVoting] = useState(false);
  const [pendingPick, setPendingPick] = useState<string | null>(null);
  const [gameError, setGameError] = useState<string | null>(null);
  // The vote is persisted but the post-vote aggregate read failed.
  const [voteResultError, setVoteResultError] = useState(false);
  const [retryingResult, setRetryingResult] = useState(false);

  const { register, unregister } = useLayerStack();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isMobile = useMediaQuery('(max-width: 767px)');

  const detailListing = detailId ? (listingById.get(detailId) ?? null) : null;
  const lightboxListing = lightboxId ? (listingById.get(lightboxId) ?? null) : null;
  const myRating = detailId ? (myRatings.find(rating => rating.listing_id === detailId) ?? null) : null;
  const rateMyRating = addId ? (myRatings.find(rating => rating.listing_id === addId) ?? null) : null;

  const ids = useMemo(() => listings.map(listing => listing.id), [listings]);
  const pairs = useMemo(() => {
    if (ids.length < 2) return [];
    return buildPairs(shuffle([...ids].sort(), seededRng(`${ids.join(',')}#${gameNonce}`)));
  }, [ids, gameNonce]);
  const roundPairs = useMemo(() => pairs.slice(0, GAME_ROUNDS), [pairs]);
  const pair = roundPairs[round] ?? null;
  const cardA = pair ? (listingById.get(pair.a) ?? null) : null;
  const cardB = pair ? (listingById.get(pair.b) ?? null) : null;
  const nextPair = roundPairs[round + 1] ?? null;
  const nextCardA = nextPair ? (listingById.get(nextPair.a) ?? null) : null;
  const nextCardB = nextPair ? (listingById.get(nextPair.b) ?? null) : null;
  const alignment = useMemo(() => alignmentSummary(history), [history]);

  const closeDetail = useCallback(() => setDetailId(null), []);
  const closeAdd = useCallback(() => {
    setAddOpen(false);
    // A rate sheet opened from the detail modal hands control back to that modal.
    if (rateReturnTo === 'detail' && addId) setDetailId(addId);
    setRateReturnTo(null);
  }, [rateReturnTo, addId]);
  const closeGameLayer = useCallback(() => setGameOpen(false), []);
  const closeEnd = useCallback(() => setEndOpen(false), []);
  const closeLightbox = useCallback(() => setLightboxId(null), []);

  const detailRef = useLayer(!!detailId, closeDetail, register, unregister);
  const addRef = useLayer(addOpen, closeAdd, register, unregister);
  const gameRef = useLayer(gameOpen && !isDesktop, closeGameLayer, register, unregister);
  const endRef = useLayer(endOpen, closeEnd, register, unregister);
  const lightboxRef = useLayer(!!lightboxId, closeLightbox, register, unregister);

  useEffect(() => {
    let cancelled = false;
    fetchMyRatings().then(result => {
      if (!cancelled && result.ok) setMyRatings(result.ratings);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!addOpen || addView !== 'search') return;
    const query = addQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchState('idle');
      setSearchError(null);
      return;
    }
    let cancelled = false;
    setSearchState('loading');
    const timer = setTimeout(async () => {
      const result = await searchListingsAction(query);
      if (cancelled) return;
      if (result.ok) {
        setSearchResults(result.results);
        setSearchState('idle');
      } else {
        setSearchError(result.error);
        setSearchState('error');
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [addOpen, addView, addQuery]);

  useEffect(() => {
    if (!addOpen || addView !== 'rate' || !addId || rateScore !== null) return;
    const mine = myRatings.find(rating => rating.listing_id === addId);
    if (!mine) return;
    setRateScore(mine.score);
    setRateTraits({
      sour: mine.trait_sour ?? undefined,
      sweet: mine.trait_sweet ?? undefined,
      fizz: mine.trait_fizz ?? undefined,
      fruity: mine.trait_fruity ?? undefined,
    });
    setRateComment(mine.comment ?? '');
    setShowRateComment(!!mine.comment);
  }, [addOpen, addView, addId, myRatings, rateScore]);

  function openDetail(id: string) {
    setPhotoMessage(null);
    setPhotoError(null);
    setDetailId(id);
  }

  function openAdd(rateId?: string, options?: { returnTo?: 'game' | 'detail' }) {
    setAddOpen(true);
    if (!rateId) setAddQuery('');
    setSearchResults([]);
    setSearchState('idle');
    setSearchError(null);
    setRateDone(null);
    setRateError(null);
    setFormError(null);
    setDuplicateId(null);
    setDone(null);
    setRateReturnTo(options?.returnTo ?? null);
    if (rateId) {
      const mine = myRatings.find(rating => rating.listing_id === rateId);
      setAddId(rateId);
      setAddView('rate');
      setRateScore(mine?.score ?? null);
      setRateTraits({
        sour: mine?.trait_sour ?? undefined,
        sweet: mine?.trait_sweet ?? undefined,
        fizz: mine?.trait_fizz ?? undefined,
        fruity: mine?.trait_fruity ?? undefined,
      });
      setRateComment(mine?.comment ?? '');
      setShowRateComment(!!mine?.comment);
    } else {
      setAddId(null);
      setAddView('search');
      setRateScore(null);
      setRateTraits({});
      setRateComment('');
      setShowRateComment(false);
    }
  }

  function openNewForm(name: string) {
    setAddView('form');
    setForm({
      name,
      city: '',
      by: '',
      comment: '',
      score: null,
      traits: {},
      photoUrl: null,
      photoName: null,
      err: {},
      saving: false,
    });
    setFormError(null);
    setDuplicateId(null);
  }

  async function handleRateSubmit() {
    if (!addId || rateScore === null || rateSaving) return;
    setRateSaving(true);
    setRateError(null);
    const result = await rateListing({
      listingId: addId,
      score: rateScore,
      traits: rateTraits,
      comment: rateComment.trim() || undefined,
    });
    setRateSaving(false);
    if (!result.ok) {
      setRateError(result.error);
      return;
    }
    setRateDone(rateScore);
    const mine = await fetchMyRatings();
    if (mine.ok) setMyRatings(mine.ratings);
    router.refresh();
    if (rateReturnTo === 'game') {
      setAddOpen(false);
      setRateReturnTo(null);
      advance();
    } else if (rateReturnTo === 'detail') {
      // closeAdd() closes this sheet and reopens the origin detail modal,
      // which re-reads the refreshed listing on the next render.
      closeAdd();
    }
  }

  async function handleFormSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form || form.saving || uploading) return;
    const err: Record<string, string> = {};
    if (form.name.trim().length < 2) err.name = 'give it a name so others can find it.';
    if (form.score === null) err.score = 'pick a score from 1 to 10 — yours is the first rating.';
    if (Object.keys(err).length) {
      setForm({ ...form, err });
      return;
    }
    setForm({ ...form, saving: true, err: {} });
    setFormError(null);
    setDuplicateId(null);
    const text = form.comment.trim();
    const result = await createListing({
      name: form.name.trim(),
      description: text || undefined,
      score: form.score as number,
      traits: form.traits,
      comment: text && text.length <= 140 ? text : undefined,
      imageUrl: form.photoUrl || undefined,
      locationCity: form.city.trim() || undefined,
      addedBy: form.by.trim() || undefined,
    });
    if (!result.ok) {
      setForm({ ...form, saving: false });
      setFormError(result.error);
      if (result.duplicateOf) setDuplicateId(result.duplicateOf);
      return;
    }
    setForm({ ...form, saving: false });
    setDone({ id: result.listingId, name: form.name.trim(), score: form.score as number });
    setAddView('done');
    const mine = await fetchMyRatings();
    if (mine.ok) setMyRatings(mine.ratings);
    router.refresh();
  }

  async function handleFormPhoto(file: File) {
    setUploading(true);
    setFormError(null);
    try {
      const url = await uploadImage(file);
      setForm(current =>
        current ? { ...current, photoUrl: url, photoName: file.name, err: { ...current.err, photo: '' } } : current
      );
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'photo upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleContributePhoto(file: File) {
    if (!detailListing) return;
    setPhotoBusy(true);
    setPhotoError(null);
    setPhotoMessage(null);
    try {
      const url = await uploadImage(file);
      const result = await contributePhoto({ listingId: detailListing.id, imageUrl: url });
      if (!result.ok) {
        setPhotoError(result.error);
      } else if (result.updated) {
        setPhotoMessage('photo added — thanks for the first one!');
        router.refresh();
      } else {
        setPhotoMessage('someone already added a photo first — showing theirs.');
        router.refresh();
      }
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'photo upload failed');
    } finally {
      setPhotoBusy(false);
    }
  }

  function resizeGame() {
    setGameNonce(nonce => nonce + 1);
    setRound(0);
    setPicked(null);
    setPendingPick(null);
    setOutcome(null);
    setHistory([]);
    setEndOpen(false);
    setGameError(null);
    setVoteResultError(false);
    setRetryingResult(false);
  }

  function startGame() {
    resizeGame();
    setGameOpen(true);
  }

  function advance() {
    setPicked(null);
    setOutcome(null);
    setVoteResultError(false);
    setRetryingResult(false);
    if (round + 1 >= roundPairs.length) {
      setEndOpen(true);
    } else {
      setRound(current => current + 1);
    }
  }

  async function handlePick(listingId: string) {
    if (!pair || picked || voting) return;
    setVoting(true);
    setPendingPick(listingId);
    setGameError(null);
    // One action casts the vote and returns the persisted post-vote aggregate.
    const vote = await castVote({ lemonadeA: pair.a, lemonadeB: pair.b, picked: listingId });
    if (!vote.ok) {
      setGameError(vote.error);
      setVoting(false);
      setPendingPick(null);
      return;
    }
    const result = vote.result;
    setPicked(listingId);
    setPendingPick(null);
    setVoting(false);
    if (!result) {
      // The vote is stored; only reading the aggregate back failed. Keep the
      // pick acknowledged and offer a retry instead of a misleading error.
      setVoteResultError(true);
      return;
    }
    setVoteResultError(false);
    const scoreFor = (id: string) => listingById.get(id)?.avg_score ?? null;
    const roundOutcome = outcomeFor(result, listingId, {
      a: scoreFor(result.lemonade_a),
      b: scoreFor(result.lemonade_b),
    });
    setOutcome(roundOutcome);
    setHistory(records => [...records, { round, picked: listingId, outcome: roundOutcome }]);
    requestAnimationFrame(() => {
      gameRef.current?.querySelector<HTMLElement>('[data-act="game-had-it"]')?.focus({ preventScroll: true });
    });
  }

  /** Re-read the aggregate for the already-persisted vote, without re-voting. */
  async function retryVoteResult() {
    if (!pair || !picked || retryingResult) return;
    setRetryingResult(true);
    setGameError(null);
    const retry = await fetchMatchupResult(pair.a, pair.b);
    setRetryingResult(false);
    if (!retry.ok) {
      setGameError(retry.error);
      return;
    }
    const result = retry.result;
    if (!result) {
      setGameError('could not load this matchup');
      return;
    }
    const scoreFor = (id: string) => listingById.get(id)?.avg_score ?? null;
    const roundOutcome = outcomeFor(result, picked, {
      a: scoreFor(result.lemonade_a),
      b: scoreFor(result.lemonade_b),
    });
    setVoteResultError(false);
    setOutcome(roundOutcome);
    setHistory(records => [...records, { round, picked, outcome: roundOutcome }]);
    requestAnimationFrame(() => {
      gameRef.current?.querySelector<HTMLElement>('[data-act="game-had-it"]')?.focus({ preventScroll: true });
    });
  }

  const isProvisionalListing = detailListing
    ? ratingLabel(detailListing)
    : '';

  function renderLeaderboardRow(listing: ListingSummary, rank: number) {
    const medal = medalFor(rank, listing.avg_score);
    return (
      <li key={listing.id}>
        <button className="row" onClick={() => openDetail(listing.id)}>
          {medal ? (
            <span className="rk medal" role="img" aria-label={`${medal.name}, rank ${rank}`}>
              {medal.emoji}
            </span>
          ) : (
            <span className="rk">
              <span className="sr">rank </span>
              {rank}
            </span>
          )}
          <span className="thumb">
            <Thumb listing={listing} priority={rank === 1} />
          </span>
          <span className="row-name od-clamp-2">{listing.name}</span>
          <span className="score">
            {fmtScore(listing.avg_score)}
            <i aria-hidden="true">☆</i>
            <span className="sr"> out of 10</span>
          </span>
        </button>
      </li>
    );
  }

  function renderTraitRows(listing: ListingSummary, variant: 'detail' | 'card') {
    return TRAITS.flatMap(trait => {
      const { avg, count } = traitOf(listing, trait.key);
      // Traits nobody rated are omitted entirely — never a "–" placeholder row.
      if (count <= 0 || avg === null) return [];
      const level = Math.max(0, Math.min(3, Math.round(avg)));
      const label = trait.words[level];
      const title = `average ${avg.toFixed(1)} from ${count} rating${count === 1 ? '' : 's'}`;
      if (variant === 'card') {
        return [
          <span className="qc-row" key={trait.key}>
            <span className="qc-lab">{trait.key}</span>
            <Meter level={level} />
            <span className="qc-val">{label}</span>
          </span>,
        ];
      }
      return [
        <div className="detail-trait" key={trait.key} title={title}>
          <span className="qc-lab">{trait.key}</span>
          <Meter level={level} />
          <span className="qc-val">
            {label}
            <span className="trait-count"> · {count}</span>
          </span>
        </div>,
      ];
    });
  }

  function renderGameCard(listing: ListingSummary, position: 'left' | 'right') {
    const revealed = !!picked && !!outcome;
    const view = revealed ? revealFor(outcome!, listing.id) : null;
    const cardImage = listing.image_url ? (
      <LoadableImage
        className="od-media"
        src={listing.image_url}
        alt=""
        fill
        sizes={isDesktop ? '320px' : '(max-width: 767px) 90vw, 45vw'}
        loading={gameOpen ? 'eager' : 'lazy'}
      />
    ) : (
      <Placeholder name={listing.name} ratio="9 / 16" />
    );

    return (
      <div className="card-wrap" data-card-position={position}>
        {revealed ? (
          <div className={`qc is-shown`}>
            <span className="qc-in">
              <span className="qc-head">
                <span className="qc-code" aria-hidden="true">
                  🍋
                </span>
                <span className="qc-name od-clamp-2">{listing.name}</span>
              </span>
              <span className="qc-img">{cardImage}</span>
              <span className="qc-foot">
                <span className="qc-location od-truncate">{listing.location_city || 'somewhere'}</span>
                <span className="od-nowrap">submitted by: {listing.added_by || 'anon'}</span>
              </span>
            </span>
            <div className={`reveal ${view!.className}`} aria-live="polite">
              <div className="badge">
                <span className="lab">{view!.label}</span>
                {view!.percent === null ? null : (
                  <span className="pct">{view!.percent.toFixed(1).replace('.', ',')}%</span>
                )}
                <span className="result-score">
                  <span>{fmtScore(listing.avg_score)}</span>
                  <span className="result-score-star" aria-hidden="true">
                    ☆
                  </span>
                </span>
                {view!.note ? <span className="result-note">{view!.note}</span> : null}
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={`qc${pendingPick === listing.id ? ' is-pending' : ''}`}
            onClick={() => handlePick(listing.id)}
            disabled={voting || !!picked}
            aria-busy={pendingPick === listing.id || undefined}
            aria-label={`card ${position === 'left' ? 1 : 2}: ${listing.name}`}
          >
            <span className="qc-in">
              <span className="qc-head">
                <span className="qc-code" aria-hidden="true">
                  🍋
                </span>
                <span className="qc-name od-clamp-2">{listing.name}</span>
              </span>
              <span className="qc-img">{cardImage}</span>
              <span className="qc-foot">
                <span className="qc-location od-truncate">{listing.location_city || 'somewhere'}</span>
                <span className="od-nowrap">submitted by: {listing.added_by || 'anon'}</span>
              </span>
            </span>
            {pendingPick === listing.id ? (
              <span className="qc-pending" role="status">
                picking…
              </span>
            ) : null}
          </button>
        )}
        {isMobile ? (
          <button
            className="card-expand"
            type="button"
            onClick={() => setLightboxId(listing.id)}
            aria-haspopup="dialog"
            aria-label={`view ${listing.name} details full screen`}
          >
            ⛶
          </button>
        ) : null}
      </div>
    );
  }

  const shownRanked = showAll ? ranked : ranked.slice(0, 20);
  const detailMyRating = myRating;

  const rateListingForSheet = addId ? (listingById.get(addId) ?? null) : null;

  return (
    <>
      <header className="top">
        <div className="wrap bar od-row">
          <span className="lemon" aria-hidden="true">
            🍋
          </span>
          <div className="od-stack od-fill" style={{ '--od-gap': '2px' } as CSSProperties}>
            <h1 className="brand">lemolist</h1>
            <p className="tagline">rank ur lemonade</p>
          </div>
          <button className="header-add" onClick={() => openAdd()}>
            <span aria-hidden="true">+</span> add yours
          </button>
        </div>
      </header>

      <main className="wrap">
        <div className="top-actions">
          <button className="btn" onClick={startGame}>
            <span className="action-mark" aria-hidden="true">
              🔥
            </span>
            <span className="play-label-desktop">yay or nay</span>
            <span className="play-label-mobile">lemoguesser</span>
          </button>
          <button className="btn btn-ghost" onClick={() => openAdd()}>
            <span className="action-mark" aria-hidden="true">
              ⭐
            </span>
            add your limo
          </button>
        </div>

        <section className="lb" aria-labelledby="lb-h">
          <div className="lb-h">
            <h2 id="lb-h">leaderboard</h2>
            <small>{listings.length} lemonades</small>
          </div>
          {ranked.length === 0 ? (
            <div className="lb-empty">
              <p>no lemonades yet — be the first!</p>
              <button className="btn" onClick={() => openAdd()}>
                add your limo
              </button>
            </div>
          ) : (
            <>
              <ol className="board">{shownRanked.map(entry => renderLeaderboardRow(entry.listing, entry.rank))}</ol>
              {ranked.length > 20 ? (
                <div className="show-all">
                  <button className="btn btn-ghost" onClick={() => setShowAll(value => !value)} aria-expanded={showAll}>
                    {showAll ? 'show top 20' : `show all ${ranked.length}`}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>

        <p className="foot">help us find the best lemonade ever pls</p>
      </main>

      <button className="fab" onClick={() => openAdd()} aria-label="add your limo">
        <span className="action-mark" aria-hidden="true">
          +
        </span>
      </button>

      {/* ── yay or nay game layer (inline on desktop, full screen below 1024) ── */}
      <div
        className={`layer game game-layer${gameOpen && !isDesktop ? ' is-open' : ''}${isDesktop ? ' desktop-inline' : ''}`}
        ref={gameRef}
        role={isDesktop ? 'region' : 'dialog'}
        aria-modal={isDesktop ? undefined : true}
        aria-labelledby="game-h"
      >
        <div className="layer-screen od-screen">
          <div className="layer-bar">
            <h2 id="game-h">which one is better??</h2>
            <p>{history.filter(record => record.outcome.result === 'agreed').length}/{roundPairs.length || GAME_ROUNDS}</p>
            <button className="icon-btn" onClick={closeGameLayer} aria-label="close game">
              {X_ICON}
            </button>
          </div>
          <div className="od-scroll">
            <div className={`layer-body${picked && (outcome || voteResultError) ? ' has-followup' : ''}`}>
              {roundPairs.length === 0 ? (
                <div className="game-empty">
                  <p className="note">not enough lemonades to play yet — add two first!</p>
                  <button className="btn" onClick={() => openAdd()}>
                    add your limo
                  </button>
                </div>
              ) : (
                <>
                  <ol
                    className="squares"
                    aria-label={`round ${Math.min(round + 1, roundPairs.length)} of ${roundPairs.length}, ${alignment.agreed} right`}
                  >
                    {roundPairs.map((_, index) => {
                      const record = history[index];
                      const roundClass = record
                        ? record.outcome.result === 'agreed'
                          ? 'hit'
                          : record.outcome.result === 'tied'
                            ? 'tie'
                            : 'miss'
                        : '';
                      const roundLabel = record
                        ? record.outcome.result === 'agreed'
                          ? 'right'
                          : record.outcome.result === 'tied'
                            ? 'no winner'
                            : 'wrong'
                        : `round ${index + 1}`;
                      return record ? (
                        <li key={index} className={roundClass} aria-label={`round ${index + 1}: ${roundLabel}`}>
                          {record.outcome.result === 'agreed' ? '✓' : record.outcome.result === 'tied' ? '–' : '×'}
                        </li>
                      ) : (
                        <li key={index} className={index === round ? 'now' : ''} aria-label={`round ${index + 1}`}>
                          {index + 1}
                        </li>
                      );
                    })}
                  </ol>
                  {cardA ? renderGameCard(cardA, 'left') : null}
                  <div className={`or${picked && (outcome || voteResultError) ? ' has-followup' : ''}`}>
                    {picked && outcome ? (
                      <>
                        <p className="game-followup-copy">did you drink this?</p>
                        <div className="game-followup-actions">
                          <button type="button" className="btn" data-act="game-had-it" data-first onClick={() => openAdd(picked, { returnTo: 'game' })}>
                            yes
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={advance}>
                            next!
                          </button>
                        </div>
                      </>
                    ) : picked && voteResultError ? (
                      <>
                        <p className="game-followup-copy" role="status">
                          vote saved — result unavailable
                        </p>
                        <div className="game-followup-actions">
                          <button
                            type="button"
                            className="btn"
                            onClick={() => void retryVoteResult()}
                            disabled={retryingResult}
                            aria-busy={retryingResult || undefined}
                          >
                            {retryingResult ? 'retrying…' : 'retry'}
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={advance}>
                            next!
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="or-text" aria-hidden="true">
                        or
                      </p>
                    )}
                  </div>
                  {cardB ? renderGameCard(cardB, 'right') : null}
                  {gameError ? <p className="err flash">{gameError}</p> : null}
                </>
              )}
            </div>
          </div>
          <div />
        </div>
        {gameOpen || isDesktop ? (
          <GameWarmPair a={nextCardA} b={nextCardB} isDesktop={isDesktop} />
        ) : null}
      </div>

      {/* ── detail sheet ── */}
      <div className="sheet-host detail" data-open={String(!!detailId)} ref={detailRef}>
        <div className="scrim" onClick={closeDetail} />
        <div className="panel" role="dialog" aria-modal="true" aria-label={detailListing?.name ?? 'listing details'}>
          {detailListing ? (
            <>
              <div className="sheet-bar">
                <p>
                  #{rankOf.get(detailListing.id) ?? '–'} of {listings.length}
                </p>
                <button className="icon-btn" onClick={closeDetail} aria-label="close" data-first>
                  {X_ICON}
                </button>
              </div>
              {detailListing.image_url ? (
                <div className="detail-photo">
                  <LoadableImage
                    className="od-media"
                    src={detailListing.image_url}
                    alt={`photo of ${detailListing.name}`}
                    width={900}
                    height={1200}
                    sizes="(min-width: 768px) 560px, 100vw"
                    priority
                  />
                </div>
              ) : (
                <div className="detail-photo-contrib">
                  <Placeholder name={detailListing.name} ratio="16 / 9" />
                  <label className={`photo-drop${photoBusy ? ' photo-uploading' : ''}`}>
                    {photoBusy ? 'uploading…' : 'this one has no photo yet — add the first!'}
                    <input
                      className="sr"
                      type="file"
                      accept="image/*"
                      disabled={photoBusy}
                      onChange={event => {
                        const file = event.target.files?.[0];
                        if (file) void handleContributePhoto(file);
                        event.target.value = '';
                      }}
                    />
                  </label>
                  {photoMessage ? (
                    <p className="status" role="status">
                      {photoMessage}
                    </p>
                  ) : null}
                  {photoError ? (
                    <p className="err" role="alert">
                      {photoError}
                    </p>
                  ) : null}
                </div>
              )}
              <div className="sheet-body">
                <div className="detail-title">
                  <h2>{detailListing.name}</h2>
                </div>
                <div className="detail-traits" aria-label="score and taste profile">
                  <div
                    className="detail-trait detail-score-row"
                    aria-label={`Score ${fmtScore(detailListing.avg_score)} out of 10, ${isProvisionalListing}`}
                  >
                    <span className="qc-lab">score</span>
                    <Stars value={detailListing.avg_score} />
                    <span className="detail-score-value">
                      <strong>{fmtScore(detailListing.avg_score)}</strong>
                      <small>
                        ·{' '}
                        {detailListing.rating_count === 0
                          ? 'no ratings yet'
                          : `${detailListing.rating_count} rating${detailListing.rating_count === 1 ? '' : 's'}`}
                        {detailListing.rating_count === 1 && detailListing.legacy_rating_count === 0 ? ' · provisional' : ''}
                      </small>
                    </span>
                  </div>
                  {renderTraitRows(detailListing, 'detail')}
                </div>
                {detailListing.description ? (
                  <p className="quote">
                    “{detailListing.description}”
                    <span className="quote-by">{detailListing.added_by || 'anon'}</span>
                  </p>
                ) : (
                  <p className="quote" style={{ color: 'var(--muted)' }}>
                    no notes yet.
                  </p>
                )}
                {detailMyRating ? (
                  <p className="my-rating">
                    your rating: {detailMyRating.score}/10
                    {detailMyRating.comment ? ` — “${detailMyRating.comment}”` : ''}
                  </p>
                ) : null}
                <dl className="detail-meta">
                  <div>
                    <dt>location</dt>
                    <dd>{detailListing.location_city || 'somewhere'}</dd>
                  </div>
                  <div>
                    <dt>added</dt>
                    <dd>{fmtDate(detailListing.created_at)}</dd>
                  </div>
                </dl>
                <div className="detail-actions">
                  <button
                    className="btn"
                    onClick={() => {
                      const id = detailListing.id;
                      // Rate mode owns the top layer: close detail, remember its origin.
                      setDetailId(null);
                      openAdd(id, { returnTo: 'detail' });
                    }}
                  >
                    {detailMyRating ? 'edit your rating' : 'rate it'}
                  </button>
                  <button className="btn btn-ghost" onClick={closeDetail}>
                    close
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* ── add / rate sheet ── */}
      <div className="sheet-host" data-open={String(addOpen)} ref={addRef}>
        <div className="scrim" onClick={closeAdd} />
        <div
          className="panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby={addView === 'rate' ? 'rate-title' : 'add-q-l'}
        >
          <div className="add-bar" hidden={addView === 'rate'}>
            <div>
              <label htmlFor="add-q" id="add-q-l">
                add your limo
              </label>
              <div className="search-field">
                <input
                  id="add-q"
                  type="text"
                  autoComplete="off"
                  placeholder="how is it called?"
                  value={addQuery}
                  onChange={event => setAddQuery(event.target.value)}
                  disabled={addView !== 'search'}
                />
                <button className="icon-btn" onClick={closeAdd} aria-label="close">
                  {X_ICON}
                </button>
              </div>
            </div>
            {addView === 'search' && addQuery.trim().length >= 2 ? (
              <button className="btn add-cta-btn" onClick={() => openNewForm(addQuery.trim())}>
                + add “{addQuery.trim()}” as new
              </button>
            ) : null}
          </div>
          <div className="add-bar rate-sheet-bar" hidden={addView !== 'rate'}>
            <p id="rate-title">rate this lemonade</p>
            <button className="icon-btn" onClick={closeAdd} aria-label="close">
              {X_ICON}
            </button>
          </div>
          <div className="add-body" aria-live="polite">
            {addView === 'search' ? (
              <>
                {addQuery.trim().length === 1 ? <p className="note">Type one more letter to search.</p> : null}
                {addQuery.trim().length >= 2 ? (
                  <>
                    {searchState === 'loading' ? <p className="note">searching…</p> : null}
                    {searchState === 'error' ? (
                      <p className="err" role="alert">
                        {searchError}
                      </p>
                    ) : null}
                    {searchResults.length > 0 ? (
                      <>
                        <p className="note">one of these??</p>
                        <ul className="plain">
                          {searchResults.slice(0, 6).map(result => (
                            <li key={result.id}>
                              <button
                                className="res"
                                onClick={() => {
                                  openAdd(result.id);
                                }}
                              >
                                <span className="thumb">
                                  <Thumb listing={result} />
                                </span>
                                <span className="od-stack" style={{ '--od-gap': '2px' } as CSSProperties}>
                                  <span className="nm od-clamp-2">{result.name}</span>
                                  <span className="mt od-truncate">
                                    {result.location_city || 'somewhere'} · {ratingLabel(result)}
                                  </span>
                                </span>
                                <span className="go">rate →</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                    {searchState !== 'loading' && searchState !== 'error' && searchResults.length === 0 ? (
                      <p className="note">no match for “{addQuery.trim()}” — looks like it’s new!</p>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}

            {addView === 'rate' && rateListingForSheet ? (
              <div className="rate-view">
                {rateDone !== null ? (
                  <>
                    <p className="done-h" role="status">
                      <b>{rateDone}/10</b> <span aria-label="star">★</span>
                    </p>
                    <p className="note">saved for {rateListingForSheet.name}.</p>
                    {rateReturnTo === 'game' ? (
                      <button className="btn" data-first onClick={() => { setAddOpen(false); setRateReturnTo(null); advance(); }}>
                        back to game
                      </button>
                    ) : (
                      <>
                        <div className="two">
                          <button
                            className="btn btn-ghost"
                            onClick={() => {
                              setAddOpen(false);
                              openDetail(rateListingForSheet.id);
                            }}
                          >
                            details
                          </button>
                          <button className="btn" data-first onClick={() => openAdd()}>
                            rate another
                          </button>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="link-btn"
                      style={{ justifySelf: 'start' }}
                      onClick={() => {
                        if (rateReturnTo === 'detail') {
                          closeAdd();
                        } else {
                          setAddId(null);
                          setAddView('search');
                        }
                      }}
                    >
                      ← not this one
                    </button>
                    <div className="rate-title">
                      <p>{rateMyRating ? 'edit your rating' : 'your rating'}</p>
                      <h3>{rateListingForSheet.name}</h3>
                    </div>
                    <div className="rate-stars">
                      <ScorePicker
                        value={rateScore}
                        onPick={value => setRateScore(value)}
                        first={rateScore === null}
                        describedBy="e-rate-score"
                        statusId="e-rate-score"
                      />
                      <button
                        type="button"
                        className="link-btn rate-comment"
                        onClick={() => setShowRateComment(value => !value)}
                      >
                        {showRateComment ? '− remove comment' : '+ add a comment'}
                      </button>
                    </div>
                    <div className="rate-comment-field" hidden={!showRateComment}>
                      <label htmlFor="rate-comment">comment</label>
                      <textarea
                        className="input"
                        id="rate-comment"
                        maxLength={140}
                        placeholder="what did you think?"
                        value={rateComment}
                        onChange={event => setRateComment(event.target.value)}
                      />
                    </div>
                    <div className="field">
                      <p className="lbl">describe the taste (optional):</p>
                      <TraitChips
                        selected={rateTraits}
                        prefix="rate"
                        onToggle={(key, value) => {
                          const next = { ...rateTraits };
                          if (next[key] === value) delete next[key];
                          else next[key] = value;
                          setRateTraits(next);
                        }}
                      />
                    </div>
                    {rateError ? (
                      <p className="err" role="alert">
                        {rateError}
                      </p>
                    ) : null}
                    <button
                      className="btn range-submit"
                      onClick={handleRateSubmit}
                      disabled={rateScore === null || rateSaving}
                    >
                      {rateSaving ? 'saving…' : rateMyRating ? 'update rating' : 'submit rating'}
                    </button>
                  </>
                )}
              </div>
            ) : null}

            {addView === 'form' && form ? (
              <form className="boxed" onSubmit={handleFormSubmit} noValidate>
                <p className="note">new one — you’re the first to add it!</p>
                <div className="field">
                  <label htmlFor="f-name">
                    name <span className="req">*</span>
                  </label>
                  <input
                    className="input"
                    id="f-name"
                    value={form.name}
                    onChange={event => {
                      setForm({ ...form, name: event.target.value, err: { ...form.err, name: '' } });
                    }}
                    aria-describedby="e-name"
                    aria-invalid={!!form.err.name}
                    data-first
                  />
                  <p className="err" id="e-name">
                    {form.err.name || ''}
                  </p>
                </div>
                <div className="field">
                  <p className="lbl">photo (optional)</p>
                  {form.photoUrl ? (
                    <>
                      <div className="photo-prev">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="od-media" src={form.photoUrl} alt="your photo of the lemonade" />
                      </div>
                      <button
                        type="button"
                        className="link-btn"
                        style={{ justifySelf: 'start' }}
                        onClick={() => setForm({ ...form, photoUrl: null, photoName: null })}
                      >
                        remove photo
                      </button>
                    </>
                  ) : (
                    <label className={`photo-drop${uploading ? ' photo-uploading' : ''}`}>
                      {uploading ? 'uploading…' : '+ take or choose a photo'}
                      <input
                        className="sr"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        disabled={uploading}
                        onChange={event => {
                          const file = event.target.files?.[0];
                          if (file) void handleFormPhoto(file);
                          event.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="f-loc">where did you drink it?</label>
                  <div className="loc-row">
                    <input
                      className="input"
                      id="f-loc"
                      value={form.city}
                      onChange={event => setForm({ ...form, city: event.target.value })}
                      placeholder="city"
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        if (!navigator.geolocation) {
                          setForm({ ...form, err: { ...form.err, loc: 'your browser can’t share location — type the city instead.' } });
                          return;
                        }
                        setForm({ ...form, err: { ...form.err, loc: 'locating…' } });
                        navigator.geolocation.getCurrentPosition(
                          position =>
                            setForm(current =>
                              current
                                ? {
                                    ...current,
                                    err: {
                                      ...current.err,
                                      loc: `location found (${position.coords.latitude.toFixed(2)}, ${position.coords.longitude.toFixed(2)}) — type the city yourself, we don’t guess.`,
                                    },
                                  }
                                : current
                            ),
                          () =>
                            setForm(current =>
                              current
                                ? { ...current, err: { ...current.err, loc: 'location blocked or unavailable — type the city instead.' } }
                                : current
                            ),
                          { timeout: 8000 }
                        );
                      }}
                    >
                      use my location
                    </button>
                  </div>
                  <p className="status" role="status">
                    {form.err.loc || ''}
                  </p>
                </div>
                <div className="field">
                  <p className="lbl" id="f-score-l">
                    your score <span className="req">*</span>
                  </p>
                  <ScorePicker
                    value={form.score}
                    onPick={value => setForm({ ...form, score: value, err: { ...form.err, score: '' } })}
                    first={false}
                    describedBy="e-score"
                  />
                  <p className="err" id="e-score">
                    {form.err.score || ''}
                  </p>
                </div>
                <div className="field">
                  <p className="lbl">describe the taste (optional):</p>
                  <TraitChips
                    selected={form.traits}
                    prefix="form"
                    onToggle={(key, value) => {
                      const next = { ...form.traits };
                      if (next[key] === value) delete next[key];
                      else next[key] = value;
                      setForm({ ...form, traits: next });
                    }}
                  />
                </div>
                <div className="field">
                  <label htmlFor="f-desc">comment (optional)</label>
                  <textarea
                    className="input"
                    id="f-desc"
                    maxLength={140}
                    placeholder="special flavor? tastes like bubblegum??"
                    value={form.comment}
                    onChange={event => setForm({ ...form, comment: event.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="f-by">your name (optional)</label>
                  <input
                    className="input"
                    id="f-by"
                    maxLength={100}
                    value={form.by}
                    onChange={event => setForm({ ...form, by: event.target.value })}
                  />
                </div>
                {formError ? (
                  <p className="err" role="alert">
                    {formError}
                  </p>
                ) : null}
                {duplicateId ? (
                  <button type="button" className="btn btn-ghost" onClick={() => openAdd(duplicateId)}>
                    rate it instead
                  </button>
                ) : null}
                <button className="btn" type="submit" disabled={form.saving || uploading}>
                  {form.saving ? 'adding…' : uploading ? 'uploading…' : 'add limo'}
                </button>
              </form>
            ) : null}

            {addView === 'done' && done ? (
              <div className="boxed" role="status">
                <p className="done-h">added! 🍋</p>
                <p className="done-h">
                  {done.name} is in at <b>#{rankOf.get(done.id) ?? '…'}</b> of {listings.length}.
                </p>
                <p className="note">your score {done.score}/10 is the first real rating.</p>
                <div className="two">
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setAddOpen(false);
                      if (listingById.has(done.id)) openDetail(done.id);
                    }}
                  >
                    see it
                  </button>
                  <button className="btn" data-first onClick={() => openAdd()}>
                    add another
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── end-of-game modal ── */}
      <div className="modal-scrim" ref={endRef} style={endOpen ? { display: 'grid' } : undefined}>
        {endOpen ? (
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="end-h">
            <p className="party" aria-hidden="true">
              🎉
            </p>
            <h2 id="end-h">thanks for playing!</h2>
            {alignment.decided > 0 ? (
              <>
                <p className="big">
                  {alignment.agreed}
                  <small>/{alignment.decided}</small>
                </p>
                <p className="ttl">{alignmentTitle(alignment.agreed, alignment.decided)}</p>
                <p>{alignmentNote(alignment)}</p>
              </>
            ) : (
              <>
                <p className="note">
                  {alignment.ties > 0
                    ? `no winner in ${alignment.ties} matchup${alignment.ties === 1 ? '' : 's'} yet — pick a side to get started.`
                    : 'no rounds played yet — pick a side to get started.'}
                </p>
                <p className="ttl">{alignmentTitle(0, 0)}</p>
              </>
            )}
            <button className="btn" data-first onClick={() => { setEndOpen(false); openAdd(); }}>
              submit your own limo
            </button>
            <button className="btn btn-ghost" onClick={() => { setEndOpen(false); resizeGame(); }}>
              play again
            </button>
            <button
              className="link-btn"
              onClick={() => {
                setEndOpen(false);
                if (isDesktop) resizeGame();
                else setGameOpen(false);
              }}
            >
              back to start
            </button>
          </div>
        ) : null}
      </div>

      {/* ── mobile card lightbox ── */}
      <div className={`card-lightbox${lightboxListing ? ' is-open' : ''}`} ref={lightboxRef}>
        {lightboxListing ? (
          <>
            <div className="card-lightbox-scrim" aria-hidden="true" onClick={closeLightbox} />
            <section className="card-lightbox-panel" role="dialog" aria-modal="true" aria-labelledby="card-lightbox-title">
              <button className="icon-btn card-lightbox-close" type="button" onClick={closeLightbox} aria-label="close image" data-first>
                {X_ICON}
              </button>
              <div className="card-lightbox-photo">
                {lightboxListing.image_url ? (
                  <LoadableImage
                    className="od-media"
                    src={lightboxListing.image_url}
                    alt={`photo of ${lightboxListing.name}`}
                    width={900}
                    height={1200}
                    sizes="(max-width: 960px) 100vw, 960px"
                    loading="eager"
                  />
                ) : (
                  <Placeholder name={lightboxListing.name} ratio="9 / 16" />
                )}
              </div>
              <div className="card-lightbox-caption">
                <h2 id="card-lightbox-title">{lightboxListing.name}</h2>
                <p className="card-lightbox-byline">submitted by: {lightboxListing.added_by || 'anon'}</p>
                <p className="card-lightbox-location">{lightboxListing.location_city || 'location not listed'}</p>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}

function ScorePicker({
  value,
  onPick,
  first,
  describedBy,
  statusId,
}: {
  value: number | null;
  onPick: (value: number) => void;
  first: boolean;
  describedBy?: string;
  statusId?: string;
}) {
  return (
    <>
      <div className="score-picker" role="group" aria-label="choose a score from 1 to 10">
        {Array.from({ length: 10 }, (_, index) => {
          const n = index + 1;
          return (
            <button
              key={n}
              type="button"
              className={value !== null && value >= n ? 'is-filled' : ''}
              onClick={() => onPick(n)}
              aria-label={`${n} out of 10 stars`}
              aria-pressed={value === n}
              aria-describedby={describedBy}
              data-first={first && index === 0 ? true : undefined}
            >
              {value !== null && value >= n ? '★' : '☆'}
            </button>
          );
        })}
      </div>
      <p className="star-count" aria-live="polite" id={statusId}>
        {value === null ? 'choose 1 to 10 stars' : `${value} of 10 stars`}
      </p>
    </>
  );
}

function TraitChips({
  selected,
  prefix,
  onToggle,
}: {
  selected: Partial<Record<TraitKey, number>>;
  prefix: string;
  onToggle: (key: TraitKey, value: number) => void;
}) {
  return (
    <div className="traits">
      {TRAITS.map(trait => (
        <fieldset className="trait" key={trait.key}>
          <legend>{trait.label}</legend>
          <div className="chips">
            {trait.words.map((word, index) => (
              <button
                key={word}
                type="button"
                data-p={`${prefix}-${trait.key}`}
                aria-pressed={selected[trait.key] === index}
                onClick={() => onToggle(trait.key, index)}
              >
                {word}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
