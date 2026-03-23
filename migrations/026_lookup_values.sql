-- ════════════════════════════════════════════════════════════════
-- Migration 026 — Lookup Values Table
--
-- Single table for all small enumerations (replaces every
-- hardcoded option list in the Grant Management UI):
--   grant_status, donor_type, grant_type, disbursement_status,
--   report_type, frequency, currency
--
-- Also adds css_class column to donor table so card colours
-- come from DB instead of donor-name string matching.
-- ════════════════════════════════════════════════════════════════

-- ── 1. lookup_values ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lookup_values (
  lookup_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lookup_type TEXT        NOT NULL,   -- e.g. 'grant_status', 'donor_type', …
  code        TEXT        NOT NULL,   -- stored value  (e.g. 'active')
  label       TEXT        NOT NULL,   -- display label (e.g. 'Active')
  css_class   TEXT,                   -- optional CSS class / colour hint
  sort_order  INT         NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lookup_type, code)
);

ALTER TABLE public.lookup_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "lv_read_all"   ON public.lookup_values FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "lv_anon_write" ON public.lookup_values FOR ALL TO anon         USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "lv_auth_write" ON public.lookup_values FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 2. Seed — grant_status ────────────────────────────────────────
INSERT INTO public.lookup_values (lookup_type, code, label, css_class, sort_order) VALUES
  ('grant_status', 'active',     'Active',     'status-active',   10),
  ('grant_status', 'pipeline',   'Pipeline',   'status-pipeline', 20),
  ('grant_status', 'proposal',   'Proposal',   'status-proposal', 30),
  ('grant_status', 'on_hold',    'On Hold',    'status-hold',     40),
  ('grant_status', 'completed',  'Completed',  'status-done',     50),
  ('grant_status', 'cancelled',  'Cancelled',  'status-cancel',   60),
  ('grant_status', 'closed',     'Closed',     'status-cancel',   70)
ON CONFLICT DO NOTHING;

-- ── 3. Seed — donor_type (unified set for wizard + Budget Book) ───
INSERT INTO public.lookup_values (lookup_type, code, label, sort_order) VALUES
  ('donor_type', 'Bilateral',          'Bilateral',            10),
  ('donor_type', 'Multilateral',       'Multilateral',         20),
  ('donor_type', 'Private Foundation', 'Private Foundation',   30),
  ('donor_type', 'CSR',                'CSR (Corporate)',      40),
  ('donor_type', 'Government',         'Government',           50),
  ('donor_type', 'Individual',         'Individual',           60),
  ('donor_type', 'NGO',                'NGO / INGO',           70),
  ('donor_type', 'Other',              'Other',                80)
ON CONFLICT DO NOTHING;

-- ── 4. Seed — grant_type (unified set for wizard + Budget Book) ───
INSERT INTO public.lookup_values (lookup_type, code, label, sort_order) VALUES
  ('grant_type', 'Restricted Project',  'Restricted Project',   10),
  ('grant_type', 'Unrestricted Core',   'Unrestricted Core',    20),
  ('grant_type', 'Emergency Relief',    'Emergency Relief',     30),
  ('grant_type', 'Research Grant',      'Research Grant',       40),
  ('grant_type', 'Capacity Building',   'Capacity Building',    50),
  ('grant_type', 'Institutional',       'Institutional',        60),
  ('grant_type', 'Other',               'Other',                70)
ON CONFLICT DO NOTHING;

-- ── 5. Seed — disbursement_status ────────────────────────────────
INSERT INTO public.lookup_values (lookup_type, code, label, css_class, sort_order) VALUES
  ('disbursement_status', 'planned',          'Planned',          'ds-planned',  10),
  ('disbursement_status', 'due',              'Due',              'ds-due',      20),
  ('disbursement_status', 'received_partial', 'Partial',          'ds-partial',  30),
  ('disbursement_status', 'received_full',    'Received (Full)',  'ds-full',     40),
  ('disbursement_status', 'delayed',          'Delayed',          'ds-delayed',  50),
  ('disbursement_status', 'waived',           'Waived',           'ds-waived',   60)
ON CONFLICT DO NOTHING;

-- ── 6. Seed — report_type ─────────────────────────────────────────
INSERT INTO public.lookup_values (lookup_type, code, label, sort_order) VALUES
  ('report_type', 'narrative',    'Narrative',          10),
  ('report_type', 'financial',    'Financial',          20),
  ('report_type', 'utilization',  'Utilisation UC',     30),
  ('report_type', 'indicator',    'Indicator',          40),
  ('report_type', 'quarterly',    'Quarterly',          50),
  ('report_type', 'annual',       'Annual',             60),
  ('report_type', 'mid_term',     'Mid-Term Review',    70),
  ('report_type', 'end_term',     'End-Term Report',    80),
  ('report_type', 'other',        'Other',              90)
ON CONFLICT DO NOTHING;

-- ── 7. Seed — frequency ──────────────────────────────────────────
INSERT INTO public.lookup_values (lookup_type, code, label, sort_order) VALUES
  ('frequency', 'monthly',    'Monthly',    10),
  ('frequency', 'quarterly',  'Quarterly',  20),
  ('frequency', 'bi_annual',  'Bi-Annual',  30),
  ('frequency', 'annual',     'Annual',     40),
  ('frequency', 'one_time',   'One-Time',   50)
ON CONFLICT DO NOTHING;

-- ── 8. Seed — currency ────────────────────────────────────────────
INSERT INTO public.lookup_values (lookup_type, code, label, sort_order) VALUES
  ('currency', 'INR', 'INR (₹)',  10),
  ('currency', 'USD', 'USD ($)',  20),
  ('currency', 'EUR', 'EUR (€)',  30),
  ('currency', 'GBP', 'GBP (£)',  40),
  ('currency', 'JPY', 'JPY (¥)',  50),
  ('currency', 'AUD', 'AUD (A$)', 60),
  ('currency', 'CAD', 'CAD (C$)', 70)
ON CONFLICT DO NOTHING;

-- ── 9. Add css_class to donor table ──────────────────────────────
ALTER TABLE public.donor ADD COLUMN IF NOT EXISTS css_class TEXT;

-- ── 10. Verify ────────────────────────────────────────────────────
SELECT lookup_type, COUNT(*) AS values_count
FROM public.lookup_values
GROUP BY lookup_type
ORDER BY lookup_type;
