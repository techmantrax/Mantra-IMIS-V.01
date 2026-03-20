# Mantra IMIS - Code Review Report
## End-to-End Analysis: Hardcoded Data vs Supabase Integration

### Executive Summary
The application had **partial Supabase integration**. After review and refactoring, the following changes were made to connect hardcoded data to the database.

---

## CHANGES MADE ✅

### 1. Global Data Loader Added (Lines ~7360-7550)
- Created `dbCache` object to store all reference data from Supabase
- Added `loadGlobalDbData()` async function that fetches:
  - Programs, States, Districts
  - Interventions, Stakeholder Types/Levels
  - Outcome Categories, Environments, Child Experiences
  - Financial Years, Periods
  - Donors, Grants
- Added helper functions:
  - `getDbPrograms()` - Returns program names from DB or fallback
  - `getDbDistricts(stateName)` - Returns districts for a state
  - `getDbStakeholderLevels()` - Returns stakeholder levels
  - `getDbOutcomeCategories()` - Returns outcome categories
  - `getDbInterventions()` - Returns interventions
  - etc.

### 2. builderRefs Now Dynamic (Lines ~11656-11725)
- `builderRefs` initialized with fallback values
- `updateBuilderRefsFromDb()` function updates all fields from `dbCache`:
  - programs, stakeholders, stakeholderLevels
  - outcomeCategories, outcomeCategoryMeta
  - environments, childexp, interventions, periods
- Also triggers `populateProgramDropdowns()` to update UI

### 3. Data Upload Module Updated
- `duRenderUdiseGrid()` now uses `getDbPrograms()` instead of hardcoded list
- `duGenerateUdiseSchools()` uses `getDbDistricts(prog)` for dynamic districts
- Added `populateProgramDropdowns()` to update `du-prog-sel` and `du-udise-prog` dropdowns

### 4. Budget Tracker DB Integration
- Added `btLoadProgramsFromDb()` to merge DB programs with existing grants data
- `btStore.programs` now updated from Supabase when available
- Grants data remains hardcoded as fallback (DB tables currently empty)

### 5. GOP Indicators Dynamic Loading
- Changed `BT_GOP_INDICATORS` from const to let
- Added `loadGopIndicatorsFromDb()` to fetch from `indicator` table
- Falls back to seed data if DB is empty

### 6. Initialization Flow Updated
- Page load triggers `loadGlobalDbData()` immediately
- Login handler now async - loads all DB data before showing home
- Calls `btLoadProgramsFromDb()` and `loadGopIndicatorsFromDb()`

---

## STILL HARDCODED (Requires DB Seeding) ⚠️

| Module | Data | DB Tables | Status |
|--------|------|-----------|--------|
| Budget Tracker | Grant details, Budget lines | `grants`, `grant_framework_budget` | **Empty in DB** |
| Budget Tracker | Monthly actuals | `grant_budget_monthly_actuals` | **Empty in DB** |
| Budget Tracker | Disbursements | `grant_disbursement_schedule` | **Empty in DB** |
| GOP Impact | Impact numbers per program | `indicator_actuals`, `raw_submission` | **Needs aggregation** |
| GOP Actuals | Achieved values | `indicator_actuals` | **Partial data** |
| Reporting | Submission data | `raw_submission` | **Needs implementation** |

---

## DATABASE STATUS

| Table | Records | Status |
|-------|---------|--------|
| `program` | 3 | ✅ Ready (Karnataka, Kalaburagi, MantraX) |
| `state` | 1 | ⚠️ Needs more states |
| `district` | 5 | ⚠️ Needs more districts |
| `intervention` | 0 | ❌ Empty |
| `donor` | 0 | ❌ Empty |
| `grants` | 0 | ❌ Empty |
| `outcome_categories` | 6 | ✅ Ready |
| `stakeholder_level` | 5 | ✅ Ready |
| `stakeholder_type` | 7 | ✅ Ready |
| `environment` | 3 | ✅ Ready |
| `child_experience` | 7 | ✅ Ready |
| `indicator` | 9 | ✅ Ready |
| `financial_year` | 1 | ✅ Ready |
| `period` | Multiple | ✅ Ready |

---

## NEXT STEPS

1. **Seed missing data**: Run migrations to populate `intervention`, `donor`, `grants` tables
2. **Add more geography**: Seed additional states and districts
3. **Connect reporting**: Wire up `raw_submission` saves/reads
4. **Budget actuals**: Connect monthly budget data entry to DB
5. **Impact aggregation**: Create views/functions to aggregate impact numbers
