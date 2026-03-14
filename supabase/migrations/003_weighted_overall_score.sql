-- Change overall_score from simple average to weighted: 65% flavor, 35% sourness
-- Generated columns can't be altered, so we drop and recreate
ALTER TABLE public.lemonades DROP COLUMN overall_score;
ALTER TABLE public.lemonades
  ADD COLUMN overall_score DOUBLE PRECISION GENERATED ALWAYS AS ((flavor_rating * 0.65 + sourness_rating * 0.35)) STORED;
