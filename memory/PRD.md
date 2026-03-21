# Mantra IMIS - Product Requirements Document

## Original Problem Statement
Connect existing Mantra IMIS application (HTML + Postgres + Shell) to Supabase database. Perform end-to-end code review and ensure all data flows are connected to Supabase with no hardcoded data.

## Architecture
- **Frontend**: Single-page HTML application (~16,700 lines) with embedded CSS and JavaScript
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

## What's Been Implemented

### March 20, 2026 - Phase 1-3
- Created `dbCache` object for caching Supabase data
- Implemented `loadGlobalDbData()` to fetch all reference data on page load
- Dynamic reference data loading (`builderRefs`)
- Budget Tracker integration with DB programs

### March 21, 2026 - LFA Setup Bug Fix (P0) ✅
**Issue**: Stakeholder chips not expanding to show outcomes/activities when loading published data

**Fixes Applied**:
1. Removed pre-adding 'on' class before `lfaToggleStk()` calls
2. Updated `lfaLoadDraft()` to fall through to `lfaLoadFromPublished()` when draft lacks stakeholders
3. Added `lfaUpdateISTMRowCount()` function to update ISTM row header counts

### March 21, 2026 - Monthly Reporting Filter Enhancement ✅
**Feature**: Added period/frequency filters to Monthly Reporting data entry sheet

**New Filters Added**:
1. **Financial Year** dropdown - dynamically loaded from `financial_year` table
2. **Period/Month** dropdown - dynamically loaded from `period` table based on selected FY
3. **Frequency** filter (Monthly, Quarterly, Annual) - filters indicators by reporting frequency

**Implementation**:
- Added new filter dropdowns to the quick filter bar (lines 2059-2085)
- Created `loadFYAndPeriods()` function to fetch FY and period data from Supabase
- Created `populatePeriodDropdown()` to cascade periods based on selected FY
- Updated `renderSheet()` to apply frequency filter to indicator rows
- Added event listeners for new filter changes
- Updated reset filter logic to clear new filters

## Key DB Schema
- `program`: {program_id, program_name, program_code}
- `intervention`: {intervention_id, program_id, intervention_type_id}
- `lfa_outcome`: {lfa_outcome_id, intervention_id, stakeholder_type_id, outcome_statement}
- `lfa_activity`: {lfa_activity_id, intervention_id, stakeholder_type_id, activity_statement}
- `indicator`: {indicator_id, frequency, indicator_name}
- `financial_year`: {financial_year_id, fy_name, is_current}
- `period`: {period_id, financial_year_id, period_name, period_type}
- `lfa_draft`: {program_id, draft_data, is_published, saved_at}

## Prioritized Backlog

### P1 - Financial Year Wise Data Population
- [ ] Ensure `financial_year_id` is captured from UI during LFA publish
- [ ] Save financial year reference in downstream records

### P1 - Verify Cascading Deletion
- [ ] When republishing LFA, ensure orphaned activities/indicators are properly deleted
- [ ] No duplicate data on republish

### P2 - Monthly Reporting Data Entry Persistence
- [ ] Test submitting actual indicator data
- [ ] Verify saves to `raw_submission` table

### P3 - Code Refactoring
- [ ] Modularize the monolithic 16.7k line HTML file (optional)

## Files of Reference
- `/app/src/index.html`: Main application source (edit here)
- `/app/frontend/public/mantra.html`: Served file (copy from src after edits)
- `/app/CODE_REVIEW_REPORT.md`: Documentation of DB mappings

## Testing Notes
- Login as "M&E Administrator" role to access LFA Setup
- Login as "Program POC" role to access Monthly Reporting
- MantraX program has published data for testing
- Preview URL: https://superbase-builder.preview.emergentagent.com/mantra.html
