-- ══════════════════════════════════════════════════════════════
--  Migration 021 — Restructure Budget Book
--  budget_category  →  Budget Heads  (top-level grouping)
--  budget_head      →  Budget Lines  (line items under each head)
--  budget_line      →  DROPPED       (redundant)
-- ══════════════════════════════════════════════════════════════

-- 1. Drop old budget_line table (no longer needed)
DROP TABLE IF EXISTS budget_line CASCADE;

-- 2. Add budget_category_id FK to budget_head
ALTER TABLE budget_head
  ADD COLUMN IF NOT EXISTS budget_category_id UUID
    REFERENCES budget_category(budget_category_id) ON DELETE SET NULL;

-- 3. Clear stale seed data
TRUNCATE TABLE budget_head RESTART IDENTITY CASCADE;
TRUNCATE TABLE budget_category RESTART IDENTITY CASCADE;

-- 4. Seed budget_category = Budget Heads (top-level groupings)
INSERT INTO budget_category (cat_code, cat_label, cat_color, sort_order, is_active) VALUES
  ('A', 'Personnel & HR',               '#3b82f6', 10, true),
  ('B', 'Training & Capacity Building', '#8b5cf6', 20, true),
  ('C', 'Travel & Transport',           '#f59e0b', 30, true),
  ('D', 'Equipment & Supplies',         '#10b981', 40, true),
  ('E', 'Program Activities',           '#ef4444', 50, true),
  ('F', 'Overheads & Administration',   '#6b7280', 60, true);

-- 5. Seed budget_head = Budget Lines (line items under each Budget Head)
-- Uses subquery to resolve budget_category_id by code
INSERT INTO budget_head (head_name, category, description, sort_order, is_active, budget_category_id) VALUES
  -- A. Personnel & HR
  ('Salaries & Benefits (Senior Staff)',  'Personnel', 'Full-time and part-time staff salaries, PF, gratuity',       10, true, (SELECT budget_category_id FROM budget_category WHERE cat_code='A')),
  ('Consultant / Expert Fees',            'Personnel', 'Short-term consultants, subject matter experts',              20, true, (SELECT budget_category_id FROM budget_category WHERE cat_code='A')),
  ('HR & Recruitment Costs',              'Personnel', 'Hiring, onboarding, and HR administration costs',            30, true, (SELECT budget_category_id FROM budget_category WHERE cat_code='A')),

  -- B. Training & Capacity Building
  ('Workshop & Training Costs',           'Programs',  'Venue, facilitation, and logistics for training events',     10, true, (SELECT budget_category_id FROM budget_category WHERE cat_code='B')),
  ('Participant Travel & Accommodation',  'Programs',  'Travel and stay costs for training participants',             20, true, (SELECT budget_category_id FROM budget_category WHERE cat_code='B')),
  ('Training Materials & Resources',      'Programs',  'Manuals, toolkits, printing, digital resources',             30, true, (SELECT budget_category_id FROM budget_category WHERE cat_code='B')),

  -- C. Travel & Transport
  ('Inter-city Travel',                   'Operations','Air, rail, bus travel between cities',                       10, true, (SELECT budget_category_id FROM budget_category WHERE cat_code='C')),
  ('Local Conveyance',                    'Operations','Auto, cab, fuel for within-city travel',                    20, true, (SELECT budget_category_id FROM budget_category WHERE cat_code='C')),
  ('Accommodation & Per Diem',            'Operations','Hotel stay and daily allowance during field visits',         30, true, (SELECT budget_category_id FROM budget_category WHERE cat_code='C')),

  -- D. Equipment & Supplies
  ('Equipment Purchase / Rental',         'Operations','Laptops, projectors, field equipment, rentals',             10, true, (SELECT budget_category_id FROM budget_category WHERE cat_code='D')),
  ('Office Supplies & Stationery',        'Operations','Paper, pens, printing supplies, consumables',               20, true, (SELECT budget_category_id FROM budget_category WHERE cat_code='D')),

  -- E. Program Activities
  ('Community Engagement Activities',     'Programs',  'Field activities, community meetings, beneficiary events',   10, true, (SELECT budget_category_id FROM budget_category WHERE cat_code='E')),
  ('Events & Outreach',                   'Programs',  'Public events, campaigns, exhibitions, seminars',            20, true, (SELECT budget_category_id FROM budget_category WHERE cat_code='E')),
  ('Research & Documentation',            'Programs',  'Surveys, studies, assessments, report production',          30, true, (SELECT budget_category_id FROM budget_category WHERE cat_code='E')),

  -- F. Overheads & Administration
  ('Office Rent & Utilities',             'Overheads', 'Rent, electricity, water, maintenance for office space',    10, true, (SELECT budget_category_id FROM budget_category WHERE cat_code='F')),
  ('Communication & Internet',            'Overheads', 'Phone, internet, postage, courier costs',                   20, true, (SELECT budget_category_id FROM budget_category WHERE cat_code='F')),
  ('Admin & Support Staff',               'Overheads', 'Admin, accounts, front office support staff costs',         30, true, (SELECT budget_category_id FROM budget_category WHERE cat_code='F'));
