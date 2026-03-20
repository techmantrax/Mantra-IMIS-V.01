# User Guide — Mantra IMIS Portal

## Getting Started

1. Open `src/index.html` in any modern browser (Chrome, Firefox, Edge, Safari).
2. On the login screen, enter any email/password (prototype — no validation).
3. Select your **role** from the dropdown.
4. Click **Login**.

---

## Roles

### POC (Programme Officer / Field Coordinator)
Access: Dashboard · Monthly Reporting · Data Upload

### Leader (Programme Lead / M&E Manager)
Access: All POC features + M&E Builder + full Dashboard analytics

### Admin
Access: All features including Grant Management

---

## Module Walkthroughs

---

### Dashboard (Home)

The dashboard displays a real-time summary of your programme's health.

**KPI Strip** — Shows cumulative totals: schools reached, children impacted, stakeholders trained.

**Programme Health Cards** — One card per state programme. Click any card to jump directly to its Monthly Reporting sheet.
- Green bar = On track (≥80% completion)
- Amber bar = At risk (50–79%)
- Red bar = Critical (<50%)

**Submission Status Matrix** — Month-by-month grid showing which programmes have submitted, are in draft, or have not started.

---

### Monthly Reporting

**Step 1 — Select Programme**
- Click any programme card on the Programme Selector screen.

**Step 2 — Fill Indicators**
- The sheet displays all indicators from the published M&E framework.
- For each indicator, enter the actual value in the **Actual** column.
- Add remarks in the **Remarks** column if needed.
- Use the flag icon (🚩) to raise a data quality concern.

**Filtering**
- Use the **Intervention** and **Stakeholder** dropdowns to focus on a subset.
- Use the **Search** box to find specific indicators by name.
- Click **Show only missing** to see unfilled indicators.
- Click **Show flagged only** to review flagged entries.

**Saving**
- Click **Save Draft** to save your progress (autosave also runs every 30 seconds).
- Drafts are per-programme and per-month — switching programmes preserves your work.

**Submitting**
- Click **Submit Month** when all indicators are filled.
- A confirmation modal shows a summary before final submission.
- Once submitted, the sheet becomes read-only for that month.

**CSV Import/Export**
- Click **Export CSV** to download the indicator sheet as a spreadsheet.
- Click **Import CSV** to bulk-fill values from a CSV file.

---

### M&E Builder

> Available to: Leader, Admin

**Programme Selector** — Choose which programme's framework to edit.

**Framework Table** — Each row is one indicator. Columns include:
| Column | Description |
|---|---|
| Indicator Name | The metric being tracked |
| Type | Output or Outcome |
| Stakeholder | Who is being measured (Teacher, Student, HM, etc.) |
| Environment | Physical or digital |
| Child Experience | Whether it relates to child learning |
| Activity | The programme activity it belongs to |
| Outcome Statement | The change this indicator measures |
| Direction | Up ↑ or Down ↓ (desired trend) |
| Aggregation | Sum, Average, or Count |
| Unit | Number, Percentage, Score, etc. |
| Frequency | Monthly, Quarterly, Annual |
| Target | Numerical target for the period |

**Adding Rows**
- Click **+ Add Row** at the top or bottom of the table.
- Type directly in any cell to edit.

**Bulk Operations**
- Select multiple rows using the checkboxes.
- Use the bulk toolbar to apply Type, Stakeholder, or Period to all selected rows.
- Click **Delete Selected** to remove multiple rows at once.

**Publishing**
- Click **Publish Framework** to make the framework live in Monthly Reporting.
- A yellow banner appears if unpublished changes exist.
- The published framework is frozen for reporting until the next publish.

**Exporting**
- Click **Export CSV** to download the full framework as a CSV file.

---

### Grant Management

> Available to: Admin

**Portfolio View**
Shows all active grants with:
- Grant name, donor, status
- Budget utilisation bar (spent vs. allocated)
- Disbursement schedule status

**Budget Tracker**
- Select a programme and grant to view its budget breakdown.
- Switch between **Budget Lines**, **Monthly Actuals**, and **Disbursements** tabs.
- Click **Generate UC** to produce a Utilisation Certificate for the selected period.

**Grant Onboarding Wizard**
Step-by-step wizard to create a new grant:
1. Donor details
2. Grant details (amount, currency, dates)
3. Programme and intervention scope
4. Budget lines
5. Disbursement schedule
6. Reporting schedule

Click **Activate Grant** on the final step to save to Supabase (or log to console in mock mode).

---

### Data Upload

> Available to: POC (own programme), Leader/Admin (all programmes)

**Step 1 — Select Programme and Month**
Use the dropdowns at the top to select which programme and reporting month you are uploading for.

**Step 2 — Drop or Browse File**
Drag a CSV, XLSX, or XLS file into the upload zone, or click **Browse files**.

Supported file types:
- Google Sheets exports (CSV)
- Excel workbooks (XLSX, XLS)
- Any tabular file with a UDISE code column

**Step 3 — Map Columns**
The system auto-detects common column names. Review the mapping:
- Green badge = auto-matched
- Amber badge = needs manual selection

Use the dropdowns to assign your file's columns to the system's expected fields.

**Step 4 — Process**
Click **Confirm mapping & process →**. The system will:
1. Match each row's UDISE code against the programme's school list
2. Compute impact KPIs (schools reached, children impacted, stakeholders)
3. Store results in the upload history

**Reviewing Results**
- Green row = successfully matched and processed
- Amber row = partial match or data warnings
- Red row = unmatched UDISE or invalid data

Click **View errors** to see the detailed error panel.

**Upload History**
Switch to the **Upload History** tab to see all previous uploads, their status, and row counts.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + S` | Save draft (on Sheet page) |
| `Escape` | Close modal or dialog |
| `Tab` | Navigate between form fields |
| `Enter` | Submit login form |

---

## Dark Mode

Click the **sun/moon icon** in the top-right corner of any page to toggle between light and dark mode.

---

## Troubleshooting

**Q: The sheet shows no indicators.**
A: The M&E Builder framework has not been published yet. Ask a Leader or Admin to publish it.

**Q: My data upload fails UDISE matching.**
A: Ensure your file has a column containing 11-digit UDISE school codes. Set up the programme's UDISE list in the **UDISE Setup** tab.

**Q: Supabase actions show "mock" in console.**
A: The app is running in mock mode. Replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` in `src/index.html` with real values.

**Q: The page is blank on mobile.**
A: The application is optimised for desktop (1024px+). Mobile support is limited in the current version.
