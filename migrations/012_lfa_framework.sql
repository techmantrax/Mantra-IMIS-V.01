-- ════════════════════════════════════════════════════════════════
-- Migration 012 — LFA Framework Schema (for M&E Builder)
-- ════════════════════════════════════════════════════════════════
-- Tables to persist LFA Setup data so M&E Builder can read it from DB
-- Schema:
--   - lfa_outcome: outcomes defined in LFA Setup
--   - lfa_activity: activities defined in LFA Setup
--   - lfa_activity_outcome_link: maps activities to outcomes

-- 1. LFA Outcomes (per intervention_stakeholder combo)
CREATE TABLE IF NOT EXISTS public.lfa_outcome (
  lfa_outcome_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id       UUID        NOT NULL,
  stakeholder_type_id   UUID        NOT NULL,
  outcome_code          TEXT        NOT NULL,
  outcome_statement     TEXT        NOT NULL,
  outcome_category      TEXT,  -- Reference to outcome_categories.category_name
  is_active             BOOLEAN     DEFAULT true NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(intervention_id, stakeholder_type_id, outcome_code)
);
ALTER TABLE public.lfa_outcome ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.lfa_outcome FOR SELECT USING (true);
CREATE POLICY "Anon insert/update" ON public.lfa_outcome FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update" ON public.lfa_outcome FOR UPDATE USING (true);

-- 2. LFA Activities (per intervention_stakeholder combo)
CREATE TABLE IF NOT EXISTS public.lfa_activity (
  lfa_activity_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id       UUID        NOT NULL,
  stakeholder_type_id   UUID        NOT NULL,
  activity_code         TEXT        NOT NULL,
  activity_statement    TEXT        NOT NULL,
  activity_category     TEXT,  -- Reference to activity_category.category_name
  is_active             BOOLEAN     DEFAULT true NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(intervention_id, stakeholder_type_id, activity_code)
);
ALTER TABLE public.lfa_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.lfa_activity FOR SELECT USING (true);
CREATE POLICY "Anon insert/update" ON public.lfa_activity FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update" ON public.lfa_activity FOR UPDATE USING (true);

-- 3. Activity→Outcome Links
CREATE TABLE IF NOT EXISTS public.lfa_activity_outcome_link (
  lfa_link_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lfa_activity_id       UUID        NOT NULL REFERENCES public.lfa_activity(lfa_activity_id) ON DELETE CASCADE,
  lfa_outcome_id        UUID        NOT NULL REFERENCES public.lfa_outcome(lfa_outcome_id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lfa_activity_id, lfa_outcome_id)
);
ALTER TABLE public.lfa_activity_outcome_link ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.lfa_activity_outcome_link FOR SELECT USING (true);
CREATE POLICY "Anon insert/update" ON public.lfa_activity_outcome_link FOR INSERT WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════
-- DONE
-- ════════════════════════════════════════════════════════════════
