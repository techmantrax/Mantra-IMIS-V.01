# Mantra IMIS - Product Requirements Document

## Original Problem Statement
Connect existing Mantra IMIS application (HTML + Postgres + Shell) to Supabase database. Perform end-to-end code review and ensure all data flows are connected to Supabase with no hardcoded data.

## Architecture
- **Frontend**: Single-page HTML application (~17,000 lines) with embedded CSS and JavaScript
- **Database**: Supabase (PostgreSQL)
- **No Backend Server**: Direct Supabase REST API calls from frontend using anon key

## What's Been Implemented

### March 20, 2026 - Phase 1-3
- Created `dbCache` object for caching Supabase data
- Implemented `loadGlobalDbData()` to fetch all reference data on page load
- Dynamic reference data loading (`builderRefs`)
- Budget Tracker integration with DB programs

### March 21, 2026 - LFA Setup Bug Fix ✅
- Fixed stakeholder chips not expanding for published data
- Added `lfaUpdateISTMRowCount()` function

### March 21, 2026 - M&E Builder Target Auto-Save ✅
- Target values auto-save to `indicator_targets` table
- Persist across navigation and publish
- Load from DB when M&E Builder opens

### March 21, 2026 - Monthly Reporting Frequency Filtering ✅
**Feature**: Proper frequency-based filtering for Monthly Reporting

**Top Nav Controls**:
1. **FY dropdown** - Select financial year
2. **Frequency dropdown** (NEW) - Monthly / Quarterly / Annual
3. **Period dropdown** - Changes based on frequency:
   - Monthly → Shows 12 months (Apr, May, Jun...)
   - Quarterly → Shows 4 quarters (Q1, Q2, Q3, Q4)
   - Annual → Shows "Annual"

**How it works**:
- Select "Monthly" → Period shows months → Only monthly indicators displayed
- Select "Quarterly" → Period shows quarters → Only quarterly indicators displayed
- Select "Annual" → Period shows Annual → Only annual indicators displayed

**Filter bar simplified**: Only Interventions + Stakeholders + Search + Show missing/flagged

## Key DB Schema
- `indicator`: {indicator_id, frequency, indicator_name, baseline_value}
- `indicator_targets`: {indicator_target_id, indicator_id, period_id, target_value}
- `financial_year`: {financial_year_id, fy_name, is_current}
- `period`: {period_id, financial_year_id, period_name, period_type}

## Prioritized Backlog

### P1 - Financial Year Wise Data Population
- [ ] Ensure `financial_year_id` is captured from UI during LFA publish

### P1 - Verify Cascading Deletion
- [ ] When republishing LFA, ensure orphaned activities/indicators are properly deleted

### P2 - Monthly Reporting Data Entry Persistence
- [ ] Test submitting actual indicator data
- [ ] Verify saves to `raw_submission` table

### P3 - Code Refactoring
- [ ] Modularize the monolithic 17k line HTML file (optional)

## Files of Reference
- `/app/src/index.html`: Main application source (edit here)
- `/app/frontend/public/mantra.html`: Served file (copy from src after edits)

## Testing Notes
- Login as "M&E Administrator" role to access M&E Builder and LFA Setup
- Login as "Program POC" role to access Monthly Reporting
- MantraX program has published data for testing
- Preview URL: https://superbase-builder.preview.emergentagent.com/mantra.html
