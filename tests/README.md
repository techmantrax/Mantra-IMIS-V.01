# Tests — Mantra IMIS Portal

## Current Status

The application is a self-contained HTML/CSS/JS SPA. Automated tests are planned for future iterations.

---

## Testing Strategy

### Unit Tests (Planned)
- Extract pure utility functions from `src/index.html` into testable modules
- Framework recommendation: **Vitest** (fast, zero-config)
- Coverage target: core data-processing functions (UDISE mapping, KPI computation, framework publish logic)

### Integration / E2E Tests (Planned)
- Framework recommendation: **Playwright**
- Key user journeys to automate:
  1. Login → select programme → fill indicators → submit month
  2. M&E Builder → add indicators → publish → verify sheet updates
  3. Grant Onboarding Wizard — all 7 steps → activate
  4. Data Upload → drop file → map columns → process → verify KPI strip

### Manual Test Checklist

Use this checklist for every release:

#### Auth
- [ ] Login with role `poc` — grants correct module access
- [ ] Login with role `leader` — M&E Builder visible in sidebar
- [ ] OTP button shows toast (prototype behaviour)
- [ ] Dark mode persists after login

#### Dashboard
- [ ] All KPI cards render with data
- [ ] Programme health cards show correct colour coding
- [ ] Clicking a health card navigates to correct sheet

#### Monthly Reporting
- [ ] Programme selector shows all 10 programmes
- [ ] Sheet loads after selecting a programme
- [ ] Indicator filters work (intervention, stakeholder, search)
- [ ] "Show missing" chip hides filled rows
- [ ] Autosave saves values when switching programmes
- [ ] Submit modal shows correct summary counts
- [ ] Submitted sheet is read-only
- [ ] Export CSV downloads a valid CSV file

#### M&E Builder
- [ ] Add row adds an editable row
- [ ] Publish button publishes framework
- [ ] Published banner confirms count
- [ ] Unpublished changes show warning banner on sheet
- [ ] Export CSV includes all columns

#### Grant Management
- [ ] Portfolio view lists grants with utilisation bars
- [ ] Budget Tracker opens on programme/grant selection
- [ ] Generate UC button opens UC modal
- [ ] Grant Onboarding: all 7 steps navigate correctly
- [ ] Grant Onboarding: Activate saves to Supabase (or logs mock)

#### Data Upload
- [ ] Drop zone accepts CSV/XLSX
- [ ] Column mapper shows auto-matched fields
- [ ] Process button runs with progress bar
- [ ] KPI strip updates after successful upload
- [ ] Upload History tab shows log entry

#### Dark Mode
- [ ] Toggle switches all surfaces to dark palette
- [ ] All text remains readable in dark mode
- [ ] Charts and badges use dark-mode colours

---

## Running Future Tests

```bash
# Unit tests (once extracted)
npm test

# E2E tests (once implemented)
npm run test:e2e

# Manual test server
npm run serve
```
