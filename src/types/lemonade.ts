import { z } from 'zod';

// Database schema types
export interface Lemonade {
  id: string;
  name: string;
  description: string;
  flavor_rating: number;
  sourness_rating: number;
  overall_score: number;
  image_url: string | null;
  location_city: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

// Form input types
export interface CreateLemonadeInput {
  name: string;
  description: string;
  flavorRating: number;
  sournessRating: number;
  imageUrl?: string;
  locationCity?: string;
  addedBy?: string;
}

// Form state for useActionState
export interface FormState {
  errors?: {
    name?: string[];
    description?: string[];
    flavorRating?: string[];
    sournessRating?: string[];
    imageUrl?: string[];
    locationCity?: string[];
    addedBy?: string[];
    _form?: string[];
  };
  message?: string;
  success?: boolean;
}

// Zod schema for lemonade form validation
export const lemonadeFormSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters'),
  flavorRating: z
    .number()
    .min(1, 'Flavor rating must be at least 1')
    .max(10, 'Flavor rating must be at most 10'),
  sournessRating: z
    .number()
    .min(1, 'Sourness rating must be at least 1')
    .max(10, 'Sourness rating must be at most 10'),
  imageUrl: z.string().url('Invalid image URL').optional().or(z.literal('')),
  locationCity: z
    .string()
    .min(1, 'City must be at least 1 character')
    .max(100, 'City must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  addedBy: z
    .string()
    .max(100, 'Name must be less than 100 characters')
    .optional()
    .or(z.literal('')),
});

export type LemonadeFormData = z.infer<typeof lemonadeFormSchema>;

// ---------------------------------------------------------------------------
// Phase A: community ratings, merges and preference votes
// ---------------------------------------------------------------------------

export type TraitKey = 'sour' | 'sweet' | 'fizz' | 'fruity';

export const traitLevelSchema = z.number().int().min(0).max(3);

export const traitsSchema = z
  .object({
    sour: traitLevelSchema.nullable().optional(),
    sweet: traitLevelSchema.nullable().optional(),
    fizz: traitLevelSchema.nullable().optional(),
    fruity: traitLevelSchema.nullable().optional(),
  })
  .strict();

export const newListingSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .or(z.literal('')),
  score: z
    .number()
    .int('Score must be a whole number')
    .min(1, 'Score must be at least 1')
    .max(10, 'Score must be at most 10'),
  traits: traitsSchema.optional(),
  comment: z
    .string()
    .max(140, 'Comment must be 140 characters or fewer')
    .optional()
    .or(z.literal('')),
  imageUrl: z.string().url('Invalid image URL').optional().or(z.literal('')),
  locationCity: z
    .string()
    .max(100, 'City must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  addedBy: z
    .string()
    .max(100, 'Name must be less than 100 characters')
    .optional()
    .or(z.literal('')),
});

export const ratingSubmissionSchema = z.object({
  listingId: z.string().uuid('Invalid listing id'),
  score: z
    .number()
    .int('Score must be a whole number')
    .min(1, 'Score must be at least 1')
    .max(10, 'Score must be at most 10'),
  traits: traitsSchema.optional(),
  comment: z
    .string()
    .max(140, 'Comment must be 140 characters or fewer')
    .optional()
    .or(z.literal('')),
});

export const photoContributionSchema = z.object({
  listingId: z.string().uuid('Invalid listing id'),
  imageUrl: z.string().url('Invalid image URL'),
});

export const matchupVoteSchema = z
  .object({
    lemonadeA: z.string().uuid('Invalid listing id'),
    lemonadeB: z.string().uuid('Invalid listing id'),
    picked: z.string().uuid('Invalid listing id'),
  })
  .superRefine((value, ctx) => {
    if (value.lemonadeA === value.lemonadeB) {
      ctx.addIssue({ code: 'custom', message: 'Pick two different lemonades' });
    }
    if (value.picked !== value.lemonadeA && value.picked !== value.lemonadeB) {
      ctx.addIssue({ code: 'custom', message: 'Your pick must be one of the two lemonades' });
    }
  });

export type NewListingData = z.infer<typeof newListingSchema>;
export type RatingSubmissionData = z.infer<typeof ratingSubmissionSchema>;
export type MatchupVoteData = z.infer<typeof matchupVoteSchema>;

/** A canonical listing with truthful rating aggregates from `listing_summaries`. */
export interface ListingSummary {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  location_city: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
  /** legacy two-axis metrics; NULL for listings created after Phase A */
  flavor_rating: number | null;
  sourness_rating: number | null;
  overall_score: number | null;
  rating_count: number;
  legacy_rating_count: number;
  visitor_rating_count: number;
  /** the single exact historical score, when present */
  legacy_score: number | null;
  visitor_avg_score: number | null;
  /** average across every real rating; NULL when nobody rated yet */
  avg_score: number | null;
  min_score: number | null;
  max_score: number | null;
  /** NULL traits mean "not enough real votes to say" */
  trait_sour_avg: number | null;
  trait_sweet_avg: number | null;
  trait_fizz_avg: number | null;
  trait_fruity_avg: number | null;
  trait_sour_count: number;
  trait_sweet_count: number;
  trait_fizz_count: number;
  trait_fruity_count: number;
}

export type ListingSearchResult = Pick<
  ListingSummary,
  | 'id'
  | 'name'
  | 'description'
  | 'image_url'
  | 'location_city'
  | 'added_by'
  | 'created_at'
  | 'flavor_rating'
  | 'sourness_rating'
  | 'overall_score'
  | 'rating_count'
  | 'legacy_rating_count'
  | 'visitor_rating_count'
  | 'avg_score'
  | 'legacy_score'
>;

export interface BrowserRating {
  listing_id: string;
  score: number;
  trait_sour: number | null;
  trait_sweet: number | null;
  trait_fizz: number | null;
  trait_fruity: number | null;
  comment: string | null;
  updated_at: string;
}

export interface MatchupResult {
  lemonade_a: string;
  lemonade_b: string;
  votes_a: number;
  votes_b: number;
  total_votes: number;
  /** NULL until at least one real vote exists - never a fake crowd */
  percent_a: number | null;
  percent_b: number | null;
}

export interface CreateListingInput {
  name: string;
  description?: string;
  score: number;
  traits?: Partial<Record<TraitKey, number | null>>;
  comment?: string;
  imageUrl?: string;
  locationCity?: string;
  addedBy?: string;
}

export interface CreateListingResult {
  /** NULL when an equivalent canonical listing already exists */
  listingId: string | null;
  duplicateOf: string | null;
}

export interface RatingSubmissionInput {
  listingId: string;
  score: number;
  traits?: Partial<Record<TraitKey, number | null>>;
  comment?: string;
}

export function firstFieldError(error: z.ZodError): string {
  const issues = error.issues ?? [];
  return issues[0]?.message ?? 'Invalid input';
}
