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
