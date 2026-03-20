# Mantra IMIS - Product Requirements Document

## Original Problem Statement
Connect existing Mantra IMIS application (HTML + Postgres + Shell) to Supabase database. Perform end-to-end code review and ensure all data flows are connected to Supabase with no hardcoded data.

## Architecture
- **Frontend**: Single-page HTML application (~15,400 lines) with embedded CSS and JavaScript
- **Database**: Supabase (PostgreSQL)
- **No Backend Server**: Direct Supabase REST API calls from frontend using anon key

## User Personas
1. **Admin (M&E Administrator)**: Full access to M&E Builder, LFA Setup, Data Upload
2. **Manager (Program Manager)**: Grant Management, Budget Tracker, Portfolio
3. **POC (Program Point of Contact)**: Monthly Reporting, Basic Dashboard

## Core Requirements
- [x] Supabase connection verified and working
- [x] Dynamic data loading from database
- [x] Fallback to hardcoded data when DB is empty
- [x] No breaking changes to UI

## What's Been Implemented (March 20, 2026)

### Phase 1: Global Data Loader
- Created `dbCache` object for caching Supabase data
- Implemented `loadGlobalDbData()` to fetch all reference data on page load
- Added helper functions: `getDbPrograms()`, `getDbDistricts()`, `getDbStakeholderLevels()`, etc.

### Phase 2: Dynamic Reference Data
- `builderRefs` now updates from Supabase:
  - Programs, Stakeholder Types/Levels
  - Outcome Categories, Environments, Child Experiences
  - Interventions, Periods
- Program dropdowns dynamically populated via `populateProgramDropdowns()`

### Phase 3: Budget Tracker Integration
- `btLoadProgramsFromDb()` merges DB programs with hardcoded grants
- GOP indicators load from `indicator` table

### Files Modified
- `/app/src/index.html` - Main application (all changes)
- `/app/CODE_REVIEW_REPORT.md` - Detailed review and status

## Prioritized Backlog

### P0 - Data Seeding Required
- [ ] Seed `intervention` table (currently empty)
- [ ] Seed `donor` table (currently empty)
- [ ] Seed `grants` table (currently empty)
- [ ] Add more states and districts

### P1 - Budget Tracker Full Integration
- [ ] Connect grant budget lines to `grant_framework_budget`
- [ ] Connect monthly actuals to `grant_budget_monthly_actuals`
- [ ] Connect disbursements to `grant_disbursement_schedule`

### P2 - Reporting Module
- [ ] Save reporting data to `raw_submission`
- [ ] Load indicator actuals from `indicator_actuals`
- [ ] Persist published frameworks

### P3 - Impact Aggregation
- [ ] Create views for impact numbers per program
- [ ] Connect GOP impact data to database

## Next Tasks
1. Seed missing reference data (interventions, donors, grants)
2. Wire up Budget Tracker to save/load from Supabase
3. Implement raw_submission persistence for reporting
