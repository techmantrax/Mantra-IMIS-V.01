-- ============================================================
-- Migration 008: Monthly Reporting — raw_submission
-- Stores POC-entered indicator actuals per program / month.
-- Supports draft → submitted → approved / rejected workflow.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.raw_submission (
  raw_submission_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Composite key for upsert on conflict
  indicator_row_id   TEXT        NOT NULL,   -- builder row id (numeric string or UUID)
  indicator_name     TEXT        NOT NULL,
  program_name       TEXT        NOT NULL,
  reporting_month    TEXT        NOT NULL,   -- e.g. 'Feb 2026'
  fiscal_year        TEXT,                  -- e.g. '2025-26'

  -- Actual data
  actual_value       TEXT,                  -- kept as text: supports %, score, yes/no
  remarks            TEXT,
  is_flagged         BOOLEAN     NOT NULL DEFAULT false,

  -- Workflow status
  actual_status      TEXT        NOT NULL DEFAULT 'submitted',
                                            -- draft | submitted | approved | rejected

  -- Timestamps
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at        TIMESTAMPTZ,
  reviewed_by        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (indicator_row_id, program_name, reporting_month, fiscal_year)
);

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION trg_fn_raw_submission_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_raw_submission_updated_at ON public.raw_submission;
CREATE TRIGGER trg_raw_submission_updated_at
  BEFORE UPDATE ON public.raw_submission
  FOR EACH ROW EXECUTE FUNCTION trg_fn_raw_submission_updated_at();

-- RLS
ALTER TABLE public.raw_submission ENABLE ROW LEVEL SECURITY;

CREATE POLICY "raw_submission_read_all"
  ON public.raw_submission FOR SELECT USING (true);

CREATE POLICY "raw_submission_anon_write"
  ON public.raw_submission FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "raw_submission_auth_write"
  ON public.raw_submission FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Verify
SELECT 'raw_submission' AS tbl, COUNT(*) FROM public.raw_submission;
