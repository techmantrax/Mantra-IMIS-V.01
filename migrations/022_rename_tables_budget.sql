-- ══════════════════════════════════════════════════════════════
--  Migration 022 — Rename tables to match their real meaning
--
--  BEFORE             AFTER           MEANING
--  budget_category → budget_head    (top-level grouping: Personnel, Travel…)
--  budget_head     → budget_line    (line items: Salaries, Consultant Fees…)
-- ══════════════════════════════════════════════════════════════

-- 1. Rename budget_head → budget_line FIRST (frees up the name)
ALTER TABLE public.budget_head RENAME TO budget_line;

-- 2. Rename budget_category → budget_head
ALTER TABLE public.budget_category RENAME TO budget_head;

-- 3. Rename PK on budget_line (was budget_head_id)
ALTER TABLE public.budget_line RENAME COLUMN budget_head_id TO budget_line_id;

-- 4. Rename PK on budget_head (was budget_category_id)
ALTER TABLE public.budget_head RENAME COLUMN budget_category_id TO budget_head_id;

-- 5. Rename FK on budget_line that links to budget_head (was budget_category_id)
ALTER TABLE public.budget_line RENAME COLUMN budget_category_id TO budget_head_id;

-- 6. Update trigger function to reference the new table name
CREATE OR REPLACE FUNCTION trg_fn_budget_head_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.head_code IS NULL THEN
    NEW.head_code := imis_generate_unique_code('BH', 'budget_line', 'head_code');
  END IF;
  RETURN NEW;
END;
$$;
