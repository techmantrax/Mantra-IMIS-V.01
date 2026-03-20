-- Migration 007: Budget Category
-- Defines budget classification codes (A, B, C...) managed by Program Manager
-- Feeds the category column in Grant Setup budget lines

CREATE TABLE IF NOT EXISTS public.budget_category (
  budget_category_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cat_code           TEXT        NOT NULL,   -- A, B, C, D, E, F or custom
  cat_label          TEXT        NOT NULL,   -- Activity-based, Program-level, Logistics, etc.
  cat_color          TEXT,                  -- optional hex like #f59e0b
  sort_order         INT         DEFAULT 0,
  is_active          BOOLEAN     NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cat_code)
);

ALTER TABLE public.budget_category ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budget_category_read_all"  ON public.budget_category FOR SELECT USING (true);
CREATE POLICY "budget_category_anon_write" ON public.budget_category FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "budget_category_auth_write" ON public.budget_category FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed with standard A-F used in Grant Setup
INSERT INTO public.budget_category (cat_code, cat_label, cat_color, sort_order) VALUES
  ('A', 'Activity-based',   '#3b82f6', 10),
  ('B', 'Program-level',    '#8b5cf6', 20),
  ('C', 'Logistics',        '#f59e0b', 30),
  ('D', 'Infrastructure',   '#10b981', 40),
  ('E', 'Administration',   '#6b7280', 50),
  ('F', 'Volunteer',        '#ec4899', 60)
ON CONFLICT DO NOTHING;

SELECT cat_code, cat_label FROM public.budget_category ORDER BY sort_order;
