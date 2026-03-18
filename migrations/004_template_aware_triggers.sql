-- ============================================================
-- Migration 004: Template-Aware Trigger Functions
-- ============================================================
-- Problem: A pre-existing trigger on outcome (not in migration 001)
--          raises "Program code not found for outcome" when no ISTM
--          is provided — blocking global template inserts.
--
-- Fix:
--   1. Drop ALL BEFORE INSERT triggers on outcome + activity
--   2. Re-create single clean triggers with is_template branch:
--        is_template = true  → prefix OC-TMPL / ACT-TMPL
--        is_template = false → original category-based prefix
-- ============================================================

-- ── 1. Drop all BEFORE INSERT triggers on outcome ──────────
DO $$
DECLARE v_trig TEXT;
BEGIN
  FOR v_trig IN
    SELECT trigger_name FROM information_schema.triggers
     WHERE event_object_schema = 'public'
       AND event_object_table  = 'outcome'
       AND event_manipulation  = 'INSERT'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.outcome', v_trig);
  END LOOP;
END;
$$;

-- ── 2. Re-create outcome trigger (template-aware) ──────────
CREATE OR REPLACE FUNCTION trg_fn_outcome_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cat_code TEXT := 'GEN';
  v_prefix   TEXT;
BEGIN
  -- Template records (M&E Book global library) → OC-TMPL-XXX
  IF COALESCE(NEW.is_template, false) = true THEN
    NEW.outcome_code := imis_generate_unique_code('OC-TMPL', 'outcome', 'outcome_code');
    RETURN NEW;
  END IF;

  -- Program-scoped records → OC-{cat}-XXX (original logic)
  SELECT imis_abbr(category_code, 'GEN')
    INTO v_cat_code
    FROM public.outcome_categories
   WHERE outcome_category_id = NEW.outcome_category_id;

  v_prefix := 'OC-' || COALESCE(v_cat_code, 'GEN');
  NEW.outcome_code := imis_generate_unique_code(v_prefix, 'outcome', 'outcome_code');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_outcome_code
  BEFORE INSERT ON public.outcome
  FOR EACH ROW EXECUTE FUNCTION trg_fn_outcome_code();


-- ── 3. Drop all BEFORE INSERT triggers on activity ─────────
DO $$
DECLARE v_trig TEXT;
BEGIN
  FOR v_trig IN
    SELECT trigger_name FROM information_schema.triggers
     WHERE event_object_schema = 'public'
       AND event_object_table  = 'activity'
       AND event_manipulation  = 'INSERT'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.activity', v_trig);
  END LOOP;
END;
$$;

-- ── 4. Re-create activity trigger (template-aware) ─────────
CREATE OR REPLACE FUNCTION trg_fn_activity_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cat_abbr TEXT := 'GEN';
  v_prefix   TEXT;
BEGIN
  -- Template records (M&E Book global library) → ACT-TMPL-XXX
  IF COALESCE(NEW.is_template, false) = true THEN
    NEW.activity_code := imis_generate_unique_code('ACT-TMPL', 'activity', 'activity_code');
    RETURN NEW;
  END IF;

  -- Program-scoped records → ACT-{cat}-XXX (original logic)
  SELECT imis_abbr(category_name, 'GEN')
    INTO v_cat_abbr
    FROM public.activity_category
   WHERE activity_category_id = NEW.activity_category_id;

  v_prefix := 'ACT-' || COALESCE(v_cat_abbr, 'GEN');
  NEW.activity_code := imis_generate_unique_code(v_prefix, 'activity', 'activity_code');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_activity_code
  BEFORE INSERT ON public.activity
  FOR EACH ROW EXECUTE FUNCTION trg_fn_activity_code();


-- ── 5. Verify triggers are correct ────────────────────────
SELECT event_object_table AS tbl, trigger_name, action_timing, event_manipulation
  FROM information_schema.triggers
 WHERE event_object_schema = 'public'
   AND event_object_table IN ('outcome', 'activity')
 ORDER BY event_object_table, trigger_name;
