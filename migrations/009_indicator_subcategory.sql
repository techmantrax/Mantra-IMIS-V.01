-- ════════════════════════════════════════════════════════════════
-- Migration 009 — indicator sub-category columns
-- ════════════════════════════════════════════════════════════════
--
-- Creates a new table outcome_indicator_category with the 3 standard
-- change-type categories used to classify OUTCOME indicators:
--   OIC-001  Capacity Building
--   OIC-002  Process & Structure
--   OIC-003  System Change
--
-- Activity/Output indicators reuse the existing activity_category table
-- (Training & Capacity Building, Community Outreach, etc.)
--
-- Adds two nullable FK columns to public.indicator:
--   outcome_ind_cat_id  → outcome_indicator_category  (for outcome indicators)
--   activity_category_id → activity_category           (for activity indicators)
--
-- NOTE: indicator_category_id (IC-001/IC-002/IC-003) remains the superset
-- type and is auto-set by the application — not shown to users.
-- ════════════════════════════════════════════════════════════════

-- 1. New table for outcome indicator categories
CREATE TABLE IF NOT EXISTS public.outcome_indicator_category (
  outcome_ind_cat_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name       TEXT        NOT NULL,
  category_code       TEXT        NOT NULL UNIQUE,
  sort_order          INT         NOT NULL DEFAULT 99,
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Seed the 3 categories
INSERT INTO public.outcome_indicator_category (category_name, category_code, sort_order) VALUES
  ('Capacity Building',   'OIC-001', 1),
  ('Process & Structure', 'OIC-002', 2),
  ('System Change',       'OIC-003', 3)
ON CONFLICT (category_code) DO NOTHING;

-- 3. Enable RLS
ALTER TABLE public.outcome_indicator_category ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "oic_read_all"
  ON public.outcome_indicator_category FOR SELECT USING (true);

-- 4. Add FK columns to indicator
ALTER TABLE public.indicator
  ADD COLUMN IF NOT EXISTS outcome_ind_cat_id  UUID
    REFERENCES public.outcome_indicator_category(outcome_ind_cat_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activity_category_id UUID
    REFERENCES public.activity_category(activity_category_id) ON DELETE SET NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_indicator_outcome_ind_cat  ON public.indicator(outcome_ind_cat_id);
CREATE INDEX IF NOT EXISTS idx_indicator_activity_cat     ON public.indicator(activity_category_id);
