-- ════════════════════════════════════════════════════════════════
-- Migration 009 — Re-seed outcome_categories
-- ════════════════════════════════════════════════════════════════
--
-- Replaces the placeholder thematic categories (Education, Health…)
-- with the correct three programme-level outcome change types:
--
--   OCC-001  Capacity Building
--   OCC-002  Process & Structure
--   OCC-003  System Change
--
-- These are the categories shown in the M&E Book when creating an
-- Outcome. Indicators under an Outcome carry NO separate category —
-- they already belong to the IC-002 Outcome superset type.
-- ════════════════════════════════════════════════════════════════

-- 1. Insert new categories first (needed before re-pointing outcomes)
INSERT INTO public.outcome_categories (category_name, category_code, description, sort_order, is_active)
VALUES
  ('Capacity Building',   'OCC-001', 'Indicators measuring change in individual or organisational capacity',    1, true),
  ('Process & Structure', 'OCC-002', 'Indicators measuring improvements in processes, systems, or structures', 2, true),
  ('System Change',       'OCC-003', 'Indicators measuring broader systemic or institutional level change',    3, true)
ON CONFLICT (category_code) DO NOTHING;

-- 2. Move all existing outcomes to Capacity Building (NOT NULL constraint requires a valid FK)
--    Users can re-assign via M&E Book after migration
UPDATE public.outcome
SET outcome_category_id = (
  SELECT outcome_category_id FROM public.outcome_categories WHERE category_code = 'OCC-001'
);

-- 3. Delete the old placeholder rows (no longer referenced)
DELETE FROM public.outcome_categories WHERE category_code NOT IN ('OCC-001', 'OCC-002', 'OCC-003');
