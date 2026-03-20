-- ════════════════════════════════════════════════════════════════
-- Migration 017 — Create Intervention Type & Category Tables
-- ════════════════════════════════════════════════════════════════

-- Drop old table if it exists with wrong schema (only if needed)
DROP TABLE IF EXISTS public.intervention_type CASCADE;
DROP TABLE IF EXISTS public.intervention_category CASCADE;

-- ════════════════════════════════════════════════════════════════
-- Create intervention_type table (fresh)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE public.intervention_type (
  intervention_type_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type_code            TEXT        NOT NULL UNIQUE,
  type_name            TEXT        NOT NULL UNIQUE,
  description          TEXT,
  is_active            BOOLEAN     DEFAULT true NOT NULL,
  sort_order           INT         DEFAULT 99,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intervention_type_code ON public.intervention_type(type_code);
CREATE INDEX idx_intervention_type_active ON public.intervention_type(is_active);

ALTER TABLE public.intervention_type ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.intervention_type FOR SELECT USING (true);
CREATE POLICY "Anon insert/update" ON public.intervention_type FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update" ON public.intervention_type FOR UPDATE USING (true);

-- ════════════════════════════════════════════════════════════════
-- Create intervention_category table (fresh)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE public.intervention_category (
  intervention_category_id UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  category_code           TEXT      NOT NULL UNIQUE,
  category_name           TEXT      NOT NULL UNIQUE,
  description             TEXT,
  is_active               BOOLEAN   DEFAULT true NOT NULL,
  sort_order              INT       DEFAULT 99,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intervention_category_code ON public.intervention_category(category_code);
CREATE INDEX idx_intervention_category_active ON public.intervention_category(is_active);

ALTER TABLE public.intervention_category ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.intervention_category FOR SELECT USING (true);
CREATE POLICY "Anon insert/update" ON public.intervention_category FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update" ON public.intervention_category FOR UPDATE USING (true);

-- ════════════════════════════════════════════════════════════════
-- Add foreign key columns to intervention table (if they don't exist)
-- ════════════════════════════════════════════════════════════════
ALTER TABLE public.intervention ADD COLUMN IF NOT EXISTS intervention_type_id UUID REFERENCES public.intervention_type(intervention_type_id) ON DELETE SET NULL;
ALTER TABLE public.intervention ADD COLUMN IF NOT EXISTS intervention_category_id UUID REFERENCES public.intervention_category(intervention_category_id) ON DELETE SET NULL;

-- ════════════════════════════════════════════════════════════════
-- SEED DATA — Intervention Types
-- ════════════════════════════════════════════════════════════════
INSERT INTO public.intervention_type (type_code, type_name, description, is_active, sort_order)
VALUES
  ('IIMP',    'Institution Improvement',  'School improvement initiatives',     true, 1),
  ('SIMP',    'System Improvement',       'System level improvement programs',  true, 2),
  ('TEAC',    'Teacher Development',      'Teacher capacity building',          true, 3),
  ('STUD',    'Student Support',          'Direct student support programs',    true, 4),
  ('CMTY',    'Community Engagement',     'Community participation programs',   true, 5)
ON CONFLICT (type_name) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- SEED DATA — Intervention Categories
-- ════════════════════════════════════════════════════════════════
INSERT INTO public.intervention_category (category_code, category_name, description, is_active, sort_order)
VALUES
  ('MA',      'Morning Assembly',         'Morning assembly programs',           true, 1),
  ('PTM',     'Parent Teacher Meeting',   'Parent-teacher engagement',          true, 2),
  ('BC',      'Bridge Courses',           'Bridge/remedial courses',            true, 3),
  ('LABS',    'Lab/Resource Support',     'Laboratory and resource centers',    true, 4),
  ('SPORT',   'Sports & Recreation',      'Sports and recreational activities', true, 5),
  ('HEALTH',  'Health Programs',          'Health and wellness programs',       true, 6),
  ('MENTOR',  'Mentoring',                'Mentoring and coaching programs',    true, 7),
  ('ASSESS',  'Assessment',               'Assessment and evaluation programs', true, 8),
  ('TRAINING','Training Workshops',       'Training and workshop programs',     true, 9),
  ('TECH',    'Technology Integration',   'Technology enabled programs',        true, 10)
ON CONFLICT (category_name) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- DONE
-- ════════════════════════════════════════════════════════════════
