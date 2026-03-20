-- ════════════════════════════════════════════════════════════════
-- Migration 011 PATCH — Add missing columns to existing reference tables
-- ════════════════════════════════════════════════════════════════

-- Add sort_order, created_at, updated_at to environment if missing
ALTER TABLE public.environment ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 99;
ALTER TABLE public.environment ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.environment ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add sort_order, created_at, updated_at to child_experience if missing
ALTER TABLE public.child_experience ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 99;
ALTER TABLE public.child_experience ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.child_experience ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add sort_order, created_at, updated_at to outcome_categories if missing
ALTER TABLE public.outcome_categories ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 99;
ALTER TABLE public.outcome_categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.outcome_categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add sort_order, created_at, updated_at to activity_category if missing
ALTER TABLE public.activity_category ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 99;
ALTER TABLE public.activity_category ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.activity_category ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Now seed the data (safe with ON CONFLICT)
INSERT INTO public.environment (environment_code, environment_name, description, is_active, sort_order)
VALUES
  ('SCHOOL',   'School',          'School level environment',            true, 1),
  ('CLUSTER',  'Cluster',         'Cluster level environment',           true, 2),
  ('BLOCK',    'Block',           'Block level environment',             true, 3),
  ('DISTRICT', 'District',        'District level environment',          true, 4),
  ('STATE',    'State',           'State level environment',             true, 5)
ON CONFLICT (environment_code) DO NOTHING;

INSERT INTO public.child_experience (child_experience_code, experience_name, description, is_active, sort_order)
VALUES
  ('CE_CLASS',  'Classroom Engagement',      'Engagement in classroom settings',     true, 1),
  ('CE_COMM',   'Community Participation',   'Participation in community activities', true, 2),
  ('CE_SOCIAL', 'Social Development',       'Social and emotional development',     true, 3),
  ('CE_HEALTH', 'Health & Wellbeing',       'Health and wellbeing outcomes',        true, 4)
ON CONFLICT (child_experience_code) DO NOTHING;

INSERT INTO public.outcome_categories (category_code, category_name, description, is_active, sort_order)
VALUES
  ('OCC_LEARN',   'Learning Outcomes',      'Knowledge and learning related outcomes',    true, 1),
  ('OCC_SKILL',   'Skill Development',      'Skills and competencies',                     true, 2),
  ('OCC_BEHAV',   'Behavioral Outcomes',    'Behavior and attitude changes',               true, 3)
ON CONFLICT (category_code) DO NOTHING;

INSERT INTO public.activity_category (category_code, category_name, description, is_active, sort_order)
VALUES
  ('ACC_TRAIN',   'Training',          'Training and capacity building activities',  true, 1),
  ('ACC_ENGAG',   'Engagement',        'Community engagement activities',            true, 2),
  ('ACC_SUPPORT', 'Support',           'Support and mentoring activities',           true, 3)
ON CONFLICT (category_code) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- DONE
-- ════════════════════════════════════════════════════════════════
