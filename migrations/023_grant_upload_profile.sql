-- ══════════════════════════════════════════════════════════════
--  Migration 023 — Upload Profile per Grant
--  Adds upload_profile JSONB column to grant_program.
--  Stores per-donor column mapping for burn file uploads.
--
--  Shape: {
--    code_col:   "Budget Code",      ← exact column name for budget code
--    amount_col: "Allocated Amount", ← exact column name for amount
--    date_col:   "Ref Date",         ← exact column name for date/month
--    date_type:  "date"              ← "date" (parse month from date)
--                                       "month_text" (already a month name)
--  }
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.grant_program
  ADD COLUMN IF NOT EXISTS upload_profile JSONB;
