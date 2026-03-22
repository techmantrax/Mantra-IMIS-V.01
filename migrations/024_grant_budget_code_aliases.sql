-- ══════════════════════════════════════════════════════════════
--  Migration 024 — Code Aliases on Grant Budget Lines
--  Adds code_aliases TEXT[] to grant_framework_budget.
--
--  Allows each grant budget line to carry multiple alternate
--  codes (donor-specific, shorthand, legacy) that the burn
--  upload parser will recognise in addition to the primary code.
--
--  Example:
--    budget_line_code = 'A-01'
--    code_aliases     = ['SALARY-SR', 'A.1', 'HR-A1']
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.grant_framework_budget
  ADD COLUMN IF NOT EXISTS code_aliases TEXT[] NOT NULL DEFAULT '{}';
