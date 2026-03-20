-- ════════════════════════════════════════════════════════════════
-- Migration 015 — Relax chk_indicator_scope for LFA-linked indicators
-- ════════════════════════════════════════════════════════════════
-- chk_indicator_scope (from migration 003) requires:
--   is_template = true OR intervention_stakeholder_type_map_id IS NOT NULL
--
-- LFA-linked indicators (from M&E Builder) have neither — they link via
-- lfa_outcome_id or lfa_activity_id (added in migration 014).
-- This migration relaxes the constraint to allow those too.

ALTER TABLE public.indicator DROP CONSTRAINT IF EXISTS chk_indicator_scope;

ALTER TABLE public.indicator
  ADD CONSTRAINT chk_indicator_scope CHECK (
    is_template = true
    OR intervention_stakeholder_type_map_id IS NOT NULL
    OR lfa_outcome_id  IS NOT NULL
    OR lfa_activity_id IS NOT NULL
  );

-- ════════════════════════════════════════════════════════════════
-- DONE
-- ════════════════════════════════════════════════════════════════
