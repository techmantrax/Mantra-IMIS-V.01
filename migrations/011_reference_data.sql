-- ════════════════════════════════════════════════════════════════
-- Migration 011 — M&E Book Reference Data Tables
-- ════════════════════════════════════════════════════════════════
-- Creates: environment, child_experience, outcome_categories, activity_category
-- Seed data for all 5 reference tables

-- 1. Environment
CREATE TABLE IF NOT EXISTS public.environment (
  environment_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_code  TEXT        NOT NULL UNIQUE,
  environment_name  TEXT        NOT NULL,
  description       TEXT,
  is_active         BOOLEAN     DEFAULT true NOT NULL,
  sort_order        INT         DEFAULT 99 NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.environment ENABLE ROW LEVEL SECURITY;

-- 2. Child Experience
CREATE TABLE IF NOT EXISTS public.child_experience (
  child_experience_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_experience_code  TEXT        NOT NULL UNIQUE,
  experience_name        TEXT        NOT NULL,
  description            TEXT,
  is_active              BOOLEAN     DEFAULT true NOT NULL,
  sort_order             INT         DEFAULT 99 NOT NULL,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.child_experience ENABLE ROW LEVEL SECURITY;

-- 3. Outcome Categories
CREATE TABLE IF NOT EXISTS public.outcome_categories (
  outcome_category_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_code       TEXT        NOT NULL UNIQUE,
  category_name       TEXT        NOT NULL,
  description         TEXT,
  is_active           BOOLEAN     DEFAULT true NOT NULL,
  sort_order          INT         DEFAULT 99 NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.outcome_categories ENABLE ROW LEVEL SECURITY;

-- 4. Activity Category
CREATE TABLE IF NOT EXISTS public.activity_category (
  activity_category_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_code        TEXT        NOT NULL UNIQUE,
  category_name        TEXT        NOT NULL,
  description          TEXT,
  is_active            BOOLEAN     DEFAULT true NOT NULL,
  sort_order           INT         DEFAULT 99 NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.activity_category ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════
-- SEED DATA
-- ════════════════════════════════════════════════════════════════

-- Seed Environments (School, District, Block, Cluster, State)
INSERT INTO public.environment (environment_code, environment_name, description, is_active, sort_order)
VALUES
  ('SCHOOL',   'School',          'School level environment',            true, 1),
  ('CLUSTER',  'Cluster',         'Cluster level environment',           true, 2),
  ('BLOCK',    'Block',           'Block level environment',             true, 3),
  ('DISTRICT', 'District',        'District level environment',          true, 4),
  ('STATE',    'State',           'State level environment',             true, 5)
ON CONFLICT (environment_code) DO NOTHING;

-- Seed Child Experiences
INSERT INTO public.child_experience (child_experience_code, experience_name, description, is_active, sort_order)
VALUES
  ('CE_CLASS',  'Classroom Engagement',      'Engagement in classroom settings',     true, 1),
  ('CE_COMM',   'Community Participation',   'Participation in community activities', true, 2),
  ('CE_SOCIAL', 'Social Development',       'Social and emotional development',     true, 3),
  ('CE_HEALTH', 'Health & Wellbeing',       'Health and wellbeing outcomes',        true, 4)
ON CONFLICT (child_experience_code) DO NOTHING;

-- Seed Outcome Categories
INSERT INTO public.outcome_categories (category_code, category_name, description, is_active, sort_order)
VALUES
  ('OCC_LEARN',   'Learning Outcomes',      'Knowledge and learning related outcomes',    true, 1),
  ('OCC_SKILL',   'Skill Development',      'Skills and competencies',                     true, 2),
  ('OCC_BEHAV',   'Behavioral Outcomes',    'Behavior and attitude changes',               true, 3)
ON CONFLICT (category_code) DO NOTHING;

-- Seed Activity Categories
INSERT INTO public.activity_category (category_code, category_name, description, is_active, sort_order)
VALUES
  ('ACC_TRAIN',   'Training',          'Training and capacity building activities',  true, 1),
  ('ACC_ENGAG',   'Engagement',        'Community engagement activities',            true, 2),
  ('ACC_SUPPORT', 'Support',           'Support and mentoring activities',           true, 3)
ON CONFLICT (category_code) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- RLS POLICIES (enable public anon access for M&E Book)
-- ════════════════════════════════════════════════════════════════

CREATE POLICY "Public read access" ON public.environment FOR SELECT USING (true);
CREATE POLICY "Anon insert/update" ON public.environment FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update" ON public.environment FOR UPDATE USING (true);

CREATE POLICY "Public read access" ON public.child_experience FOR SELECT USING (true);
CREATE POLICY "Anon insert/update" ON public.child_experience FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update" ON public.child_experience FOR UPDATE USING (true);

CREATE POLICY "Public read access" ON public.outcome_categories FOR SELECT USING (true);
CREATE POLICY "Anon insert/update" ON public.outcome_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update" ON public.outcome_categories FOR UPDATE USING (true);

CREATE POLICY "Public read access" ON public.activity_category FOR SELECT USING (true);
CREATE POLICY "Anon insert/update" ON public.activity_category FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update" ON public.activity_category FOR UPDATE USING (true);

-- ════════════════════════════════════════════════════════════════
-- DONE
-- ════════════════════════════════════════════════════════════════
