# Changelog — Mantra IMIS Portal

All notable changes to this project are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [16.2.0] — 2026-03-17

### Added
- Industry-grade project structure with `src/`, `docs/`, `config/`, `scripts/`, `.github/`
- Full `README.md` with quick-start, feature table, and deployment overview
- Architecture documentation (`docs/ARCHITECTURE.md`)
- User guide with per-role walkthroughs (`docs/USER_GUIDE.md`)
- Deployment guide with Nginx, Apache, Netlify, Vercel, and Supabase schema (`docs/DEPLOYMENT.md`)
- GitHub Actions CI/CD pipeline (`.github/workflows/`)
- `package.json` with `npm run serve`, `npm run dev`, `npm run build`, `npm run deploy:*`
- `.editorconfig` for consistent code formatting across editors
- `.htmlhintrc` for HTML linting
- `config/supabase.example.env` for environment configuration template
- `scripts/serve.sh` and `scripts/deploy.sh` shell helpers
- MIT `LICENSE` file

### Changed
- `src/index.html` is the canonical, untouched application source

---

## [16.0.0] — 2026-02 (v16 Leader Final)

### Added
- Leader role with full dashboard analytics
- Grant Management module: portfolio, budget tracker, utilisation certificates
- Grant Onboarding Wizard (7-step flow with Supabase integration)
- Data Upload module with UDISE code mapping and impact KPI computation
- M&E Builder v2 with intervention blocks and LFA source panels
- Dark mode support across all modules
- Submission status matrix on dashboard

### Changed
- Design system upgraded to "Precision Light" (v3.0): white cards, strong blue accent, Linear/Notion/Stripe-inspired layout
- Sidebar with collapsible Grant Management sub-navigation
- POC sheet redesigned with intervention tabs and filter bar

---

## [15.0.0] — 2025-11

### Added
- M&E Builder with publish/draft workflow
- Published framework drives Monthly Reporting sheet
- Per-programme submit state (submitting Bihar doesn't lock Karnataka)
- Bulk operations in builder (type, stakeholder, period bulk-apply)
- CSV export from builder and sheet

### Fixed
- Sheet autosave now correctly scoped to programme + month
- Filter chips clear correctly on reset

---

## [14.0.0] — 2025-09

### Added
- Multi-programme support (10 state programmes)
- Programme selector grid on Monthly Reporting entry
- Programme health cards on dashboard
- Intervention and Stakeholder filter dropdowns on sheet

---

## [12.0.0] — 2025-06

### Added
- Role-based UI (POC vs. Leader views)
- Toast notification system
- Modal submit confirmation with validation summary
- Flag / unflag individual indicators

---

## [10.0.0] — 2025-03

### Added
- Initial Monthly Reporting Sheet (single programme)
- Auth screen with role selection
- Basic dashboard KPI strip
- Dark mode prototype

---

*Older versions are not formally recorded in this changelog.*
