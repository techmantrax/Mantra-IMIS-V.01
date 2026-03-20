-- ============================================================
-- Migration 005: Template-Aware Indicator Trigger
-- Same pattern as migration 004 but for the indicator table.
--
-- Problem: Pre-existing indicator trigger raises
--          "Unable to resolve indicator parent context"
--          when is_template = true (no ISTM context).
--
-- Fix:
--   1. Drop ALL BEFORE INSERT triggers on indicator
--   2. Re-create with is_template branch:
--        is_template = true  → IND-TMPL-XXX (global library)
--        is_template = false → IND-{cat_abbr}-XXX (program-scoped)
-- ============================================================

-- ── 1. Drop all BEFORE INSERT triggers on indicator ─────────
DO $$
DECLARE v_trig TEXT;
BEGIN
  FOR v_trig IN
    SELECT trigger_name FROM information_schema.triggers
     WHERE event_object_schema = 'public'
       AND event_object_table  = 'indicator'
       AND event_manipulation  = 'INSERT'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.indicator', v_trig);
  END LOOP;
END;
$$;

-- ── 2. Re-create indicator trigger (template-aware) ─────────
CREATE OR REPLACE FUNCTION trg_fn_indicator_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cat_abbr TEXT := 'GEN';
  v_prefix   TEXT;
BEGIN
  -- Template records (M&E Book global library) → IND-TMPL-XXX
  IF COALESCE(NEW.is_template, false) = true THEN
    NEW.indicator_code := imis_generate_unique_code('IND-TMPL', 'indicator', 'indicator_code');
    RETURN NEW;
  END IF;

  -- Program-scoped records → IND-{cat_abbr}-XXX
  SELECT imis_abbr(category_name, 'GEN')
    INTO v_cat_abbr
    FROM public.indicator_category
   WHERE indicator_category_id = NEW.indicator_category_id;

  v_prefix := 'IND-' || COALESCE(v_cat_abbr, 'GEN');
  NEW.indicator_code := imis_generate_unique_code(v_prefix, 'indicator', 'indicator_code');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_indicator_code
  BEFORE INSERT ON public.indicator
  FOR EACH ROW EXECUTE FUNCTION trg_fn_indicator_code();

-- ── 3. Also find all valid frequency_enum values ────────────
SELECT enumlabel AS valid_frequency_value
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
 WHERE t.typname = 'frequency_enum'
 ORDER BY e.enumsortorder;

-- ── 4. Verify trigger is registered ─────────────────────────
SELECT trigger_name, action_timing, event_manipulation
  FROM information_schema.triggers
 WHERE event_object_schema = 'public'
   AND event_object_table  = 'indicator'
 ORDER BY trigger_name;
