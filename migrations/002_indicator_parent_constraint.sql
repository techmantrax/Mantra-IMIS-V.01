-- ═══════════════════════════════════════════════════════════════════════════
--  MIGRATION 002 — Indicator Parent Constraint
--  Project : Mantra IMIS
--  Date    : 2026-03-17
--
--  Scope:
--    Only two indicator types in M&E Builder:
--      IC-001 (Output)  → must have activity_id SET
--      IC-002 (Outcome) → must have outcome_id  SET
--
--    IC-003 (Impact/Program Goal) → calculated from raw_submission
--                                   NOT managed via indicator table
--
--  This migration adds ONE check constraint to enforce the rule.
--  Nothing else. No new tables. No new columns.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── Drop if exists (idempotent) ───────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.indicator
    DROP CONSTRAINT IF EXISTS chk_indicator_parent;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ── Add constraint ────────────────────────────────────────────────────────
--  Rule: every non-template indicator MUST be linked to either:
--    outcome_id  (Outcome indicator — IC-002)
--    activity_id (Output indicator  — IC-001)
--  Template indicators (is_template = true) are exempt — no parent yet.
-- ─────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.indicator
    ADD CONSTRAINT chk_indicator_parent CHECK (
      is_template = true
      OR outcome_id  IS NOT NULL
      OR activity_id IS NOT NULL
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── Verify ────────────────────────────────────────────────────────────────
SELECT
  ic.category_name                              AS indicator_type,
  ic.category_code                              AS code,
  COUNT(i.indicator_id)                         AS total_indicators,
  COUNT(i.activity_id)                          AS linked_to_activity,
  COUNT(i.outcome_id)                           AS linked_to_outcome
FROM public.indicator_category ic
LEFT JOIN public.indicator i
       ON i.indicator_category_id = ic.indicator_category_id
WHERE ic.category_code IN ('IC-001', 'IC-002')
GROUP BY ic.category_name, ic.category_code
ORDER BY ic.category_code;
