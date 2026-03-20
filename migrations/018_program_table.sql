-- ════════════════════════════════════════════════════════════════
-- Migration 018 — Create Program Table & Seed MantraX
-- ════════════════════════════════════════════════════════════════

-- Drop and recreate to ensure clean state
DROP TABLE IF EXISTS public.program CASCADE;

-- Create program table fresh
CREATE TABLE public.program (
  program_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_code        TEXT        UNIQUE,
  program_name        TEXT        NOT NULL UNIQUE,
  program_level       TEXT,       -- State, District, Block, Cluster, School
  financial_year_id   UUID,
  state_id            UUID,
  is_frozen           BOOLEAN     DEFAULT false NOT NULL,
  description         TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX idx_program_name ON public.program(program_name);
CREATE INDEX idx_program_frozen ON public.program(is_frozen);

-- Enable RLS
ALTER TABLE public.program ENABLE ROW LEVEL SECURITY;
CREATE POLICY "program_read_all" ON public.program FOR SELECT USING (true);
CREATE POLICY "program_write" ON public.program FOR INSERT WITH CHECK (true);
CREATE POLICY "program_update" ON public.program FOR UPDATE USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════
-- SEED DATA — Programs
-- ════════════════════════════════════════════════════════════════
INSERT INTO public.program (program_code, program_name, program_level, is_frozen, description)
VALUES
  ('KA',       'Karnataka',      'State',    false, 'Karnataka state program'),
  ('KALABURAGI', 'Kalaburagi',   'District', false, 'Kalaburagi district program'),
  ('MANTRAX',  'MantraX',        'District', false, 'End-to-end testing program for IMIS features');

-- ════════════════════════════════════════════════════════════════
-- DONE
-- ════════════════════════════════════════════════════════════════
