-- ═══════════════════════════════════════════════════════════════════════════
--  MIGRATION 001 — AUTO CODE GENERATION (Fully Locked)
--  Project : Mantra IMIS
--  Date    : 2026-03-17
--  Author  : System
--
--  Rules:
--    • Codes are ALWAYS system-generated — no user input accepted
--    • On every INSERT, the trigger fires and OVERWRITES any provided code
--    • Format: PREFIX-{ABBR}-{SEQ:03d}  e.g. IND-FL-001
--    • Sequence is per-prefix (each prefix has its own counter)
--    • Uniqueness guaranteed via loop check
--
--  Tables covered:
--    1. indicator          → indicator_code        IND-{cat_abbr}-{seq}
--    2. intervention       → intervention_code     IV-{type_abbr}-{seq}
--    3. outcome            → outcome_code          OC-{cat_code}-{seq}
--    4. activity           → activity_code         ACT-{cat_abbr}-{seq}
--    5. outcome_categories → category_code         OCC-{seq}
--    6. activity_category  → category_code         ACC-{seq}
--    7. indicator_category → (added col if missing) IC-{seq}
--    8. donor              → donor_code            DNR-{seq}
--    9. grants             → grant_code            GRT-{fy_abbr}-{seq}
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
--  STEP 1: Shared helper function
--  generate_unique_code(base_prefix TEXT, table_name TEXT, code_column TEXT)
--  Returns next available code like 'IND-FL-001'
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION imis_generate_unique_code(
  p_prefix      TEXT,       -- e.g. 'IND-FL', 'OC-TL', 'DNR'
  p_table       TEXT,       -- e.g. 'indicator'
  p_col         TEXT        -- e.g. 'indicator_code'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seq     INTEGER := 1;
  v_code    TEXT;
  v_exists  BOOLEAN;
  v_sql     TEXT;
BEGIN
  -- Find next sequence number for this prefix
  v_sql := format(
    'SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(%I, ''^.*-(\d+)$'', ''\1''), '''') AS INTEGER)), 0) + 1
     FROM %I
     WHERE %I LIKE %L',
    p_col, p_table, p_col, p_prefix || '-%'
  );
  EXECUTE v_sql INTO v_seq;
  v_seq := COALESCE(v_seq, 1);

  -- Build candidate code
  v_code := p_prefix || '-' || LPAD(v_seq::TEXT, 3, '0');

  -- Ensure uniqueness (loop on collision)
  LOOP
    v_sql := format('SELECT EXISTS(SELECT 1 FROM %I WHERE %I = %L)', p_table, p_col, v_code);
    EXECUTE v_sql INTO v_exists;
    EXIT WHEN NOT v_exists;
    v_seq  := v_seq + 1;
    v_code := p_prefix || '-' || LPAD(v_seq::TEXT, 3, '0');
  END LOOP;

  RETURN v_code;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────
--  STEP 2: Helper — derive 3-char UPPERCASE abbreviation from a name
--  e.g. 'Foundational Literacy' → 'FOU'  |  'Teacher Dev' → 'TEA'
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION imis_abbr(p_name TEXT, p_fallback TEXT DEFAULT 'GEN')
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  RETURN UPPER(LEFT(REGEXP_REPLACE(COALESCE(TRIM(p_name), ''), '[^A-Za-z]', '', 'g'), 3));
EXCEPTION WHEN OTHERS THEN
  RETURN UPPER(p_fallback);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
--  TABLE 1: indicator  →  indicator_code  =  IND-{cat_abbr}-{seq}
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_fn_indicator_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cat_abbr TEXT := 'GEN';
  v_prefix   TEXT;
BEGIN
  -- Derive abbreviation from indicator_category name
  SELECT imis_abbr(category_name, 'GEN')
    INTO v_cat_abbr
    FROM public.indicator_category
   WHERE indicator_category_id = NEW.indicator_category_id;

  v_prefix := 'IND-' || COALESCE(v_cat_abbr, 'GEN');

  -- Always overwrite — fully locked
  NEW.indicator_code := imis_generate_unique_code(v_prefix, 'indicator', 'indicator_code');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_indicator_code ON public.indicator;
CREATE TRIGGER trg_indicator_code
  BEFORE INSERT ON public.indicator
  FOR EACH ROW EXECUTE FUNCTION trg_fn_indicator_code();


-- ═══════════════════════════════════════════════════════════════════════════
--  TABLE 2: intervention  →  intervention_code  =  IV-{type_abbr}-{seq}
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_fn_intervention_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_type_abbr TEXT := 'GEN';
  v_prefix    TEXT;
BEGIN
  SELECT imis_abbr(type_name, 'GEN')
    INTO v_type_abbr
    FROM public.intervention_type
   WHERE intervention_type_id = NEW.intervention_type_id;

  v_prefix := 'IV-' || COALESCE(v_type_abbr, 'GEN');

  NEW.intervention_code := imis_generate_unique_code(v_prefix, 'intervention', 'intervention_code');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_intervention_code ON public.intervention;
CREATE TRIGGER trg_intervention_code
  BEFORE INSERT ON public.intervention
  FOR EACH ROW EXECUTE FUNCTION trg_fn_intervention_code();


-- ═══════════════════════════════════════════════════════════════════════════
--  TABLE 3: outcome  →  outcome_code  =  OC-{cat_code}-{seq}
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_fn_outcome_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cat_code TEXT := 'GEN';
  v_prefix   TEXT;
BEGIN
  SELECT imis_abbr(category_code, 'GEN')
    INTO v_cat_code
    FROM public.outcome_categories
   WHERE outcome_category_id = NEW.outcome_category_id;

  v_prefix := 'OC-' || COALESCE(v_cat_code, 'GEN');

  NEW.outcome_code := imis_generate_unique_code(v_prefix, 'outcome', 'outcome_code');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_outcome_code ON public.outcome;
CREATE TRIGGER trg_outcome_code
  BEFORE INSERT ON public.outcome
  FOR EACH ROW EXECUTE FUNCTION trg_fn_outcome_code();


-- ═══════════════════════════════════════════════════════════════════════════
--  TABLE 4: activity  →  activity_code  =  ACT-{cat_abbr}-{seq}
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_fn_activity_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cat_abbr TEXT := 'GEN';
  v_prefix   TEXT;
BEGIN
  SELECT imis_abbr(category_name, 'GEN')
    INTO v_cat_abbr
    FROM public.activity_category
   WHERE activity_category_id = NEW.activity_category_id;

  v_prefix := 'ACT-' || COALESCE(v_cat_abbr, 'GEN');

  NEW.activity_code := imis_generate_unique_code(v_prefix, 'activity', 'activity_code');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_code ON public.activity;
CREATE TRIGGER trg_activity_code
  BEFORE INSERT ON public.activity
  FOR EACH ROW EXECUTE FUNCTION trg_fn_activity_code();


-- ═══════════════════════════════════════════════════════════════════════════
--  TABLE 5: outcome_categories  →  category_code  =  OCC-{seq}
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_fn_outcome_category_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.category_code := imis_generate_unique_code('OCC', 'outcome_categories', 'category_code');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_outcome_category_code ON public.outcome_categories;
CREATE TRIGGER trg_outcome_category_code
  BEFORE INSERT ON public.outcome_categories
  FOR EACH ROW EXECUTE FUNCTION trg_fn_outcome_category_code();


-- ═══════════════════════════════════════════════════════════════════════════
--  TABLE 6: activity_category  →  category_code  =  ACC-{seq}
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_fn_activity_category_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.category_code := imis_generate_unique_code('ACC', 'activity_category', 'category_code');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_category_code ON public.activity_category;
CREATE TRIGGER trg_activity_category_code
  BEFORE INSERT ON public.activity_category
  FOR EACH ROW EXECUTE FUNCTION trg_fn_activity_category_code();


-- ═══════════════════════════════════════════════════════════════════════════
--  TABLE 7: indicator_category  →  add code col if missing  =  IC-{seq}
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'indicator_category'
       AND column_name  = 'category_code'
  ) THEN
    ALTER TABLE public.indicator_category ADD COLUMN category_code TEXT;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION trg_fn_indicator_category_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.category_code := imis_generate_unique_code('IC', 'indicator_category', 'category_code');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_indicator_category_code ON public.indicator_category;
CREATE TRIGGER trg_indicator_category_code
  BEFORE INSERT ON public.indicator_category
  FOR EACH ROW EXECUTE FUNCTION trg_fn_indicator_category_code();


-- ═══════════════════════════════════════════════════════════════════════════
--  TABLE 8: donor  →  donor_code  =  DNR-{seq}
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_fn_donor_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.donor_code := imis_generate_unique_code('DNR', 'donor', 'donor_code');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_donor_code ON public.donor;
CREATE TRIGGER trg_donor_code
  BEFORE INSERT ON public.donor
  FOR EACH ROW EXECUTE FUNCTION trg_fn_donor_code();


-- ═══════════════════════════════════════════════════════════════════════════
--  TABLE 9: grants  →  grant_code  =  GRT-{fy_abbr}-{seq}
--  e.g. GRT-2526-001  (from financial year name like "2025-26")
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_fn_grant_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_fy_abbr TEXT := 'GEN';
  v_prefix  TEXT;
BEGIN
  -- Derive short FY code from fy_name e.g. "2025-26" → "2526"
  SELECT REGEXP_REPLACE(fy_name, '[^0-9]', '', 'g')
    INTO v_fy_abbr
    FROM public.financial_year
   WHERE financial_year_id = NEW.financial_year_id;

  -- Take last 4 digits e.g. "202526" → "2526"
  v_fy_abbr := RIGHT(COALESCE(v_fy_abbr, 'GEN'), 4);
  v_prefix  := 'GRT-' || v_fy_abbr;

  NEW.grant_code := imis_generate_unique_code(v_prefix, 'grants', 'grant_code');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_code ON public.grants;
CREATE TRIGGER trg_grant_code
  BEFORE INSERT ON public.grants
  FOR EACH ROW EXECUTE FUNCTION trg_fn_grant_code();


-- ═══════════════════════════════════════════════════════════════════════════
--  STEP 3: Backfill — generate codes for any existing NULL codes
-- ═══════════════════════════════════════════════════════════════════════════

-- donor
UPDATE public.donor SET donor_code = imis_generate_unique_code('DNR', 'donor', 'donor_code')
 WHERE donor_code IS NULL OR donor_code = '';

-- grants (per FY)
UPDATE public.grants g
   SET grant_code = imis_generate_unique_code(
       'GRT-' || RIGHT(REGEXP_REPLACE(COALESCE(f.fy_name,'GEN'), '[^0-9]','','g'), 4),
       'grants', 'grant_code')
  FROM public.financial_year f
 WHERE g.financial_year_id = f.financial_year_id
   AND (g.grant_code IS NULL OR g.grant_code = '');

-- outcome_categories
UPDATE public.outcome_categories
   SET category_code = imis_generate_unique_code('OCC', 'outcome_categories', 'category_code')
 WHERE category_code IS NULL OR category_code = '';

-- activity_category
UPDATE public.activity_category
   SET category_code = imis_generate_unique_code('ACC', 'activity_category', 'category_code')
 WHERE category_code IS NULL OR category_code = '';

-- indicator_category
UPDATE public.indicator_category
   SET category_code = imis_generate_unique_code('IC', 'indicator_category', 'category_code')
 WHERE category_code IS NULL OR category_code = '';

-- intervention (needs type name lookup)
UPDATE public.intervention i
   SET intervention_code = imis_generate_unique_code(
       'IV-' || COALESCE((SELECT imis_abbr(type_name,'GEN') FROM public.intervention_type t WHERE t.intervention_type_id = i.intervention_type_id), 'GEN'),
       'intervention', 'intervention_code')
 WHERE intervention_code IS NULL OR intervention_code = '';

-- outcome (needs category code lookup)
UPDATE public.outcome o
   SET outcome_code = imis_generate_unique_code(
       'OC-' || COALESCE((SELECT imis_abbr(category_code,'GEN') FROM public.outcome_categories c WHERE c.outcome_category_id = o.outcome_category_id), 'GEN'),
       'outcome', 'outcome_code')
 WHERE outcome_code IS NULL OR outcome_code = '';

-- activity (needs category name lookup)
UPDATE public.activity a
   SET activity_code = imis_generate_unique_code(
       'ACT-' || COALESCE((SELECT imis_abbr(category_name,'GEN') FROM public.activity_category c WHERE c.activity_category_id = a.activity_category_id), 'GEN'),
       'activity', 'activity_code')
 WHERE activity_code IS NULL OR activity_code = '';

-- indicator (needs category name lookup)
UPDATE public.indicator i
   SET indicator_code = imis_generate_unique_code(
       'IND-' || COALESCE((SELECT imis_abbr(category_name,'GEN') FROM public.indicator_category c WHERE c.indicator_category_id = i.indicator_category_id), 'GEN'),
       'indicator', 'indicator_code')
 WHERE indicator_code IS NULL OR indicator_code = '';


-- ═══════════════════════════════════════════════════════════════════════════
--  STEP 4: Lock columns — add NOT NULL + UNIQUE constraints (idempotent)
--  Uses DO $$ guards so re-running never errors on existing constraints
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  -- indicator_code
  ALTER TABLE public.indicator ALTER COLUMN indicator_code SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.indicator ADD CONSTRAINT uq_indicator_code UNIQUE (indicator_code);
  EXCEPTION WHEN duplicate_table THEN NULL; WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.intervention ALTER COLUMN intervention_code SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.intervention ADD CONSTRAINT uq_intervention_code UNIQUE (intervention_code);
  EXCEPTION WHEN duplicate_table THEN NULL; WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.outcome ALTER COLUMN outcome_code SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.outcome ADD CONSTRAINT uq_outcome_code UNIQUE (outcome_code);
  EXCEPTION WHEN duplicate_table THEN NULL; WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.activity ALTER COLUMN activity_code SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.activity ADD CONSTRAINT uq_activity_code UNIQUE (activity_code);
  EXCEPTION WHEN duplicate_table THEN NULL; WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.outcome_categories ALTER COLUMN category_code SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.outcome_categories ADD CONSTRAINT uq_outcome_cat_code UNIQUE (category_code);
  EXCEPTION WHEN duplicate_table THEN NULL; WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.activity_category ALTER COLUMN category_code SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.activity_category ADD CONSTRAINT uq_activity_cat_code UNIQUE (category_code);
  EXCEPTION WHEN duplicate_table THEN NULL; WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.indicator_category ALTER COLUMN category_code SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.indicator_category ADD CONSTRAINT uq_indicator_cat_code UNIQUE (category_code);
  EXCEPTION WHEN duplicate_table THEN NULL; WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.donor ALTER COLUMN donor_code SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.donor ADD CONSTRAINT uq_donor_code UNIQUE (donor_code);
  EXCEPTION WHEN duplicate_table THEN NULL; WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.grants ALTER COLUMN grant_code SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.grants ADD CONSTRAINT uq_grant_code UNIQUE (grant_code);
  EXCEPTION WHEN duplicate_table THEN NULL; WHEN others THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
--  DONE — Verify
-- ═══════════════════════════════════════════════════════════════════════════
SELECT
  'indicator'         AS tbl, COUNT(*) AS total, COUNT(indicator_code)   AS coded FROM public.indicator
UNION ALL SELECT
  'intervention',               COUNT(*), COUNT(intervention_code)        FROM public.intervention
UNION ALL SELECT
  'outcome',                    COUNT(*), COUNT(outcome_code)             FROM public.outcome
UNION ALL SELECT
  'activity',                   COUNT(*), COUNT(activity_code)            FROM public.activity
UNION ALL SELECT
  'outcome_categories',         COUNT(*), COUNT(category_code)           FROM public.outcome_categories
UNION ALL SELECT
  'activity_category',          COUNT(*), COUNT(category_code)           FROM public.activity_category
UNION ALL SELECT
  'indicator_category',         COUNT(*), COUNT(category_code)           FROM public.indicator_category
UNION ALL SELECT
  'donor',                      COUNT(*), COUNT(donor_code)              FROM public.donor
UNION ALL SELECT
  'grants',                     COUNT(*), COUNT(grant_code)              FROM public.grants;
