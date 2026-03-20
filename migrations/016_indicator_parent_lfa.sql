-- ════════════════════════════════════════════════════════════════
-- Migration 016 — Update ck_indicator_exactly_one_parent for LFA columns
-- ════════════════════════════════════════════════════════════════
-- The constraint ck_indicator_exactly_one_parent was created in the original
-- schema and requires outcome_id OR activity_id to be set.
-- LFA-linked indicators use lfa_outcome_id / lfa_activity_id instead.
-- This migration drops the old constraint and adds a relaxed version.

-- Also drop chk_indicator_parent if it exists (from migration 002),
-- to avoid duplicate / conflicting constraints.
ALTER TABLE public.indicator DROP CONSTRAINT IF EXISTS ck_indicator_exactly_one_parent;
ALTER TABLE public.indicator DROP CONSTRAINT IF EXISTS chk_indicator_parent;

-- New unified parent constraint:
-- A non-template indicator must link to ONE of:
--   outcome_id        (old M&E Book path)
--   activity_id       (old M&E Book path)
--   lfa_outcome_id    (new LFA path — added migration 014)
--   lfa_activity_id   (new LFA path — added migration 014)
ALTER TABLE public.indicator
  ADD CONSTRAINT ck_indicator_parent CHECK (
    is_template = true
    OR outcome_id      IS NOT NULL
    OR activity_id     IS NOT NULL
    OR lfa_outcome_id  IS NOT NULL
    OR lfa_activity_id IS NOT NULL
  );

-- ════════════════════════════════════════════════════════════════
-- DONE
-- ════════════════════════════════════════════════════════════════
