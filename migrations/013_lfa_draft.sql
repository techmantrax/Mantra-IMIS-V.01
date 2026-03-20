-- ════════════════════════════════════════════════════════════════
-- Migration 013 — LFA Draft Auto-Save
-- ════════════════════════════════════════════════════════════════
-- Stores the full LFA Setup state as JSON for auto-save/restore
-- Allows users to save progress and resume later without losing work

CREATE TABLE IF NOT EXISTS public.lfa_draft (
  lfa_draft_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    UUID        NOT NULL,
  draft_data    JSONB       NOT NULL DEFAULT '{}',
  saved_at      TIMESTAMPTZ DEFAULT now(),
  is_published  BOOLEAN     DEFAULT false NOT NULL,
  UNIQUE(program_id)
);

ALTER TABLE public.lfa_draft ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read"   ON public.lfa_draft FOR SELECT USING (true);
CREATE POLICY "Anon insert"   ON public.lfa_draft FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update"   ON public.lfa_draft FOR UPDATE USING (true);

-- ════════════════════════════════════════════════════════════════
-- DONE
-- ════════════════════════════════════════════════════════════════
