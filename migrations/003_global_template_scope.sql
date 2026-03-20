-- ============================================================
-- Migration 003: Global Template Scope for M&E Book
-- ============================================================
-- Problem: outcome, activity, indicator, activity_outcome_map
--          all have intervention_stakeholder_type_map_id NOT NULL.
--          This blocks creation of global template records (is_template=true)
--          that have no ISTM scope — which is required for the M&E Book.
--
-- Solution:
--   1. Make istm_id nullable on all 4 tables
--   2. Add is_template column to activity (it was missing)
--   3. Add CHECK constraints: non-template rows MUST have istm_id
--   4. Re-generate code trigger handles OC-GEN-XXX for templates
-- ============================================================

-- ── 1. outcome: make istm_id nullable ──────────────────────
ALTER TABLE outcome
  ALTER COLUMN intervention_stakeholder_type_map_id DROP NOT NULL;

ALTER TABLE outcome
  ADD CONSTRAINT chk_outcome_scope
  CHECK (is_template = true OR intervention_stakeholder_type_map_id IS NOT NULL);

-- ── 2. activity: add is_template + make istm_id nullable ───
ALTER TABLE activity
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;

ALTER TABLE activity
  ALTER COLUMN intervention_stakeholder_type_map_id DROP NOT NULL;

ALTER TABLE activity
  ADD CONSTRAINT chk_activity_scope
  CHECK (is_template = true OR intervention_stakeholder_type_map_id IS NOT NULL);

-- ── 3. indicator: make istm_id nullable ────────────────────
ALTER TABLE indicator
  ALTER COLUMN intervention_stakeholder_type_map_id DROP NOT NULL;

ALTER TABLE indicator
  ADD CONSTRAINT chk_indicator_scope
  CHECK (is_template = true OR intervention_stakeholder_type_map_id IS NOT NULL);

-- ── 4. activity_outcome_map: make istm_id nullable ─────────
--    istm_id = NULL  → global map (M&E Book)
--    istm_id = <id>  → program-scoped map (LFA Setup)
ALTER TABLE activity_outcome_map
  ALTER COLUMN intervention_stakeholder_type_map_id DROP NOT NULL;

-- ── 5. Index for fast global template queries ───────────────
CREATE INDEX IF NOT EXISTS idx_outcome_template
  ON outcome (is_template, is_active)
  WHERE is_template = true;

CREATE INDEX IF NOT EXISTS idx_activity_template
  ON activity (is_template, is_active)
  WHERE is_template = true;

CREATE INDEX IF NOT EXISTS idx_indicator_template
  ON indicator (is_template, is_active)
  WHERE is_template = true;

CREATE INDEX IF NOT EXISTS idx_aom_global
  ON activity_outcome_map (outcome_id, activity_id)
  WHERE intervention_stakeholder_type_map_id IS NULL;
