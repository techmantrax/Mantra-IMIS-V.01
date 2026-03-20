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

-- 1. Rename existing OCC-001/002/003 rows in-place (avoids FK churn)
UPDATE public.outcome_categories SET
  category_name = 'Capacity Building',
  description   = 'Indicators measuring change in individual or organisational capacity',
  sort_order    = 1
WHERE category_code = 'OCC-001';

UPDATE public.outcome_categories SET
  category_name = 'Process & Structure',
  description   = 'Indicators measuring improvements in processes, systems, or structures',
  sort_order    = 2
WHERE category_code = 'OCC-002';

UPDATE public.outcome_categories SET
  category_name = 'System Change',
  description   = 'Indicators measuring broader systemic or institutional level change',
  sort_order    = 3
WHERE category_code = 'OCC-003';

-- 2. Move any outcomes still on OCC-004/005/006 to OCC-001 before deleting
UPDATE public.outcome
SET outcome_category_id = (
  SELECT outcome_category_id FROM public.outcome_categories WHERE category_code = 'OCC-001'
)
WHERE outcome_category_id IN (
  SELECT outcome_category_id FROM public.outcome_categories
  WHERE category_code NOT IN ('OCC-001', 'OCC-002', 'OCC-003')
);

-- 3. Delete the leftover placeholder rows
DELETE FROM public.outcome_categories WHERE category_code NOT IN ('OCC-001', 'OCC-002', 'OCC-003');
