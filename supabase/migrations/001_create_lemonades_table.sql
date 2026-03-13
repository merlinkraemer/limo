-- Create lemonades table with all required fields and constraints
CREATE TABLE IF NOT EXISTS public.lemonades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  flavor_rating INTEGER NOT NULL CHECK (flavor_rating BETWEEN 1 AND 10),
  sourness_rating INTEGER NOT NULL CHECK (sourness_rating BETWEEN 1 AND 10),
  overall_score DOUBLE PRECISION GENERATED ALWAYS AS (((flavor_rating + sourness_rating) / 2.0)) STORED,
  image_url TEXT,
  location_city TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for efficient leaderboard queries (ordered by overall_score DESC, then by created_at ASC)
CREATE INDEX IF NOT EXISTS idx_lemonades_overall_score ON public.lemonades(overall_score DESC, created_at ASC);

-- Enable Row Level Security (RLS) - disabled for MVP (no auth)
ALTER TABLE public.lemonades ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access (MVP - no authentication)
CREATE POLICY "Enable read access for all users" ON public.lemonades
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON public.lemonades
  FOR INSERT WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_lemonades_updated_at
  BEFORE UPDATE ON public.lemonades
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
