-- ════════════════════════════════════════════════════════════════
-- Migration 010 — Impact / Goal level
-- ════════════════════════════════════════════════════════════════

-- 1. Impact categories
CREATE TABLE IF NOT EXISTS public.impact_category (
  impact_category_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name       TEXT        NOT NULL,
  category_code       TEXT        NOT NULL UNIQUE,
  sort_order          INT         NOT NULL DEFAULT 99,
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.impact_category (category_name, category_code, sort_order) VALUES
  ('SDG Alignment',         'IPC-001', 1),
  ('National Policy Goal',  'IPC-002', 2),
  ('Programme Impact Goal', 'IPC-003', 3)
ON CONFLICT (category_code) DO NOTHING;

ALTER TABLE public.impact_category ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ipc_read_all"  ON public.impact_category;
DROP POLICY IF EXISTS "ipc_write_all" ON public.impact_category;
CREATE POLICY "ipc_read_all"  ON public.impact_category FOR SELECT USING (true);
CREATE POLICY "ipc_write_all" ON public.impact_category FOR ALL USING (true);

-- 2. Impact table
CREATE TABLE IF NOT EXISTS public.impact (
  impact_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  impact_category_id  UUID        REFERENCES public.impact_category(impact_category_id) ON DELETE SET NULL,
  impact_code         TEXT,
  impact_statement    TEXT        NOT NULL,
  is_template         BOOLEAN     NOT NULL DEFAULT true,
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_impact_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE seq INT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(impact_code,'[^0-9]','','g'),'')::INT),0)+1
    INTO seq FROM public.impact WHERE is_template = NEW.is_template;
  NEW.impact_code := 'IM-TMPL-' || LPAD(seq::TEXT, 3, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impact_code ON public.impact;
CREATE TRIGGER trg_impact_code
  BEFORE INSERT ON public.impact
  FOR EACH ROW WHEN (NEW.impact_code IS NULL)
  EXECUTE FUNCTION public.set_impact_code();

CREATE OR REPLACE FUNCTION public.set_impact_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_impact_updated_at ON public.impact;
CREATE TRIGGER trg_impact_updated_at
  BEFORE UPDATE ON public.impact
  FOR EACH ROW EXECUTE FUNCTION public.set_impact_updated_at();

ALTER TABLE public.impact ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "impact_read_all"  ON public.impact;
DROP POLICY IF EXISTS "impact_write_all" ON public.impact;
CREATE POLICY "impact_read_all"  ON public.impact FOR SELECT USING (true);
CREATE POLICY "impact_write_all" ON public.impact FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_impact_category ON public.impact(impact_category_id);
CREATE INDEX IF NOT EXISTS idx_impact_active   ON public.impact(is_active);

-- 3. Add impact_id to indicator
ALTER TABLE public.indicator
  ADD COLUMN IF NOT EXISTS impact_id UUID
    REFERENCES public.impact(impact_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_indicator_impact ON public.indicator(impact_id);
