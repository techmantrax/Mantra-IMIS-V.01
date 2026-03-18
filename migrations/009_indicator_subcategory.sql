-- ════════════════════════════════════════════════════════════════
-- Migration 009 — indicator sub-category columns
-- ════════════════════════════════════════════════════════════════
--
-- Adds two nullable FK columns to public.indicator so that:
--   • Outcome indicators carry outcome_category_id
--     (FK → outcome_categories: Education & Learning, Health & Nutrition…)
--   • Activity/Output indicators carry activity_category_id
--     (FK → activity_category: Training & Cap Building, Community Outreach…)
--
-- The existing indicator_category_id (IC-001/IC-002/IC-003) remains as the
-- superset type and is auto-set by the application based on parent context.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.indicator
  ADD COLUMN IF NOT EXISTS outcome_category_id  UUID
    REFERENCES public.outcome_categories(outcome_category_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activity_category_id UUID
    REFERENCES public.activity_category(activity_category_id) ON DELETE SET NULL;

-- Indexes for FK lookups
CREATE INDEX IF NOT EXISTS idx_indicator_outcome_cat  ON public.indicator(outcome_category_id);
CREATE INDEX IF NOT EXISTS idx_indicator_activity_cat ON public.indicator(activity_category_id);
