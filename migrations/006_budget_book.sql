-- ============================================================
-- Migration 006: Budget Book
-- Master repository for Budget Heads, Donors, and Grant Programs.
-- Feeds dropdown selections in Grant Setup.
--
-- Tables created:
--   budget_head   → BH-001, BH-002 …
--   donor         → DOR-001, DOR-002 …
--   grant_program → GRT-001, GRT-002 …
-- ============================================================

-- ── 1. budget_head ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budget_head (
  budget_head_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  head_code       TEXT        UNIQUE,
  head_name       TEXT        NOT NULL,
  category        TEXT,       -- Personnel, Training, Travel, Equipment, Programs, Overheads…
  description     TEXT,
  sort_order      INT         DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-code trigger for budget_head
CREATE OR REPLACE FUNCTION trg_fn_budget_head_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.head_code IS NULL THEN
    NEW.head_code := imis_generate_unique_code('BH', 'budget_head', 'head_code');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_budget_head_code ON public.budget_head;
CREATE TRIGGER trg_budget_head_code
  BEFORE INSERT ON public.budget_head
  FOR EACH ROW EXECUTE FUNCTION trg_fn_budget_head_code();

-- ── 2. donor ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.donor (
  donor_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_code      TEXT        UNIQUE,
  donor_name      TEXT        NOT NULL,
  donor_type      TEXT,       -- Bilateral, Multilateral, Foundation, CSR, Government, Individual
  country         TEXT,
  website         TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-code trigger for donor
CREATE OR REPLACE FUNCTION trg_fn_donor_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.donor_code IS NULL THEN
    NEW.donor_code := imis_generate_unique_code('DOR', 'donor', 'donor_code');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_donor_code ON public.donor;
CREATE TRIGGER trg_donor_code
  BEFORE INSERT ON public.donor
  FOR EACH ROW EXECUTE FUNCTION trg_fn_donor_code();

-- ── 3. grant_program ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.grant_program (
  grant_program_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_code       TEXT        UNIQUE,
  grant_name       TEXT        NOT NULL,
  donor_id         UUID        REFERENCES public.donor(donor_id) ON DELETE SET NULL,
  grant_type       TEXT,       -- Restricted Project, Unrestricted Core, Emergency, Research, Capacity Building
  currency         TEXT        NOT NULL DEFAULT 'INR',
  total_amount     NUMERIC(18,2),
  start_date       DATE,
  end_date         DATE,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-code trigger for grant_program
CREATE OR REPLACE FUNCTION trg_fn_grant_program_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.grant_code IS NULL THEN
    NEW.grant_code := imis_generate_unique_code('GRT', 'grant_program', 'grant_code');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_program_code ON public.grant_program;
CREATE TRIGGER trg_grant_program_code
  BEFORE INSERT ON public.grant_program
  FOR EACH ROW EXECUTE FUNCTION trg_fn_grant_program_code();

-- ── 4. Seed: Budget Head categories ─────────────────────────
INSERT INTO public.budget_head (head_name, category, description, sort_order) VALUES
  ('Personnel & HR',            'Personnel',   'Staff salaries, consultant fees, HR costs',         10),
  ('Training & Capacity Building', 'Programs', 'Workshops, trainings, materials, facilitation',     20),
  ('Travel & Transport',        'Operations',  'Field visits, inter-city travel, local conveyance',  30),
  ('Equipment & Supplies',      'Operations',  'Hardware, stationery, consumables',                 40),
  ('Program Activities',        'Programs',    'Direct program delivery costs',                      50),
  ('Communication & Outreach',  'Programs',    'IEC materials, media, community mobilisation',       60),
  ('Research & Documentation',  'Programs',    'Studies, assessments, printing, publications',       70),
  ('Infrastructure & Utilities','Operations',  'Office rent, utilities, maintenance',                80),
  ('Overheads & Administration','Overheads',   'Admin support, indirect costs, statutory charges',   90),
  ('Monitoring & Evaluation',   'Programs',    'M&E activities, data collection, reporting',        100)
ON CONFLICT DO NOTHING;

-- ── 5. RLS — mirror the existing tables' policy pattern ──────
ALTER TABLE public.budget_head   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donor         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_program ENABLE ROW LEVEL SECURITY;

-- Allow anon + authenticated to read all rows
CREATE POLICY "budget_head_read_all"   ON public.budget_head   FOR SELECT USING (true);
CREATE POLICY "donor_read_all"         ON public.donor         FOR SELECT USING (true);
CREATE POLICY "grant_program_read_all" ON public.grant_program FOR SELECT USING (true);

-- Allow authenticated users full write access
CREATE POLICY "budget_head_write"      ON public.budget_head   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "donor_write"            ON public.donor         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "grant_program_write"    ON public.grant_program FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Also allow anon writes (needed if app uses anon key only, no auth)
CREATE POLICY "budget_head_anon_write"   ON public.budget_head   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "donor_anon_write"         ON public.donor         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "grant_program_anon_write" ON public.grant_program FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── 6. Verify ────────────────────────────────────────────────
SELECT 'budget_head'   AS tbl, COUNT(*) FROM public.budget_head   UNION ALL
SELECT 'donor'         AS tbl, COUNT(*) FROM public.donor          UNION ALL
SELECT 'grant_program' AS tbl, COUNT(*) FROM public.grant_program;
