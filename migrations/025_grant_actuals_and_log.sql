-- ════════════════════════════════════════════════════════════════
-- Migration 025 — Grant Actuals & Upload Log
--
-- Only creates what is genuinely NEW:
--   grant_budget_monthly_actuals  — monthly burn data per budget line
--   grant_burn_upload_log         — audit trail of every file upload
--   grants.upload_profile         — JSONB column for column-mapping profile
--
-- All other grant tables (grants, grant_framework_budget, etc.) are
-- assumed to already exist from the Grant Setup wizard.
-- ════════════════════════════════════════════════════════════════

-- ── 1. Add upload_profile to grants if missing ───────────────────
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS upload_profile JSONB;

-- ── 2. grant_budget_monthly_actuals ─────────────────────────────
-- Drop first to clear any partial table from a previous failed run.
DROP TABLE IF EXISTS public.grant_budget_monthly_actuals CASCADE;
CREATE TABLE public.grant_budget_monthly_actuals (
  actual_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id              UUID        NOT NULL,
  framework_budget_id   UUID        NOT NULL,
  financial_year        TEXT        NOT NULL,
  month_index           SMALLINT    NOT NULL CHECK (month_index BETWEEN 0 AND 11),
  actual_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
  source_file           TEXT,
  uploaded_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (framework_budget_id, financial_year, month_index)
);

CREATE INDEX IF NOT EXISTS idx_gma_grant_id ON public.grant_budget_monthly_actuals (grant_id);
CREATE INDEX IF NOT EXISTS idx_gma_fy       ON public.grant_budget_monthly_actuals (financial_year);

-- ── 3. grant_burn_upload_log ─────────────────────────────────────
-- Drop first to clear any partial table from a previous failed run.
DROP TABLE IF EXISTS public.grant_burn_upload_log CASCADE;
CREATE TABLE public.grant_burn_upload_log (
  log_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id          UUID,
  program_id        UUID,
  financial_year    TEXT,
  upload_month      TEXT,
  file_name         TEXT,
  rows_processed    INT         DEFAULT 0,
  rows_matched      INT         DEFAULT 0,
  rows_unmatched    INT         DEFAULT 0,
  total_amount      NUMERIC(18,2) DEFAULT 0,
  unmatched_codes   TEXT[]      DEFAULT '{}',
  upload_status     TEXT        NOT NULL DEFAULT 'success',
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bul_grant_id ON public.grant_burn_upload_log (grant_id);
CREATE INDEX IF NOT EXISTS idx_bul_uploaded ON public.grant_burn_upload_log (uploaded_at DESC);

-- ── 4. RLS ───────────────────────────────────────────────────────
ALTER TABLE public.grant_budget_monthly_actuals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gma_read_all"   ON public.grant_budget_monthly_actuals;
DROP POLICY IF EXISTS "gma_anon_write" ON public.grant_budget_monthly_actuals;
DROP POLICY IF EXISTS "gma_auth_write" ON public.grant_budget_monthly_actuals;
CREATE POLICY "gma_read_all"   ON public.grant_budget_monthly_actuals FOR SELECT USING (true);
CREATE POLICY "gma_anon_write" ON public.grant_budget_monthly_actuals FOR ALL TO anon         USING (true) WITH CHECK (true);
CREATE POLICY "gma_auth_write" ON public.grant_budget_monthly_actuals FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.grant_burn_upload_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bul_read_all"   ON public.grant_burn_upload_log;
DROP POLICY IF EXISTS "bul_anon_write" ON public.grant_burn_upload_log;
DROP POLICY IF EXISTS "bul_auth_write" ON public.grant_burn_upload_log;
CREATE POLICY "bul_read_all"   ON public.grant_burn_upload_log FOR SELECT USING (true);
CREATE POLICY "bul_anon_write" ON public.grant_burn_upload_log FOR ALL TO anon         USING (true) WITH CHECK (true);
CREATE POLICY "bul_auth_write" ON public.grant_burn_upload_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 5. Verify ────────────────────────────────────────────────────
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns c
   WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS col_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'grant_budget_monthly_actuals',
    'grant_burn_upload_log'
  )
ORDER BY table_name;
