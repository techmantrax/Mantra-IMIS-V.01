-- ════════════════════════════════════════════════════════════════
-- Migration 025 — End-to-End Grant Management DB Wiring
--
-- Creates:
--   grant_budget_monthly_actuals  — stores per-line monthly burn data
--   grant_burn_upload_log         — audit log of every burn file upload
--
-- Alters:
--   grants                        — adds upload_profile JSONB column
--
-- Also ensures all wizard-created grant tables exist (idempotent).
-- ════════════════════════════════════════════════════════════════

-- ── 0. Ensure core grant tables exist (created via dashboard, guarded) ──

CREATE TABLE IF NOT EXISTS public.grants (
  grant_id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id                UUID        REFERENCES public.donor(donor_id) ON DELETE SET NULL,
  grant_name              TEXT        NOT NULL,
  grant_code              TEXT,
  grant_status            TEXT        NOT NULL DEFAULT 'active',
  total_committed_amount  NUMERIC(18,2),
  currency                TEXT        NOT NULL DEFAULT 'INR',
  financial_year_id       UUID,
  start_date              DATE,
  end_date                DATE,
  description             TEXT,
  upload_profile          JSONB,
  is_active               BOOLEAN     NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grant_financial_year_mapping (
  mapping_id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id            UUID  NOT NULL REFERENCES public.grants(grant_id) ON DELETE CASCADE,
  financial_year_id   UUID  NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (grant_id, financial_year_id)
);

CREATE TABLE IF NOT EXISTS public.grant_program_scope (
  scope_id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id            UUID  NOT NULL REFERENCES public.grants(grant_id) ON DELETE CASCADE,
  program_id          UUID  NOT NULL REFERENCES public.program(program_id) ON DELETE CASCADE,
  financial_year_id   UUID,
  allocated_amount    NUMERIC(18,2),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (grant_id, program_id)
);

CREATE TABLE IF NOT EXISTS public.grant_intervention_scope (
  intervention_scope_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id              UUID NOT NULL REFERENCES public.grants(grant_id) ON DELETE CASCADE,
  program_id            UUID,
  intervention_id       UUID,
  financial_year_id     UUID,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grant_framework_budget (
  framework_budget_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id              UUID        NOT NULL REFERENCES public.grants(grant_id) ON DELETE CASCADE,
  financial_year_id     UUID,
  program_id            UUID,
  intervention_id       UUID,
  budget_category_code  TEXT,
  budget_line_code      TEXT,
  budget_head_name      TEXT,
  code_aliases          TEXT[]      DEFAULT '{}',
  unit_count            NUMERIC,
  cost_per_unit         NUMERIC(18,2),
  allocated_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
  budget_status         TEXT        NOT NULL DEFAULT 'active',
  sort_order            INT         NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grant_disbursement_schedule (
  disbursement_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id          UUID NOT NULL REFERENCES public.grants(grant_id) ON DELETE CASCADE,
  installment_no    INT  NOT NULL DEFAULT 1,
  due_date          DATE,
  expected_amount   NUMERIC(18,2) DEFAULT 0,
  received_amount   NUMERIC(18,2) DEFAULT 0,
  received_date     DATE,
  status            TEXT DEFAULT 'planned',
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grant_reporting_schedule (
  reporting_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id              UUID NOT NULL REFERENCES public.grants(grant_id) ON DELETE CASCADE,
  report_type           TEXT,
  reporting_period_end  DATE,
  due_date              DATE,
  submitted_at          DATE,
  status                TEXT DEFAULT 'planned',
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grant_indicator_commitment (
  commitment_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id                  UUID NOT NULL REFERENCES public.grants(grant_id) ON DELETE CASCADE,
  indicator_id              UUID,
  financial_year_id         UUID,
  committed_target_value    NUMERIC,
  reporting_frequency       TEXT,
  is_key_outcome_indicator  BOOLEAN DEFAULT false,
  remarks                   TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grant_document (
  document_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id        UUID NOT NULL REFERENCES public.grants(grant_id) ON DELETE CASCADE,
  document_type   TEXT,
  document_name   TEXT,
  document_url    TEXT,
  version_number  INT DEFAULT 1,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 1. Add upload_profile to grants (safe if already exists) ────────────
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS upload_profile JSONB;

-- ── 2. grant_budget_monthly_actuals ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.grant_budget_monthly_actuals (
  actual_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id              UUID        NOT NULL REFERENCES public.grants(grant_id) ON DELETE CASCADE,
  framework_budget_id   UUID        NOT NULL REFERENCES public.grant_framework_budget(framework_budget_id) ON DELETE CASCADE,
  financial_year        TEXT        NOT NULL,          -- e.g. '2025-26'
  month_index           SMALLINT    NOT NULL CHECK (month_index BETWEEN 0 AND 11),
  -- 0=Apr 1=May 2=Jun 3=Jul 4=Aug 5=Sep 6=Oct 7=Nov 8=Dec 9=Jan 10=Feb 11=Mar
  actual_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
  source_file           TEXT,
  uploaded_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (framework_budget_id, financial_year, month_index)
);

CREATE INDEX IF NOT EXISTS idx_gma_grant_id   ON public.grant_budget_monthly_actuals (grant_id);
CREATE INDEX IF NOT EXISTS idx_gma_fy         ON public.grant_budget_monthly_actuals (financial_year);

-- ── 3. grant_burn_upload_log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.grant_burn_upload_log (
  log_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id          UUID        REFERENCES public.grants(grant_id) ON DELETE SET NULL,
  program_id        UUID        REFERENCES public.program(program_id) ON DELETE SET NULL,
  financial_year    TEXT,
  upload_month      TEXT,
  file_name         TEXT,
  rows_processed    INT         DEFAULT 0,
  rows_matched      INT         DEFAULT 0,
  rows_unmatched    INT         DEFAULT 0,
  total_amount      NUMERIC(18,2) DEFAULT 0,
  unmatched_codes   TEXT[]      DEFAULT '{}',
  upload_status     TEXT        NOT NULL DEFAULT 'success',  -- success | partial | failed
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bul_grant_id ON public.grant_burn_upload_log (grant_id);
CREATE INDEX IF NOT EXISTS idx_bul_uploaded ON public.grant_burn_upload_log (uploaded_at DESC);

-- ── 4. RLS on all new / core tables ──────────────────────────────────────
DO $$ BEGIN
  -- grants
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='grants' AND policyname='grants_read_all') THEN
    ALTER TABLE public.grants ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "grants_read_all"   ON public.grants FOR SELECT USING (true);
    CREATE POLICY "grants_anon_write" ON public.grants FOR ALL TO anon USING (true) WITH CHECK (true);
    CREATE POLICY "grants_auth_write" ON public.grants FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  -- grant_framework_budget
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='grant_framework_budget' AND policyname='gfb_read_all') THEN
    ALTER TABLE public.grant_framework_budget ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "gfb_read_all"   ON public.grant_framework_budget FOR SELECT USING (true);
    CREATE POLICY "gfb_anon_write" ON public.grant_framework_budget FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;

  -- grant_program_scope
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='grant_program_scope' AND policyname='gps_read_all') THEN
    ALTER TABLE public.grant_program_scope ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "gps_read_all"   ON public.grant_program_scope FOR SELECT USING (true);
    CREATE POLICY "gps_anon_write" ON public.grant_program_scope FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;

  -- grant_disbursement_schedule
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='grant_disbursement_schedule' AND policyname='gds_read_all') THEN
    ALTER TABLE public.grant_disbursement_schedule ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "gds_read_all"   ON public.grant_disbursement_schedule FOR SELECT USING (true);
    CREATE POLICY "gds_anon_write" ON public.grant_disbursement_schedule FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;

  -- grant_reporting_schedule
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='grant_reporting_schedule' AND policyname='grs_read_all') THEN
    ALTER TABLE public.grant_reporting_schedule ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "grs_read_all"   ON public.grant_reporting_schedule FOR SELECT USING (true);
    CREATE POLICY "grs_anon_write" ON public.grant_reporting_schedule FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- grant_budget_monthly_actuals
ALTER TABLE public.grant_budget_monthly_actuals ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "gma_read_all"   ON public.grant_budget_monthly_actuals FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "gma_anon_write" ON public.grant_budget_monthly_actuals FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "gma_auth_write" ON public.grant_budget_monthly_actuals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- grant_burn_upload_log
ALTER TABLE public.grant_burn_upload_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "bul_read_all"   ON public.grant_burn_upload_log FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "bul_anon_write" ON public.grant_burn_upload_log FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "bul_auth_write" ON public.grant_burn_upload_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 5. Verify ─────────────────────────────────────────────────────────────
SELECT tablename, (SELECT COUNT(*) FROM information_schema.columns WHERE table_name=tablename AND table_schema='public') AS col_count
FROM pg_tables
WHERE schemaname='public'
  AND tablename IN (
    'grants','grant_framework_budget','grant_program_scope',
    'grant_disbursement_schedule','grant_reporting_schedule',
    'grant_budget_monthly_actuals','grant_burn_upload_log'
  )
ORDER BY tablename;
