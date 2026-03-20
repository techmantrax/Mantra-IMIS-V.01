-- ════════════════════════════════════════════════════════════════
-- Migration 019 — Populate MantraX with LFA Setup data
-- ════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_intv_id UUID;
  v_stk_id UUID;
  v_out_id_1 UUID;
  v_out_id_2 UUID;
  v_act_id_1 UUID;
  v_act_id_2 UUID;
BEGIN
  -- Get Teacher stakeholder type (or use existing)
  SELECT stakeholder_type_id INTO v_stk_id FROM public.stakeholder_type
    WHERE stakeholder_type_code='TEACHER' LIMIT 1;

  IF v_stk_id IS NULL THEN
    INSERT INTO public.stakeholder_type (stakeholder_type_code, type_name)
    VALUES ('TEACHER', 'Teacher');
    SELECT stakeholder_type_id INTO v_stk_id FROM public.stakeholder_type
      WHERE stakeholder_type_code='TEACHER' LIMIT 1;
  END IF;

  -- Use a test intervention ID (UUID) - can be any valid UUID
  v_intv_id := '550e8400-e29b-41d4-a716-446655440001'::uuid;

  -- Create sample outcomes (linked to intervention + stakeholder)
  INSERT INTO public.lfa_outcome (intervention_id, stakeholder_type_id, outcome_code, outcome_statement, outcome_category)
  VALUES
    (v_intv_id, v_stk_id, 'OUT-01', 'Students improve reading skills', 'Learning Outcomes'),
    (v_intv_id, v_stk_id, 'OUT-02', 'Teachers adopt new teaching methods', 'Skill Development')
  ON CONFLICT DO NOTHING;

  SELECT lfa_outcome_id INTO v_out_id_1 FROM public.lfa_outcome
    WHERE intervention_id=v_intv_id AND outcome_code='OUT-01' LIMIT 1;
  SELECT lfa_outcome_id INTO v_out_id_2 FROM public.lfa_outcome
    WHERE intervention_id=v_intv_id AND outcome_code='OUT-02' LIMIT 1;

  -- Create sample activities
  INSERT INTO public.lfa_activity (intervention_id, stakeholder_type_id, activity_code, activity_statement, activity_category)
  VALUES
    (v_intv_id, v_stk_id, 'ACT-01', 'Conduct teacher training on reading methodology', 'Training'),
    (v_intv_id, v_stk_id, 'ACT-02', 'Distribute reading materials to classrooms', 'Support')
  ON CONFLICT DO NOTHING;

  SELECT lfa_activity_id INTO v_act_id_1 FROM public.lfa_activity
    WHERE intervention_id=v_intv_id AND activity_code='ACT-01' LIMIT 1;
  SELECT lfa_activity_id INTO v_act_id_2 FROM public.lfa_activity
    WHERE intervention_id=v_intv_id AND activity_code='ACT-02' LIMIT 1;

  -- Link activities to outcomes
  INSERT INTO public.lfa_activity_outcome_link (lfa_activity_id, lfa_outcome_id)
  VALUES
    (v_act_id_1, v_out_id_1),
    (v_act_id_2, v_out_id_1),
    (v_act_id_2, v_out_id_2)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'MantraX LFA data populated: 2 outcomes, 2 activities, linked';
END $$;

-- ════════════════════════════════════════════════════════════════
-- Verify
-- ════════════════════════════════════════════════════════════════
SELECT 'LFA Outcomes' as entity, COUNT(*) FROM public.lfa_outcome
UNION ALL
SELECT 'LFA Activities', COUNT(*) FROM public.lfa_activity
UNION ALL
SELECT 'Activity-Outcome Links', COUNT(*) FROM public.lfa_activity_outcome_link;
