-- ============================================================
-- Migration 020: Budget Lines
-- Granular line-item layer sitting between grant_program and
-- budget_head.  Each row represents one coded expenditure line
-- (A.1, A.2, C.1 …) within a specific grant.
--
-- Key columns:
--   line_code          → donor's code (A.1, C.1 …)
--   allocation_factor  → fraction of shared cost attributed here
--                        (0.5 = 50 %); 1.0 = fully assigned
--   code_aliases       → alternate codes from other donor file
--                        formats pointing to same line
-- ============================================================

CREATE TABLE IF NOT EXISTS public.budget_line (
  budget_line_id    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  line_sys_code     TEXT          UNIQUE,                                   -- auto BL-001
  grant_program_id  UUID          NOT NULL
                    REFERENCES public.grant_program(grant_program_id)
                    ON DELETE CASCADE,
  budget_head_id    UUID
                    REFERENCES public.budget_head(budget_head_id)
                    ON DELETE SET NULL,
  line_code         TEXT          NOT NULL,                                  -- e.g. A.1
  line_desc         TEXT          NOT NULL,                                  -- e.g. Salaries & Benefits
  sanctioned_amount NUMERIC(18,2),                                           -- budget allocation
  allocation_factor NUMERIC(5,4)  NOT NULL DEFAULT 1.0                       -- 0.01 – 1.00
                    CHECK (allocation_factor > 0 AND allocation_factor <= 1),
  code_aliases      TEXT[]        NOT NULL DEFAULT '{}',                     -- ['HR-01','1A']
  is_active         BOOLEAN       NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (grant_program_id, line_code)
);

-- ── Auto-code trigger ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_fn_budget_line_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.line_sys_code IS NULL THEN
    NEW.line_sys_code := imis_generate_unique_code('BL', 'budget_line', 'line_sys_code');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_budget_line_code ON public.budget_line;
CREATE TRIGGER trg_budget_line_code
  BEFORE INSERT ON public.budget_line
  FOR EACH ROW EXECUTE FUNCTION trg_fn_budget_line_code();

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.budget_line ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_line_read_all"
  ON public.budget_line FOR SELECT USING (true);

CREATE POLICY "budget_line_write"
  ON public.budget_line FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "budget_line_anon_write"
  ON public.budget_line FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Verify ───────────────────────────────────────────────────────
SELECT 'budget_line' AS tbl, COUNT(*) FROM public.budget_line;
