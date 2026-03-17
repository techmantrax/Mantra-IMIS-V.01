# Architecture — Mantra IMIS Portal

## System Overview

Mantra IMIS is a **self-contained, single-page web application** (SPA). All HTML, CSS, and JavaScript are embedded in `src/index.html`. No build tools, bundlers, or server-side runtime are required for operation. Supabase provides optional cloud persistence.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Client)                    │
│                                                         │
│  ┌──────────────┐   ┌────────────────────────────────┐  │
│  │  Auth Screen  │   │          App Shell             │  │
│  │  (role login) │──▶│  Sidebar + Topbar + Content    │  │
│  └──────────────┘   └───────────────┬────────────────┘  │
│                                     │                   │
│                    ┌────────────────▼─────────────┐     │
│                    │       Page Router (JS)        │     │
│                    │   showPage(route) function    │     │
│                    └──┬───┬───┬───┬───┬───┬───┬───┘     │
│                       │   │   │   │   │   │   │         │
│                    home│ sheet│ me│ gm│ du│ bt│ gop     │
│                       ▼   ▼   ▼   ▼   ▼   ▼   ▼         │
│             ┌─────────────────────────────────────┐     │
│             │            Page Sections             │     │
│             │  Dashboard · Sheet · M&E Builder     │     │
│             │  Grant Mgmt · Data Upload · Budget   │     │
│             └─────────────────────────────────────┘     │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │                  State Layer (JS)                │   │
│  │   state{}  reportingActuals{}  publishedFramework│   │
│  │   builderRows[]  gsState{}  btStore{}  duStore{} │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │ (optional)
                          ▼
         ┌────────────────────────────────┐
         │         Supabase Cloud         │
         │  PostgreSQL · Auth · Storage   │
         │  REST API via fetch()          │
         └────────────────────────────────┘
```

---

## Module Breakdown

### 1. Auth Module
- **File location:** `#screen-auth` section in `src/index.html`
- **Function:** Role selection (poc / leader / admin) with email + password fields
- **State:** Sets `state.role`, triggers `applyRoleUI()` and `showPage('home')`
- **Note:** Prototype — no real auth backend. Connect Supabase Auth for production.

### 2. Page Router
- **Key function:** `showPage(route)`
- **Routes:** `home`, `sheet`, `me-builder`, `grant-mgmt`, `data-upload`, `budget-tracker`, `grant-op`
- **Mechanism:** Shows/hides `<section id="page-*">` elements, updates breadcrumbs and sidebar active state

### 3. Dashboard (Home)
- **ID:** `#page-home`
- **Content:** KPI strip, programme health grid, submission status matrix
- **Data source:** In-memory `state` object + `publishedFramework`

### 4. Monthly Reporting Sheet
- **ID:** `#page-sheet`
- **Key functions:** `renderSheet()`, `renderProgSelector()`, `computeStats()`
- **Data flow:** POC selects programme → `getReportingRows(prog)` fetches from published framework → renders indicator table → POC fills actuals → `reportingActuals` store updated
- **Persistence:** `localStorage` autosave (prototype); Supabase submission on `btn-submit`

### 5. M&E Builder
- **ID:** `#page-me-builder`
- **Key functions:** `renderBuilder()`, `renderBuilderTable()`, `doPublish()`
- **Data flow:** Leader edits `builderRows[]` → `doPublish()` snapshots into `publishedFramework` → drives Sheet and Dashboard
- **Sub-state:** `builderRows`, `publishedFramework`, `activeMEProgram`

### 6. Grant Management
- **ID:** `#page-grant-mgmt`
- **Sub-pages:** Portfolio (`grant-mgmt`), Budget Tracker (`budget-tracker`), Grant Onboarding (`grant-op`)
- **Key functions:** `btRenderCurrentView()`, `gsActivate()`, `renderGrantPortfolio()`
- **Supabase tables:** `donor`, `grants`, `grant_program_scope`, `grant_intervention_scope`, `grant_framework_budget`, `grant_disbursement_schedule`, `grant_reporting_schedule`

### 7. Data Upload
- **ID:** `#page-data-upload`
- **Key functions:** `duBuildMapper()`, `duProcess()`, `duComputeKPIs()`
- **Flow:** File drop → column mapping → UDISE match → KPI computation → `duStore` updated
- **Formats:** CSV, XLSX, XLS

---

## State Architecture

```
state (global)
  ├── role: 'poc' | 'leader' | 'admin'
  ├── route: string
  ├── program: string | null
  ├── fy: string
  ├── month: string
  ├── filters: { search, indType, stakeholder, … }
  ├── submittedPrograms: { [progName]: boolean }
  └── sheetRows (computed from publishedFramework)

reportingActuals: { [program]: { [indicatorId]: { value, remarks, flagged } } }

publishedFramework: { rows[], count, publishedAt }

builderRows: Indicator[]

gsState (Grant Setup): { step, budgetLines[], disbRows[], reportRows[], … }

btStore (Budget Tracker): { activeProg, activeGrant, activeView, … }

duStore (Data Upload): { uploads[], udiseMap, kpis }
```

---

## CSS Architecture

- All styles are embedded in `<style>` blocks within `src/index.html`
- Design system uses CSS Custom Properties (variables) defined in `:root`
- Dark mode implemented via `body.dark` class overriding all CSS variables
- Component-scoped styles for complex modules (M&E Builder, Data Upload, Budget Tracker) are in `<style>` tags within their respective `<section>` elements

### Design Tokens

| Token | Purpose |
|---|---|
| `--blue`, `--blue-mid` | Primary brand accent |
| `--ink`, `--ink-2`, `--ink-3` | Text hierarchy |
| `--mist`, `--mist-2`, `--mist-3` | Borders and subtle backgrounds |
| `--ok`, `--warn`, `--danger` | Semantic status colours |
| `--shadow-xs` to `--shadow-xl` | Elevation system |
| `--r-sm` to `--r-xl` | Border radius scale |

---

## Data Flow — Monthly Reporting

```
M&E Builder (Leader)
      │
      │  doPublish()
      ▼
publishedFramework  ◄──── getReportingRows(program)
      │
      ▼
Monthly Sheet (POC)
      │
      │  fills actuals
      ▼
reportingActuals[program][id]
      │
      │  btn-submit → sbInsert('submissions', …)
      ▼
Supabase (prod) / toast (mock)
```

---

## Security Considerations

- The application is a **prototype/demo**. For production:
  1. Implement real authentication (Supabase Auth or OAuth)
  2. Enable Row Level Security (RLS) on all Supabase tables
  3. Never expose `service_role` key in frontend code — use only `anon` key
  4. Validate all user inputs server-side
  5. Serve over HTTPS only
  6. Add Content Security Policy headers via server/CDN config

---

## Performance

- Zero JavaScript dependencies — no React, Vue, Angular, or jQuery
- Single HTTP request for the full application (~585 KB)
- Google Fonts preconnect for optimal font loading
- All rendering is synchronous DOM manipulation — no virtual DOM overhead
