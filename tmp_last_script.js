
// ═══════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════
const state = {
  role: 'poc',
  route: 'home',
  program: null,
  programSchools: 820,
  fy: '2025-26',
  month: 'Feb 2026',
  showMissing: false,
  showFlagged: false,
  // All filter keys (populated dynamically from published refs)
  filters: { search:'', indType:'', stakeholder:'', env:'', child:'', period:'', intv:'', activity:'', outcome:'', outcomeCat:'' },
  // Per-program submit state — keyed by program name so submitting Bihar doesn't lock Karnataka
  submittedPrograms: {},
  get submitted() { return !!this.submittedPrograms[this.program]; },
  set submitted(val) { if (this.program) this.submittedPrograms[this.program] = val; },
  // sheetRows is derived from the published framework (falls back to live if unpublished)
  get sheetRows() { return getReportingRows(this.program); },
};

// Stores POC-entered actuals per program → indicator id
// Structure: { 'Bihar': { 1: { value:'', remarks:'', flagged:false, updated:'—' }, ... } }
const reportingActuals = {};

// ═══════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════
const $ = id => document.getElementById(id);
const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const esc = s => String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(msg, duration=2500) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ═══════════════════════════════════════════════════
// BRIDGE: M&E Builder → Monthly Reporting
// Derives sheet rows live from builderRows for a given program.
// POC-entered actuals are preserved in reportingActuals[program][id].
// ═══════════════════════════════════════════════════
function getSheetRowsForProgram(program) {
  if (!program) return [];
  // Use per-program snapshot first (builderRowsByProg), fall back to global builderRows
  const src = (builderRowsByProg[program] && builderRowsByProg[program].length)
    ? builderRowsByProg[program]
    : (typeof builderRows !== 'undefined' ? builderRows : []);
  const rows = src.filter(r => r.active !== false && r.prog === program && r.name);

  if (!reportingActuals[program]) reportingActuals[program] = {};
  const actuals = reportingActuals[program];

  return rows.map(r => {
    if (!actuals[r.id]) actuals[r.id] = { value:'', remarks:'', flagged:false, updated:'—', actualStatus:'draft' };
    const a = actuals[r.id];
    return {
      _id:        r.id,
      indicator:  r.name,
      abbr:       r.abbr || '',
      type:       r.type,
      stakeholder:r.stk,
      unit:       r.unit,
      target:     r.target,
      child:      r.child,
      env:        r.env,
      freq:       r.freq,
      period:     r.period,
      intv:       r.intv,
      dir:        r.dir,
      activity:   r.activity,
      outcome:    r.outcome,
      outcomeCategory:r.outcomeCategory || '',
      dir:        r.dir,
      agg:        r.agg,
      isKeyOutcome:r.isKeyOutcome,
      baseline:   r.baseline,
      value:      a.value,
      remarks:    a.remarks,
      flagged:    a.flagged,
      updated:    a.updated,
      actualStatus: a.actualStatus || 'draft',
    };
  });
}

// Saves a value entered by POC back into reportingActuals
// actualStatus ENUM: draft | submitted | approved | rejected  (matches DB actual_status_enum)
function saveActual(program, id, field, val) {
  if (!reportingActuals[program]) reportingActuals[program] = {};
  if (!reportingActuals[program][id]) reportingActuals[program][id] = { value:'', remarks:'', flagged:false, updated:'—', actualStatus:'draft' };
  reportingActuals[program][id][field] = val;
  reportingActuals[program][id].updated = 'Just now';
  if (field === 'value') reportingActuals[program][id].actualStatus = 'draft';
}

// Update actualStatus for all actuals in a program
function setProgramActualStatus(program, status) {
  if (!reportingActuals[program]) return;
  Object.values(reportingActuals[program]).forEach(a => { a.actualStatus = status; });
}

// Dynamic program stats derived from builder
function getProgramStats(program) {
  const rows = getReportingRows(program);
  const total = rows.length;
  const filled = rows.filter(r => r.value !== '').length;
  const flags  = rows.filter(r => r.flagged).length;
  const pct    = total > 0 ? Math.round(filled / total * 100) : 0;
  return { total, filled, missing: total - filled, flags, pct };
}

// ═══════════════════════════════════════════════════
// M&E BOOK
// ═══════════════════════════════════════════════════
/* ── Icon library (Lucide-style SVG, 16×16, currentColor) ── */
const IC = (() => {
  const s = (body, w=16, h=16) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;">${body}</svg>`;
  return {
    // ── UI controls ──
    search:      s('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>'),
    x:           s('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    plus:        s('<path d="M5 12h14"/><path d="M12 5v14"/>'),
    edit:        s('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>'),
    trash:       s('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>'),
    check:       s('<polyline points="20 6 9 17 4 12"/>'),
    'check-circle': s('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
    'arrow-right': s('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
    'arrow-left':  s('<path d="m19 12-14 0"/><path d="m12 5-7 7 7 7"/>'),
    'chevron-down': s('<path d="m6 9 6 6 6-6"/>'),
    'chevron-up':   s('<path d="m18 15-6-6-6 6"/>'),
    'chevron-right':s('<path d="m9 18 6-6-6-6"/>'),
    lock:        s('<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    shield:      s('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
    info:        s('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
    warning:     s('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
    star:        s('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
    flag:        s('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>'),
    refresh:     s('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
    rocket:      s('<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>'),
    lightbulb:   s('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'),
    target:      s('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
    settings:    s('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),
    'eye':       s('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'),
    // ── Content / module icons ──
    chart:       s('<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>'),
    'trending-up': s('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'),
    'book-open': s('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
    clipboard:   s('<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>'),
    zap:         s('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
    library:     s('<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>'),
    layers:      s('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'),
    'file-text': s('<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/>'),
    calendar:    s('<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>'),
    activity:    s('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'),
    database:    s('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>'),
    // ── People / location ──
    user:        s('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    users:       s('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    school:      s('<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>'),
    home:        s('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
    building:    s('<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v8h4"/><path d="M18 9h2a2 2 0 0 1 2 2v11h-4"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>'),
    map:         s('<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/>'),
    'map-pin':   s('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'),
    landmark:    s('<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="22"/><line x1="10" x2="10" y1="18" y2="22"/><line x1="14" x2="14" y1="18" y2="22"/><line x1="18" x2="18" y1="18" y2="22"/><polygon points="12 2 20 7 4 7"/><line x1="3" x2="21" y1="18" y2="18"/>'),
    wave:        s('<path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>'),
    // ── Specialty ──
    type:        s('<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>'),
    hash:        s('<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>'),
    sprout:      s('<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>'),
    'grid':      s('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'),
    'ruler':     s('<path d="M21.3 8.7 8.7 21.3c-1 1-2.5 1-3.4 0l-2.6-2.6c-1-1-1-2.5 0-3.4L15.3 2.7c1-1 2.5-1 3.4 0l2.6 2.6c1 1 1 2.5 0 3.4Z"/><path d="m7.5 10.5 2 2"/><path d="m10.5 7.5 2 2"/><path d="m13.5 4.5 2 2"/><path d="m4.5 13.5 2 2"/>'),
    'percent':   s('<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>'),
    'award':     s('<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>'),
    'log-in':    s('<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/>'),
    'log-out':   s('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>'),
    'moon':      s('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
    'sun':       s('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'),
    'maximize':  s('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
    'bell':      s('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
    'save':      s('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>'),
    'send':      s('<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'),
    'download':  s('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>'),
    'link':      s('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
    'filter':    s('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>'),
    'sliders':   s('<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/>'),
    wrench:      s('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/>'),
    party:       s('<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11v0c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98v0C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>'),
    bot:         s('<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>'),
    money:       s('<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
    paperclip:   s('<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>'),
    backpack:    s('<path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5"/><path d="M8 10h8"/><path d="M8 18h8"/>'),
    handshake:   s('<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>'),
  };
})();

const MEBK_URL = GS_SB_URL;
const MEBK_HDR = { ...GS_SB_HDR };
const mebkState = { loading: false };

// ═══════════════════════════════════════════════════
// M&E BOOK — Global Library (Outcomes | Activities)
// Outcomes and Activities are independent.
// Mapping happens during LFA Setup per stakeholder.
// ═══════════════════════════════════════════════════

window.mebkCats    = { outcomes: [], activities: [], impacts: [] };
window.mebkIndCats = []; // [{id, code, name}] — Output/Outcome/Impact

async function mebkInit() {
  await mebkLoadCategories();
  await Promise.all([mebkLoadStats(), mebkLoadOutcomes(), mebkLoadActivities()]);
  // Impact loaded lazily on tab click (mebkSwitchTab checks mebkImLoaded)
}

// ── Load & cache categories ─────────────────────────
async function mebkLoadCategories() {
  try {
    const [ocRes, acRes, indRes, imRes] = await Promise.all([
      fetch(`${MEBK_URL}/rest/v1/outcome_categories?is_active=eq.true&select=outcome_category_id,category_name&order=sort_order.asc`, { headers: MEBK_HDR }),
      fetch(`${MEBK_URL}/rest/v1/activity_category?is_active=eq.true&select=activity_category_id,category_name&order=sort_order.asc`, { headers: MEBK_HDR }),
      fetch(`${MEBK_URL}/rest/v1/indicator_category?select=indicator_category_id,category_code,category_name&order=category_code.asc`, { headers: MEBK_HDR }),
      fetch(`${MEBK_URL}/rest/v1/impact_category?is_active=eq.true&select=impact_category_id,category_name&order=sort_order.asc`, { headers: MEBK_HDR }),
    ]);
    const ocCats  = await ocRes.json();
    const acCats  = await acRes.json();
    const indCats = await indRes.json();
    const imCats  = imRes.ok ? await imRes.json() : [];

    if (Array.isArray(ocCats)) { mebkCats.outcomes = ocCats;    window.mebkOcCats = ocCats; }
    if (Array.isArray(acCats)) { mebkCats.activities = acCats;  window.mebkAcCats = acCats; }
    if (Array.isArray(imCats)) { mebkCats.impacts = imCats;     window.mebkImCats = imCats; }
    if (Array.isArray(indCats)) {
      window.mebkIndCats = indCats.map(c => ({ id: c.indicator_category_id, code: c.category_code, name: c.category_name }));
      window.mebkIcIds = {};
      indCats.forEach(c => { window.mebkIcIds[c.category_code] = c.indicator_category_id; });
    }
    mebkRenderCatPills();
  } catch(e) { /* silent */ }
}

// ── Sync all category selects for a tab (form + filter) ────
function mebkSyncCatSelects(tab) {
  const cats  = tab === 'oc' ? (window.mebkOcCats||[]) : tab === 'im' ? (window.mebkImCats||[]) : (window.mebkAcCats||[]);
  const idKey = tab === 'oc' ? 'outcome_category_id' : tab === 'im' ? 'impact_category_id' : 'activity_category_id';
  const isOc  = tab === 'oc'; // kept for unused refs below
  const catOpts = cats.map(c => `<option value="${c[idKey]}">${c.category_name}</option>`).join('');
  const addOpt  = `<option value="__new__" style="color:var(--ok);font-weight:600;">+ Add new category…</option>`;

  // Form select (Category… + existing + add new)
  const formSel = document.getElementById(`mebk-${tab}-cat-sel`);
  if (formSel) {
    const cur = formSel.value;
    formSel.innerHTML = `<option value="">Category…</option>${catOpts}${addOpt}`;
    if (cur && cur !== '__new__') formSel.value = cur;
  }

  // Filter dropdown (All Categories + existing — no add new here)
  const filterSel = document.getElementById(`mebk-cat-sel-${tab}`);
  if (filterSel) {
    const cur = filterSel.value;
    filterSel.innerHTML = `<option value="">All Categories</option>${catOpts}`;
    if (cur) filterSel.value = cur;
  }
}

// Called after mebkLoadCategories resolves
function mebkRenderCatPills() {
  mebkSyncCatSelects('oc');
  mebkSyncCatSelects('ac');
  mebkSyncCatSelects('im');
}

function mebkSetCatFilter(tab, catId) {
  window.mebkCatFilter = window.mebkCatFilter || {};
  window.mebkCatFilter[tab] = catId;
  const sel = document.getElementById(`mebk-cat-sel-${tab}`);
  if (sel) sel.classList.toggle('has-filter', !!catId);
  if (tab === 'oc') mebkLoadOutcomes();
  else if (tab === 'ac') mebkLoadActivities();
  else mebkLoadImpacts();
}

// ── Detect "+ Add new category…" selection ──────────
function mebkOnCatSelChange(tab, sel) {
  if (sel.value === '__new__') {
    sel.value = ''; // reset select
    mebkShowNewCatForm(tab);
  }
}

function mebkShowNewCatForm(tab) {
  const form = document.getElementById(`mebk-newcat-form-${tab}`);
  if (form) { form.style.display = 'flex'; document.getElementById(`mebk-newcat-inp-${tab}`)?.focus(); }
}

function mebkHideNewCatForm(tab) {
  const form = document.getElementById(`mebk-newcat-form-${tab}`);
  if (form) { form.style.display = 'none'; const inp = document.getElementById(`mebk-newcat-inp-${tab}`); if (inp) inp.value = ''; }
}

// ── Save new category to DB, update global state ────
async function mebkSaveNewCat(tab) {
  const inp  = document.getElementById(`mebk-newcat-inp-${tab}`);
  const name = inp?.value.trim();
  if (!name) { inp?.focus(); return; }
  const btn = document.getElementById(`mebk-newcat-save-${tab}`);
  if (btn) btn.disabled = true;
  try {
    const table = tab === 'oc' ? 'outcome_categories' : tab === 'im' ? 'impact_category' : 'activity_category';
    const pfxMap = { oc: 'OCC', ac: 'ACC', im: 'IPC' };
    const body = { category_name: name, category_code: `${pfxMap[tab]||'CAT'}-AUTO-${Date.now()}`, sort_order: 99, is_active: true };
    const res = await fetch(`${MEBK_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    const [newCat] = await res.json();
    // Update global cache
    if (tab === 'oc')      window.mebkOcCats = [...(window.mebkOcCats||[]), newCat];
    else if (tab === 'ac') window.mebkAcCats = [...(window.mebkAcCats||[]), newCat];
    else                   window.mebkImCats = [...(window.mebkImCats||[]), newCat];
    // Sync all selects
    mebkSyncCatSelects(tab);
    // Auto-select new category in form select
    const idKey   = tab === 'oc' ? 'outcome_category_id' : tab === 'im' ? 'impact_category_id' : 'activity_category_id';
    const formSel = document.getElementById(`mebk-${tab}-cat-sel`);
    if (formSel && newCat[idKey]) formSel.value = newCat[idKey];
    mebkHideNewCatForm(tab);
    mebkToast(`Category "${name}" added ✓`);
  } catch(e) { alert('Error saving category: ' + e.message); }
  if (btn) btn.disabled = false;
}

// ── Tab switch ──────────────────────────────────────
const MEBK_ALL_TABS = ['oc','ac','im','env','ce','stk','ocat','acat','inttype','intcat'];
function mebkSwitchTab(tab) {
  MEBK_ALL_TABS.forEach(t => {
    document.getElementById(`mebk-panel-${t}`).style.display = tab === t ? '' : 'none';
    document.getElementById(`mebk-tab-${t}`).classList.toggle('active', tab === t);
  });
  if (tab === 'im'   && !window.mebkImLoaded)   { mebkLoadImpacts(); window.mebkImLoaded = true; }
  if (['env','ce','stk','ocat','acat','inttype','intcat'].includes(tab) && !window[`mebkRefLoaded_${tab}`]) {
    mebkRefLoad(tab); window[`mebkRefLoaded_${tab}`] = true;
  }
}

// ══ Import / Export ════════════════════════════════
const MEBK_IO_CFG = {
  oc:   { label:'Outcomes',            cols:[{h:'Code',k:'outcome_code'},{h:'Statement',k:'outcome_statement'},{h:'Category',k:'_catName'},{h:'Active',k:'is_active'}],         dataFn:()=>window.mebkLibData?.oc||[], table:'outcome',           codeCol:'outcome_code',          nameCol:'outcome_statement', idCol:'outcome_id' },
  ac:   { label:'Activities',          cols:[{h:'Code',k:'activity_code'},{h:'Name',k:'activity_name'},{h:'Category',k:'_catName'},{h:'Active',k:'is_active'}],                dataFn:()=>window.mebkLibData?.ac||[], table:'activity',           codeCol:'activity_code',         nameCol:'activity_name',     idCol:'activity_id' },
  im:   { label:'Impact Goals',        cols:[{h:'Code',k:'impact_code'},{h:'Statement',k:'impact_statement'},{h:'Category',k:'_catName'},{h:'Active',k:'is_active'}],          dataFn:()=>window.mebkLibData?.im||[], table:'impact',             codeCol:'impact_code',           nameCol:'impact_statement',  idCol:'impact_id' },
  env:  { label:'Environments',        cols:[{h:'Code',k:'environment_code'},{h:'Name',k:'environment_name'},{h:'Description',k:'description'},{h:'Active',k:'is_active'}],    dataFn:()=>window.mebkRefItems?.env||[], table:'environment',       codeCol:'environment_code',      nameCol:'environment_name',  idCol:'environment_id' },
  ce:   { label:'Child Experience',    cols:[{h:'Code',k:'child_experience_code'},{h:'Experience',k:'experience_name'},{h:'Description',k:'description'},{h:'Active',k:'is_active'}], dataFn:()=>window.mebkRefItems?.ce||[], table:'child_experience', codeCol:'child_experience_code', nameCol:'experience_name',   idCol:'child_experience_id' },
  stk:  { label:'Stakeholder Types',        cols:[{h:'Code',k:'stakeholder_type_code'},{h:'Name',k:'type_name'},{h:'Description',k:'description'}],                                                 dataFn:()=>window.mebkRefItems?.stk||[], table:'stakeholder_type', codeCol:'stakeholder_type_code', nameCol:'type_name',          idCol:'stakeholder_type_id' },
  ocat: { label:'Outcome Categories',       cols:[{h:'Code',k:'category_code'},{h:'Name',k:'category_name'},{h:'Description',k:'description'},{h:'Active',k:'is_active'}],                               dataFn:()=>window.mebkRefItems?.ocat||[], table:'outcome_categories', codeCol:'category_code',         nameCol:'category_name',      idCol:'outcome_category_id' },
  acat: { label:'Activity Categories',      cols:[{h:'Code',k:'category_code'},{h:'Name',k:'category_name'},{h:'Description',k:'description'},{h:'Active',k:'is_active'}],                               dataFn:()=>window.mebkRefItems?.acat||[], table:'activity_category', codeCol:'category_code',         nameCol:'category_name',      idCol:'activity_category_id' },
  inttype: { label:'Intervention Types',    cols:[{h:'Code',k:'type_code'},{h:'Name',k:'type_name'},{h:'Description',k:'description'},{h:'Active',k:'is_active'}],                                        dataFn:()=>window.mebkRefItems?.inttype||[], table:'intervention_type', codeCol:'type_code',            nameCol:'type_name',          idCol:'intervention_type_id' },
  intcat: { label:'Intervention Categories', cols:[{h:'Code',k:'category_code'},{h:'Name',k:'category_name'},{h:'Description',k:'description'},{h:'Active',k:'is_active'}],                              dataFn:()=>window.mebkRefItems?.intcat||[], table:'intervention_category', codeCol:'category_code',     nameCol:'category_name',      idCol:'intervention_category_id' },
};

window._mebkImportKey = null;
window._mebkImportRows = [];

// — Menu toggle ———————————————————————————————
function mebkToggleMenu(type, key) {
  const id = `mebk-${type}-menu-${key}`;
  const el = document.getElementById(id);
  if (!el) return;
  const isOpen = el.classList.contains('open');
  mebkCloseMenus();
  if (!isOpen) el.classList.add('open');
}
function mebkCloseMenus() {
  document.querySelectorAll('.mebk-io-menu.open').forEach(m => m.classList.remove('open'));
}
document.addEventListener('click', e => {
  if (!e.target.closest('.mebk-io-wrap')) mebkCloseMenus();
});

// — Export ————————————————————————————————————
const MEBK_LIB_KEYS = ['oc','ac','im']; // library tabs that have nested indicators

async function mebkExport(key, format) {
  const cfg = MEBK_IO_CFG[key];
  const rows = cfg.dataFn();
  if (!rows.length) { toast('No data to export.', 2500); return; }
  const filename = `${cfg.label.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}`;
  const dateStr  = new Date().toLocaleDateString();

  // Fetch indicators for library tabs
  let indMap = {}; // parentId → indicators[]
  if (MEBK_LIB_KEYS.includes(key)) {
    const parentCol = key === 'oc' ? 'outcome_id' : key === 'ac' ? 'activity_id' : 'impact_id';
    const ids = rows.map(r => r[cfg.idCol]).filter(Boolean);
    if (ids.length) {
      try {
        const res = await fetch(
          `${MEBK_URL}/rest/v1/indicator?${parentCol}=in.(${ids.join(',')})&is_template=eq.true&is_active=eq.true&select=indicator_code,indicator_name,unit_of_measure,${parentCol}&order=indicator_code.asc&limit=500`,
          { headers: MEBK_HDR }
        );
        const inds = res.ok ? await res.json() : [];
        (inds||[]).forEach(i => {
          if (!indMap[i[parentCol]]) indMap[i[parentCol]] = [];
          indMap[i[parentCol]].push(i);
        });
      } catch(e) { /* non-blocking */ }
    }
  }

  const isLib = MEBK_LIB_KEYS.includes(key);
  const parentHeaders = cfg.cols.map(c => c.h);
  const indHeaders    = ['Indicator Code','Indicator Name','Unit'];

  if (format === 'csv') {
    const csvRows = [];
    // Header row
    csvRows.push([...parentHeaders, ...(isLib ? indHeaders : [])]);
    rows.forEach(r => {
      const parentRow = cfg.cols.map(c => c.k === 'is_active' ? (r[c.k] ? 'Yes' : 'No') : (r[c.k] ?? ''));
      if (isLib) {
        const inds = indMap[r[cfg.idCol]] || [];
        if (!inds.length) { csvRows.push([...parentRow, '', '', '']); }
        else inds.forEach((ind, i) => {
          csvRows.push(i === 0 ? [...parentRow, ind.indicator_code||'', ind.indicator_name||'', ind.unit_of_measure||'']
                                : ['','','','', ind.indicator_code||'', ind.indicator_name||'', ind.unit_of_measure||'']);
        });
      } else { csvRows.push(parentRow); }
    });
    const csv = csvRows.map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    mebkDownloadBlob(new Blob([csv], {type:'text/csv'}), `${filename}.csv`);

  } else if (format === 'xlsx') {
    const wb = XLSX.utils.book_new();
    // Sheet 1: parent data
    const parentData = rows.map(r => cfg.cols.map(c => c.k === 'is_active' ? (r[c.k] ? 'Yes' : 'No') : (r[c.k] ?? '')));
    const ws1 = XLSX.utils.aoa_to_sheet([parentHeaders, ...parentData]);
    XLSX.utils.book_append_sheet(wb, ws1, cfg.label.slice(0,31));
    // Sheet 2: indicators (library tabs only)
    if (isLib) {
      const indRows = [['Parent Code', ...indHeaders]];
      rows.forEach(r => {
        const parentCode = r[cfg.codeCol] || '';
        (indMap[r[cfg.idCol]] || []).forEach(ind => {
          indRows.push([parentCode, ind.indicator_code||'', ind.indicator_name||'', ind.unit_of_measure||'']);
        });
      });
      const ws2 = XLSX.utils.aoa_to_sheet(indRows);
      XLSX.utils.book_append_sheet(wb, ws2, 'Indicators');
    }
    XLSX.writeFile(wb, `${filename}.xlsx`);

  } else if (format === 'pdf') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text(`M&E Book — ${cfg.label}`, 14, 16);
    doc.setFontSize(9);  doc.setFont('helvetica','normal');
    doc.text(`Exported: ${dateStr}  ·  ${rows.length} ${cfg.label}`, 14, 23);

    if (!isLib) {
      const data = rows.map(r => cfg.cols.map(c => c.k === 'is_active' ? (r[c.k]?'Yes':'No') : String(r[c.k]??'')));
      doc.autoTable({ head:[parentHeaders], body:data, startY:28, styles:{fontSize:8,cellPadding:3}, headStyles:{fillColor:[37,99,235],textColor:255,fontStyle:'bold'}, alternateRowStyles:{fillColor:[248,250,252]} });
    } else {
      // Nested: outcome/activity/impact row then indented indicators
      const body = [];
      const didFill = []; // track alternate parent rows
      rows.forEach((r, ri) => {
        const parentRow = cfg.cols.map(c => c.k === 'is_active' ? (r[c.k]?'Yes':'No') : String(r[c.k]??''));
        body.push({ row: parentRow, type: 'parent', alt: ri % 2 === 0 });
        const inds = indMap[r[cfg.idCol]] || [];
        inds.forEach(ind => {
          body.push({ row: [r[cfg.codeCol]||'', `    ↳ ${ind.indicator_name||''}`, ind.unit_of_measure||'', ''], type:'ind', alt: ri % 2 === 0 });
        });
        if (!inds.length) {
          body.push({ row: [r[cfg.codeCol]||'', '    No indicators defined', '', ''], type:'empty', alt: ri % 2 === 0 });
        }
      });
      doc.autoTable({
        head: [parentHeaders],
        body: body.map(b => b.row),
        startY: 28,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor:[37,99,235], textColor:255, fontStyle:'bold' },
        didParseCell(data) {
          const b = body[data.row.index];
          if (!b) return;
          if (b.type === 'parent') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = b.alt ? [219,234,254] : [239,246,255];
            data.cell.styles.textColor = [30,64,175];
          } else if (b.type === 'ind') {
            data.cell.styles.fillColor = b.alt ? [249,250,251] : [255,255,255];
            data.cell.styles.textColor = [55,65,81];
            data.cell.styles.fontSize  = 7.5;
          } else {
            data.cell.styles.fillColor  = [255,255,255];
            data.cell.styles.textColor  = [156,163,175];
            data.cell.styles.fontStyle  = 'italic';
            data.cell.styles.fontSize   = 7.5;
          }
        }
      });
    }
    doc.save(`${filename}.pdf`);
  }
  const indCount = Object.values(indMap).reduce((s,a) => s+a.length, 0);
  toast(`✓ Exported ${rows.length} ${cfg.label}${isLib && indCount ? ` · ${indCount} indicators` : ''} as ${format.toUpperCase()}`);
}

function mebkDownloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// — Import: template download ————————————————
function mebkDownloadTemplate(key) {
  mebkCloseMenus();
  const cfg = MEBK_IO_CFG[key];
  const importCols = cfg.cols.filter(c => c.k !== 'is_active' || true); // include all
  const headers = importCols.map(c => c.h);
  const example = importCols.map(c => {
    if (c.k === 'is_active') return 'Yes';
    if (c.h === 'Code') return `${key.toUpperCase()}-001`;
    if (c.h.includes('Statement') || c.h.includes('Experience')) return `Example ${cfg.label.slice(0,-1)} statement`;
    if (c.h === 'Name') return `Example ${cfg.label.slice(0,-1)}`;
    if (c.h === 'Category') return 'Category Name';
    return 'Description here';
  });
  const csv = [headers, example].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  mebkDownloadBlob(new Blob([csv], {type:'text/csv'}), `${cfg.label.replace(/\s+/g,'_')}_template.csv`);
  toast('✓ Template downloaded');
}

// — Import: trigger file picker ——————————————
function mebkTriggerImport(key, fmt) {
  mebkCloseMenus();
  window._mebkImportKey = key;
  window._mebkImportFmt = fmt;
  const inp = document.getElementById('mebk-file-input');
  if (!inp) return;
  inp.accept = fmt === 'csv' ? '.csv' : '.xlsx,.xls';
  inp.value = '';
  inp.click();
}

async function mebkHandleFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  const key = window._mebkImportKey;
  const cfg = MEBK_IO_CFG[key];
  if (!cfg) return;
  try {
    let rows = [];
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g,'').trim());
      rows = lines.slice(1).map(line => {
        const vals = line.match(/(".*?"|[^,]+)(?=,|$)/g) || line.split(',');
        const obj = {};
        headers.forEach((h,i) => { obj[h] = (vals[i]||'').replace(/^"|"$/g,'').trim(); });
        return obj;
      });
    } else {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf);
      const ws  = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, {defval:''});
    }
    // Map headers to columns
    const colMap = {};
    cfg.cols.forEach(c => { colMap[c.h] = c.k; });
    const existing = cfg.dataFn();
    const existingCodes = new Set(existing.map(e => String(e[cfg.codeCol]||'').toLowerCase()));
    const parsed = rows.filter(r => Object.values(r).some(v => v !== '')).map(r => {
      const mapped = {};
      Object.entries(r).forEach(([h,v]) => { if (colMap[h]) mapped[colMap[h]] = v; });
      const code = String(mapped[cfg.codeCol]||'').toLowerCase();
      const action = !code ? 'error' : existingCodes.has(code) ? 'update' : 'new';
      return { ...mapped, _action: action, _error: !mapped[cfg.nameCol] ? 'Name required' : action === 'error' ? 'Code required' : '' };
    });
    window._mebkImportRows = parsed;
    mebkShowImportPreview(key, parsed);
  } catch(e) { alert('Could not parse file: ' + e.message); }
}

function mebkShowImportPreview(key, rows) {
  const cfg = MEBK_IO_CFG[key];
  const nNew    = rows.filter(r => r._action === 'new').length;
  const nUpdate = rows.filter(r => r._action === 'update').length;
  const nError  = rows.filter(r => r._action === 'error').length;
  document.getElementById('mebk-import-modal-title').textContent = `Import Preview — ${cfg.label}`;
  document.getElementById('mebk-import-summary').textContent =
    `${rows.length} rows · ${nNew} new · ${nUpdate} update · ${nError} error`;
  document.getElementById('mebk-import-confirm-btn').disabled = (nNew + nUpdate) === 0;
  const cols = cfg.cols;
  const body = document.getElementById('mebk-import-modal-body');
  body.innerHTML = `
    <table class="mebk-import-table">
      <thead><tr><th>Action</th>${cols.map(c=>`<th>${c.h}</th>`).join('')}<th>Note</th></tr></thead>
      <tbody>${rows.map(r => {
        const action = ['new','update','error'].includes(r._action) ? r._action : 'error';
        return `
        <tr class="${action}">
          <td><span class="mebk-import-badge ${action}">${action.toUpperCase()}</span></td>
          ${cols.map(c=>`<td>${esc(r[c.k] ?? '')}</td>`).join('')}
          <td style="color:var(--warn);font-size:11px;">${esc(r._error || '')}</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>`;
  document.getElementById('mebk-import-modal').classList.add('open');
}

function mebkCloseImportModal() {
  document.getElementById('mebk-import-modal').classList.remove('open');
  window._mebkImportRows = [];
}

async function mebkConfirmImport() {
  const key = window._mebkImportKey;
  const cfg = MEBK_IO_CFG[key];
  const rows = window._mebkImportRows.filter(r => r._action !== 'error' && !r._error);
  if (!rows.length) return;
  const btn = document.getElementById('mebk-import-confirm-btn');
  btn.disabled = true; btn.textContent = 'Importing…';
  let ok = 0, fail = 0;
  for (const row of rows) {
    try {
      const payload = {};
      cfg.cols.forEach(c => {
        if (c.k === '_catName') return;
        if (c.k === '_action' || c.k === '_error') return;
        if (row[c.k] !== undefined && row[c.k] !== '') {
          if (c.k === 'is_active') payload[c.k] = String(row[c.k]).toLowerCase() !== 'no';
          else payload[c.k] = row[c.k];
        }
      });
      let res;
      if (row._action === 'update') {
        const existing = cfg.dataFn().find(e => String(e[cfg.codeCol]).toLowerCase() === String(payload[cfg.codeCol]).toLowerCase());
        if (existing) {
          res = await fetch(`${MEBK_URL}/rest/v1/${cfg.table}?${cfg.idCol}=eq.${existing[cfg.idCol]}`, {
            method:'PATCH', headers:MEBK_HDR, body:JSON.stringify(payload)
          });
        }
      } else {
        payload.is_template = true;
        res = await fetch(`${MEBK_URL}/rest/v1/${cfg.table}`, {
          method:'POST', headers:{...MEBK_HDR,'Prefer':'return=minimal'}, body:JSON.stringify(payload)
        });
      }
      res?.ok ? ok++ : fail++;
    } catch(e) { fail++; }
  }
  btn.disabled = false; btn.textContent = 'Confirm Import';
  mebkCloseImportModal();
  toast(`✓ Import done — ${ok} saved${fail ? `, ${fail} failed` : ''}`);
  // Reload the tab data
  if (['env','ce','stk','ocat','acat'].includes(key)) {
    window[`mebkRefLoaded_${key}`] = false; await mebkRefLoad(key); window[`mebkRefLoaded_${key}`] = true;
  } else if (key === 'oc') await mebkLoadOutcomes();
  else if (key === 'ac') await mebkLoadActivities();
  else if (key === 'im') await mebkLoadImpacts();
  await mebkLoadStats();
}

// ══ Reference Data — generic CRUD ══════════════════
const MEBK_REF_CFG = {
  env:  { table:'environment',         idCol:'environment_id',         codeCol:'environment_code',      nameCol:'environment_name', descCol:'description', hasActive:true,  color:'#f59e0b' },
  ce:   { table:'child_experience',    idCol:'child_experience_id',    codeCol:'child_experience_code', nameCol:'experience_name',  descCol:'description', hasActive:true,  color:'#ec4899' },
  stk:  { table:'stakeholder_type',    idCol:'stakeholder_type_id',    codeCol:'stakeholder_type_code', nameCol:'type_name',        descCol:'description', hasActive:false, color:'#0d9488', geoCol:'allowed_geography_level' },
  ocat: { table:'outcome_categories',  idCol:'outcome_category_id',    codeCol:'category_code',         nameCol:'category_name',    descCol:'description', hasActive:true,  color:'var(--ok)' },
  acat: { table:'activity_category',   idCol:'activity_category_id',   codeCol:'category_code',         nameCol:'category_name',    descCol:'description', hasActive:true,  color:'var(--blue)' },
  inttype: { table:'intervention_type',    idCol:'intervention_type_id',   codeCol:'type_code',             nameCol:'type_name',        descCol:'description', hasActive:true,  color:'#ec4899' },
  intcat: { table:'intervention_category', idCol:'intervention_category_id', codeCol:'category_code',       nameCol:'category_name',    descCol:'description', hasActive:true,  color:'#14b8a6' },
};

window.mebkRefItems = {}; // key → array
window.mebkRefFilter = {}; // key → 'active'|'all'|'inactive'

async function mebkRefLoad(key) {
  const cfg = MEBK_REF_CFG[key];
  const list = document.getElementById(`mebk-ref-list-${key}`);
  if (!list) return;
  list.innerHTML = '<div class="mebk-loading">Loading…</div>';
  try {
    const r = await fetch(`${MEBK_URL}/rest/v1/${cfg.table}?select=*&order=${cfg.codeCol}.asc`, { headers: MEBK_HDR });
    const items = r.ok ? await r.json() : [];
    if (!Array.isArray(items)) throw new Error('bad response');
    window.mebkRefItems[key] = items;
    mebkRefRender(key);
  } catch(e) { list.innerHTML = '<div class="mebk-empty">Error loading data.</div>'; }
}

function mebkRefRender(key) {
  const cfg = MEBK_REF_CFG[key];
  const list = document.getElementById(`mebk-ref-list-${key}`);
  if (!list) return;
  const search = (document.getElementById(`mebk-search-ref-${key}`)?.value || '').toLowerCase();
  const filter = window.mebkRefFilter[key] || 'active';
  let items = (window.mebkRefItems[key] || []).filter(i => {
    const name = (i[cfg.nameCol] || '').toLowerCase();
    const code = (i[cfg.codeCol] || '').toLowerCase();
    if (search && !name.includes(search) && !code.includes(search)) return false;
    if (cfg.hasActive) {
      if (filter === 'active'   && !i.is_active) return false;
      if (filter === 'inactive' &&  i.is_active) return false;
    }
    return true;
  });
  if (!items.length) { list.innerHTML = '<div class="mebk-empty">No items found.</div>'; return; }
  list.innerHTML = items.map(i => {
    const id = i[cfg.idCol];
    const badge = `<span style="font-size:10px;font-weight:700;font-family:var(--mono);background:var(--mist-2);padding:2px 7px;border-radius:4px;color:var(--slate);white-space:nowrap;">${esc(i[cfg.codeCol]||'—')}</span>`;
    const activeDot = cfg.hasActive ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${i.is_active?'var(--ok)':'var(--mist-3)'};margin-right:4px;"></span>` : '';
    const geoLevel = cfg.geoCol && i[cfg.geoCol] ? `<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;background:#ccfbf1;color:#0d9488;white-space:nowrap;">${esc(i[cfg.geoCol])}</span>` : '';
    return `<div class="mebk-ref-row" style="grid-template-columns:${cfg.geoCol?'100px 1fr 100px 1fr 96px':'100px 1fr 1fr 96px'};" id="mebk-ref-row-${key}-${id}">
      ${badge}
      <span style="display:flex;align-items:center;gap:6px;">${activeDot}<strong style="font-size:13px;">${esc(i[cfg.nameCol]||'—')}</strong></span>
      ${cfg.geoCol ? geoLevel : ''}
      <span style="color:var(--slate);font-size:12px;">${esc(i[cfg.descCol]||'')}</span>
      <span style="display:flex;gap:4px;justify-content:flex-end;">
        ${cfg.hasActive ? `<button class="mebk-action-btn edit" title="${i.is_active?'Deactivate':'Activate'}" onclick="mebkRefToggleActive('${key}','${id}',${!i.is_active})" style="font-size:10px;padding:2px 6px;">${i.is_active?'Off':'On'}</button>` : ''}
        <button class="mebk-action-btn edit" title="Edit" onclick="mebkRefEdit('${key}','${id}')">${IC.edit}</button>
        <button class="mebk-action-btn del"  title="Delete" onclick="mebkRefDelete('${key}','${id}')">${IC.trash}</button>
      </span>
    </div>`;
  }).join('');
}

function mebkRefSearch(key, val) { mebkRefRender(key); }

function mebkRefSetFilter(key, f) {
  window.mebkRefFilter[key] = f;
  ['active','all','inactive'].forEach(v => {
    document.getElementById(`mebk-fpill-ref-${key}-${v}`)?.classList.toggle('sel', v === f);
  });
  mebkRefRender(key);
}

function mebkRefShowForm(key) {
  const f = document.getElementById(`mebk-ref-form-${key}`);
  if (f) { f.style.display = 'flex'; document.getElementById(`mebk-ref-inp-name-${key}`)?.focus(); }
}
function mebkRefHideForm(key) {
  const f = document.getElementById(`mebk-ref-form-${key}`);
  if (f) { f.style.display = 'none'; ['name','geo','desc'].forEach(x => { const el = document.getElementById(`mebk-ref-inp-${x}-${key}`); if(el) el.value=''; }); }
}

async function mebkRefSave(key) {
  const cfg = MEBK_REF_CFG[key];
  const name = document.getElementById(`mebk-ref-inp-name-${key}`)?.value.trim();
  const desc = document.getElementById(`mebk-ref-inp-desc-${key}`)?.value.trim();
  if (!name) { alert('Name is required.'); return; }
  const geo  = document.getElementById(`mebk-ref-inp-geo-${key}`)?.value || null;
  // Auto-generate code from name (first 8 chars, uppercase, alphanumeric + underscore)
  const autoCode = name.substring(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const payload = { [cfg.nameCol]: name, [cfg.codeCol]: autoCode };
  if (cfg.descCol && desc) payload[cfg.descCol] = desc;
  if (cfg.hasActive) payload.is_active = true;
  if (cfg.geoCol && geo) payload[cfg.geoCol] = geo;
  try {
    const r = await fetch(`${MEBK_URL}/rest/v1/${cfg.table}`, {
      method:'POST', headers:{...MEBK_HDR,'Prefer':'return=representation'}, body:JSON.stringify(payload)
    });
    if (!r.ok) throw new Error(await r.text());
    mebkRefHideForm(key);
    window[`mebkRefLoaded_${key}`] = false;
    await mebkRefLoad(key);
    window[`mebkRefLoaded_${key}`] = true;
    toast(`✓ ${name} added`);
  } catch(e) { alert('Error saving: ' + e.message); }
}

function mebkRefEdit(key, id) {
  const cfg = MEBK_REF_CFG[key];
  const item = (window.mebkRefItems[key]||[]).find(i => i[cfg.idCol] === id);
  if (!item) return;
  const row = document.getElementById(`mebk-ref-row-${key}-${id}`);
  if (!row) return;
  const geoOpts = cfg.geoCol ? ['state','district','block','cluster','school']
    .map(g => `<option value="${g}" ${item[cfg.geoCol]===g?'selected':''}>${g.charAt(0).toUpperCase()+g.slice(1)}</option>`).join('') : '';
  row.style.gridTemplateColumns = cfg.geoCol ? '100px 1fr 110px 1fr 96px' : '100px 1fr 1fr 96px';
  row.innerHTML = `
    <span style="font-size:10px;color:var(--slate);font-family:var(--mono);">${item[cfg.codeCol]||'—'}</span>
    <input id="mebk-ref-edit-name-${key}-${id}" value="${(item[cfg.nameCol]||'').replace(/"/g,'&quot;')}" placeholder="Name…" style="padding:5px 8px;border:1px solid var(--mist-2);border-radius:var(--r);font-size:12px;width:100%;"/>
    ${cfg.geoCol ? `<select id="mebk-ref-edit-geo-${key}-${id}" style="padding:5px 8px;border:1px solid var(--mist-2);border-radius:var(--r);font-size:12px;"><option value="">Geography…</option>${geoOpts}</select>` : ''}
    <input id="mebk-ref-edit-desc-${key}-${id}" value="${(item[cfg.descCol]||'').replace(/"/g,'&quot;')}" placeholder="Description…" style="padding:5px 8px;border:1px solid var(--mist-2);border-radius:var(--r);font-size:12px;width:100%;"/>
    <span style="display:flex;gap:4px;justify-content:flex-end;">
      <button class="mebk-action-btn edit" onclick="mebkRefSaveEdit('${key}','${id}')">${IC.check||'✓'}</button>
      <button class="mebk-action-btn" onclick="mebkRefRender('${key}')">${IC.x||'✕'}</button>
    </span>`;
  document.getElementById(`mebk-ref-edit-name-${key}-${id}`)?.focus();
}

async function mebkRefSaveEdit(key, id) {
  const cfg = MEBK_REF_CFG[key];
  const name = document.getElementById(`mebk-ref-edit-name-${key}-${id}`)?.value.trim();
  const desc = document.getElementById(`mebk-ref-edit-desc-${key}-${id}`)?.value.trim();
  if (!name) { alert('Name cannot be empty.'); return; }
  try {
    const geo  = document.getElementById(`mebk-ref-edit-geo-${key}-${id}`)?.value || null;
    // Keep existing code, don't regenerate on edit
    const existingItem = (window.mebkRefItems[key] || []).find(i => i[cfg.idCol] === id);
    const code = existingItem ? existingItem[cfg.codeCol] : '';
  const r = await fetch(`${MEBK_URL}/rest/v1/${cfg.table}?${cfg.idCol}=eq.${id}`, {
      method:'PATCH', headers:{...MEBK_HDR,'Prefer':'return=representation'},
      body: JSON.stringify({ [cfg.nameCol]: name, ...(code ? {[cfg.codeCol]: code} : {}), ...(cfg.descCol ? {[cfg.descCol]: desc||null} : {}), ...(cfg.geoCol && geo ? {[cfg.geoCol]: geo} : {}) })
    });
    if (!r.ok) throw new Error(await r.text());
    const updated = await r.json();
    const items = window.mebkRefItems[key] || [];
    const idx = items.findIndex(i => i[cfg.idCol] === id);
    if (idx >= 0 && updated[0]) items[idx] = updated[0];
    mebkRefRender(key);
    toast('✓ Updated');
  } catch(e) { alert('Error updating: ' + e.message); }
}

async function mebkRefToggleActive(key, id, active) {
  const cfg = MEBK_REF_CFG[key];
  try {
    await fetch(`${MEBK_URL}/rest/v1/${cfg.table}?${cfg.idCol}=eq.${id}`, {
      method:'PATCH', headers:MEBK_HDR, body:JSON.stringify({is_active:active})
    });
    const items = window.mebkRefItems[key] || [];
    const item = items.find(i => i[cfg.idCol] === id);
    if (item) item.is_active = active;
    mebkRefRender(key);
  } catch(e) { alert('Error updating status.'); }
}

async function mebkRefDelete(key, id) {
  const cfg = MEBK_REF_CFG[key];
  const item = (window.mebkRefItems[key]||[]).find(i => i[cfg.idCol] === id);
  if (!confirm(`Delete "${item?.[cfg.nameCol]}"? This cannot be undone.`)) return;
  try {
    const r = await fetch(`${MEBK_URL}/rest/v1/${cfg.table}?${cfg.idCol}=eq.${id}`, {
      method:'DELETE', headers:MEBK_HDR
    });
    if (!r.ok) throw new Error(await r.text());
    window.mebkRefItems[key] = (window.mebkRefItems[key]||[]).filter(i => i[cfg.idCol] !== id);
    mebkRefRender(key);
    toast('✓ Deleted');
  } catch(e) { alert('Cannot delete — item may be in use.'); }
}

// ── Show add forms ──────────────────────────────────
function mebkShowOcForm() {
  const f = document.getElementById('mebk-add-oc-form');
  if (f) { f.style.display = 'flex'; document.getElementById('mebk-oc-stmt')?.focus(); }
}
function mebkShowAcForm() {
  const f = document.getElementById('mebk-add-ac-form');
  if (f) { f.style.display = 'flex'; document.getElementById('mebk-ac-name')?.focus(); }
}

// ── Stats ───────────────────────────────────────────
async function mebkLoadStats() {
  try {
    const countHdr = { ...MEBK_HDR, 'Prefer': 'count=exact' };
    const [ocRes, acRes, imRes, indRes, envRes, ceRes, stkRes, ocatRes, acatRes, inttypeRes, intcatRes] = await Promise.all([
      fetch(`${MEBK_URL}/rest/v1/outcome?is_template=eq.true&is_active=eq.true&select=outcome_id&limit=1`,            { headers: countHdr }),
      fetch(`${MEBK_URL}/rest/v1/activity?is_template=eq.true&is_active=eq.true&select=activity_id&limit=1`,          { headers: countHdr }),
      fetch(`${MEBK_URL}/rest/v1/impact?is_template=eq.true&is_active=eq.true&select=impact_id&limit=1`,              { headers: countHdr }),
      fetch(`${MEBK_URL}/rest/v1/indicator?is_template=eq.true&is_active=eq.true&select=indicator_id&limit=1`,        { headers: countHdr }),
      fetch(`${MEBK_URL}/rest/v1/environment?is_active=eq.true&select=environment_id&limit=1`,                        { headers: countHdr }),
      fetch(`${MEBK_URL}/rest/v1/child_experience?is_active=eq.true&select=child_experience_id&limit=1`,              { headers: countHdr }),
      fetch(`${MEBK_URL}/rest/v1/stakeholder_type?select=stakeholder_type_id&limit=1`,                                { headers: countHdr }),
      fetch(`${MEBK_URL}/rest/v1/outcome_categories?is_active=eq.true&select=outcome_category_id&limit=1`,            { headers: countHdr }),
      fetch(`${MEBK_URL}/rest/v1/activity_category?is_active=eq.true&select=activity_category_id&limit=1`,            { headers: countHdr }),
      fetch(`${MEBK_URL}/rest/v1/intervention_type?is_active=eq.true&select=intervention_type_id&limit=1`,            { headers: countHdr }),
      fetch(`${MEBK_URL}/rest/v1/intervention_category?is_active=eq.true&select=intervention_category_id&limit=1`,    { headers: countHdr }),
    ]);
    const n = r => r.headers.get('Content-Range')?.split('/')[1] ?? '?';
    const s = id => document.getElementById(id);
    if (s('mebk-stat-oc'))      s('mebk-stat-oc').textContent      = n(ocRes);
    if (s('mebk-stat-ac'))      s('mebk-stat-ac').textContent      = n(acRes);
    if (s('mebk-stat-im'))      s('mebk-stat-im').textContent      = n(imRes);
    if (s('mebk-stat-ind'))     s('mebk-stat-ind').textContent     = n(indRes);
    if (s('mebk-stat-env'))     s('mebk-stat-env').textContent     = n(envRes);
    if (s('mebk-stat-ce'))      s('mebk-stat-ce').textContent      = n(ceRes);
    if (s('mebk-stat-stk'))     s('mebk-stat-stk').textContent     = n(stkRes);
    if (s('mebk-stat-ocat'))    s('mebk-stat-ocat').textContent    = n(ocatRes);
    if (s('mebk-stat-acat'))    s('mebk-stat-acat').textContent    = n(acatRes);
    if (s('mebk-stat-inttype')) s('mebk-stat-inttype').textContent = n(inttypeRes);
    if (s('mebk-stat-intcat'))  s('mebk-stat-intcat').textContent  = n(intcatRes);
  } catch(e) { /* decorative */ }
}

// ── Shared: build a CSS toggle switch ───────────────
function mebkSwitch(isOn, onClickExpr, titleOn, titleOff) {
  const title = isOn ? titleOn : titleOff;
  return `<span class="mebk-sw" title="${title}" onclick="event.stopPropagation();${onClickExpr}">
    <span class="mebk-sw-track${isOn ? ' on' : ''}"><span class="mebk-sw-thumb"></span></span>
  </span>`;
}

// ── Load & render: Outcomes ─────────────────────────
async function mebkLoadOutcomes() {
  const el = document.getElementById('mebk-outcomes-list');
  if (el) el.innerHTML = '<div class="mebk-loading">Loading…</div>';
  const filterVal = (window.mebkFilter = window.mebkFilter || {}).oc || 'active';
  const activeFilter = filterVal === 'active' ? '&is_active=eq.true'
                     : filterVal === 'inactive' ? '&is_active=eq.false' : '';
  const catId = (window.mebkCatFilter = window.mebkCatFilter || {}).oc || '';
  const catFilter = catId ? `&outcome_category_id=eq.${catId}` : '';
  try {
    const res  = await fetch(
      `${MEBK_URL}/rest/v1/outcome?is_template=eq.true${activeFilter}${catFilter}&select=outcome_id,outcome_code,outcome_statement,is_active,outcome_categories(category_name)&order=is_active.desc,outcome_code.asc&limit=300`,
      { headers: MEBK_HDR }
    );
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error(JSON.stringify(data));
    window.mebkLibData = window.mebkLibData || {};
    window.mebkLibData.oc = data.map(d => ({ ...d, _catName: d.outcome_categories?.category_name || '' }));
    const el2 = document.getElementById('mebk-outcomes-list');
    if (!el2) return;
    const emptyMsg = filterVal === 'inactive'
      ? 'No inactive outcomes — all outcomes are currently active'
      : 'No outcomes yet — click "+ Add Outcome" to start building your M&amp;E Book';
    if (!data.length) {
      el2.innerHTML = `<div class="mebk-empty"><div class="mebk-empty-icon">${IC.clipboard}</div>${emptyMsg}</div>`;
      return;
    }
    el2.innerHTML = data.map(o => {
      const isActive = o.is_active !== false;
      const sw = mebkSwitch(isActive,
        `mebkSetActiveOc('${o.outcome_id}',${!isActive})`,
        'Active — click to deactivate', 'Inactive — click to reactivate');
      return `
      <div class="mebk-oc-card${isActive ? '' : ' inactive'}" id="mebk-oc-${o.outcome_id}">
        <div class="mebk-oc-hd" onclick="mebkToggleOc('${o.outcome_id}')">
          <span class="mebk-oc-code">${o.outcome_code || '—'}</span>
          <span class="mebk-stmt" id="mebk-oc-stmt-${o.outcome_id}">${o.outcome_statement || '—'}</span>
          ${o.outcome_categories?.category_name ? `<span class="mebk-cat">${o.outcome_categories.category_name}</span>` : ''}
          ${isActive ? '' : '<span class="mebk-badge-inactive">Inactive</span>'}
          <span class="mebk-card-actions" onclick="event.stopPropagation()">
            ${isActive ? `<button class="mebk-action-btn edit" title="Edit" onclick="mebkEditOc('${o.outcome_id}','${(o.outcome_statement||'').replace(/'/g,"\\'")}')\">${IC.edit}</button>` : ''}
            ${sw}
          </span>
          <span class="mebk-chev">${IC['chevron-down']}</span>
        </div>
        <div class="mebk-oc-edit" id="mebk-oc-edit-${o.outcome_id}" style="display:none;padding:10px 14px;gap:8px;flex-wrap:wrap;align-items:center;background:var(--ok-bg);border-top:1px solid var(--ok-border);">
          <input class="mebk-inp mebk-inp-lg" id="mebk-oc-edit-inp-${o.outcome_id}" value="${(o.outcome_statement||'').replace(/"/g,'&quot;')}" placeholder="Outcome statement…"/>
          <button class="btn btn-ok" style="font-size:12px;padding:6px 14px;" onclick="mebkSaveEditOc('${o.outcome_id}')">Save</button>
          <button class="btn" style="font-size:12px;padding:6px 12px;" onclick="document.getElementById('mebk-oc-edit-${o.outcome_id}').style.display='none'">Cancel</button>
        </div>
        <div class="mebk-oc-body" id="mebk-oc-body-${o.outcome_id}"><div class="mebk-loading">Loading…</div></div>
      </div>`;
    }).join('');
  } catch(e) {
    const el2 = document.getElementById('mebk-outcomes-list');
    if (el2) el2.innerHTML = `<div class="mebk-err">${IC.warning} ${e.message}</div>`;
  }
}

// ── Load & render: Activities ───────────────────────
async function mebkLoadActivities() {
  const el = document.getElementById('mebk-activities-list');
  if (el) el.innerHTML = '<div class="mebk-loading">Loading…</div>';
  const filterVal = (window.mebkFilter = window.mebkFilter || {}).ac || 'active';
  const activeFilter = filterVal === 'active' ? '&is_active=eq.true'
                     : filterVal === 'inactive' ? '&is_active=eq.false' : '';
  const catId = (window.mebkCatFilter = window.mebkCatFilter || {}).ac || '';
  const catFilter = catId ? `&activity_category_id=eq.${catId}` : '';
  try {
    const res  = await fetch(
      `${MEBK_URL}/rest/v1/activity?is_template=eq.true${activeFilter}${catFilter}&select=activity_id,activity_code,activity_name,is_active,activity_category(category_name)&order=is_active.desc,activity_code.asc&limit=300`,
      { headers: MEBK_HDR }
    );
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error(JSON.stringify(data));
    window.mebkLibData = window.mebkLibData || {};
    window.mebkLibData.ac = data.map(d => ({ ...d, _catName: d.activity_category?.category_name || '' }));
    const el2 = document.getElementById('mebk-activities-list');
    if (!el2) return;
    const emptyMsg = filterVal === 'inactive'
      ? 'No inactive activities — all activities are currently active'
      : 'No activities yet — click "+ Add Activity" to start building your library';
    if (!data.length) {
      el2.innerHTML = `<div class="mebk-empty"><div class="mebk-empty-icon">${IC.zap}</div>${emptyMsg}</div>`;
      return;
    }
    el2.innerHTML = data.map(a => {
      const isActive = a.is_active !== false;
      const sw = mebkSwitch(isActive,
        `mebkSetActiveAc('${a.activity_id}',${!isActive})`,
        'Active — click to deactivate', 'Inactive — click to reactivate');
      return `
      <div class="mebk-ac-card${isActive ? '' : ' inactive'}" id="mebk-ac-${a.activity_id}">
        <div class="mebk-ac-hd" onclick="mebkToggleAc('${a.activity_id}')">
          <span class="mebk-ac-code">${a.activity_code || '—'}</span>
          <span class="mebk-stmt" id="mebk-ac-stmt-${a.activity_id}">${a.activity_name || '—'}</span>
          ${a.activity_category?.category_name ? `<span class="mebk-cat">${a.activity_category.category_name}</span>` : ''}
          ${isActive ? '' : '<span class="mebk-badge-inactive">Inactive</span>'}
          <span class="mebk-card-actions" onclick="event.stopPropagation()">
            ${isActive ? `<button class="mebk-action-btn edit" title="Edit" onclick="mebkEditAc('${a.activity_id}','${(a.activity_name||'').replace(/'/g,"\\'")}')\">${IC.edit}</button>` : ''}
            ${sw}
          </span>
          <span class="mebk-chev">${IC['chevron-down']}</span>
        </div>
        <div class="mebk-ac-edit" id="mebk-ac-edit-${a.activity_id}" style="display:none;padding:10px 14px;gap:8px;flex-wrap:wrap;align-items:center;background:#eff6ff;border-top:1px solid #bfdbfe;">
          <input class="mebk-inp mebk-inp-lg" id="mebk-ac-edit-inp-${a.activity_id}" value="${(a.activity_name||'').replace(/"/g,'&quot;')}" placeholder="Activity name…"/>
          <button class="btn" style="font-size:12px;padding:6px 14px;background:var(--blue);color:#fff;border-color:var(--blue);" onclick="mebkSaveEditAc('${a.activity_id}')">Save</button>
          <button class="btn" style="font-size:12px;padding:6px 12px;" onclick="document.getElementById('mebk-ac-edit-${a.activity_id}').style.display='none'">Cancel</button>
        </div>
        <div class="mebk-ac-body" id="mebk-ac-body-${a.activity_id}"><div class="mebk-loading">Loading…</div></div>
      </div>`;
    }).join('');
  } catch(e) {
    const el2 = document.getElementById('mebk-activities-list');
    if (el2) el2.innerHTML = `<div class="mebk-err">${IC.warning} ${e.message}</div>`;
  }
}

// ── Toggle open/close ───────────────────────────────
async function mebkToggleOc(ocId) {
  const card = document.getElementById(`mebk-oc-${ocId}`);
  if (!card) return;
  if (card.classList.contains('open')) { card.classList.remove('open'); return; }
  card.classList.add('open');
  await mebkLoadOcContent(ocId);
}
async function mebkToggleAc(acId) {
  const card = document.getElementById(`mebk-ac-${acId}`);
  if (!card) return;
  if (card.classList.contains('open')) { card.classList.remove('open'); return; }
  card.classList.add('open');
  await mebkLoadAcContent(acId);
}

// ── Load outcome body (indicators only — no linking here) ──
async function mebkLoadOcContent(ocId) {
  const body = document.getElementById(`mebk-oc-body-${ocId}`);
  if (!body) return;
  try {
    const res = await fetch(
      `${MEBK_URL}/rest/v1/indicator?outcome_id=eq.${ocId}&is_template=eq.true&is_active=eq.true&select=indicator_id,indicator_code,indicator_name,unit_of_measure&order=indicator_code.asc`,
      { headers: MEBK_HDR }
    );
    let indicators = res.ok ? await res.json() : [];
    if (!Array.isArray(indicators)) indicators = [];
    body.innerHTML = `
      <div class="mebk-section">
        <div class="mebk-section-lbl">${IC.chart} Outcome Indicators</div>
        ${mebkBuildIndGrid(indicators, 'oc', ocId)}
        ${mebkBuildIndForm('oc', ocId)}
        <button class="mebk-add-btn ind" onclick="mebkShowIndForm('oc','${ocId}')">+ Add Indicator</button>
      </div>`;
  } catch(e) { body.innerHTML = `<div class="mebk-err">${IC.warning} ${e.message}</div>`; }
}

// ── Load activity body (indicators only) ───────────
async function mebkLoadAcContent(acId) {
  const body = document.getElementById(`mebk-ac-body-${acId}`);
  if (!body) return;
  try {
    const res = await fetch(
      `${MEBK_URL}/rest/v1/indicator?activity_id=eq.${acId}&is_template=eq.true&is_active=eq.true&select=indicator_id,indicator_code,indicator_name,unit_of_measure&order=indicator_code.asc`,
      { headers: MEBK_HDR }
    );
    let indicators = res.ok ? await res.json() : [];
    if (!Array.isArray(indicators)) indicators = [];
    body.innerHTML = `
      <div class="mebk-section">
        <div class="mebk-section-lbl">${IC.chart} Activity Indicators</div>
        ${mebkBuildIndGrid(indicators, 'ac', acId)}
        ${mebkBuildIndForm('ac', acId)}
        <button class="mebk-add-btn ind" onclick="mebkShowIndForm('ac','${acId}')">+ Add Indicator</button>
      </div>`;
  } catch(e) { body.innerHTML = `<div class="mebk-err">${IC.warning} ${e.message}</div>`; }
}

// ── Indicator grid & form builders ─────────────────
function mebkEditIndFromEncoded(indId, pfx, parentId, encoded) {
  let indObj = {};
  try { indObj = JSON.parse(decodeURIComponent(encoded || '')); } catch { indObj = {}; }
  mebkEditInd(indId, pfx, parentId, indObj);
}

function mebkBuildIndGrid(indicators, pfx, parentId) {
  if (!Array.isArray(indicators) || !indicators.length)
    return '<div class="mebk-no-data">No indicators yet — click "+ Add Indicator" below</div>';
  return `
    <div class="mebk-ind-grid">
      <div class="mebk-ind-hdr" style="grid-template-columns:100px 1fr 90px 56px;"><span>Code</span><span>Indicator Name</span><span>Unit</span><span></span></div>
      ${indicators.map(i => {
        const encodedInd = esc(encodeURIComponent(JSON.stringify(i || {})));
        return `
        <div class="mebk-ind-row" style="grid-template-columns:100px 1fr 90px 56px;" id="mebk-ind-row-${esc(i.indicator_id)}">
          <span class="mebk-ind-code">${esc(i.indicator_code || '—')}</span>
          <span>${esc(i.indicator_name || '—')}</span>
          <span style="color:var(--slate)">${esc(i.unit_of_measure || '—')}</span>
          <span style="display:flex;gap:4px;align-items:center;">
            <button class="mebk-action-btn edit" title="Edit"
              data-ind-id="${esc(i.indicator_id)}"
              data-pfx="${esc(pfx)}"
              data-parent-id="${esc(parentId)}"
              data-ind="${encodedInd}"
              onclick="mebkEditIndFromEncoded(this.dataset.indId,this.dataset.pfx,this.dataset.parentId,this.dataset.ind)">${IC.edit}</button>
            <button class="mebk-action-btn del"  title="Delete"
              data-ind-id="${esc(i.indicator_id)}"
              data-pfx="${esc(pfx)}"
              data-parent-id="${esc(parentId)}"
              onclick="mebkDeleteInd(this.dataset.indId,this.dataset.pfx,this.dataset.parentId)">${IC.trash}</button>
          </span>
        </div>`;
      }).join('')}
    </div>`;
}
function mebkBuildIndForm(pfx, parentId) {
  return `
    <div class="mebk-add-form ind-form" id="mebk-ind-form-${pfx}-${parentId}" style="display:none;">
      <input class="mebk-inp mebk-inp-lg" id="mebk-ind-name-${pfx}-${parentId}" placeholder="Indicator name…"/>
      <select class="mebk-sel" id="mebk-ind-unit-${pfx}-${parentId}" style="min-width:130px;">
        <option value="">Unit…</option>
        <option value="percentage">Percentage (%)</option>
        <option value="count">Count (No.)</option>
        <option value="ratio">Ratio</option>
        <option value="yes_no">Yes / No</option>
      </select>
      <button class="btn btn-ok" style="font-size:12px;padding:6px 12px;" onclick="mebkSaveIndicator('${pfx}','${parentId}')">Save</button>
      <button class="btn" style="font-size:12px;padding:6px 12px;" onclick="document.getElementById('mebk-ind-form-${pfx}-${parentId}').style.display='none'">Cancel</button>
    </div>`;
}
function mebkShowIndForm(pfx, parentId) {
  const f = document.getElementById(`mebk-ind-form-${pfx}-${parentId}`);
  if (f) { f.style.display = 'flex'; document.getElementById(`mebk-ind-name-${pfx}-${parentId}`)?.focus(); }
}

// ── Save: Outcome ───────────────────────────────────
async function mebkSaveOutcome() {
  const stmt  = document.getElementById('mebk-oc-stmt')?.value.trim();
  const catId = document.getElementById('mebk-oc-cat-sel')?.value;
  if (!stmt)  { alert('Please enter an outcome statement.'); return; }
  if (!catId) { alert('Please select a category.'); return; }
  const btn = document.getElementById('mebk-oc-save-btn');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/outcome`, {
      method: 'POST',
      headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body: JSON.stringify({ outcome_statement: stmt, outcome_category_id: catId, is_template: true, is_active: true })
    });
    if (!res.ok) throw new Error(await res.text());
    document.getElementById('mebk-oc-stmt').value = '';
    document.getElementById('mebk-oc-cat-sel').value = '';
    document.getElementById('mebk-add-oc-form').style.display = 'none';
    await Promise.all([mebkLoadOutcomes(), mebkLoadStats()]);
    mebkToast('Outcome added ✓');
  } catch(e) { alert('Error: ' + e.message); }
  if (btn) btn.disabled = false;
}

// ── Save: Activity (standalone — no outcome link) ───
async function mebkSaveActivity() {
  const name  = document.getElementById('mebk-ac-name')?.value.trim();
  const catId = document.getElementById('mebk-ac-cat-sel')?.value;
  if (!name)  { alert('Please enter an activity name.'); return; }
  if (!catId) { alert('Please select a category.'); return; }
  const btn = document.getElementById('mebk-ac-save-btn');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/activity`, {
      method: 'POST',
      headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body: JSON.stringify({ activity_name: name, activity_statement: name, activity_category_id: catId, is_template: true, is_active: true })
    });
    if (!res.ok) throw new Error(await res.text());
    document.getElementById('mebk-ac-name').value = '';
    document.getElementById('mebk-ac-cat-sel').value = '';
    document.getElementById('mebk-add-ac-form').style.display = 'none';
    await Promise.all([mebkLoadActivities(), mebkLoadStats()]);
    mebkToast('Activity added ✓');
  } catch(e) { alert('Error: ' + e.message); }
  if (btn) btn.disabled = false;
}

// ── Save: Indicator (under outcome or activity) ─────
async function mebkSaveIndicator(pfx, parentId) {
  const name = document.getElementById(`mebk-ind-name-${pfx}-${parentId}`)?.value.trim();
  const unit = document.getElementById(`mebk-ind-unit-${pfx}-${parentId}`)?.value;
  if (!name) { alert('Please enter an indicator name.'); return; }
  // Auto-assign superset type: activity → IC-001, outcome → IC-002, impact → IC-003
  const icIds = window.mebkIcIds || {};
  const autoIndCatId = pfx === 'ac' ? icIds['IC-001'] : pfx === 'im' ? icIds['IC-003'] : icIds['IC-002'];
  const payload = {
    indicator_name:        name,
    indicator_category_id: autoIndCatId || null,
    unit_of_measure:       unit || null,
    is_template:           true,
    is_active:             true,
  };
  if (pfx === 'oc')      payload.outcome_id  = parentId;
  else if (pfx === 'ac') payload.activity_id = parentId;
  else                   payload.impact_id   = parentId;
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/indicator`, {
      method: 'POST',
      headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    ['name','unit'].forEach(f => { const el = document.getElementById(`mebk-ind-${f}-${pfx}-${parentId}`); if(el) el.value=''; });
    document.getElementById(`mebk-ind-form-${pfx}-${parentId}`).style.display = 'none';
    if (pfx === 'oc')      await mebkLoadOcContent(parentId);
    else if (pfx === 'ac') await mebkLoadAcContent(parentId);
    else                   await mebkLoadImContent(parentId);
    await mebkLoadStats();
    mebkToast('Indicator saved ✓');
  } catch(e) { alert('Error: ' + e.message); }
}

// ════════════════════════════════════════════════════
// IMPACT / GOALS
// ════════════════════════════════════════════════════
function mebkShowImForm() {
  const f = document.getElementById('mebk-add-im-form');
  if (f) { f.style.display = 'flex'; document.getElementById('mebk-im-stmt')?.focus(); }
}

function mebkEditImFromEncoded(imId, encoded) {
  let imObj = {};
  try { imObj = JSON.parse(decodeURIComponent(encoded || '')); } catch { imObj = {}; }
  mebkEditIm(imId, imObj);
}

async function mebkLoadImpacts() {
  const el = document.getElementById('mebk-impacts-list');
  if (el) el.innerHTML = '<div class="mebk-loading">Loading…</div>';
  const filterVal = (window.mebkFilter = window.mebkFilter || {}).im || 'active';
  const activeFilter = filterVal === 'active' ? '&is_active=eq.true' : filterVal === 'inactive' ? '&is_active=eq.false' : '';
  const catId = (window.mebkCatFilter = window.mebkCatFilter || {}).im || '';
  const catFilter = catId ? `&impact_category_id=eq.${catId}` : '';
  try {
    const res = await fetch(
      `${MEBK_URL}/rest/v1/impact?is_template=eq.true${activeFilter}${catFilter}&select=impact_id,impact_code,impact_statement,is_active,impact_category(category_name)&order=is_active.desc,impact_code.asc&limit=300`,
      { headers: MEBK_HDR }
    );
    // Table may not exist yet (migration pending) — show friendly message
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.code === 'PGRST205' || String(err.message).includes("impact")) {
        const el2 = document.getElementById('mebk-impacts-list');
        if (el2) el2.innerHTML = `<div class="mebk-empty" style="color:var(--amber);">⚠ Database migration pending — run <code>migrations/010_impact_goal.sql</code> in Supabase to activate this tab.</div>`;
        return;
      }
      throw new Error(JSON.stringify(err));
    }
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error(JSON.stringify(data));
    window.mebkLibData = window.mebkLibData || {};
    window.mebkLibData.im = data.map(d => ({ ...d, _catName: d.impact_category?.category_name || '' }));
    const el2 = document.getElementById('mebk-impacts-list');
    if (!el2) return;
    if (!data.length) {
      const msg = filterVal === 'inactive' ? 'No inactive impact goals' : 'No impact goals yet — click "+ Add Impact Goal" to start';
      el2.innerHTML = `<div class="mebk-empty"><div class="mebk-empty-icon">🌐</div>${msg}</div>`;
      return;
    }
    el2.innerHTML = data.map(im => {
      const isActive = im.is_active !== false;
      const catName  = im.impact_category?.category_name || '';
      const encodedIm = esc(encodeURIComponent(JSON.stringify(im || {})));
      const sw = mebkSwitch(isActive, `mebkSetActiveIm('${im.impact_id}',${!isActive})`, 'Active — click to deactivate', 'Inactive — click to reactivate');
      return `
      <div class="mebk-im-card${isActive ? '' : ' inactive'}" id="mebk-im-${esc(im.impact_id)}">
        <div class="mebk-im-hd" data-im-id="${esc(im.impact_id)}" onclick="mebkToggleIm(this.dataset.imId)">
          <span class="mebk-im-code">${esc(im.impact_code || '—')}</span>
          <span class="mebk-im-stmt">${esc(im.impact_statement || '—')}</span>
          ${catName ? `<span class="mebk-im-cat-badge">${esc(catName)}</span>` : ''}
          <button class="mebk-action-btn edit" title="Edit" data-im-id="${esc(im.impact_id)}" data-im="${encodedIm}" onclick="event.stopPropagation();mebkEditImFromEncoded(this.dataset.imId,this.dataset.im)">${IC.edit}</button>
          ${sw}
          <span class="mebk-chevron">${IC.chevronDown}</span>
        </div>
        <div class="mebk-im-body" id="mebk-im-body-${esc(im.impact_id)}" style="display:none;"></div>
      </div>`;
    }).join('');
  } catch(e) {
    const el2 = document.getElementById('mebk-impacts-list');
    if (el2) el2.innerHTML = `<div class="mebk-err">${IC.warning} ${e.message}</div>`;
  }
}

async function mebkSaveImpact() {
  const stmt  = document.getElementById('mebk-im-stmt')?.value.trim();
  const catId = document.getElementById('mebk-im-cat-sel')?.value;
  if (!stmt)  { alert('Please enter an impact goal statement.'); return; }
  if (!catId) { alert('Please select a category.'); return; }
  const btn = document.getElementById('mebk-im-save-btn');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/impact`, {
      method: 'POST', headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body: JSON.stringify({ impact_statement: stmt, impact_category_id: catId, is_template: true, is_active: true })
    });
    if (!res.ok) throw new Error(await res.text());
    document.getElementById('mebk-im-stmt').value = '';
    document.getElementById('mebk-im-cat-sel').value = '';
    document.getElementById('mebk-add-im-form').style.display = 'none';
    await Promise.all([mebkLoadImpacts(), mebkLoadStats()]);
    mebkToast('Impact goal added ✓');
  } catch(e) { alert('Error: ' + e.message); }
  if (btn) btn.disabled = false;
}

async function mebkToggleIm(imId) {
  const card = document.getElementById(`mebk-im-${imId}`);
  if (!card) return;
  const body = document.getElementById(`mebk-im-body-${imId}`);
  const chevron = card.querySelector('.mebk-chevron');
  if (body.style.display !== 'none') {
    body.style.display = 'none';
    if (chevron) chevron.style.transform = '';
    return;
  }
  body.style.display = 'block';
  if (chevron) chevron.style.transform = 'rotate(180deg)';
  await mebkLoadImContent(imId);
}

async function mebkLoadImContent(imId) {
  const body = document.getElementById(`mebk-im-body-${imId}`);
  if (!body) return;
  try {
    const res = await fetch(
      `${MEBK_URL}/rest/v1/indicator?impact_id=eq.${imId}&is_template=eq.true&is_active=eq.true&select=indicator_id,indicator_code,indicator_name,unit_of_measure&order=indicator_code.asc`,
      { headers: MEBK_HDR }
    );
    let indicators = res.ok ? await res.json() : [];
    if (!Array.isArray(indicators)) indicators = [];
    body.innerHTML = `
      <div class="mebk-section">
        <div class="mebk-section-lbl">${IC.chart} Impact Indicators</div>
        ${mebkBuildIndGrid(indicators, 'im', imId)}
        ${mebkBuildIndForm('im', imId)}
        <button class="mebk-add-btn ind" onclick="mebkShowIndForm('im','${imId}')">+ Add Indicator</button>
      </div>`;
  } catch(e) { body.innerHTML = `<div class="mebk-err">${IC.warning} ${e.message}</div>`; }
}

async function mebkSetActiveIm(imId, newActive) {
  const action = newActive ? 'Reactivate' : 'Deactivate';
  if (!confirm(`${action} this impact goal?`)) return;
  try {
    await fetch(`${MEBK_URL}/rest/v1/impact?impact_id=eq.${imId}`, {
      method: 'PATCH', headers: { ...MEBK_HDR, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ is_active: newActive })
    });
    await Promise.all([mebkLoadImpacts(), mebkLoadStats()]);
    mebkToast(newActive ? 'Impact goal reactivated ✓' : 'Impact goal deactivated ✓');
  } catch(e) { alert('Error: ' + e.message); }
}

function mebkEditIm(imId, imObj) {
  if (typeof imObj === 'string') try { imObj = JSON.parse(imObj); } catch { imObj = {}; }
  const row = document.getElementById(`mebk-im-${imId}`);
  if (!row || row.dataset.editing) return;
  row.dataset.editing = '1';
  const hd = row.querySelector('.mebk-im-hd');
  if (!hd) return;
  const editRow = document.createElement('div');
  editRow.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--mist-3);border-top:1px solid var(--mist-2);flex-wrap:wrap;';
  editRow.id = `mebk-im-edit-${imId}`;
  const catOpts = (window.mebkImCats||[]).map(c=>`<option value="${c.impact_category_id}" ${imObj.impact_category_id===c.impact_category_id?'selected':''}>${c.category_name}</option>`).join('');
  editRow.innerHTML = `
    <span style="font-size:10px;color:#7c3aed;font-family:var(--mono);font-weight:700;">${imObj.impact_code||'—'}</span>
    <input id="mebk-im-edit-stmt-${imId}" value="${(imObj.impact_statement||'').replace(/"/g,'&quot;')}" style="flex:1;min-width:200px;height:30px;padding:0 10px;font-size:12px;border:1.5px solid var(--mist-2);border-radius:var(--r-sm);" placeholder="Impact statement…"/>
    <select id="mebk-im-edit-cat-${imId}" style="height:30px;padding:0 8px;font-size:12px;border:1.5px solid var(--mist-2);border-radius:var(--r-sm);">
      <option value="">Category…</option>${catOpts}
    </select>
    <button class="mebk-ind-save-btn"   onclick="mebkSaveEditIm('${imId}')">${IC.check}</button>
    <button class="mebk-ind-cancel-btn" onclick="mebkCancelEditIm('${imId}')">${IC.x}</button>`;
  row.appendChild(editRow);
  document.getElementById(`mebk-im-edit-stmt-${imId}`)?.focus();
}

function mebkCancelEditIm(imId) {
  document.getElementById(`mebk-im-edit-${imId}`)?.remove();
  const row = document.getElementById(`mebk-im-${imId}`);
  if (row) delete row.dataset.editing;
}

async function mebkSaveEditIm(imId) {
  const stmt  = document.getElementById(`mebk-im-edit-stmt-${imId}`)?.value.trim();
  const catId = document.getElementById(`mebk-im-edit-cat-${imId}`)?.value;
  if (!stmt) { alert('Impact statement cannot be empty.'); return; }
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/impact?impact_id=eq.${imId}`, {
      method: 'PATCH', headers: { ...MEBK_HDR, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ impact_statement: stmt, impact_category_id: catId || null })
    });
    if (!res.ok) throw new Error(await res.text());
    await mebkLoadImpacts();
    mebkToast('Impact goal updated ✓');
  } catch(e) { alert('Error: ' + e.message); }
}

// ── Search (active tab) ─────────────────────────────
function mebkSearch(tab, q) {
  const lq    = (q || '').toLowerCase();
  const listId = tab === 'oc' ? 'mebk-outcomes-list' : tab === 'im' ? 'mebk-impacts-list' : 'mebk-activities-list';
  const codeClass = tab === 'oc' ? '.mebk-oc-code' : tab === 'im' ? '.mebk-im-code' : '.mebk-ac-code';
  document.querySelectorAll(`#${listId} > div`).forEach(card => {
    const txt  = (card.querySelector('.mebk-stmt')?.textContent || '').toLowerCase();
    const code = (card.querySelector(codeClass)?.textContent || '').toLowerCase();
    card.style.display = (!lq || txt.includes(lq) || code.includes(lq)) ? '' : 'none';
  });
}

// ── Toast ───────────────────────────────────────────
function mebkToast(msg) {
  let t = document.getElementById('mebk-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'mebk-toast';
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#22c55e;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);transition:opacity .3s;pointer-events:none;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2500);
}

// ══════════════════════════════════════════════════════
//  EDIT / DELETE — OUTCOMES
// ══════════════════════════════════════════════════════

function mebkEditOc(ocId, currentStmt) {
  // hide any other open edit panels first
  document.querySelectorAll('.mebk-oc-edit').forEach(el => el.style.display = 'none');
  const panel = document.getElementById(`mebk-oc-edit-${ocId}`);
  if (!panel) return;
  panel.style.display = 'flex';
  const inp = document.getElementById(`mebk-oc-edit-inp-${ocId}`);
  if (inp) { inp.value = currentStmt; inp.focus(); inp.select(); }
}

async function mebkSaveEditOc(ocId) {
  const inp  = document.getElementById(`mebk-oc-edit-inp-${ocId}`);
  const stmt = inp?.value.trim();
  if (!stmt) { alert('Outcome statement cannot be empty.'); return; }
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/outcome?outcome_id=eq.${ocId}`, {
      method:  'PATCH',
      headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body:    JSON.stringify({ outcome_statement: stmt })
    });
    if (!res.ok) throw new Error(await res.text());
    // update label in-place without full reload
    const lbl = document.getElementById(`mebk-oc-stmt-${ocId}`);
    if (lbl) lbl.textContent = stmt;
    document.getElementById(`mebk-oc-edit-${ocId}`).style.display = 'none';
    mebkToast('Outcome updated ✓');
  } catch(e) { alert('Error: ' + e.message); }
}

async function mebkDeleteOc(ocId) {
  if (!confirm('Delete this outcome and all its indicators? This cannot be undone.')) return;
  try {
    // soft-delete: set is_active = false
    const res = await fetch(`${MEBK_URL}/rest/v1/outcome?outcome_id=eq.${ocId}`, {
      method:  'PATCH',
      headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body:    JSON.stringify({ is_active: false })
    });
    if (!res.ok) throw new Error(await res.text());
    // also soft-delete child indicators
    await fetch(`${MEBK_URL}/rest/v1/indicator?outcome_id=eq.${ocId}`, {
      method:  'PATCH',
      headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body:    JSON.stringify({ is_active: false })
    });
    await Promise.all([mebkLoadOutcomes(), mebkLoadStats()]);
    mebkToast('Outcome deleted ✓');
  } catch(e) { alert('Error: ' + e.message); }
}

// ══════════════════════════════════════════════════════
//  EDIT / DELETE — ACTIVITIES
// ══════════════════════════════════════════════════════

function mebkEditAc(acId, currentName) {
  document.querySelectorAll('.mebk-ac-edit').forEach(el => el.style.display = 'none');
  const panel = document.getElementById(`mebk-ac-edit-${acId}`);
  if (!panel) return;
  panel.style.display = 'flex';
  const inp = document.getElementById(`mebk-ac-edit-inp-${acId}`);
  if (inp) { inp.value = currentName; inp.focus(); inp.select(); }
}

async function mebkSaveEditAc(acId) {
  const inp  = document.getElementById(`mebk-ac-edit-inp-${acId}`);
  const name = inp?.value.trim();
  if (!name) { alert('Activity name cannot be empty.'); return; }
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/activity?activity_id=eq.${acId}`, {
      method:  'PATCH',
      headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body:    JSON.stringify({ activity_name: name, activity_statement: name })
    });
    if (!res.ok) throw new Error(await res.text());
    const lbl = document.getElementById(`mebk-ac-stmt-${acId}`);
    if (lbl) lbl.textContent = name;
    document.getElementById(`mebk-ac-edit-${acId}`).style.display = 'none';
    mebkToast('Activity updated ✓');
  } catch(e) { alert('Error: ' + e.message); }
}

async function mebkDeleteAc(acId) {
  if (!confirm('Delete this activity and all its indicators? This cannot be undone.')) return;
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/activity?activity_id=eq.${acId}`, {
      method:  'PATCH',
      headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body:    JSON.stringify({ is_active: false })
    });
    if (!res.ok) throw new Error(await res.text());
    // soft-delete child indicators
    await fetch(`${MEBK_URL}/rest/v1/indicator?activity_id=eq.${acId}`, {
      method:  'PATCH',
      headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body:    JSON.stringify({ is_active: false })
    });
    await Promise.all([mebkLoadActivities(), mebkLoadStats()]);
    mebkToast('Activity deleted ✓');
  } catch(e) { alert('Error: ' + e.message); }
}

// ══════════════════════════════════════════════════════
//  ACTIVATE / DEACTIVATE — OUTCOMES & ACTIVITIES
// ══════════════════════════════════════════════════════

// ── Status filter pill controller ───────────────────
function mebkSetFilter(tab, value) {
  window.mebkFilter = window.mebkFilter || {};
  window.mebkFilter[tab] = value;
  ['active','all','inactive'].forEach(v => {
    const pill = document.getElementById(`mebk-fpill-${tab}-${v}`);
    if (pill) pill.classList.toggle('sel', v === value);
  });
  if (tab === 'oc') mebkLoadOutcomes();
  else if (tab === 'ac') mebkLoadActivities();
  else mebkLoadImpacts();
}

// Set active status for an outcome (true = activate, false = deactivate)
async function mebkSetActiveOc(ocId, newActive) {
  const action = newActive ? 'Reactivate' : 'Deactivate';
  if (!confirm(`${action} this outcome${newActive ? '' : ' (it will be hidden from the active list)'}?`)) return;
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/outcome?outcome_id=eq.${ocId}`, {
      method:  'PATCH',
      headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body:    JSON.stringify({ is_active: newActive })
    });
    if (!res.ok) throw new Error(await res.text());
    // cascade to child indicators when deactivating
    if (!newActive) {
      await fetch(`${MEBK_URL}/rest/v1/indicator?outcome_id=eq.${ocId}`, {
        method:  'PATCH',
        headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
        body:    JSON.stringify({ is_active: false })
      });
    }
    await Promise.all([mebkLoadOutcomes(), mebkLoadStats()]);
    mebkToast(newActive ? 'Outcome reactivated ✓' : 'Outcome deactivated ✓');
  } catch(e) { alert('Error: ' + e.message); }
}

// Set active status for an activity (true = activate, false = deactivate)
async function mebkSetActiveAc(acId, newActive) {
  const action = newActive ? 'Reactivate' : 'Deactivate';
  if (!confirm(`${action} this activity${newActive ? '' : ' (it will be hidden from the active list)'}?`)) return;
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/activity?activity_id=eq.${acId}`, {
      method:  'PATCH',
      headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body:    JSON.stringify({ is_active: newActive })
    });
    if (!res.ok) throw new Error(await res.text());
    // cascade to child indicators when deactivating
    if (!newActive) {
      await fetch(`${MEBK_URL}/rest/v1/indicator?activity_id=eq.${acId}`, {
        method:  'PATCH',
        headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
        body:    JSON.stringify({ is_active: false })
      });
    }
    await Promise.all([mebkLoadActivities(), mebkLoadStats()]);
    mebkToast(newActive ? 'Activity reactivated ✓' : 'Activity deactivated ✓');
  } catch(e) { alert('Error: ' + e.message); }
}

// ══════════════════════════════════════════════════════
//  EDIT / DELETE — INDICATORS
// ══════════════════════════════════════════════════════

function mebkEditInd(indId, pfx, parentId, indObj) {
  // close any open indicator edit rows
  document.querySelectorAll('.mebk-ind-edit-row').forEach(el => el.remove());
  // re-show the regular row if it was hidden
  document.querySelectorAll('.mebk-ind-row[data-editing]').forEach(el => {
    el.style.display = ''; delete el.dataset.editing;
  });

  const row = document.getElementById(`mebk-ind-row-${indId}`);
  if (!row) return;
  row.style.display = 'none';
  row.dataset.editing = '1';

  const units = [
    { v:'percentage', l:'Percentage (%)' },
    { v:'count',      l:'Count (No.)'    },
    { v:'ratio',      l:'Ratio'          },
    { v:'yes_no',     l:'Yes / No'       }
  ];

  const editRow = document.createElement('div');
  editRow.className = 'mebk-ind-edit-row';
  editRow.id = `mebk-ind-edit-row-${indId}`;

  editRow.innerHTML = `
    <span style="font-size:10px;color:var(--slate);font-family:var(--mono);">${indObj.indicator_code||'—'}</span>
    <input id="mebk-ind-edit-name-${indId}" value="${(indObj.indicator_name||'').replace(/"/g,'&quot;')}" placeholder="Indicator name…" style="width:100%;"/>
    <select id="mebk-ind-edit-unit-${indId}">
      <option value="">Unit…</option>
      ${units.map(u=>`<option value="${u.v}" ${indObj.unit_of_measure===u.v?'selected':''}>${u.l}</option>`).join('')}
    </select>
    <span style="display:flex;gap:3px;flex-wrap:wrap;">
      <button class="mebk-ind-save-btn"   onclick="mebkSaveEditInd('${indId}','${pfx}','${parentId}')">${IC.check}</button>
      <button class="mebk-ind-cancel-btn" onclick="mebkCancelEditInd('${indId}')">${IC.x}</button>
    </span>`;
  row.parentNode.insertBefore(editRow, row.nextSibling);
  document.getElementById(`mebk-ind-edit-name-${indId}`)?.focus();
}

function mebkCancelEditInd(indId) {
  document.getElementById(`mebk-ind-edit-row-${indId}`)?.remove();
  const row = document.getElementById(`mebk-ind-row-${indId}`);
  if (row) { row.style.display = ''; delete row.dataset.editing; }
}

async function mebkSaveEditInd(indId, pfx, parentId) {
  const name = document.getElementById(`mebk-ind-edit-name-${indId}`)?.value.trim();
  const unit = document.getElementById(`mebk-ind-edit-unit-${indId}`)?.value;
  if (!name) { alert('Indicator name cannot be empty.'); return; }
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/indicator?indicator_id=eq.${indId}`, {
      method:  'PATCH',
      headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body:    JSON.stringify({
        indicator_name:  name,
        unit_of_measure: unit || null,
      })
    });
    if (!res.ok) throw new Error(await res.text());
    // reload indicators in the parent card body
    if (pfx === 'oc')      await mebkLoadOcContent(parentId);
    else if (pfx === 'ac') await mebkLoadAcContent(parentId);
    else                   await mebkLoadImContent(parentId);
    await mebkLoadStats();
    mebkToast('Indicator updated ✓');
  } catch(e) { alert('Error: ' + e.message); }
}

async function mebkDeleteInd(indId, pfx, parentId) {
  if (!confirm('Delete this indicator?')) return;
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/indicator?indicator_id=eq.${indId}`, {
      method:  'PATCH',
      headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body:    JSON.stringify({ is_active: false })
    });
    if (!res.ok) throw new Error(await res.text());
    if (pfx === 'oc') await mebkLoadOcContent(parentId);
    else              await mebkLoadAcContent(parentId);
    await mebkLoadStats();
    mebkToast('Indicator deleted ✓');
  } catch(e) { alert('Error: ' + e.message); }
}

// ═══════════════════════════════════════════════════
// ROUTING
// ═══════════════════════════════════════════════════
function showPage(route) {
  state.route = route;

  // Normalise alias: budget-tracker → grant-mgmt (backward compat)
  if (route === 'budget-tracker') route = 'grant-mgmt';

  // ── Sub-nav active state ──────────────────────────────────────────
  const isGrantMgmt = route === 'grant-mgmt' || route === 'grant-setup' || route === 'budget-book';
  $('nav-budget')?.classList.toggle('sub-open', isGrantMgmt);
  $('nav-gm-sub')?.classList.toggle('open', isGrantMgmt);
  $('nav-sub-portfolio')?.classList.toggle('active',    route === 'grant-mgmt');
  $('nav-sub-newgrant')?.classList.toggle('active',     route === 'grant-setup');
  $('nav-sub-budgetbook')?.classList.toggle('active',   route === 'budget-book');

  // update nav — parent button active when any grant-mgmt sub-route is active
  qsa('.nav-btn').forEach(b => {
    const br = b.dataset.route;
    b.classList.toggle('active',
      br === route || (br === 'grant-mgmt' && isGrantMgmt)
    );
  });

  // hide all pages
  ['home','data-entry','data-entry-sheet','me-book','me-builder','lfa','data-upload','budget-book','budget-tracker'].forEach(id => {
    $(`page-${id}`)?.classList.add('hidden');
  });
  // also hide the inline grant setup panel if navigating away
  if (route !== 'grant-setup') {
    $('page-grant-setup')?.classList.add('hidden');
  }

  if (route === 'home') {
    $('page-home').classList.remove('hidden');
    $('crumb-path').textContent = 'Mantra Portal';
    $('crumb-title').textContent = 'Overview Dashboard';
    (function(){ const h=new Date().getHours(); const g=h<12?'Good morning':h<17?'Good afternoon':'Good evening'; const el=$('home-greeting'); if(el) el.innerHTML=g+' '+IC.wave; })();
  } else if (route === 'data-entry') {
    $('page-data-entry').classList.remove('hidden');
    $('crumb-path').textContent = 'Monthly Reporting';
    $('crumb-title').textContent = `Select Program · ${state.month}`;
    // Load published indicators from DB before rendering
    mrLoadAllPublishedIndicators().then(() => renderProgramSelect());
  } else if (route === 'data-entry-sheet') {
    $('page-data-entry-sheet').classList.remove('hidden');
    $('crumb-path').innerHTML = `Monthly Reporting ${IC['arrow-right']} ${state.program}`;
    $('crumb-title').textContent = `Monthly Sheet · ${state.month}`;
    state.filters = { search:'', indType:'', stakeholder:'', env:'', child:'', period:'', intv:'', activity:'', outcome:'', outcomeCat:'' };
    state.showMissing = false; state.showFlagged = false;
    if($('chip-missing')) $('chip-missing').classList.remove('on');
    if($('chip-flagged')) $('chip-flagged').classList.remove('on');
    const meta = programMeta[state.program] || {};
    if($('stat-schools')) $('stat-schools').textContent = (meta.schools||0).toLocaleString();
    if($('sheet-title'))  $('sheet-title').textContent  = state.program;
    const total = getReportingRows(state.program).length;
    if($('stat-indicator-count')) $('stat-indicator-count').textContent = total;
    updatePublishState();
    populateSheetFilters(state.program);
    // Load any previously submitted actuals from DB, then re-render
    mrLoadFromDB(state.program, state.month, state.fy || '2025-26').then(() => renderSheet());
  } else if (route === 'me-book') {
    $('page-me-book').classList.remove('hidden');
    $('crumb-path').textContent = 'M&E Administration';
    $('crumb-title').textContent = 'M&E Book — Outcome & Activity Repository';
    mebkInit();
  } else if (route === 'me-builder') {
    $('page-me-builder').classList.remove('hidden');
    $('crumb-path').textContent = 'M&E Builder';
    $('crumb-title').textContent = 'Select Program';
    $('me-prog-selector').classList.remove('hidden');
    $('me-builder-content').classList.add('hidden');
    renderMEProgSelector();
  } else if (route === 'lfa') {
    $('page-lfa').classList.remove('hidden');
    $('crumb-path').textContent = 'LFA Setup';
    $('crumb-title').textContent = 'Select Program';
    $('lfa-prog-selector').classList.remove('hidden');
    $('lfa-builder-content').classList.add('hidden');
    lfaRenderProgCards();
    // Pre-load M&E Book library so comboboxes are ready immediately
    if (typeof lfaLoadLibrary === 'function') lfaLoadLibrary();
    // Sync reference data from M&E Book tables
    if (typeof lfaLoadRefData === 'function') lfaLoadRefData();
  } else if (route === 'data-upload') {
    $('page-data-upload').classList.remove('hidden');
    $('crumb-path').textContent = 'Data Upload';
    $('crumb-title').textContent = 'Response File Upload & Impact KPIs';
    duEnsureProgramMasterLoaded();
    const preferredProgram = $('du-prog-sel')?.value || duTemplateState.program || duGeoMapState.program || '';
    duRenderProgramSelectors(preferredProgram);
    duRefreshKPIs();
    duRenderUdiseGrid();
    duRenderHistory();
    duRenderTemplateProgramCards();
    duRenderGeoProgramCards();
    const selectedProgram = $('du-prog-sel')?.value || duTemplateState.program || '';
    if (selectedProgram) {
      const shouldReset = duTemplateState.program !== selectedProgram || !duTemplateState.columns.length;
      duSelectTemplateProgram(selectedProgram, { syncTopSelect: false, resetForm: shouldReset });
      const shouldLoadGeo = duGeoMapState.program !== selectedProgram || !duGeoMapState.rows.length;
      duSelectGeoProgram(selectedProgram, { syncTopSelect: false, loadRows: shouldLoadGeo });
    } else {
      duSelectTemplateProgram('', { syncTopSelect: false, resetForm: false });
      duSelectGeoProgram('', { syncTopSelect: false, loadRows: false });
    }
  } else if (route === 'budget-book') {
    $('page-budget-book').classList.remove('hidden');
    $('crumb-path').textContent = 'Grant Management';
    $('crumb-title').textContent = 'Budget Book — Heads, Donors & Grants';
    bbInit();
  } else if (route === 'grant-mgmt') {
    $('page-budget-tracker').classList.remove('hidden');
    $('crumb-path').textContent = 'Grant Management';
    $('crumb-title').textContent = 'Portfolio Overview';
    btShowProgSelector();
  } else if (route === 'grant-setup') {
    $('page-grant-setup')?.classList.remove('hidden');
    $('crumb-path').textContent  = 'Grant Management';
    $('crumb-title').textContent = 'New Grant Setup';
    // Initialise the component (delayed one tick so DOM is visible)
    setTimeout(() => { if (typeof gsInit === 'function') gsInit(); }, 0);
  }

  // Fix 11 — hide period-related topbar controls on design pages
  (function(){
    const design = ['lfa', 'me-builder'];
    const mc = document.getElementById('month-select')?.closest('.tb-control');
    if (mc) mc.style.display = design.includes(route) ? 'none' : '';
    const fc = document.getElementById('fy-select')?.closest('.tb-control');
    if (fc) fc.style.display = route === 'lfa' ? 'none' : '';
  })();
}

// ═══════════════════════════════════════════════════
// ROLE UI
// ═══════════════════════════════════════════════════
function applyRoleUI() {
  const labels = { poc:'Program POC', admin:'M&E Administrator', manager:'Program Manager', leader:'Leadership', donor:'Donor/Funder' };
  $('role-badge-text').textContent = labels[state.role] || state.role;

  const isAdmin   = state.role === 'admin';
  const isManager = state.role === 'manager';
  const isPOC     = state.role === 'poc';
  const isViewer  = ['leader','donor'].includes(state.role);

  // ── Sidebar nav visibility ─────────────────────────────────────
  // M&E Book — admin only (M&E Administration role)
  $('nav-me-book')?.classList.toggle('hidden', !isAdmin);
  // M&E Builder — admin only
  $('nav-me-builder')?.classList.toggle('hidden', !isAdmin);
  // LFA Setup — admin + program manager
  $('nav-lfa')?.classList.toggle('hidden', !(isAdmin || isManager));
  // Monthly Reporting — admin + POC only (not manager, not viewer)
  $('nav-data-entry')?.classList.toggle('hidden', isManager || isViewer);
  // Data Upload — admin + POC (not manager, not viewer)
  $('nav-data-upload')?.classList.toggle('hidden', isManager || isViewer);
  // Grant Management — program manager + viewer (portfolio view) · NOT admin (M&E role)
  $('nav-budget')?.classList.toggle('hidden', !(isManager || isViewer));
  // Budget Book sub-nav — manager only (admin hidden)
  $('nav-sub-budgetbook')?.classList.toggle('hidden', !isManager);
  // New Grant Setup sub-nav — manager only, never admin/viewer
  $('nav-sub-newgrant')?.classList.toggle('hidden', !isManager);

  // Budget Tracker — hide edit controls for viewer (read-only portfolio)
  const btEditEls = ['bt-th-update-util','bt-save-lines-btn','bt-entry-type-sel','bt-save-monthly-btn','bt-monthly-type-sel','bt-add-disb-btn','bt-add-report-btn'];
  btEditEls.forEach(id => $(id)?.classList.toggle('hidden', isViewer));
  // UDISE setup tab inside Data Upload — admin only
  $('du-tab-setup')?.classList.toggle('hidden', !isAdmin);

  // ── Home page — adapt to role ──────────────────────────────────
  // M&E Builder quick card — admin only
  $('home-builder-card')?.classList.toggle('hidden', !isAdmin);
  // Monthly Reporting quick card + Open Reporting button — admin + POC only
  $('home-reporting-card')?.classList.toggle('hidden', isManager || isViewer);
  $('home-open-reporting-btn')?.classList.toggle('hidden', isManager || isViewer);
  // Grant Management quick card — manager + leader/donor · NOT admin
  $('home-grant-card')?.classList.toggle('hidden', !(isManager || isViewer));
  // "+ New Grant" button on home card — manager only
  $('home-new-grant-btn')?.classList.toggle('hidden', !isManager);
  // LFA quick card — admin + manager
  $('home-lfa-card')?.classList.toggle('hidden', !(isAdmin || isManager));

  // Home greeting sub-text — contextual per role
  const subEl = $('home-sub-text');
  if (subEl) {
    if (isManager) subEl.textContent = 'Grant portfolio and program design overview';
    else if (isAdmin) subEl.textContent = 'System-wide overview · All programs · Feb 2026';
    else subEl.textContent = 'Program reporting status for February 2026';
  }
}

// ═══════════════════════════════════════════════════
// SHEET (DATA ENTRY)
// ═══════════════════════════════════════════════════
function rowMatches(r) {
  const f = state.filters;
  const lo = s => (s||'').toLowerCase();
  if (f.search      && !lo(r.indicator).includes(lo(f.search))) return false;
  if (f.indType     && r.type        !== f.indType)     return false;
  if (f.stakeholder && r.stakeholder !== f.stakeholder) return false;
  if (f.env         && r.env         !== f.env)         return false;
  if (f.child       && r.child       !== f.child)       return false;
  if (f.period      && r.period      !== f.period)      return false;
  if (f.intv        && r.intv        !== f.intv)        return false;
  if (f.activity    && r.activity    !== f.activity)    return false;
  if (f.outcome     && r.outcome     !== f.outcome)     return false;
  if (f.outcomeCat && r.outcomeCategory !== f.outcomeCat) return false;
  if (state.showMissing && r.value !== '') return false;
  if (state.showFlagged && !r.flagged)     return false;
  return true;
}

function computeStats() {
  const rows = state.sheetRows;
  const filled = rows.filter(r => r.value !== '').length;
  const missing = rows.length - filled;
  const flags = rows.filter(r => r.flagged).length;
  return { total: rows.length, filled, missing, flags };
}

// ═══════════════════════════════════════════════════
// PUBLISHED FRAMEWORK — snapshot on Publish click
// Reporting reads ONLY from this; Builder edits are drafts.
// ═══════════════════════════════════════════════════
let publishedFramework = null; // pointer to active program's published framework

// ═══════════════════════════════════════════════════════════════════
// ─── M&E Program Selector — LFA-driven (correct architecture) ───
// ═══════════════════════════════════════════════════════════════════
//
//  Flow:  LFA Setup → M&E Builder → Grant Setup Step 7
//
//  LFA Setup    : defines interventions × stakeholders → outcomes + activities
//  M&E Builder  : reads LFA structure → admin sets indicator names/targets → publishes
//  Grant Setup  : PM picks KEY indicators from the published M&E framework
//                 and maps them to a donor (grant_indicator_commitment)
//  Donor view   : shows only committed indicator progress
//
// ═══════════════════════════════════════════════════════════════════

// Programs that have LFA / M&E coverage
let ME_PROGRAMS = []; // Populated from DB
let ME_PROGRAMS_MAP = {}; // program_name → program_id
let lfa_outcome_cache = {}; // program_id → outcome count (for LFA badge check)
let lfa_activity_cache = {}; // program_id → activity count (for LFA badge check)

// Pre-load LFA cache for all programs to show correct badges
// Uses correct hierarchy: Program → Intervention → Outcomes/Activities
async function preloadLfaCache() {
  if (!GS_SB_URL) return;
  try {
    // Get all program IDs
    const progIds = Object.values(ME_PROGRAMS_MAP).filter(Boolean);
    if (!progIds.length) return;

    // Fetch interventions for all programs
    const intRes = await fetch(`${GS_SB_URL}/rest/v1/intervention?program_id=in.(${progIds.join(',')})&select=intervention_id,program_id`, { headers: GS_SB_HDR });
    const interventions = intRes.ok ? await intRes.json() : [];
    
    // Group intervention IDs by program
    const intByProg = {};
    interventions.forEach(i => {
      if (!intByProg[i.program_id]) intByProg[i.program_id] = [];
      intByProg[i.program_id].push(i.intervention_id);
    });

    // Get all intervention IDs
    const allIntIds = interventions.map(i => i.intervention_id);
    
    if (allIntIds.length) {
      // Fetch outcome/activity counts per intervention
      const [ocRes, acRes] = await Promise.all([
        fetch(`${GS_SB_URL}/rest/v1/lfa_outcome?intervention_id=in.(${allIntIds.join(',')})&select=intervention_id`, { headers: GS_SB_HDR }),
        fetch(`${GS_SB_URL}/rest/v1/lfa_activity?intervention_id=in.(${allIntIds.join(',')})&select=intervention_id`, { headers: GS_SB_HDR })
      ]);

      const outcomes = ocRes.ok ? await ocRes.json() : [];
      const activities = acRes.ok ? await acRes.json() : [];

      // Count per program (through interventions)
      progIds.forEach(progId => {
        const progIntIds = intByProg[progId] || [];
        lfa_outcome_cache[progId] = outcomes.filter(o => progIntIds.includes(o.intervention_id)).length;
        lfa_activity_cache[progId] = activities.filter(a => progIntIds.includes(a.intervention_id)).length;
      });
    }

    console.log('[preloadLfaCache] Loaded LFA counts:', { 
      interventions: interventions.length,
      outcomes: Object.values(lfa_outcome_cache).reduce((a,b) => a+b, 0), 
      activities: Object.values(lfa_activity_cache).reduce((a,b) => a+b, 0) 
    });
  } catch (e) {
    console.warn('[preloadLfaCache] Error:', e);
  }
}

// Cache for indicator category IDs — used when publishing to DB
var meb2CatIds = {};  // { 'IC-001': uuid, 'IC-002': uuid }

// Fetch + cache indicator_category IDs once (called at publish time)
async function meb2EnsureCatIds() {
  if (meb2CatIds['IC-001']) return;
  try {
    const cats = await gsSbFetch('indicator_category',
      'category_code=in.(IC-001,IC-002)&select=indicator_category_id,category_code');
    (cats||[]).forEach(c => { meb2CatIds[c.category_code] = c.indicator_category_id; });
  } catch(e) { console.warn('[meb2] Could not fetch indicator_category IDs:', e); }
}

// ── Per-program publish status ───────────────────────────────────
function getMEProgStatus(prog) {
  const rows = builderRowsByProg[prog] || [];
  const pf   = publishedFrameworkByProg[prog] || null;
  const publishable = rows.filter(r => r.active && r.name && (r.type || r.sourceType) && (r.stk || r.stakeholder));
  const count = publishable.length;
  if (pf) {
    const dirty = JSON.stringify(publishable) !== JSON.stringify(pf.rows);
    return { state: dirty ? 'draft' : 'published', count, pf, dirty };
  }
  if (count > 0) return { state:'draft', count, pf:null, dirty:true };
  return { state:'empty', count:0, pf:null, dirty:false };
}

// ── Program selector — shows program cards, LFA status ──────────
async function renderMEProgSelector() {
  const grid = $('me-prog-cards');
  if (!grid) return;

  // Load programs from DB if not yet loaded
  if (!ME_PROGRAMS.length) {
    grid.innerHTML = '<div style="padding:20px;color:var(--muted);font-size:13px;">Loading programs…</div>';
    try {
      const res = await fetch(`${GS_SB_URL}/rest/v1/program?select=program_id,program_name&order=program_name.asc&limit=100`, { headers: GS_SB_HDR });
      if (res.ok) {
        const rows = await res.json();
        ME_PROGRAMS = rows.map(r => r.program_name);
        rows.forEach(r => { ME_PROGRAMS_MAP[r.program_name] = r.program_id; });
      }
    } catch(e) { console.warn('[renderMEProgSelector] Failed to load programs:', e); }
    if (!ME_PROGRAMS.length) {
      grid.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);font-size:13px;">No programs found. Create programs in Program Setup first.</div>';
      return;
    }
  }

  // Pre-load LFA cache for all programs to show correct badge
  await preloadLfaCache();

  const dotCss = c => `display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:3px;`;
  grid.innerHTML = ME_PROGRAMS.map(prog => {
    const { state, count, pf } = getMEProgStatus(prog);
    // Check if LFA has been published for this program (by looking for outcomes/activities in DB)
    const progId = ME_PROGRAMS_MAP[prog];
    const hasLfa = !!(progId && (lfa_outcome_cache?.[progId] || lfa_activity_cache?.[progId]));
    const dot  = state==='published' ? `<span style="${dotCss('var(--ok)')}"></span>`
               : state==='draft'     ? `<span style="${dotCss('var(--warn)')}"></span>`
               :                       `<span style="${dotCss('var(--slate-2)')}"></span>`;
    const label = state==='published'
      ? `Published · ${pf.count} indicator${pf.count!==1?'s':''}`
      : count > 0 ? `Draft — ${count} indicator${count!==1?'s':''}`
      : hasLfa    ? 'LFA ready · click to configure indicators'
      :             'Set up LFA first, then configure indicators';
    const ts = pf ? `<span style="font-size:10px;color:var(--muted);margin-left:4px;">${pf.ts.toLocaleTimeString()}</span>` : '';
    const lfaBadge = hasLfa
      ? `<span style="font-size:10px;padding:1px 6px;border-radius:999px;background:var(--ok-bg);border:1px solid var(--ok-border);color:var(--ok);margin-left:6px;">LFA ✓</span>`
      : `<span style="font-size:10px;padding:1px 6px;border-radius:999px;background:var(--warn-bg);border:1px solid var(--warn-border);color:var(--warn);margin-left:6px;">LFA needed</span>`;
    return `<div class="me-prog-card ${state}" data-meprog="${esc(prog)}" style="cursor:pointer;">
      <div class="mpc-name">${esc(prog)} ${lfaBadge}</div>
      <div class="mpc-count">${count} indicator${count!==1?'s':''}</div>
      <div class="mpc-status">${dot}<span>${label}</span>${ts}</div>
      <div class="mpc-open">Open Builder ${IC['arrow-right']}</div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.me-prog-card').forEach(card =>
    card.addEventListener('click', () => openMEBuilderForProg(card.dataset.meprog))
  );
}

// ── openMEBuilderForProg — LFA-driven, program-based ────────────
function openMEBuilderForProg(prog) {
  activeMEProgram = prog;
  // Store the real program_id so meb2LoadProgramFromDB can use it directly
  window.lfaCurrentProgId = ME_PROGRAMS_MAP[prog] || null;
  if (!builderRowsByProg[prog]) builderRowsByProg[prog] = [];
  builderRows        = builderRowsByProg[prog];
  publishedFramework = publishedFrameworkByProg[prog] || null;
  builderFilterProg  = prog;

  $('me-prog-selector').classList.add('hidden');
  $('me-builder-content').classList.remove('hidden');
  $('crumb-title').textContent = `M&E Builder — ${prog}`;
  const fyBadge = $('builder-fy-badge');
  if (fyBadge) fyBadge.textContent = `Editing FY: ${builderFilterFY} · ${prog}`;
  const title = $('meb2-prog-title'); if (title) title.textContent = prog;
  const sub   = $('meb2-prog-sub');
  if (sub) sub.textContent = 'Configure indicators from LFA structure · set targets · publish';

  // meb2Render reads lfaStore for this program
  if (typeof meb2Render === 'function') meb2Render(prog);
}

// ═══════════════════════════════════════════════════════════════════
// ─── meb2LoadFromDB — 4-query hierarchy loader ───────────────────
// ═══════════════════════════════════════════════════════════════════
//
//  Grant → grant_intervention_scope → intervention
//        → intervention_stakeholder_type_map (ISTM)
//        → outcome  (IC-002 source)
//        → activity (IC-001 source)
//        → indicator (existing indicators per outcome/activity)
//
async function meb2LoadFromDB(grantId, grantName) {
  const container = document.getElementById('meb2-framework');
  const noLfa     = document.getElementById('meb2-no-lfa-state');
  const pubBar    = document.querySelector('.meb2-pub-bar');
  const banner    = document.getElementById('meb2-lfa-banner');

  // Show loading spinner in the framework area
  if (container) container.innerHTML = `
    <div style="padding:32px;text-align:center;color:var(--muted);font-size:13px;">
      <div class="app-spinner" style="margin:0 auto 10px;"></div>
      Loading outcomes, activities and indicators from database…
    </div>`;
  if (noLfa)   noLfa.style.display   = 'none';
  if (pubBar)  pubBar.style.display  = '';
  if (banner)  banner.classList.add('hidden');

  await meb2EnsureCatIds();

  try {
    // ── Step 1: Grant interventions ───────────────────────────────
    const scopes = await gsSbFetch('grant_intervention_scope',
      `grant_id=eq.${grantId}&is_active=eq.true&select=intervention_id`);
    const intvIds = (scopes||[]).map(s => s.intervention_id).filter(Boolean);

    if (!intvIds.length) {
      if (container) container.innerHTML = `
        <div style="padding:32px;text-align:center;color:var(--muted);">
          <div style="font-size:24px;margin-bottom:8px;">${IC.warning}</div>
          <div style="font-weight:600;margin-bottom:4px;">No interventions linked to this grant</div>
          <div style="font-size:12px;">Go to Grant Setup and configure interventions first.</div>
        </div>`;
      return;
    }

    // ── Step 2: Intervention names ────────────────────────────────
    const intvs = await gsSbFetch('intervention',
      `intervention_id=in.(${intvIds.join(',')})&select=intervention_id,intervention_name,intervention_code`);
    const intvById = {};
    (intvs||[]).forEach(iv => { intvById[iv.intervention_id] = iv; });

    // ── Step 3: ISTMs for those interventions ─────────────────────
    const istms = await gsSbFetch('intervention_stakeholder_type_map',
      `intervention_id=in.(${intvIds.join(',')})&is_active=eq.true` +
      `&select=intervention_stakeholder_type_map_id,intervention_id,stakeholder_type_id`);
    const istmList = istms||[];
    const istmIds  = istmList.map(m => m.intervention_stakeholder_type_map_id);

    if (!istmIds.length) {
      if (container) container.innerHTML = `
        <div style="padding:32px;text-align:center;color:var(--muted);">
          <div style="font-size:24px;margin-bottom:8px;">${IC.warning}</div>
          <div style="font-weight:600;margin-bottom:4px;">No stakeholder mappings found</div>
          <div style="font-size:12px;">Configure intervention × stakeholder mappings in LFA Setup first.</div>
        </div>`;
      return;
    }

    // ── Step 4: Stakeholder type names ────────────────────────────
    const stkTypeIds = [...new Set(istmList.map(m => m.stakeholder_type_id).filter(Boolean))];
    let stkById = {};
    if (stkTypeIds.length) {
      const stks = await gsSbFetch('stakeholder_type',
        `stakeholder_type_id=in.(${stkTypeIds.join(',')})&select=stakeholder_type_id,type_name`);
      (stks||[]).forEach(s => { stkById[s.stakeholder_type_id] = s.type_name; });
    }

    // ── Step 5: Outcomes by ISTM (IC-002) ────────────────────────
    //   SELECT * FROM outcome
    //   WHERE intervention_stakeholder_type_map_id IN (…) AND is_active = true
    const outcomes = await gsSbFetch('outcome',
      `intervention_stakeholder_type_map_id=in.(${istmIds.join(',')})&is_active=eq.true` +
      `&select=outcome_id,outcome_statement,outcome_code,outcome_category_id,intervention_stakeholder_type_map_id` +
      `&order=outcome_code.asc`);

    // ── Step 6: Activities by ISTM (IC-001) ───────────────────────
    //   SELECT * FROM activity
    //   WHERE intervention_stakeholder_type_map_id IN (…) AND is_active = true
    const activities = await gsSbFetch('activity',
      `intervention_stakeholder_type_map_id=in.(${istmIds.join(',')})&is_active=eq.true` +
      `&select=activity_id,activity_name,activity_code,activity_category_id,intervention_stakeholder_type_map_id` +
      `&order=activity_code.asc`);

    // ── Step 7a: Outcome indicators (IC-002) ──────────────────────
    //   SELECT i.*, ic.category_code FROM indicator i
    //   JOIN indicator_category ic ON ic.indicator_category_id = i.indicator_category_id
    //   WHERE i.outcome_id IN (…) AND i.activity_id IS NULL AND i.is_active = true
    const outcomeIds = (outcomes||[]).map(o => o.outcome_id);
    let outcomeInds = [];
    if (outcomeIds.length) {
      outcomeInds = await gsSbFetch('indicator',
        `outcome_id=in.(${outcomeIds.join(',')})&activity_id=is.null&is_active=eq.true` +
        `&select=indicator_id,indicator_name,indicator_code,unit_of_measure,frequency,baseline_value,direction,is_key_outcome,outcome_id,activity_id,intervention_stakeholder_type_map_id`) || [];
    }

    // ── Step 7b: Activity/Output indicators (IC-001) ──────────────
    //   SELECT i.* FROM indicator i
    //   WHERE i.activity_id IN (…) AND i.outcome_id IS NULL AND i.is_active = true
    const activityIds = (activities||[]).map(a => a.activity_id);
    let activityInds = [];
    if (activityIds.length) {
      activityInds = await gsSbFetch('indicator',
        `activity_id=in.(${activityIds.join(',')})&outcome_id=is.null&is_active=eq.true` +
        `&select=indicator_id,indicator_name,indicator_code,unit_of_measure,frequency,baseline_value,direction,is_key_outcome,outcome_id,activity_id,intervention_stakeholder_type_map_id`) || [];
    }

    // ── Build index maps ──────────────────────────────────────────
    const istmById = {};
    istmList.forEach(m => { istmById[m.intervention_stakeholder_type_map_id] = m; });

    // outcome_id → [indicators]
    const indsByOutcome  = {};
    outcomeInds.forEach(i => {
      const k = i.outcome_id;
      if (!indsByOutcome[k])  indsByOutcome[k]  = [];
      indsByOutcome[k].push(i);
    });

    // activity_id → [indicators]
    const indsByActivity = {};
    activityInds.forEach(i => {
      const k = i.activity_id;
      if (!indsByActivity[k]) indsByActivity[k] = [];
      indsByActivity[k].push(i);
    });

    // ── Build meb2Groups from DB data ─────────────────────────────
    const groups = [];

    // Helper: convert DB indicator row → meb2 indicator object
    const dbIndToRow = ind => ({
      id:           meb2NextId++,
      indicator_id: ind.indicator_id,  // keep DB ID for update path
      name:         ind.indicator_name || '',
      abbr:         ind.indicator_code || '',
      unit:         ind.unit_of_measure || 'count',
      freq:         ind.frequency || 'monthly',
      baseline:     ind.baseline_value != null ? String(ind.baseline_value) : '',
      targets:      {},
      active:       true,
      _fromDb:      true
    });

    // Outcome groups (IC-002)
    (outcomes||[]).forEach(oc => {
      const istm    = istmById[oc.intervention_stakeholder_type_map_id] || {};
      const intvId  = istm.intervention_id;
      const intv    = intvById[intvId] || {};
      const stkName = stkById[istm.stakeholder_type_id] || 'Stakeholder';
      const existingInds = (indsByOutcome[oc.outcome_id] || []).map(dbIndToRow);

      groups.push({
        id:         'g-db-oc-' + oc.outcome_id,
        _dbType:    'outcome',
        _dbId:      oc.outcome_id,
        _istmId:    oc.intervention_stakeholder_type_map_id,
        prog:       grantName,
        fy:         '2025-26',
        intv:       intv.intervention_name || ('Intervention ' + (intvId||'')),
        intvCode:   intv.intervention_code || '',
        env:        '', child: '',
        stk:        stkName,
        sourceType: 'outcome',
        sourceCode: oc.outcome_code || '',
        sourceStmt: oc.outcome_statement || '',
        sourceCat:  '',
        outcome:    oc.outcome_statement || '',
        indicators: existingInds.length ? existingInds : [meb2NewIndRow('')]
      });
    });

    // Activity groups (IC-001)
    (activities||[]).forEach(ac => {
      const istm    = istmById[ac.intervention_stakeholder_type_map_id] || {};
      const intvId  = istm.intervention_id;
      const intv    = intvById[intvId] || {};
      const stkName = stkById[istm.stakeholder_type_id] || 'Stakeholder';
      const existingInds = (indsByActivity[ac.activity_id] || []).map(dbIndToRow);

      groups.push({
        id:         'g-db-ac-' + ac.activity_id,
        _dbType:    'activity',
        _dbId:      ac.activity_id,
        _istmId:    ac.intervention_stakeholder_type_map_id,
        prog:       grantName,
        fy:         '2025-26',
        intv:       intv.intervention_name || ('Intervention ' + (intvId||'')),
        intvCode:   intv.intervention_code || '',
        env:        '', child: '',
        stk:        stkName,
        sourceType: 'activity',
        sourceCode: ac.activity_code || '',
        sourceStmt: ac.activity_name || '',
        sourceCat:  '',
        outcome:    '',
        indicators: existingInds.length ? existingInds : [meb2NewIndRow('')]
      });
    });

    meb2Groups = groups;
    meb2Prog   = grantName;

    if (!groups.length) {
      if (container) container.innerHTML = `
        <div style="padding:32px;text-align:center;color:var(--muted);">
          <div style="font-size:24px;margin-bottom:8px;">${IC.clipboard}</div>
          <div style="font-weight:600;margin-bottom:4px;">No outcomes or activities found</div>
          <div style="font-size:12px;">Add outcomes and activities in LFA Setup for this grant's interventions.</div>
        </div>`;
      return;
    }

    // Render the framework with loaded data
    meb2RenderFramework();
    toast(`${IC['check-circle']} Loaded ${groups.length} sources (${outcomeIds.length} outcomes · ${activityIds.length} activities)`);

  } catch(err) {
    console.error('[meb2LoadFromDB] Error:', err);
    if (container) container.innerHTML = `
      <div style="padding:32px;text-align:center;color:var(--danger);">
        <div style="font-size:24px;margin-bottom:8px;">${IC.x}</div>
        <div style="font-weight:600;margin-bottom:4px;">Failed to load from database</div>
        <div style="font-size:12px;color:var(--muted);">${esc(String(err?.message||err))}</div>
      </div>`;
    toast(IC.x + ' DB load failed — check console');
  }
}

// ═══════════════════════════════════════════════════════════════════
// ─── meb2PublishToDB — saves indicators to Supabase ──────────────
// ═══════════════════════════════════════════════════════════════════
async function meb2PublishToDB() {
  if (!meb2DbGrant) return false;
  await meb2EnsureCatIds();

  const catIdOutput  = meb2CatIds['IC-001'];
  const catIdOutcome = meb2CatIds['IC-002'];

  let saved = 0, updated = 0, errors = 0;
  const grantId = meb2DbGrant.grant_id;

  for (const g of meb2Groups) {
    const catId = g._dbType === 'activity' ? catIdOutput : catIdOutcome;

    for (const ind of g.indicators) {
      if (!ind.name && !ind.abbr) continue; // skip blank rows

      const payload = {
        indicator_name:                    ind.name || ind.abbr,
        unit_of_measure:                   ind.unit  || 'count',
        frequency:                         ind.freq  || 'monthly',
        baseline_value:                    ind.baseline != null && ind.baseline !== '' ? Number(ind.baseline) : null,
        direction:                         'increase',
        is_active:                         true,
        is_template:                       false,
        indicator_category_id:             catId || null,
        intervention_stakeholder_type_map_id: g._istmId || null,
        ...(g._dbType === 'outcome'   ? { outcome_id:  g._dbId, activity_id: null } : {}),
        ...(g._dbType === 'activity'  ? { activity_id: g._dbId, outcome_id:  null } : {}),
      };

      try {
        if (ind.indicator_id) {
          // UPDATE existing indicator
          await fetch(`${GS_SB_URL}/rest/v1/indicator?indicator_id=eq.${ind.indicator_id}`, {
            method: 'PATCH',
            headers: { ...GS_SB_HDR, 'Prefer': 'return=minimal' },
            body: JSON.stringify(payload)
          });
          updated++;
        } else {
          // INSERT new indicator — trigger generates indicator_code
          const res = await gsSbInsert('indicator', payload);
          if (res && res.indicator_id) ind.indicator_id = res.indicator_id;
          saved++;
        }
      } catch(e) {
        console.error('[meb2PublishToDB] Indicator save failed:', e, payload);
        errors++;
      }
    }
  }

  if (errors > 0) {
    toast(`${IC.warning} Saved ${saved} new + ${updated} updated, but ${errors} failed — check console`);
    return false;
  }
  toast(`${IC['check-circle']} Saved ${saved} new indicators, updated ${updated} · codes auto-assigned by DB`);
  return true;
}
// ────────────────────────────────────────────────────────────────

function doPublish() {
  const complete = builderRows.filter(r => r.active && r.name && (r.type || r.sourceType) && (r.stk || r.stakeholder));
  if (complete.length === 0) { toast(IC.warning + ' No complete active indicators to publish'); return false; }

  // Deep snapshot of rows + all reference dictionaries
  publishedFramework = {
    rows:    JSON.parse(JSON.stringify(complete)),
    refs:    JSON.parse(JSON.stringify(builderRefs)),
    ts:      new Date(),
    count:   complete.length,
    prog:    activeMEProgram,
  };
  if (activeMEProgram) publishedFrameworkByProg[activeMEProgram] = publishedFramework;

  // Mark builder as in sync
  updatePublishState();
  return true;
}

// Compares current builderRows/refs against snapshot to detect drift
function hasUnpublishedChanges() {
  if (!publishedFramework) return true;
  const curSig = JSON.stringify(builderRows.filter(r=>r.active&&r.name)) + JSON.stringify(builderRefs);
  const pubSig = JSON.stringify(publishedFramework.rows) + JSON.stringify(publishedFramework.refs);
  return curSig !== pubSig;
}

function updatePublishState() {
  const btn = $('builder-publish-btn');
  const badge = $('builder-publish-status');
  const draftBanner = $('draft-pending-banner');
  const dirty = hasUnpublishedChanges();

  if (btn) {
    btn.textContent = dirty ? 'Publish to Reporting' : 'Published';
    btn.style.opacity = dirty ? '1' : '.6';
  }
  if (badge) badge.textContent = publishedFramework
    ? (dirty ? `Last published: ${publishedFramework.ts.toLocaleTimeString()}` : `Published · ${publishedFramework.count} indicators`)
    : 'Not published yet';

  // Show/hide draft banner in reporting sheet
  if (draftBanner) draftBanner.classList.toggle('hidden', !dirty || !publishedFramework);
}

// Source for reporting: published snapshot rows for this program
function getReportingRows(program) {
  // Use the per-program snapshot — NOT the global pointer which only holds the last-opened program
  const pf = publishedFrameworkByProg[program] || null;
  if (!pf) return getSheetRowsForProgram(program); // fallback to live seed rows
  if (!reportingActuals[program]) reportingActuals[program] = {};
  const actuals = reportingActuals[program];
  return pf.rows
    .filter(r => r.prog === program)
    .map(r => {
      if (!actuals[r.id]) actuals[r.id] = { value:'', remarks:'', flagged:false, updated:'—', actualStatus:'draft' };
      const a = actuals[r.id];
      return { _id:r.id, indicator:r.name, abbr:r.abbr||'', type:r.type, stakeholder:r.stk, unit:r.unit,
               target:r.target, child:r.child, env:r.env, freq:r.freq, period:r.period,
               intv:r.intv, dir:r.dir, agg:r.agg, activity:r.activity, outcome:r.outcome,
               outcomeCategory:r.outcomeCategory||'', isKeyOutcome:r.isKeyOutcome, baseline:r.baseline,
               value:a.value, remarks:a.remarks, flagged:a.flagged, updated:a.updated,
               actualStatus: a.actualStatus || 'draft' };
    });
}

// Source for program select page programs list
function getPublishedPrograms() {
  // Collect every program that has its own published snapshot
  const publishedProgs = Object.keys(publishedFrameworkByProg);
  if (publishedProgs.length > 0) {
    return publishedProgs;
  }
  // Before any publish: fall back to live builder data so POC can preview
  return [...new Set(builderRows.filter(r=>r.active&&r.name&&r.prog).map(r=>r.prog))];
}

// ── Filter panel — built entirely from published refs ──────────────────
// Config: which builderRefs key → filter id / label / state key
const FILTER_CONFIG = [
  { id:'f-search',      key:null,            label:'Search indicator',    type:'text',    stateKey:'search',      placeholder:'e.g. Attendance, Training…' },
  { id:'f-intv',        key:'interventions', label:'Intervention',        type:'select',  stateKey:'intv',        all:'All Interventions' },
  { id:'f-ind-type',    key:'types',         label:'Indicator Type',      type:'select',  stateKey:'indType',     all:'All Types' },
  { id:'f-stakeholder', key:'stakeholders',  label:'Stakeholder',         type:'select',  stateKey:'stakeholder', all:'All Stakeholders' },
  { id:'f-env',         key:'environments',  label:'Environment',         type:'select',  stateKey:'env',         all:'All Environments' },
  { id:'f-child',       key:'childexp',      label:'Child Experience',    type:'select',  stateKey:'child',       all:'All' },
  { id:'f-activity',    key:'activities',    label:'Activity',            type:'select',  stateKey:'activity',    all:'All Activities' },
  { id:'f-outcome',     key:'outcomes',          label:'Outcome Statement',   type:'select',  stateKey:'outcome',     all:'All Outcomes' },
  { id:'f-outcomeCat',  key:'outcomeCategories', label:'Outcome Category',    type:'select',  stateKey:'outcomeCat',  all:'All Categories' },
  { id:'f-period',      key:'periods',           label:'Reporting Period',    type:'select',  stateKey:'period',      all:'All Periods' },
];

// Shows active filter pills above the table so the POC can see / clear what's applied
function updateActiveFilterChips() {
  const wrap = $('active-filter-chips');
  if (!wrap) return;
  wrap.innerHTML = '';
  const labelMap = {};
  FILTER_CONFIG.forEach(c => { if (c.key || c.type==='text') labelMap[c.stateKey] = c.label; });
  Object.entries(state.filters).forEach(([key, val]) => {
    if (!val) return;
    const chip = document.createElement('span');
    chip.style.cssText = 'display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:4px 9px;border-radius:999px;background:rgba(37,99,235,.1);border:1px solid rgba(37,99,235,.25);color:var(--blue);cursor:pointer;';
    chip.title = 'Click to clear';
    chip.innerHTML = `<span style="color:var(--muted);font-size:10px;">${esc(labelMap[key]||key)}:</span> ${esc(val)} <span style="font-size:10px;opacity:.6;">${IC.x}</span>`;
    chip.addEventListener('click', () => {
      state.filters[key] = '';
      // also clear the select/input DOM element
      const cfgEl = FILTER_CONFIG.find(c => c.stateKey === key);
      if (cfgEl) { const el = $(cfgEl.id); if (el) el.value = ''; }
      renderSheet();
      updateActiveFilterChips();
    });
    wrap.appendChild(chip);
  });
}

const MR_PERIOD_FREQ_RANK = { monthly: 0, quarterly: 1, annual: 2, unknown: 9 };
const MR_FISCAL_MONTH_INDEX = {
  apr: 0, april: 0,
  may: 1,
  jun: 2, june: 2,
  jul: 3, july: 3,
  aug: 4, august: 4,
  sep: 5, sept: 5, september: 5,
  oct: 6, october: 6,
  nov: 7, november: 7,
  dec: 8, december: 8,
  jan: 9, january: 9,
  feb: 10, february: 10,
  mar: 11, march: 11
};

function mrNormFreq(freq) {
  const f = String(freq || '').toLowerCase();
  if (f === 'monthly' || f === 'quarterly') return f;
  if (f === 'annual' || f === 'yearly') return 'annual';
  return '';
}

function mrToFullYear(yearText) {
  const y = parseInt(yearText, 10);
  if (Number.isNaN(y)) return 0;
  return String(yearText).length === 2 ? (2000 + y) : y;
}

function mrInferPeriodFreq(label) {
  const s = String(label || '').trim();
  if (!s) return 'unknown';
  if (/(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i.test(s)) return 'monthly';
  if (/\bq[1-4]\b/i.test(s) || /\bquarter\b/i.test(s)) return 'quarterly';
  if (/\bannual\b/i.test(s) || /\bfy\b/i.test(s) || /\byear\b/i.test(s)) return 'annual';
  return 'unknown';
}

function mrPeriodYear(label) {
  const s = String(label || '');
  const fy = s.match(/fy\s*'?\s*(\d{2,4})/i);
  if (fy) return mrToFullYear(fy[1]);
  const y4 = s.match(/\b(19\d{2}|20\d{2})\b/);
  if (y4) return parseInt(y4[1], 10);
  return 0;
}

function mrPeriodMonthIndex(label) {
  const s = String(label || '');
  const m = s.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i);
  if (!m) return 99;
  return MR_FISCAL_MONTH_INDEX[m[1].toLowerCase()] ?? 99;
}

function mrPeriodQuarterIndex(label) {
  const s = String(label || '');
  const q = s.match(/\bq([1-4])\b/i) || s.match(/\bquarter\s*([1-4])\b/i);
  if (!q) return 99;
  return (parseInt(q[1], 10) || 99) - 1;
}

function mrPeriodMeta(label, freqHint = '') {
  const txt = String(label || '').trim();
  const freq = mrNormFreq(freqHint) || mrInferPeriodFreq(txt);
  const rank = MR_PERIOD_FREQ_RANK[freq] ?? MR_PERIOD_FREQ_RANK.unknown;
  let slot = 99;
  if (freq === 'monthly') slot = mrPeriodMonthIndex(txt);
  else if (freq === 'quarterly') slot = mrPeriodQuarterIndex(txt);
  else if (freq === 'annual') slot = 0;
  return { rank, year: mrPeriodYear(txt), slot, txt: txt.toLowerCase() };
}

function mrComparePeriodLabels(a, b, freqA = '', freqB = '') {
  const A = mrPeriodMeta(a, freqA);
  const B = mrPeriodMeta(b, freqB);
  if (A.rank !== B.rank) return A.rank - B.rank;
  if (A.year !== B.year) return A.year - B.year;
  if (A.slot !== B.slot) return A.slot - B.slot;
  return A.txt.localeCompare(B.txt);
}

function populateSheetFilters(program) {
  const container = $('dynamic-filter-groups');
  if (!container) return;

  // Build refs from actual published rows for this program (covers LFA-sourced + seed)
  const pf = publishedFrameworkByProg[program];
  const progRows = pf ? pf.rows.filter(r => r.prog === program) : [];
  const selectedFreq = mrNormFreq($('freq-select')?.value || 'monthly');
  const freqRows = progRows.filter(r => mrNormFreq(r.freq || 'monthly') === selectedFreq);
  const rowsForPeriodOpts = freqRows.length ? freqRows : progRows;
  const periodFreqMap = {};
  rowsForPeriodOpts.forEach(r => {
    if (!r.period) return;
    periodFreqMap[r.period] = mrNormFreq(r.freq || selectedFreq);
  });
  const sortedTextValues = vals => [...vals].sort((a, b) => String(a).localeCompare(String(b)));
  const sortValues = (field, vals) => {
    if (field !== 'period') return sortedTextValues(vals);
    return [...vals].sort((a, b) => mrComparePeriodLabels(a, b, periodFreqMap[a], periodFreqMap[b]));
  };
  const uniq = field => {
    const rows = field === 'period' ? rowsForPeriodOpts : progRows;
    return sortValues(field, [...new Set(rows.map(r => r[field]).filter(Boolean))]);
  };
  const refs = {
    interventions: uniq('intv'), types: uniq('type'), stakeholders: uniq('stk'),
    environments: uniq('env'), childexp: uniq('child'), activities: uniq('activity'),
    outcomes: uniq('outcome'), outcomeCategories: uniq('outcomeCategory'),
    periods: uniq('period'), units: uniq('unit'),
  };

  // presentValues uses the same progRows (reporting rows include actual value + target fields)
  const presentValues = (field) => {
    const rows = field === 'period' ? rowsForPeriodOpts : progRows;
    return sortValues(field, [...new Set(rows.map(r => r[field]).filter(Boolean))]);
  };

  // Update source label — use the per-program snapshot, not the global pointer
  const lbl = $('filter-source-label');
  if (lbl) lbl.textContent = pf
    ? `Published ${pf.ts.toLocaleTimeString()} · ${pf.count} indicators`
    : IC.warning + ' Preview (not yet published)';

  container.innerHTML = '';

  FILTER_CONFIG.forEach(cfg => {
    const wrap = document.createElement('div');
    wrap.className = 'filter-group';

    if (cfg.type === 'text') {
      wrap.innerHTML = `<label>${esc(cfg.label)}</label>
        <input id="${cfg.id}" placeholder="${cfg.placeholder || ''}" value="${esc(state.filters[cfg.stateKey]||'')}" />`;
    } else {
      // Options: intersection of ref dictionary + what's actually used in this program's rows
      const refOpts = refs[cfg.key] || [];
      // Map stateKey → actual row field name
      const fieldMap = { indType:'type', intv:'intv', period:'period',
                         stakeholder:'stakeholder', env:'env', child:'child',
                         activity:'activity', outcome:'outcome' };
      const rowField = fieldMap[cfg.stateKey] || cfg.stateKey;
      const used = presentValues(rowField);
      // Show all ref options; mark (present) ones with a visual indicator
      const options = refOpts.map(v => {
        const isUsed = used.includes(v);
        return `<option value="${esc(v)}" ${state.filters[cfg.stateKey]===v?'selected':''} ${!isUsed?'style="color:var(--muted)"':''}>${esc(v)}${isUsed ? '' : ' ·'}</option>`;
      });
      // Also add any used values not in ref (edge case after ref deletion)
      used.filter(v => !refOpts.includes(v)).forEach(v => {
        options.push(`<option value="${esc(v)}" ${state.filters[cfg.stateKey]===v?'selected':''}>${esc(v)}</option>`);
      });

      wrap.innerHTML = `<label style="display:flex;align-items:center;justify-content:space-between;">
        <span>${esc(cfg.label)}</span>
        <span style="font-size:9px;color:var(--muted);font-weight:600;">${used.length} in use</span>
      </label>
      <select id="${cfg.id}">
        <option value="">${esc(cfg.all)}</option>
        ${options.join('')}
      </select>`;
    }
    container.appendChild(wrap);

    // Wire change/input immediately
    const el = wrap.querySelector(`#${cfg.id}`);
    if (!el) return;
    const ev = cfg.type === 'text' ? 'input' : 'change';
    el.addEventListener(ev, e => {
      state.filters[cfg.stateKey] = e.target.value;
      renderSheet();
      updateActiveFilterChips();
    });
  });

  updateActiveFilterChips();
}

function renderSheet() {
  const container = $('poc-sheet-body');
  const tabsEl    = $('poc-intv-tabs');
  if (!container || !tabsEl) return;

  const allRows = state.sheetRows;

  // ── Apply quick filters (search, missing, flagged, intv, stk) ──────────────
  // Frequency is controlled by top nav selector, not filter bar
  const searchQ  = ($('poc-search')?.value      || '').toLowerCase().trim();
  const selIntv  = $('poc-sheet-intv')?.value   || '';
  const selStk   = $('poc-sheet-stk')?.value    || '';
  const selFreq  = $('freq-select')?.value      || 'monthly';  // From top nav

  const rows = allRows.filter(r => {
    if (state.showMissing && r.value !== '') return false;
    if (state.showFlagged && !r.flagged)     return false;
    if (searchQ && !r.indicator.toLowerCase().includes(searchQ)) return false;
    if (selIntv && (r.intv||'General') !== selIntv) return false;
    if (selStk  && (r.stakeholder||'General') !== selStk) return false;
    // Filter by frequency from top nav
    if (selFreq && (r.freq||'monthly') !== selFreq) return false;
    return true;
  });

  // ── Populate Intervention dropdown from live row data ───────────────────
  const intvSel = $('poc-sheet-intv');
  const stkSel  = $('poc-sheet-stk');
  if (intvSel) {
    // Only show interventions that have indicators matching the selected frequency
    const freqFilteredRows = allRows.filter(r => (r.freq||'monthly') === selFreq);
    const intvs = [...new Set(freqFilteredRows.map(r => r.intv||'General').filter(Boolean))].sort();
    intvSel.innerHTML = '<option value="">All Interventions</option>' +
      intvs.map(v => `<option value="${esc(v)}"${selIntv===v?' selected':''}>${esc(v)}</option>`).join('');
    $('poc-sheet-intv-wrap')?.classList.toggle('active', selIntv !== '');
  }
  if (stkSel) {
    // Stakeholders filtered to those present in selected intervention (or all if none selected)
    const freqFilteredRows = allRows.filter(r => (r.freq||'monthly') === selFreq);
    const stkSource = selIntv
      ? freqFilteredRows.filter(r => (r.intv||'General') === selIntv)
      : freqFilteredRows;
    const stks = [...new Set(stkSource.map(r => r.stakeholder||'General').filter(Boolean))].sort();
    stkSel.innerHTML = '<option value="">All Stakeholders</option>' +
      stks.map(v => `<option value="${esc(v)}"${selStk===v?' selected':''}>${esc(v)}</option>`).join('');
    $('poc-sheet-stk-wrap')?.classList.toggle('active', selStk !== '');
  }

  // ── Empty state ──────────────────────────────────────────────────
  if (allRows.length === 0) {
    tabsEl.innerHTML = '';
    container.innerHTML = `<div class="poc-empty">
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      <h4>No indicators configured for ${esc(state.program)}</h4>
      <p style="font-size:13px;">Ask your M&amp;E Administrator to publish the framework for this program.</p>
    </div>`;
    updateSheetStats();
    return;
  }

  // ── Group: intv → stk → sourceType → source statement ──────────
  const catCls = cat => ({'Capacity Building':'cb','Structures & Process':'sp','Systemic Tools':'st','Training':'cb','Field Visit':'sp','Review & Planning':'st'})[cat]||'cb';
  const typeColors = { Output:'tp-output', Outcome:'tp-outcome', Process:'tp-process', Impact:'tp-impact' };

  const intvMap = {};
  allRows.forEach(r => {
    const intv = r.intv || 'General';
    const stk  = r.stakeholder || 'General';
    const sType = (r.type === 'Output' || r.type === 'Process') ? 'activity' : 'outcome';
    const srcKey = r.activity || r.outcome || r.indicator;
    if (!intvMap[intv]) intvMap[intv] = {};
    if (!intvMap[intv][stk]) intvMap[intv][stk] = { activity:{}, outcome:{} };
    if (!intvMap[intv][stk][sType][srcKey]) intvMap[intv][stk][sType][srcKey] = [];
    intvMap[intv][stk][sType][srcKey].push(r);
  });

  const intvNames = Object.keys(intvMap);

  // ── Intervention tabs ────────────────────────────────────────────
  const prevActiveIntv = tabsEl.querySelector('.poc-intv-tab.active')?.dataset.intv || intvNames[0];
  tabsEl.innerHTML = intvNames.map(name => {
    const total   = allRows.filter(r => (r.intv||'General') === name).length;
    const filled  = allRows.filter(r => (r.intv||'General') === name && r.value !== '').length;
    const missing = total - filled;
    return `<div class="poc-intv-tab${name===prevActiveIntv?' active':''}" data-intv="${esc(name)}"
      onclick="pocSelectIntv(this,'${esc(name)}')">
      <span class="poc-intv-tab-name">${esc(name)}</span>
      <span class="poc-intv-tab-meta">${filled}/${total} filled${missing>0?' · '+missing+' missing':''}</span>
    </div>`;
  }).join('');

  const activeIntv = prevActiveIntv;

  // ── Col header template ──────────────────────────────────────────
  const colHeader = `<div class="poc-col-header">
    <div class="poc-col-hd">Indicator</div>
    <div class="poc-col-hd">Freq</div>
    <div class="poc-col-hd">Unit</div>
    <div class="poc-col-hd">Dir</div>
    <div class="poc-col-hd">Baseline</div>
    <div class="poc-col-hd">Target</div>
    <div class="poc-col-hd editable">Achieved Value</div>
    <div class="poc-col-hd editable">Remarks</div>
    <div class="poc-col-hd">Status</div>
    <div class="poc-col-hd">Updated / Action</div>
  </div>`;

  // ── Render intervention blocks ───────────────────────────────────
  container.innerHTML = '';
  intvNames.forEach(intvName => {
    const stkMap = intvMap[intvName];
    const block  = document.createElement('div');
    block.className = 'poc-intv-block' + (intvName===activeIntv?' active':'');
    block.dataset.intv = intvName;

    Object.entries(stkMap).forEach(([stkName, types]) => {
      // Filter rows in this stk section that match current search/filters
      const stkAllRows = [...Object.values(types.activity), ...Object.values(types.outcome)].flat();
      const stkRows = stkAllRows.filter(r => rows.includes(r));
      if (searchQ && stkRows.length === 0) return; // hide empty stk sections when searching

      const stkTotal  = stkAllRows.length;
      const stkFilled = stkAllRows.filter(r => r.value !== '').length;
      const stkMissing = stkTotal - stkFilled;

      const stkSec = document.createElement('div');
      stkSec.className = 'poc-stk-section open';
      const stkSafeId = 'poc-stk-' + (intvName+'-'+stkName).replace(/[^a-z0-9]/gi,'-').toLowerCase();
      stkSec.id = stkSafeId;

      stkSec.innerHTML = `<div class="poc-stk-hd" onclick="this.closest('.poc-stk-section').classList.toggle('open')">
        <span class="poc-stk-pill">${esc(stkName)}</span>
        <span class="poc-stk-meta">${stkFilled}/${stkTotal} filled${stkMissing>0?' · <span style="color:var(--warn);font-weight:600;">'+stkMissing+' missing</span>':''}</span>
        <span class="poc-stk-chev">${IC['chevron-down']}</span>
      </div>`;

      const body = document.createElement('div');
      body.className = 'poc-stk-body';

      // Build filter function once per stk section — used by makePocSrcBlock
      const filterFn = r => {
        if (state.showMissing && r.value !== '') return false;
        if (state.showFlagged && !r.flagged)     return false;
        if (searchQ && !r.indicator.toLowerCase().includes(searchQ)) return false;
        if (selFreq && (r.freq||'monthly') !== selFreq) return false;
        return true;
      };

      // Activities → Output
      const actEntries = Object.entries(types.activity);
      if (actEntries.length > 0) {
        const typeHd = document.createElement('div');
        typeHd.className = 'poc-type-hd';
        typeHd.innerHTML = `<span class="poc-type-lbl output">Activities ${IC['arrow-right']} Output indicators</span>
          <span style="font-size:10px;color:var(--slate);margin-left:8px;">${actEntries.length} activit${actEntries.length!==1?'ies':'y'}</span>`;
        body.appendChild(typeHd);
        actEntries.forEach(([srcStmt, srcRows]) => {
          body.appendChild(makePocSrcBlock(srcStmt, srcRows, 'activity', catCls, colHeader, filterFn));
        });
      }

      // Outcomes → Outcome
      const ocEntries = Object.entries(types.outcome);
      if (ocEntries.length > 0) {
        const typeHd = document.createElement('div');
        typeHd.className = 'poc-type-hd';
        typeHd.innerHTML = `<span class="poc-type-lbl outcome">Outcomes ${IC['arrow-right']} Outcome indicators</span>
          <span style="font-size:10px;color:var(--slate);margin-left:8px;">${ocEntries.length} outcome${ocEntries.length!==1?'s':''}</span>`;
        body.appendChild(typeHd);
        ocEntries.forEach(([srcStmt, srcRows]) => {
          body.appendChild(makePocSrcBlock(srcStmt, srcRows, 'outcome', catCls, colHeader, filterFn));
        });
      }

      stkSec.appendChild(body);
      block.appendChild(stkSec);
    });

    container.appendChild(block);
  });

  // ── Wire all inputs in the new layout ────────────────────────────
  qsa('.poc-cell input.cell-input', container).forEach(inp => {
    inp.addEventListener('input', e => {
      const rid   = +e.target.dataset.rid;
      const field = e.target.dataset.field;
      saveActual(state.program, rid, field, e.target.value);
      $('sheet-status').textContent = 'Draft • autosave on';
      updateSheetStats();
      // live-update status badge in same row
      if (field === 'value') {
        const row   = e.target.closest('.poc-ind-row');
        const badge = row?.querySelector('.poc-status-badge');
        if (badge) {
          const empty = e.target.value === '';
          badge.className = `badge ${empty ? 'badge-danger' : 'badge-ok'} poc-status-badge`;
          badge.textContent = empty ? 'Missing' : 'Draft';
          row.classList.toggle('is-missing', empty);
        }
      }
    });
  });

  // Admin approve / reject buttons
  qsa('[data-approve]', container).forEach(btn => {
    btn.addEventListener('click', () => {
      const rid = +btn.dataset.approve;
      if (reportingActuals[state.program]?.[rid]) {
        reportingActuals[state.program][rid].actualStatus = 'approved';
        reportingActuals[state.program][rid].updated = 'Approved now';
      }
      renderSheet();
      toast('Indicator approved — row locked');
    });
  });
  qsa('[data-reject]', container).forEach(btn => {
    btn.addEventListener('click', () => {
      const rid = +btn.dataset.reject;
      if (reportingActuals[state.program]?.[rid]) {
        reportingActuals[state.program][rid].actualStatus = 'rejected';
        reportingActuals[state.program][rid].updated = 'Rejected — POC to revise';
      }
      renderSheet();
      toast('Indicator rejected — POC can revise');
    });
  });

  updateSheetStats();
}

// ── Helper: build one source block with its indicator rows ──────────
function makePocSrcBlock(srcStmt, srcRows, sourceType, catCls, colHeader, filterFn) {
  const srcBlock = document.createElement('div');
  srcBlock.className = 'poc-src-block';

  // pick category from first row
  const firstR = srcRows[0] || {};
  const cat    = firstR.outcomeCategory || '';
  const cc     = catCls(cat);
  const catBadge = cat ? `<span class="poc-src-cat ${cc}">${esc(cat)}</span>` : '';

  srcBlock.innerHTML = `<div class="poc-src-hd" onclick="this.closest('.poc-src-block').classList.toggle('collapsed')">
    <span class="poc-src-stmt">${esc(srcStmt)}</span>
    ${catBadge}
    <span class="poc-src-chev">${IC['chevron-down']}</span>
  </div>
  <div class="poc-src-body">${colHeader}</div>`;

  const body = srcBlock.querySelector('.poc-src-body');
  let visibleCount = 0;

  srcRows.forEach(r => {
    const rid        = r._id;
    const aStatus    = r.actualStatus || 'draft';
    const isLocked   = state.submitted || aStatus === 'approved';
    const hasMissing = r.value === '';
    const show       = filterFn(r);
    if (show) visibleCount++;

    let statusCls, statusTxt;
    if (aStatus === 'approved')       { statusCls = 'badge-ok';     statusTxt = 'Approved'; }
    else if (aStatus === 'rejected')  { statusCls = 'badge-danger'; statusTxt = 'Rejected'; }
    else if (aStatus === 'submitted') { statusCls = 'badge-warn';   statusTxt = 'Submitted'; }
    else if (r.flagged)               { statusCls = 'badge-warn';   statusTxt = 'Flagged'; }
    else if (hasMissing)              { statusCls = 'badge-danger'; statusTxt = 'Missing'; }
    else                              { statusCls = 'badge-ok';     statusTxt = 'Draft'; }

    const dirSymbol = r.dir ? ({increase:'↑', decrease:'↓', neutral:'→'}[r.dir]||'') : '—';

    const row = document.createElement('div');
    row.className = `poc-ind-row${hasMissing && aStatus==='draft' ? ' is-missing' : ''}${aStatus==='approved' ? ' is-approved' : ''}`;
    row.dataset.rid = rid;
    row.style.display = show ? '' : 'none';

    row.innerHTML = `
      <div class="poc-cell">
        <div class="poc-ind-name">${esc(r.indicator)}</div>
        ${r.abbr ? `<div class="poc-ind-abbr">${esc(r.abbr)}</div>` : ''}
      </div>
      <div class="poc-cell ref">${esc(r.freq||'—')}</div>
      <div class="poc-cell mono">${esc(r.unit||'—')}</div>
      <div class="poc-cell ref">${dirSymbol}</div>
      <div class="poc-cell mono">${esc(r.baseline||'—')}</div>
      <div class="poc-cell target">${esc(r.target||'—')}</div>
      <div class="poc-cell">
        <input class="cell-input" data-rid="${rid}" data-field="value"
          value="${esc(r.value)}" placeholder="Enter achieved…" ${isLocked?'disabled':''} />
      </div>
      <div class="poc-cell">
        <input class="cell-input" data-rid="${rid}" data-field="remarks"
          value="${esc(r.remarks)}" placeholder="Add remark…" ${isLocked?'disabled':''} />
      </div>
      <div class="poc-cell">
        <span class="badge ${statusCls} poc-status-badge" style="font-size:11px;">${statusTxt}</span>
      </div>
      <div class="poc-cell" style="font-size:11px;">
        ${state.role === 'admin' && aStatus === 'submitted'
          ? `<div style="display:flex;gap:4px;flex-wrap:wrap;">
               <button class="btn btn-ok" style="font-size:10px;padding:3px 7px;" data-approve="${rid}">Approve</button>
               <button class="btn btn-danger" style="font-size:10px;padding:3px 7px;" data-reject="${rid}">Reject</button>
             </div>`
          : `<span style="color:var(--slate);">${esc(r.updated)}</span>`}
      </div>`;
    body.appendChild(row);
  });

  // Hide the entire src block if no rows are visible after filtering
  if (visibleCount === 0) srcBlock.style.display = 'none';
  return srcBlock;
}

// ── Intervention tab switcher for POC sheet ──────────────────────────
function pocSelectIntv(tabEl, intvName) {
  document.querySelectorAll('.poc-intv-tab').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');
  document.querySelectorAll('.poc-intv-block').forEach(b =>
    b.classList.toggle('active', b.dataset.intv === intvName)
  );
}

function updateSheetStats() {
  const s = computeStats();
  const pct = s.total > 0 ? Math.round(s.filled / s.total * 100) : 0;
  if($('stat-filled')) $('stat-filled').textContent = `${s.filled} / ${s.total}`;
  if($('stat-missing')) $('stat-missing').textContent = s.missing;
  if($('stat-pct')) $('stat-pct').textContent = pct + '%';
  if($('m-completed')) $('m-completed').textContent = s.filled;
  if($('m-missing')) $('m-missing').textContent = s.missing;
  if($('m-flags')) $('m-flags').textContent = s.flags;
  if($('m-program')) $('m-program').textContent = state.program || '—';
  if($('m-month')) $('m-month').textContent = state.month;
}

// ═══════════════════════════════════════════════════
// PROGRAM SELECT — driven by M&E Builder data
// ═══════════════════════════════════════════════════
const programMeta = {};

function renderProgramSelect() {
  // Aggregate rows across ALL per-program published snapshots (not the single global pointer)
  const publishedProgs = Object.keys(publishedFrameworkByProg);
  const isPublished = publishedProgs.length > 0;
  const allPublishedRows = isPublished
    ? publishedProgs.flatMap(p => publishedFrameworkByProg[p].rows)
    : [];
  const srcRows = isPublished ? allPublishedRows : builderRows.filter(r => r.active && r.name);

  const totalInd  = srcRows.length;
  const programs  = getPublishedPrograms();
  const typeCounts = {};
  srcRows.forEach(r => { typeCounts[r.type] = (typeCounts[r.type]||0)+1; });

  // Framework info banner
  const summary = $('framework-summary');
  if (summary) {
    if (isPublished) {
      summary.textContent = `${totalInd} indicators across ${programs.length} program${programs.length!==1?'s':''} published`;
      summary.style.color = '';
    } else {
      summary.innerHTML = `${IC.warning} Framework not yet published — showing live builder preview (${totalInd} indicators)`;
      summary.style.color = 'var(--warn)';
    }
  }

  const typeBadges = $('framework-type-badges');
  if (typeBadges) {
    const typeColors = { Output:'tp-output', Outcome:'tp-outcome', Process:'tp-process', Impact:'tp-impact' };
    typeBadges.innerHTML = Object.entries(typeCounts)
      .map(([t, n]) => `<span class="type-pill ${typeColors[t]||''}" style="font-size:10px;">${n} ${esc(t)}</span>`)
      .join('');
  }

  const sub = $('data-entry-sub');
  if (sub) sub.textContent = `Select a program to submit indicator data for ${state.month}`;

  const grid = $('prog-grid-container');
  if (!grid) return;
  grid.innerHTML = '';

  if (programs.length === 0) {
    grid.innerHTML = `<div class="card" style="grid-column:1/-1;text-align:center;padding:40px;">
      <div style="font-size:32px;margin-bottom:10px;color:var(--slate-2);"><svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></div>
      <div style="font-weight:700;color:var(--text2);margin-bottom:6px;">No programs configured yet</div>
      <div style="font-size:12px;color:var(--muted);">Ask your M&amp;E Administrator to add programs and indicators in the M&amp;E Builder, then click Publish.</div>
    </div>`;
    renderProgramKPIs(programs);
    return;
  }

  programs.forEach(prog => {
    const stats = getProgramStats(prog);
    const meta  = programMeta[prog] || { state:'India', schools:0 };
    const pct   = stats.pct;
    const colorCls = pct >= 100 ? 'ok' : pct >= 70 ? 'warn' : 'danger';
    const barColor  = pct >= 100 ? 'var(--ok)' : pct >= 70 ? 'var(--warn)' : 'var(--danger)';

    const card = document.createElement('div');
    card.className = `prog-card ${colorCls}`;
    card.dataset.program = prog;
    card.innerHTML = `
      <div class="pc-name">${esc(prog)}</div>
      <div class="pc-state">${esc(meta.state)} Program</div>
      <div class="pc-pct ${colorCls}">${pct}%</div>
      <div class="pc-meta">${stats.filled} / ${stats.total} indicators filled</div>
      <div class="prog-bar"><div class="prog-bar-fill" style="width:${pct}%;background:${barColor};"></div></div>
      <div class="schools-badge"><strong>${(meta.schools||0).toLocaleString()}</strong> schools &nbsp;·&nbsp; ${stats.missing} missing</div>
    `;
    card.addEventListener('click', () => {
      state.program = prog;
      state.programSchools = meta.schools || 0;
      state.submitted = false;
      showPage('data-entry-sheet');
    });
    grid.appendChild(card);
  });

  renderProgramKPIs(programs);

  // Populate & wire the Intervention + Stakeholder filter dropdowns
  populatePocProgFilters();
}

function renderProgramKPIs(programs) {
  const kpiRow = $('program-select-kpis');
  if (!kpiRow) return;
  const total   = programs.length;
  const complete= programs.filter(p => getProgramStats(p).pct >= 100).length;
  const inProg  = programs.filter(p => { const pct=getProgramStats(p).pct; return pct>0&&pct<100; }).length;
  const notStart= programs.filter(p => getProgramStats(p).pct === 0).length;
  kpiRow.innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Programs</div><div class="kpi-value accent">${total}</div><div class="kpi-sub">From M&amp;E Framework</div></div>
    <div class="kpi-card"><div class="kpi-label">Fully Submitted</div><div class="kpi-value ok">${complete}</div><div class="kpi-sub">100% complete</div></div>
    <div class="kpi-card"><div class="kpi-label">In Progress</div><div class="kpi-value warn">${inProg}</div><div class="kpi-sub">Partial submission</div></div>
    <div class="kpi-card"><div class="kpi-label">Not Started</div><div class="kpi-value danger">${notStart}</div><div class="kpi-sub">No data entered yet</div></div>
  `;
}

// ── Intervention + Stakeholder filter bar for the program selector page ──────
// Populates from published rows if available, else falls back to builderRefs (dummy data).
// Filters prog-card visibility only — card click handler, state.program, and all
// downstream logic are completely untouched.
function populatePocProgFilters() {
  const intvSel = $('poc-prog-intv-filter');
  const stkSel  = $('poc-prog-stk-filter');
  if (!intvSel || !stkSel) return;

  // Source: published rows if any program has been published, else builderRefs fallback
  const publishedProgs = Object.keys(publishedFrameworkByProg);
  const allPubRows = publishedProgs.flatMap(p => publishedFrameworkByProg[p].rows);

  const intvs = allPubRows.length > 0
    ? [...new Set(allPubRows.map(r => r.intv).filter(Boolean))].sort()
    : [...builderRefs.interventions].sort();

  const stks = allPubRows.length > 0
    ? [...new Set(allPubRows.map(r => r.stk || r.stakeholder).filter(Boolean))].sort()
    : [...builderRefs.stakeholders].sort();

  // Preserve current selections across re-renders
  const curIntv = intvSel.value;
  const curStk  = stkSel.value;

  intvSel.innerHTML = '<option value="">All Interventions</option>' +
    intvs.map(v => `<option value="${esc(v)}" ${curIntv===v?'selected':''}>${esc(v)}</option>`).join('');

  stkSel.innerHTML = '<option value="">All Stakeholders</option>' +
    stks.map(v => `<option value="${esc(v)}" ${curStk===v?'selected':''}>${esc(v)}</option>`).join('');

  _applyPocProgFilter();
}

function _applyPocProgFilter() {
  const intvSel = $('poc-prog-intv-filter');
  const stkSel  = $('poc-prog-stk-filter');
  const bar     = $('poc-prog-filter-bar');
  const countEl = $('poc-prog-filter-count');
  if (!intvSel || !stkSel || !bar) return;

  const selIntv = intvSel.value;
  const selStk  = stkSel.value;
  const isFiltered = selIntv !== '' || selStk !== '';

  // Update active-filter visual state
  bar.classList.toggle('filtered', isFiltered);
  $('poc-intv-wrap')?.classList.toggle('has-filter', selIntv !== '');
  $('poc-stk-wrap')?.classList.toggle('has-filter',  selStk  !== '');

  // Filter program cards by checking if that program has rows matching both selections
  const publishedProgs = Object.keys(publishedFrameworkByProg);
  const allPubRows = publishedProgs.flatMap(p => publishedFrameworkByProg[p].rows);

  let visibleCount = 0;
  qsa('.prog-card', $('prog-grid-container')).forEach(card => {
    const prog = card.dataset.program;
    let show = true;

    if (isFiltered && allPubRows.length > 0) {
      // Filter against published rows for this program
      const progRows = allPubRows.filter(r => r.prog === prog);
      const matchIntv = !selIntv || progRows.some(r => r.intv === selIntv);
      const matchStk  = !selStk  || progRows.some(r => (r.stk || r.stakeholder) === selStk);
      show = matchIntv && matchStk;
    }
    // If no published rows yet, show all cards regardless (dummy data in dropdowns)

    card.style.display = show ? '' : 'none';
    if (show) visibleCount++;
  });

  if (countEl) {
    const total = qsa('.prog-card', $('prog-grid-container')).length;
    countEl.textContent = isFiltered
      ? `${visibleCount} of ${total} programs`
      : `${total} programs`;
  }
}


const builderRefs = {
  types:        ['Output','Outcome','Process','Impact'],
  stakeholders: ['Teacher','Student','Leader','Community','Cluster Resource Coordinator','Block Education Officer','Academic Mentor','Training Facilitator','District Coordinator','Parent'],
  environments: ['School','Cluster','Block','District','State'],
  childexp:     ['Classroom Engagement','Foundational Literacy','Numeracy','Social-Emotional Learning','STEM Exploration','Holistic Development'],
  activities:   ['Capacity Building','Workshop','MIP','Review','Observation Visit','Mentoring Session','Assessment','Parent Engagement','Data Review','Peer Learning Circle'],
  outcomes:     [
    'Teachers demonstrate improved instructional practices',
    'Students show improvement in foundational literacy',
    'Students show improvement in foundational numeracy',
    'School leaders demonstrate stronger management practices',
    'Communities actively participate in school governance',
    'Attendance rates improve across target schools',
    'Students exhibit stronger social-emotional competencies',
    'Block officials use data for academic planning',
    'Cluster coordinators provide effective peer support',
    'Parents demonstrate increased school engagement',
    'STEM participation increases among students',
    'Assessment practices become more learner-centric',
  ],
  programs:     ['Bihar','Karnataka','Uttar Pradesh','Odisha','Punjab','Rajasthan','Madhya Pradesh','Jharkhand','Assam','Maharashtra'],
  interventions:['FLN Program','Teacher Development','School Leadership','Community Engagement','District Capacity Building','Cluster Support','STEM Initiative','Assessment Reform'],
  periods:      ['Oct 2025','Nov 2025','Dec 2025','Jan 2026','Feb 2026','Mar 2026','Apr 2026','Q1 FY26','Q2 FY26'],
  units:        ['count','percentage','percentage_point','ratio','yes_no'],
  outcomeCategories: ['Capacity Building','Systemic Tools','Structures & Process'],
  outcomeCategoryMeta: {
    'Capacity Building':   { code: 'CAP_BUILD', sort: 0 },
    'Systemic Tools':      { code: 'SYS_TOOLS', sort: 1 },
    'Structures & Process':{ code: 'STR_PROC',  sort: 2 },
  },
  stakeholderLevels: ['school','cluster','block','district','state'],
};

const _allSeedRows = [];
// Split seed rows into per-program buckets
const builderRowsByProg = {};
_allSeedRows.forEach(r => {
  if (!builderRowsByProg[r.prog]) builderRowsByProg[r.prog] = [];
  builderRowsByProg[r.prog].push(r);
});
let builderRows = [];           // active pointer — set when program opened
let activeMEProgram = null;     // which program is open
const publishedFrameworkByProg = {};  // per-program publish snapshots
let builderNextId = 46;
let builderSelectedIds = new Set();
let builderSearchQ = '';
let builderFilterType = '';
let builderFilterProg = '';
let builderFilterIntv = '';
let builderFilterStatus = '';
let builderFilterFY = '2025-26';

// ── completeness ─────────────────────────
function rowCompleteness(row) {
  const required = ['name','type','stk'];
  const optional = ['prog','intv','env','child','activity','outcome','unit','freq','period','target'];
  const reqFilled = required.every(k => row[k] && row[k].trim() !== '');
  const optFilled = optional.filter(k => row[k] && row[k].trim() !== '').length;
  if (!reqFilled) return 'partial';
  if (reqFilled && optFilled === 0) return 'partial';
  if (reqFilled && optFilled < optional.length * 0.5) return 'partial';
  return 'complete';
}

function rowMatchesBuilder(row) {
  if (builderFilterFY && row.fy && row.fy !== builderFilterFY) return false;
  if (builderSearchQ && !row.name.toLowerCase().includes(builderSearchQ.toLowerCase())) return false;
  if (builderFilterType && row.type !== builderFilterType) return false;
  if (builderFilterProg && row.prog !== builderFilterProg) return false;
  if (builderFilterIntv && row.intv !== builderFilterIntv) return false;
  if (builderFilterStatus) {
    const c = rowCompleteness(row);
    const isEmpty = !row.name && !row.type && !row.stk;
    if (builderFilterStatus === 'complete' && c !== 'complete') return false;
    if (builderFilterStatus === 'partial' && c !== 'partial') return false;
    if (builderFilterStatus === 'empty' && !isEmpty) return false;
  }
  return true;
}

// ── Reference panel ───────────────────────
function renderRefPanel() {
  Object.keys(builderRefs).forEach(key => {
    const wrap = $(`rchips-${key}`);
    const countEl = $(`rc-${key}`);
    if (!wrap) return;
    wrap.innerHTML = '';
    const items = builderRefs[key];
    if (countEl) countEl.textContent = items.length;

    items.forEach((val, i) => {
      const typeCls = key==='types' ? `type-${val.toLowerCase()}` : '';
      const chip = document.createElement('div');
      chip.className = `ref-chip ${typeCls}`;
      // For outcomeCategories: show code badge alongside name
      let label = esc(val);
      if (key === 'outcomeCategories') {
        const meta = (builderRefs.outcomeCategoryMeta||{})[val];
        if (meta) label += ` <span style="font-size:9px;font-family:var(--mono);background:rgba(110,231,255,.12);border:1px solid rgba(110,231,255,.2);border-radius:4px;padding:1px 4px;color:var(--blue);margin-left:4px;">${esc(meta.code)}</span><span style="font-size:9px;color:var(--muted);margin-left:4px;">#${meta.sort}</span>`;
      }
      chip.innerHTML = `<span>${label}</span><button class="del-chip" title="Remove" data-refkey="${key}" data-idx="${i}"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>`;
      wrap.appendChild(chip);
    });

    // del handlers
    wrap.querySelectorAll('.del-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.refkey;
        const idx = +btn.dataset.idx;
        builderRefs[k].splice(idx,1);
        renderRefPanel();
        refreshBuilderSelects();
        toast(`Removed from ${k}`);
      });
    });
  });

  // populate intervention filter
  const fintv = $('builder-filter-intv');
  if (fintv) {
    const cur = fintv.value;
    fintv.innerHTML = '<option value="">All Interventions</option>' + builderRefs.interventions.map(v=>`<option ${v===cur?'selected':''}>${esc(v)}</option>`).join('');
  }

  // populate bulk selects
  const bstk = $('bulk-stk');
  if(bstk) bstk.innerHTML = '<option value="">Stakeholder…</option>' + builderRefs.stakeholders.map(s=>`<option>${esc(s)}</option>`).join('');
  const bperiod = $('bulk-period');
  if(bperiod) bperiod.innerHTML = '<option value="">Period…</option>' + builderRefs.periods.map(p=>`<option>${esc(p)}</option>`).join('');
}

function refreshBuilderSelects() {
  renderBuilderTable();
  updatePublishState(); // ref changes = unpublished drift
}

// ── Section accordion ─────────────────────
// Event delegation on parent — safe to call multiple times, no duplicate listeners
function initRefAccordion() {
  const panel = $('ref-panel');
  if (!panel || panel._accordionReady) return;
  panel._accordionReady = true;
  panel.addEventListener('click', e => {
    const hd = e.target.closest('.ref-section-hd');
    if (!hd) return;
    const sec = hd.closest('.ref-section');
    const isOpen = sec.classList.contains('open');
    qsa('.ref-section').forEach(s => s.classList.remove('open'));
    if (!isOpen) {
      sec.classList.add('open');
      setTimeout(() => sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    }
  });
}

// ── Add ref value ──────────────────────────
// Event delegation on parent — safe to call multiple times, no duplicate listeners
function initRefAdds() {
  const panel = $('ref-panel');
  if (!panel || panel._addsReady) return;
  panel._addsReady = true;
  // + button click
  panel.addEventListener('click', e => {
    const btn = e.target.closest('[data-addto]');
    if (!btn) return;
    const key = btn.dataset.addto;

    // ── Special: programs needs alias + type ─────────────────────────
    if (key === 'programs') {
      const nameInp  = $('radd-programs');
      const aliasInp = $('radd-programAlias');
      const typeInp  = $('radd-programType');
      const name = nameInp?.value.trim();
      const alias = aliasInp?.value.trim();
      const pType = typeInp?.value || 'state';
      if (!name) { toast(IC.warning + ' Program name required'); return; }
      if (builderRefs.programs.includes(name)) { toast('Already exists'); return; }
      builderRefs.programs.push(name);
      if (!builderRefs.programMeta) builderRefs.programMeta = {};
      builderRefs.programMeta[name] = { alias, program_type: pType };
      if (nameInp) nameInp.value = '';
      if (aliasInp) aliasInp.value = '';
      renderRefPanel();
      refreshBuilderSelects();
      toast(`Added program "${name}" (${pType}${alias ? ', alias: '+alias : ''})`);
      return;
    }

    // ── Special: periods needs type + start + end dates ───────────────
    if (key === 'periods') {
      const nameInp  = $('radd-periods');
      const typeInp  = $('radd-periodType');
      const startInp = $('radd-periodStart');
      const endInp   = $('radd-periodEnd');
      const name  = nameInp?.value.trim();
      const pType = typeInp?.value || 'monthly';
      const start = startInp?.value;
      const end   = endInp?.value;
      if (!name) { toast(IC.warning + ' Period name required'); return; }
      if (!start || !end) { toast(IC.warning + ' start_date and end_date are required DB fields'); return; }
      if (builderRefs.periods.includes(name)) { toast('Already exists'); return; }
      builderRefs.periods.push(name);
      if (!builderRefs.periodMeta) builderRefs.periodMeta = {};
      builderRefs.periodMeta[name] = { period_type: pType, start_date: start, end_date: end };
      if (nameInp) nameInp.value = '';
      if (startInp) startInp.value = '';
      if (endInp) endInp.value = '';
      renderRefPanel();
      refreshBuilderSelects();
      toast(`Added period "${name}" (${pType}: ${start} → ${end})`);
      return;
    }

    // ── Special: outcomeCategories needs code + sort ──────────────────
    if (key === 'outcomeCategories') {
      const nameInp = $('radd-outcomeCategories');
      const codeInp = $('radd-outcomeCategoryCode');
      const sortInp = $('radd-outcomeCategorySort');
      const name = nameInp?.value.trim();
      const code = codeInp?.value.trim().toUpperCase().replace(/\s+/g,'_');
      const sort = parseInt(sortInp?.value || '0', 10);
      if (!name) { toast(IC.warning + ' Category name is required'); return; }
      if (!code) { toast(IC.warning + ' category_code is required (NOT NULL UNIQUE in DB)'); codeInp?.focus(); return; }
      if (builderRefs.outcomeCategories.includes(name)) { toast('Already exists'); return; }
      if (Object.values(builderRefs.outcomeCategoryMeta||{}).some(m => m.code === code)) { toast(IC.warning + ' Code already in use'); return; }
      builderRefs.outcomeCategories.push(name);
      if (!builderRefs.outcomeCategoryMeta) builderRefs.outcomeCategoryMeta = {};
      builderRefs.outcomeCategoryMeta[name] = { code, sort };
      if (nameInp) nameInp.value = '';
      if (codeInp) codeInp.value = '';
      if (sortInp) sortInp.value = '';
      renderRefPanel();
      refreshBuilderSelects();
      toast(`Added "${name}" (code: ${code})`);
      return;
    }

    const inp = $(`radd-${key}`);
    const val = inp?.value.trim();
    if (!val) return;
    if (builderRefs[key].includes(val)) { toast('Already exists'); return; }
    builderRefs[key].push(val);
    inp.value = '';
    renderRefPanel();
    refreshBuilderSelects();
    toast(`Added "${val}" to ${key}`);
  });
  // Enter key in any add-input
  panel.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const inp = e.target.closest('.ref-add-input');
    if (!inp) return;
    const btn = inp.closest('.ref-add-row')?.querySelector('[data-addto]');
    if (btn) btn.click();
  });
}

// ── Build select options ───────────────────
function opts(arr, selected='', empty='— select —') {
  return `<option value="">${empty}</option>` + arr.map(v => `<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join('');
}

function typePillHtml(type) {
  if (!type) return '';
  const cls = { Output:'tp-output', Outcome:'tp-outcome', Process:'tp-process', Impact:'tp-impact' }[type] || '';
  return `<span class="type-pill ${cls}">${esc(type)}</span>`;
}

// ── Stats bar ─────────────────────────────
function updateBuilderStats() {
  const rows = builderRows;
  const total = rows.length;
  const cnt = t => rows.filter(r => r.type===t).length;
  const o=cnt('Output'), oc=cnt('Outcome'), pr=cnt('Process'), im=cnt('Impact');
  $('bhs-total').textContent = total;
  $('bhs-output').textContent = o;
  $('bhs-outcome').textContent = oc;
  $('bhs-process').textContent = pr;
  $('bhs-impact').textContent = im;
  if(total>0){
    $('bhs-output-bar').style.width = (o/total*100)+'%';
    $('bhs-outcome-bar').style.width = (oc/total*100)+'%';
    $('bhs-process-bar').style.width = (pr/total*100)+'%';
    $('bhs-impact-bar').style.width = (im/total*100)+'%';
  }
  const rc = $('builder-row-count');
  if(rc) {
    const vis = rows.filter(rowMatchesBuilder).length;
    rc.textContent = vis < total ? `Showing ${vis} of ${total}` : `${total} indicators`;
  }
  // Keep publish status badge in sync
  updatePublishState();
}

// ═══════════════════════════════════════════════════
// PERIOD-WISE TARGET POPOVER
// ═══════════════════════════════════════════════════

// Returns ordered period label list for Indian FY (Apr–Mar)
function getPeriodList(freq, fy) {
  const fyYear = parseInt((fy || '2025-26').split('-')[0]);
  if (freq === 'monthly') {
    return [
      `Apr ${fyYear}`,`May ${fyYear}`,`Jun ${fyYear}`,
      `Jul ${fyYear}`,`Aug ${fyYear}`,`Sep ${fyYear}`,
      `Oct ${fyYear}`,`Nov ${fyYear}`,`Dec ${fyYear}`,
      `Jan ${fyYear+1}`,`Feb ${fyYear+1}`,`Mar ${fyYear+1}`
    ];
  }
  if (freq === 'quarterly') {
    const short = String(fyYear+1).slice(-2);
    return [`Q1 FY${short}`,`Q2 FY${short}`,`Q3 FY${short}`,`Q4 FY${short}`];
  }
  return [];
}

// Summary label shown in the target cell button
function getTargetSummary(row) {
  const periods = getPeriodList(row.freq, row.fy || '2025-26');
  if (!periods.length) return row.target || '0';
  const pt = row.periodTargets || {};
  const filled = periods.filter(p => pt[p] !== undefined && pt[p] !== '').length;
  const total  = periods.reduce((s, p) => s + (parseFloat(pt[p]) || 0), 0);
  if (filled === 0)              return `${IC.target} Set targets ${IC['chevron-down']}`;
  if (filled < periods.length)   return `${IC.target} ${filled}/${periods.length} set ${IC['chevron-down']}`;
  return `${IC['check-circle']} ${total} total ${IC['chevron-down']}`;
}

// Update just the summary button for one row (no full re-render)
function updateTargetSummaryBtn(rid) {
  const btn = document.querySelector(`.target-popover-btn[data-tgt-rid="${rid}"]`);
  const row  = builderRows.find(r => r.id === rid);
  if (!btn || !row) return;
  const periods = getPeriodList(row.freq, row.fy || '2025-26');
  const pt      = row.periodTargets || {};
  const filled  = periods.filter(p => pt[p] !== undefined && pt[p] !== '').length;
  btn.textContent = getTargetSummary(row);
  btn.classList.toggle('all-set', filled > 0 && filled === periods.length);
}

// Show the popover anchored to the trigger button
function showTargetPopover(rid, anchorEl) {
  const row = builderRows.find(r => r.id === rid);
  if (!row) return;

  // Remove any existing popover first
  const old = document.getElementById('target-popover');
  if (old) { old.remove(); return; } // second click on same btn = toggle close

  if (!row.periodTargets) row.periodTargets = {};
  const periods   = getPeriodList(row.freq, row.fy || '2025-26');
  const freqLabel = { monthly:'Monthly', quarterly:'Quarterly' }[row.freq] || '';
  const fyLabel   = row.fy || '2025-26';

  const pop = document.createElement('div');
  pop.id = 'target-popover';
  pop.innerHTML = `
    <div class="tp-header">
      <span>${IC.target} ${esc(freqLabel)} Targets &nbsp;<span style="font-size:10px;color:var(--muted);font-weight:400;">FY ${esc(fyLabel)}</span></span>
      <button class="tp-close" id="tp-close-btn"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
    </div>
    <table class="tp-table">
      <thead><tr><th>Period</th><th style="text-align:right;padding-right:8px;">Target</th></tr></thead>
      <tbody>
        ${periods.map(p => `
          <tr>
            <td class="tp-period">${esc(p)}</td>
            <td><input class="tp-input" data-period="${esc(p)}" value="${esc(row.periodTargets[p]||'')}" placeholder="0" type="number" min="0" /></td>
          </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td class="tp-total-lbl">Total</td>
          <td class="tp-total" id="tp-total-val">0</td>
        </tr>
      </tfoot>
    </table>`;

  document.body.appendChild(pop);

  // ── Position: below anchor, prevent viewport overflow ──
  const rect = anchorEl.getBoundingClientRect();
  const pw   = 238;
  let   left = rect.left;
  if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
  pop.style.top  = (rect.bottom + 5) + 'px';
  pop.style.left = Math.max(8, left) + 'px';

  // ── Compute + display running total ──
  function refreshTotal() {
    const t = periods.reduce((s, p) => s + (parseFloat(row.periodTargets[p] || 0)), 0);
    const el = document.getElementById('tp-total-val');
    if (el) el.textContent = t || 0;
  }
  refreshTotal();

  // ── Wire inputs ──
  pop.querySelectorAll('.tp-input').forEach(inp => {
    inp.addEventListener('input', e => {
      row.periodTargets[e.target.dataset.period] = e.target.value;
      refreshTotal();
      updateTargetSummaryBtn(rid);
      updatePublishState();
    });
  });

  // ── Close button ──
  document.getElementById('tp-close-btn').addEventListener('click', () => pop.remove());

  // ── Click outside closes ──
  setTimeout(() => {
    document.addEventListener('click', function onOutside(e) {
      if (!pop.contains(e.target) && !anchorEl.contains(e.target)) {
        pop.remove();
        document.removeEventListener('click', onOutside);
      }
    });
  }, 10);
}

// ── Render the target cell depending on freq ──────────
function renderTargetCell(row) {
  const needsPopover = row.freq === 'monthly' || row.freq === 'quarterly';
  if (!needsPopover) {
    // annually / one_time / unset — plain single input
    return `<input class="cell-num" data-field="target" data-rid="${row.id}" value="${esc(row.target)}" placeholder="0" type="number" min="0" />`;
  }
  // monthly / quarterly — summary button that opens popover
  if (!row.periodTargets) row.periodTargets = {};
  const periods  = getPeriodList(row.freq, row.fy || '2025-26');
  const pt       = row.periodTargets;
  const filled   = periods.filter(p => pt[p] !== undefined && pt[p] !== '').length;
  const summary  = getTargetSummary(row);
  const allSet   = filled > 0 && filled === periods.length;
  return `<button class="target-popover-btn${allSet?' all-set':''}" data-tgt-rid="${row.id}">${summary}</button>`;
}

// ── Refresh target cell in-place when freq changes ───
function refreshTargetCell(rid) {
  const row = builderRows.find(r => r.id === rid);
  const td  = document.querySelector(`tr[data-rid="${rid}"] .col-target`);
  if (!row || !td) return;
  td.innerHTML = renderTargetCell(row);
  // re-wire if it's a plain input
  const inp = td.querySelector('input[data-field="target"]');
  if (inp) {
    inp.addEventListener('input', e => {
      row.target = e.target.value;
      updateBuilderStats();
    });
  }
  // re-wire if it's a popover button
  const btn = td.querySelector('.target-popover-btn');
  if (btn) {
    btn.addEventListener('click', () => showTargetPopover(rid, btn));
  }
}

// ── Wire all target cells in tbody ───────────────────
function wireTargetCells(tbody) {
  // plain inputs
  qsa('input[data-field="target"]', tbody).forEach(inp => {
    inp.addEventListener('input', e => {
      const row = builderRows.find(r => r.id === +e.target.dataset.rid);
      if (row) row.target = e.target.value;
      updateBuilderStats();
    });
  });
  // popover buttons
  qsa('.target-popover-btn', tbody).forEach(btn => {
    btn.addEventListener('click', () => showTargetPopover(+btn.dataset.tgtRid, btn));
  });
}

// ── Render builder table ──────────────────────────────────────────────────────
function renderBuilderTable() {
  const tbody = $('builder-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const visible = builderRows.filter(rowMatchesBuilder);

  if (visible.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="27"><div class="builder-empty"><div class="be-icon"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div><h4>No indicators yet</h4><p>Click "+ Add Indicator Row" to start building your M&E framework</p></div></td>`;
    tbody.appendChild(tr);
    updateBuilderStats();
    return;
  }

  visible.forEach((row, vi) => {
    const ri = builderRows.indexOf(row);
    const comp = rowCompleteness(row);
    const dotCls = comp === 'complete' ? 'complete' : (row.name || row.type || row.stk ? 'partial' : 'empty');
    const typeClass = row.type ? `rtype-${row.type.toLowerCase()}` : '';
    const selCls = builderSelectedIds.has(row.id) ? 'row-selected' : '';

    const tr = document.createElement('tr');
    tr.className = `${typeClass} ${selCls}`;
    tr.dataset.rid = row.id;
    tr.innerHTML = `
      <td class="col-chk">
        <input type="checkbox" class="row-chk builder-row-check" data-rid="${row.id}" ${builderSelectedIds.has(row.id)?'checked':''} style="width:14px;height:14px;accent-color:var(--blue);cursor:pointer;" />
      </td>
      <td class="col-num">${vi+1}</td>
      <td class="col-status"><span class="validity-dot ${dotCls}" title="${comp}"></span></td>

      <td class="col-intv">
        <select class="cell-sel" data-field="intv" data-rid="${row.id}">${opts(builderRefs.interventions, row.intv, '— Intervention —')}</select>
      </td>
      <td class="col-ind">
        <input class="cell-txt ${!row.name?'cell-required-empty':''}" data-field="name" data-rid="${row.id}" value="${esc(row.name)}" placeholder="Indicator name…" />
      </td>
      <td class="col-type">
        <div style="display:flex;flex-direction:column;gap:4px;">
          <select class="cell-sel ${!row.type?'cell-required-empty':''}" data-field="type" data-rid="${row.id}">${opts(builderRefs.types, row.type, '— Type —')}</select>
          ${row.type ? typePillHtml(row.type) : ''}
        </div>
      </td>
      <td class="col-stk">
        <select class="cell-sel ${!row.stk?'cell-required-empty':''}" data-field="stk" data-rid="${row.id}">${opts(builderRefs.stakeholders, row.stk, '— Stakeholder —')}</select>
      </td>
      <td class="col-env">
        <select class="cell-sel" data-field="env" data-rid="${row.id}">${opts(builderRefs.environments, row.env, '— Env —')}</select>
      </td>
      <td class="col-child">
        <select class="cell-sel" data-field="child" data-rid="${row.id}">${opts(builderRefs.childexp, row.child, '— Child Exp —')}</select>
      </td>
      <td class="col-activity">
        <select class="cell-sel" data-field="activity" data-rid="${row.id}">${opts(builderRefs.activities, row.activity, '— Activity —')}</select>
      </td>
      <td class="col-outcome">
        <select class="cell-sel" data-field="outcome" data-rid="${row.id}">${opts(builderRefs.outcomes, row.outcome, '— Outcome Statement —')}</select>
      </td>
      <td class="col-outcat">
        <select class="cell-sel" data-field="outcomeCategory" data-rid="${row.id}" title="Maps to indicator.outcome_category_id (single FK)">
          <option value="">— Category —</option>
          ${(builderRefs.outcomeCategories||[]).map(cat => {
            const catName = typeof cat === 'object' ? cat.name : cat;
            return `<option value="${esc(catName)}" ${(row.outcomeCategory||'')=== catName?'selected':''}>${esc(catName)}</option>`;
          }).join('')}
        </select>
      </td>
      <td class="col-agg">
        <select class="cell-sel" data-field="agg" data-rid="${row.id}">
          <option value="">— Agg —</option>
          <option value="sum"        ${row.agg==='sum'       ?'selected':''}>Sum</option>
          <option value="average"    ${row.agg==='average'   ?'selected':''}>Average</option>
          <option value="distinct"   ${row.agg==='distinct'  ?'selected':''}>Distinct</option>
          <option value="fixed"      ${row.agg==='fixed'     ?'selected':''}>Fixed</option>
          <option value="last_value" ${row.agg==='last_value'?'selected':''}>Last Val</option>
        </select>
      </td>
      <td class="col-keyoc">
        <div class="toggle-wrap">
          <div class="toggle ${row.isKeyOutcome?'on':''}" data-field="isKeyOutcome" data-rid="${row.id}" title="Key Outcome indicator"></div>
        </div>
      </td>
      <td class="col-baseline">
        <input class="cell-num" data-field="baseline" data-rid="${row.id}" value="${esc(row.baseline||'')}" placeholder="0" type="number" min="0" />
      </td>
      <td class="col-unit">
        <select class="cell-sel" data-field="unit" data-rid="${row.id}">${opts(builderRefs.units, row.unit, '— Unit —')}</select>
      </td>
      <td class="col-freq">
        <select class="cell-sel" data-field="freq" data-rid="${row.id}">
          <option value="">—</option>
          <option value="monthly"   ${row.freq==='monthly'  ?'selected':''}>Monthly</option>
          <option value="quarterly" ${row.freq==='quarterly'?'selected':''}>Quarterly</option>
          <option value="annually"  ${row.freq==='annually' ?'selected':''}>Annually</option>
          <option value="one_time"  ${row.freq==='one_time' ?'selected':''}>One-time</option>
        </select>
      </td>
      <td class="col-period">
        <select class="cell-sel" data-field="period" data-rid="${row.id}">${opts(builderRefs.periods, row.period, '— Period —')}</select>
      </td>
      <td class="col-target">
        ${renderTargetCell(row)}
      </td>
      <td class="col-tgtnotes">
        <input class="cell-txt" data-field="targetNotes" data-rid="${row.id}" value="${esc(row.targetNotes||'')}" placeholder="e.g. Revised for Q3…" style="min-width:130px;" />
      </td>
      <td class="col-datasrc">
        <input class="cell-txt" data-field="dataSource" data-rid="${row.id}" value="${esc(row.dataSource||'')}" placeholder="e.g. MIS, School register…" style="min-width:150px;" />
      </td>
      <td class="col-active">
        <div class="toggle-wrap">
          <div class="toggle ${row.active?'on':''}" data-rid="${row.id}" title="${row.active?'Active':'Inactive'}" data-toggle="active"></div>
        </div>
      </td>
      <td class="col-act">
        <button class="row-del" data-delrid="${row.id}" title="Delete row">${IC.trash}</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // ── Cell change handlers ──
  qsa('[data-field]', tbody).forEach(el => {
    const ev = el.tagName === 'INPUT' ? 'input' : 'change';
    el.addEventListener(ev, e => {
      const rid = +e.target.dataset.rid;
      const field = e.target.dataset.field;
      const row = builderRows.find(r => r.id === rid);
      if (!row) return;
      row[field] = e.target.value;
      const tr = e.target.closest('tr');
      if (field === 'type') {
        tr.className = `rtype-${row.type.toLowerCase()} ${builderSelectedIds.has(rid)?'row-selected':''}`;
        const pillDiv = tr.querySelector('.col-type div');
        if (pillDiv) pillDiv.innerHTML = `<select class="cell-sel" data-field="type" data-rid="${rid}">${opts(builderRefs.types, row.type, '— Type —')}</select>${typePillHtml(row.type)}`;
        rebindCell(pillDiv, rid, 'type');
      }
      if (field === 'name' || field === 'type' || field === 'stk') {
        e.target.classList.toggle('cell-required-empty', !e.target.value.trim());
      }
      // When freq changes: refresh the target cell (plain input ↔ popover button)
      if (field === 'freq') {
        // clear cached periodTargets when freq changes so stale data isn't shown
        row.periodTargets = {};
        row.target = '';
        // close any open popover
        const old = document.getElementById('target-popover');
        if (old) old.remove();
        refreshTargetCell(rid);
      }
      // C2: When activity changes, filter the outcome dropdown
      if (field === 'activity') {
        const outcomeCell = tr.querySelector('[data-field="outcome"]');
        if (outcomeCell) {
          const activityOutcomeMap = builderRows
            .filter(r2 => r2.activity === row.activity && r2.outcome)
            .map(r2 => r2.outcome);
          const allOutcomes = builderRefs.outcomes;
          const linked = [...new Set(activityOutcomeMap)];
          const unlinked = allOutcomes.filter(o => !linked.includes(o));
          outcomeCell.innerHTML = `<option value="">— Outcome Statement —</option>`
            + (linked.length ? `<optgroup label="Linked to this activity">${linked.map(o=>`<option value="${esc(o)}" ${row.outcome===o?'selected':''}>${esc(o)}</option>`).join('')}</optgroup>` : '')
            + (unlinked.length ? `<optgroup label="All other outcomes" style="color:var(--muted);">${unlinked.map(o=>`<option value="${esc(o)}" style="color:var(--muted);" ${row.outcome===o?'selected':''}>${esc(o)}</option>`).join('')}</optgroup>` : '');
        }
      }
      const dot = tr.querySelector('.validity-dot');
      if (dot) {
        const c = rowCompleteness(row);
        dot.className = `validity-dot ${c === 'complete' ? 'complete' : (row.name||row.type||row.stk ? 'partial' : 'empty')}`;
        dot.title = c;
      }
      updateBuilderStats();
    });
  });

  // Wire period-target cells (plain inputs + popover buttons)
  wireTargetCells(tbody);

  // toggle active
  qsa('[data-toggle="active"]', tbody).forEach(tog => {
    tog.addEventListener('click', () => {
      const rid = +tog.dataset.rid;
      const row = builderRows.find(r => r.id === rid);
      if (!row) return;
      row.active = !row.active;
      tog.classList.toggle('on', row.active);
      tog.title = row.active ? 'Active' : 'Inactive';
    });
  });

  // toggle isKeyOutcome
  qsa('[data-field="isKeyOutcome"]', tbody).forEach(tog => {
    tog.addEventListener('click', () => {
      const rid = +tog.dataset.rid;
      const row = builderRows.find(r => r.id === rid);
      if (!row) return;
      row.isKeyOutcome = !row.isKeyOutcome;
      tog.classList.toggle('on', row.isKeyOutcome);
      updatePublishState();
    });
  });

  // outcomeCategory single-select is handled by the standard data-field change handler above

  // delete
  qsa('[data-delrid]', tbody).forEach(btn => {
    btn.addEventListener('click', () => {
      const rid = +btn.dataset.delrid;
      const idx = builderRows.findIndex(r => r.id === rid);
      if (idx !== -1) { builderRows.splice(idx, 1); builderSelectedIds.delete(rid); }
      renderBuilderTable();
      updateBuilderStats();
      toast('Row deleted');
    });
  });

  // row checkbox
  qsa('.builder-row-check', tbody).forEach(chk => {
    chk.addEventListener('change', () => {
      const rid = +chk.dataset.rid;
      if (chk.checked) builderSelectedIds.add(rid);
      else builderSelectedIds.delete(rid);
      updateBulkBar();
      // update row highlight
      const tr = chk.closest('tr');
      if (tr) tr.classList.toggle('row-selected', chk.checked);
    });
  });

  // select all
  const sa = $('builder-select-all');
  if (sa) {
    sa.checked = builderSelectedIds.size > 0 && builderSelectedIds.size === visible.length;
    sa.indeterminate = builderSelectedIds.size > 0 && builderSelectedIds.size < visible.length;
  }

  updateBuilderStats();
}

function rebindCell(container, rid, field) {
  if (!container) return;
  const sel = container.querySelector('[data-field]');
  if (!sel) return;
  sel.addEventListener('change', e => {
    const row = builderRows.find(r => r.id === rid);
    if (!row) return;
    row[field] = e.target.value;
    const tr = e.target.closest('tr');
    if (tr) tr.className = `rtype-${row.type.toLowerCase()} ${builderSelectedIds.has(rid)?'row-selected':''}`;
    if (field === 'type') {
      const pillDiv = tr?.querySelector('.col-type div');
      if (pillDiv) pillDiv.innerHTML = `<select class="cell-sel" data-field="type" data-rid="${rid}">${opts(builderRefs.types, row.type, '— Type —')}</select>${typePillHtml(row.type)}`;
      rebindCell(pillDiv, rid, 'type');
    }
    updateBuilderStats();
  });
}

// ── Bulk bar ──────────────────────────────
function updateBulkBar() {
  const bar = $('bulk-bar');
  const n = builderSelectedIds.size;
  bar?.classList.toggle('hidden', n === 0);
  const lbl = $('bulk-count-lbl');
  if (lbl) lbl.textContent = `${n} row${n!==1?'s':''} selected`;
}

// ── Add row ───────────────────────────────
function addBuilderRow() {
  builderRows.push({ id:builderNextId++, prog: activeMEProgram || '', intv:'', name:'', type:'', stk:'', env:'', child:'', activity:'', outcome:'', outcomeCategory:'', unit:'count', freq:'monthly', period:'Feb 2026', target:'', periodTargets:{}, targetNotes:'', dataSource:'', calcLogic:'', description:'', active:true, dir:'increase', agg:'sum', isKeyOutcome:false, baseline:'', periodTargets:{}, targetNotes:'', dataSource:'', calcLogic:'', description:''  });
  renderBuilderTable();
  // scroll to bottom & focus last name input
  requestAnimationFrame(() => {
    const wrap = document.querySelector('.builder-tbl-wrap');
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
    const inputs = document.querySelectorAll('.builder-table .cell-txt[data-field="name"]');
    if (inputs.length) inputs[inputs.length-1].focus();
    // mark last row as new
    const trs = document.querySelectorAll('#builder-tbody tr');
    if (trs.length) trs[trs.length-1].classList.add('row-new');
  });
}

// ── Main init for builder ─────────────────
function renderBuilder() {
  renderRefPanel();
  initRefAccordion();
  initRefAdds();
  renderBuilderTable();
  updateBuilderStats();

  // toolbar events
  $('builder-add-row')?.addEventListener('click', addBuilderRow);
  $('builder-add-row-bottom')?.addEventListener('click', addBuilderRow);

  $('builder-search-inp')?.addEventListener('input', e => {
    builderSearchQ = e.target.value;
    renderBuilderTable();
  });
  $('builder-filter-type')?.addEventListener('change', e => {
    builderFilterType = e.target.value;
    renderBuilderTable();
  });
  $('builder-filter-intv')?.addEventListener('change', e => {
    builderFilterIntv = e.target.value;
    renderBuilderTable();
  });
  $('builder-filter-status')?.addEventListener('change', e => {
    builderFilterStatus = e.target.value;
    renderBuilderTable();
  });

  // select all
  $('builder-select-all')?.addEventListener('change', e => {
    const visible = builderRows.filter(rowMatchesBuilder);
    if (e.target.checked) visible.forEach(r => builderSelectedIds.add(r.id));
    else builderSelectedIds.clear();
    renderBuilderTable();
    updateBulkBar();
  });

  // Bulk apply
  $('bulk-apply')?.addEventListener('click', () => {
    const t = $('bulk-type')?.value;
    const s = $('bulk-stk')?.value;
    const p = $('bulk-period')?.value;
    builderRows.forEach(r => {
      if (!builderSelectedIds.has(r.id)) return;
      if (t) r.type = t;
      if (s) r.stk = s;
      if (p) r.period = p;
    });
    renderBuilderTable();
    toast(`Applied bulk changes to ${builderSelectedIds.size} rows`);
  });

  // Bulk delete
  $('bulk-delete')?.addEventListener('click', () => {
    const n = builderSelectedIds.size;
    builderSelectedIds.forEach(id => {
      const idx = builderRows.findIndex(r => r.id === id);
      if (idx !== -1) builderRows.splice(idx, 1);
    });
    builderSelectedIds.clear();
    updateBulkBar();
    renderBuilderTable();
    toast(`Deleted ${n} rows`);
  });

  $('bulk-cancel')?.addEventListener('click', () => {
    builderSelectedIds.clear();
    updateBulkBar();
    renderBuilderTable();
  });

  // Clear empty rows
  $('builder-clear-empty')?.addEventListener('click', () => {
    const before = builderRows.length;
    for (let i = builderRows.length - 1; i >= 0; i--) {
      const r = builderRows[i];
      if (!r.name && !r.type && !r.stk) builderRows.splice(i, 1);
    }
    renderBuilderTable();
    toast(`Cleared ${before - builderRows.length} empty rows`);
  });

  // Publish — snapshot builder into publishedFramework
  $('builder-publish-btn')?.addEventListener('click', () => {
    const ok = doPublish();
    if (!ok) return;
    const banner = $('publish-success-banner');
    if (banner) {
      banner.classList.remove('hidden');
      banner.querySelector('p').textContent =
        `${publishedFramework.count} indicators across ${getPublishedPrograms().length} programs are now live in Monthly Reporting.`;
      banner.scrollIntoView({ behavior:'smooth', block:'start' });
    }
    updatePublishState();
    toast(`Published ${publishedFramework.count} indicators · Reporting updated`);
  });

  $('dismiss-publish-banner')?.addEventListener('click', () => {
    $('publish-success-banner')?.classList.add('hidden');
  });

  // Export CSV
  $('me-back-to-progs')?.addEventListener('click', () => {
    $('me-builder-content').classList.add('hidden');
    $('me-prog-selector').classList.remove('hidden');
    $('crumb-title').textContent = 'Select Program';
    builderRows = [];
    activeMEProgram = null;
    publishedFramework = null;
    renderMEProgSelector();
  });

  $('builder-export-btn')?.addEventListener('click', () => {
    const headers = ['FY','Program','Intervention','Indicator Name','Type','Stakeholder','Environment','Child Experience','Activity','Outcome Statement','Outcome Category','Direction','Aggregation','Key Outcome','Baseline','Unit','Frequency','Target Period','Target Value','Target Notes','Data Source','Calculation Logic','Description','Active'];
    const rows = builderRows.map(r => [r.fy||'',r.prog,r.intv,r.name,r.type,r.stk,r.env,r.child,r.activity,r.outcome,r.outcomeCategory||'',r.dir||'',r.agg||'',r.isKeyOutcome?'Yes':'No',r.baseline||'',r.unit,r.freq,r.period,r.target,r.targetNotes||'',r.dataSource||'',r.calcLogic||'',r.description||'',r.active?'Yes':'No'].map(v=>`"${v}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `mantra_me_framework_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast('CSV exported');
  });
}

// ═══════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════

// ── Auth ──
$('btn-login').addEventListener('click', () => {
  state.role = $('login-role').value;
  $('screen-auth').classList.add('hidden');
  $('screen-app').classList.remove('hidden');
  applyRoleUI();
  showPage('home');
});
$('btn-otp').addEventListener('click', () => toast('OTP sent to registered mobile (prototype)'));
$('login-email').addEventListener('keydown', e => { if(e.key==='Enter') $('btn-login').click(); });
$('login-password').addEventListener('keydown', e => { if(e.key==='Enter') $('btn-login').click(); });
$('btn-logout').addEventListener('click', () => {
  $('screen-app').classList.add('hidden');
  $('screen-auth').classList.remove('hidden');
});

// ── Nav ──
qsa('.nav-btn').forEach(b => {
  b.addEventListener('click', () => {
    const route = b.dataset.route;
    if (!route) return;
    if ((route === 'me-book' || route === 'me-builder') && state.role !== 'admin') {
      toast(IC.warning + ' M&E Administrator access required'); return;
    }
    if (route === 'lfa' && state.role !== 'admin' && state.role !== 'manager') {
      toast(IC.warning + ' M&E Administrator access required'); return;
    }
    // Grant Management (Budget Book, Grant Setup, Portfolio) — manager + viewer only, NOT admin
    if (['grant-mgmt','grant-setup','budget-book'].includes(route) && state.role === 'admin') {
      toast(IC.warning + ' Grant Management is for Program Managers'); return;
    }
    showPage(route);
  });
});

// ── Home goto links ──
qsa('[data-goto]').forEach(el => {
  el.addEventListener('click', () => {
    const route = el.dataset.goto;
    if (route === 'me-builder' && state.role !== 'admin') {
      toast(IC.warning + ' M&E Administrator access required'); return;
    }
    if (['grant-mgmt','grant-setup','budget-book'].includes(route) && state.role === 'admin') {
      toast(IC.warning + ' Grant Management is for Program Managers'); return;
    }
    showPage(route);
  });
});

// ── Home quick cards (click card body itself) ──
qsa('.quick-card').forEach(c => {
  c.addEventListener('click', e => {
    if (e.target.closest('.qc-actions')) return;
    const goto = c.dataset.goto;
    if (goto) {
      if (goto === 'me-builder' && state.role !== 'admin') { toast(IC.warning + ' M&E Administrator access required'); return; }
      if (['grant-mgmt','grant-setup','budget-book'].includes(goto) && state.role === 'admin') { toast(IC.warning + ' Grant Management is for Program Managers'); return; }
      showPage(goto);
    }
  });
});

// ── Back from sheet ──
$('btn-back-to-programs').addEventListener('click', () => showPage('data-entry'));

// ── Sheet filters — wired dynamically inside populateSheetFilters ──
// (no static event wiring needed — each filter element is created fresh)

// ── POC search input (new grouped sheet) ──
$('poc-search')?.addEventListener('input', () => renderSheet());

// ── Sheet Intervention + Stakeholder dropdowns ──
$('poc-sheet-intv')?.addEventListener('change', () => renderSheet());
$('poc-sheet-stk')?.addEventListener('change',  () => renderSheet());

// ── Load Financial Years and Months for Top Nav dropdowns ──
async function loadTopNavFYAndMonths() {
  try {
    const fyRes = await fetch(`${GS_SB_URL}/rest/v1/financial_year?select=financial_year_id,fy_name,is_current&order=start_date.desc`, { headers: GS_SB_HDR });
    if (fyRes.ok) {
      const fys = await fyRes.json();
      const fySel = $('fy-select');
      if (fySel && fys.length > 0) {
        fySel.innerHTML = fys.map(f => 
          `<option value="${esc(f.fy_name)}" data-fy-id="${f.financial_year_id}"${f.is_current?' selected':''}>${esc(f.fy_name)}</option>`
        ).join('');
        
        // Set state from current FY
        const currentFY = fys.find(f => f.is_current) || fys[0];
        if (currentFY) {
          state.fy = currentFY.fy_name;
          await populateTopNavMonthDropdown(currentFY.financial_year_id);
        }
      }
    }
  } catch(e) { console.warn('[loadTopNavFYAndMonths] Failed:', e); }
}

async function populateTopNavMonthDropdown(fyId) {
  try {
    const freq = $('freq-select')?.value || 'monthly';
    const monthSel = $('month-select');
    if (!monthSel) return;
    
    if (freq === 'monthly') {
      // Load monthly periods
      const res = await fetch(`${GS_SB_URL}/rest/v1/period?financial_year_id=eq.${fyId}&period_type=eq.monthly&select=period_id,period_name,start_date&order=start_date.desc`, { headers: GS_SB_HDR });
      if (res.ok) {
        const periods = await res.json();
        if (periods.length > 0) {
          const now = new Date();
          const currMonthStr = now.toLocaleString('default', { month: 'short' }) + ' ' + now.getFullYear();
          
          monthSel.innerHTML = periods.map(p => {
            const label = p.period_name.trim();
            const parts = label.split(/\s+/);
            const shortLabel = parts[0].substring(0, 3) + ' ' + parts[parts.length - 1];
            const isCurrent = shortLabel.toLowerCase() === currMonthStr.toLowerCase();
            return `<option value="${shortLabel}" data-period-id="${p.period_id}" data-freq="monthly"${isCurrent?' selected':''}>${shortLabel}</option>`;
          }).join('');
        }
      }
    } else if (freq === 'quarterly') {
      // Load quarterly periods from DB
      const res = await fetch(`${GS_SB_URL}/rest/v1/period?financial_year_id=eq.${fyId}&period_type=eq.quarterly&select=period_id,period_name,quarter_number&order=quarter_number.asc`, { headers: GS_SB_HDR });
      if (res.ok) {
        const periods = await res.json();
        if (periods.length > 0) {
          // Determine current quarter
          const now = new Date();
          const month = now.getMonth(); // 0-11
          const currQ = month < 3 ? 4 : month < 6 ? 1 : month < 9 ? 2 : 3; // Fiscal year quarters
          
          monthSel.innerHTML = periods.map(p => {
            const isCurrent = p.quarter_number === currQ;
            return `<option value="${p.period_name}" data-period-id="${p.period_id}" data-freq="quarterly"${isCurrent?' selected':''}>${p.period_name}</option>`;
          }).join('');
        } else {
          // Fallback if no quarterly periods in DB
          monthSel.innerHTML = `
            <option value="Q1 (Apr-Jun)" data-freq="quarterly">Q1 (Apr-Jun)</option>
            <option value="Q2 (Jul-Sep)" data-freq="quarterly">Q2 (Jul-Sep)</option>
            <option value="Q3 (Oct-Dec)" data-freq="quarterly">Q3 (Oct-Dec)</option>
            <option value="Q4 (Jan-Mar)" data-freq="quarterly" selected>Q4 (Jan-Mar)</option>
          `;
        }
      }
    } else if (freq === 'annual') {
      // Load yearly period from DB
      const res = await fetch(`${GS_SB_URL}/rest/v1/period?financial_year_id=eq.${fyId}&period_type=eq.yearly&select=period_id,period_name&limit=1`, { headers: GS_SB_HDR });
      if (res.ok) {
        const periods = await res.json();
        if (periods.length > 0) {
          monthSel.innerHTML = `<option value="${periods[0].period_name}" data-period-id="${periods[0].period_id}" data-freq="annual">${periods[0].period_name}</option>`;
        } else {
          const fyName = $('fy-select')?.options[$('fy-select').selectedIndex]?.text || 'Annual';
          monthSel.innerHTML = `<option value="Annual" data-freq="annual">${fyName}</option>`;
        }
      }
    }
    
    // Update state
    state.freq = freq;
    state.month = monthSel.value;
    if ($('sb-month')) $('sb-month').textContent = freq === 'annual' ? 'Annual' : state.month;
    
  } catch(e) { console.warn('[populateTopNavMonthDropdown] Failed:', e); }
}

// Frequency selector change handler
$('freq-select')?.addEventListener('change', async () => {
  const fyId = $('fy-select')?.options[$('fy-select').selectedIndex]?.dataset.fyId;
  if (fyId) await populateTopNavMonthDropdown(fyId);
  // Reload reporting data with new frequency filter
  if (state.route === 'data-entry-sheet') {
    await mrLoadFromDB(state.program, state.month, state.fy);
    populateSheetFilters(state.program);
    renderSheet();
  }
});

// Initialize top nav FY/Month on page load
loadTopNavFYAndMonths();

// ── Program selector Intervention + Stakeholder filter dropdowns ──
$('poc-prog-intv-filter')?.addEventListener('change', () => _applyPocProgFilter());
$('poc-prog-stk-filter')?.addEventListener('change',  () => _applyPocProgFilter());
$('poc-prog-filter-clear')?.addEventListener('click', () => {
  const intvSel = $('poc-prog-intv-filter');
  const stkSel  = $('poc-prog-stk-filter');
  if (intvSel) intvSel.value = '';
  if (stkSel)  stkSel.value  = '';
  _applyPocProgFilter();
});

$('chip-missing').addEventListener('click', () => {
  state.showMissing = !state.showMissing;
  $('chip-missing').classList.toggle('on', state.showMissing);
  if (state.showMissing) { state.showFlagged = false; $('chip-flagged').classList.remove('on'); }
  renderSheet();
});
$('chip-flagged').addEventListener('click', () => {
  state.showFlagged = !state.showFlagged;
  $('chip-flagged').classList.toggle('on', state.showFlagged);
  if (state.showFlagged) { state.showMissing = false; $('chip-missing').classList.remove('on'); }
  renderSheet();
});
$('chip-reset').addEventListener('click', () => {
  state.showMissing = false; state.showFlagged = false;
  state.filters = { search:'', indType:'', stakeholder:'', env:'', child:'', period:'', intv:'', activity:'', outcome:'' };
  $('chip-missing').classList.remove('on'); $('chip-flagged').classList.remove('on');
  const ps = $('poc-search'); if (ps) ps.value = '';
  const si = $('poc-sheet-intv'); if (si) si.value = '';
  const ss = $('poc-sheet-stk');  if (ss) ss.value = '';
  // Rebuild the filter panel so all selects reset to "All" correctly
  populateSheetFilters(state.program);
  renderSheet();
  toast('Filters reset');
});

// ── Save / Submit ──
$('btn-save').addEventListener('click', () => {
  toast('Draft saved — ' + new Date().toLocaleTimeString());
  $('sheet-status').textContent = 'Saved · ' + new Date().toLocaleTimeString();
});
$('btn-submit').addEventListener('click', () => $('modal-submit').classList.remove('hidden'));
$('m-cancel').addEventListener('click', () => $('modal-submit').classList.add('hidden'));

// ── Monthly Reporting — persist actuals to raw_submission table ──────────────
async function mrSubmitToDB() {
  const program = state.program;
  const month   = state.month;
  const fy      = state.fy || '2025-26';
  const rows    = getReportingRows(program);

  // Only send rows that have a value or remarks
  const payload = rows
    .filter(r => r.value !== '' || r.remarks)
    .map(r => ({
      indicator_row_id: String(r._id),
      indicator_name:   r.indicator,
      program_name:     program,
      reporting_month:  month,
      fiscal_year:      fy,
      actual_value:     r.value !== '' ? String(r.value) : null,
      remarks:          r.remarks || null,
      is_flagged:       !!r.flagged,
      actual_status:    'submitted',
    }));

  if (!payload.length) return true; // nothing to save — still counts as success

  try {
    const res = await fetch(`${GS_SB_URL}/rest/v1/raw_submission`, {
      method:  'POST',
      headers: { ...GS_SB_HDR, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[mrSubmitToDB] HTTP', res.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[mrSubmitToDB] Network error:', e);
    return false;
  }
}

// ── Load published indicators from DB for all programs ───────────────────────
// Correct hierarchy: Program → Intervention → Outcomes/Activities → Indicators
async function mrLoadAllPublishedIndicators() {
  if (!GS_SB_URL) return;
  try {
    // Get all programs with their IDs
    let programsData = [];
    if (typeof dbCache !== 'undefined' && dbCache.programs && dbCache.programs.length > 0) {
      programsData = dbCache.programs;
    } else {
      const progRes = await fetch(`${GS_SB_URL}/rest/v1/program?select=program_id,program_name`, { headers: GS_SB_HDR });
      if (progRes.ok) {
        programsData = await progRes.json();
      }
    }

    if (!programsData.length) {
      console.log('[mrLoadAllPublishedIndicators] No programs found');
      return;
    }

    // For each program, load its interventions → outcomes/activities → indicators
    for (const prog of programsData) {
      const progId = prog.program_id;
      const progName = prog.program_name;
      
      if (!progId) continue;
      
      // Skip if already loaded
      if (publishedFrameworkByProg[progName]) continue;

      // Fetch interventions for this program
      const intRes = await fetch(`${GS_SB_URL}/rest/v1/intervention?program_id=eq.${progId}&is_active=eq.true&select=intervention_id,intervention_name`, { headers: GS_SB_HDR });
      const interventions = intRes.ok ? await intRes.json() : [];
      const intIds = interventions.map(i => i.intervention_id);
      const intMap = {};
      interventions.forEach(i => { intMap[i.intervention_id] = i.intervention_name || progName; });

      if (!intIds.length) {
        console.log(`[mrLoadAllPublishedIndicators] No interventions for ${progName}`);
        publishedFrameworkByProg[progName] = { rows: [], refs: {}, ts: new Date(), count: 0, prog: progName };
        continue;
      }

      // Fetch LFA outcomes/activities + intervention-stakeholder mappings
      const [ocRes, acRes, istmRes] = await Promise.all([
        fetch(`${GS_SB_URL}/rest/v1/lfa_outcome?intervention_id=in.(${intIds.join(',')})&is_active=eq.true&select=lfa_outcome_id,intervention_id,stakeholder_type_id,outcome_statement,outcome_category,outcome_code`, { headers: GS_SB_HDR }),
        fetch(`${GS_SB_URL}/rest/v1/lfa_activity?intervention_id=in.(${intIds.join(',')})&is_active=eq.true&select=lfa_activity_id,intervention_id,stakeholder_type_id,activity_statement,activity_category,activity_code`, { headers: GS_SB_HDR }),
        fetch(`${GS_SB_URL}/rest/v1/intervention_stakeholder_type_map?intervention_id=in.(${intIds.join(',')})&is_active=eq.true&select=intervention_stakeholder_type_map_id,intervention_id,stakeholder_type_id`, { headers: GS_SB_HDR })
      ]);

      const outcomes = ocRes.ok ? await ocRes.json() : [];
      const activities = acRes.ok ? await acRes.json() : [];
      const istmRows = istmRes.ok ? await istmRes.json() : [];

      const outcomeIds = outcomes.map(o => o.lfa_outcome_id);
      const activityIds = activities.map(a => a.lfa_activity_id);

      if (!outcomeIds.length && !activityIds.length) {
        console.log(`[mrLoadAllPublishedIndicators] No LFA data for ${progName}`);
        publishedFrameworkByProg[progName] = { rows: [], refs: {}, ts: new Date(), count: 0, prog: progName };
        continue;
      }

      const outcomeMap = {};
      outcomes.forEach(o => { outcomeMap[o.lfa_outcome_id] = o; });
      const activityMap = {};
      activities.forEach(a => { activityMap[a.lfa_activity_id] = a; });
      const istmMap = {};
      const stakeholderTypeIds = new Set();
      outcomes.forEach(o => { if (o.stakeholder_type_id) stakeholderTypeIds.add(o.stakeholder_type_id); });
      activities.forEach(a => { if (a.stakeholder_type_id) stakeholderTypeIds.add(a.stakeholder_type_id); });
      istmRows.forEach(m => {
        istmMap[m.intervention_stakeholder_type_map_id] = m;
        if (m.stakeholder_type_id) stakeholderTypeIds.add(m.stakeholder_type_id);
      });

      const stkMap = {};
      if (stakeholderTypeIds.size > 0) {
        const stkRes = await fetch(`${GS_SB_URL}/rest/v1/stakeholder_type?stakeholder_type_id=in.(${[...stakeholderTypeIds].join(',')})&select=stakeholder_type_id,type_name`, { headers: GS_SB_HDR });
        const stks = stkRes.ok ? await stkRes.json() : [];
        stks.forEach(s => { stkMap[s.stakeholder_type_id] = s.type_name; });
      }

      // Build query for indicators linked to this program's outcomes/activities
      const orClauses = [];
      if (outcomeIds.length) {
        orClauses.push(`lfa_outcome_id.in.(${outcomeIds.join(',')})`);
      }
      if (activityIds.length) {
        orClauses.push(`lfa_activity_id.in.(${activityIds.join(',')})`);
      }

      const indRes = await fetch(
        `${GS_SB_URL}/rest/v1/indicator?or=(${orClauses.join(',')})&is_active=eq.true&select=indicator_id,indicator_name,indicator_code,unit_of_measure,frequency,direction,lfa_outcome_id,lfa_activity_id,intervention_stakeholder_type_map_id`,
        { headers: GS_SB_HDR }
      );

      const indicators = indRes.ok ? await indRes.json() : [];
      
      const rows = indicators.map((ind, idx) => {
        const oc = ind.lfa_outcome_id ? outcomeMap[ind.lfa_outcome_id] : null;
        const ac = ind.lfa_activity_id ? activityMap[ind.lfa_activity_id] : null;
        const istm = ind.intervention_stakeholder_type_map_id ? istmMap[ind.intervention_stakeholder_type_map_id] : null;
        const sourceType = oc ? 'outcome' : 'activity';
        const stkTypeId = (oc && oc.stakeholder_type_id) || (ac && ac.stakeholder_type_id) || (istm && istm.stakeholder_type_id) || null;
        const intId = (oc && oc.intervention_id) || (ac && ac.intervention_id) || (istm && istm.intervention_id) || null;
        return {
          id: ind.indicator_id || (Date.now() + idx),
          prog: progName,
          fy: '2025-26',
          intv: intMap[intId] || progName,
          stk: stkTypeId ? (stkMap[stkTypeId] || 'Unknown') : 'Unknown',
          name: ind.indicator_name,
          code: ind.indicator_code || '',
          unit: ind.unit_of_measure || 'count',
          freq: ind.frequency || 'monthly',
          active: true,
          target: '',
          type: sourceType === 'outcome' ? 'Outcome' : 'Output',
          sourceType,
          sourceCode: sourceType === 'outcome' ? (oc?.outcome_code || '') : (ac?.activity_code || ''),
          activity: sourceType === 'activity' ? (ac?.activity_statement || '') : '',
          outcome: sourceType === 'outcome' ? (oc?.outcome_statement || '') : '',
          outcomeCategory: sourceType === 'outcome' ? (oc?.outcome_category || '') : '',
          dir: ind.direction || 'increase',
        };
      });

      publishedFrameworkByProg[progName] = {
        rows, refs: {}, ts: new Date(), count: rows.length, prog: progName
      };
      
      console.log(`[mrLoadAllPublishedIndicators] ${progName}: ${rows.length} indicators`);
    }
    
    console.log('[mrLoadAllPublishedIndicators] Completed loading for', programsData.length, 'programs');
  } catch (e) { 
    console.warn('[mrLoadAllPublishedIndicators] Error:', e); 
  }
}

// Legacy function - calls the new one
async function mrLoadPublishedIndicators(program) {
  await mrLoadAllPublishedIndicators();
}

// ── Load existing raw_submission actuals for a program+month from DB ─────────
async function mrLoadFromDB(program, month, fy) {
  if (!GS_SB_URL) return;
  try {
    const params = `program_name=eq.${encodeURIComponent(program)}&reporting_month=eq.${encodeURIComponent(month)}&fiscal_year=eq.${encodeURIComponent(fy||'2025-26')}&select=indicator_row_id,actual_value,remarks,is_flagged,actual_status`;
    const r = await fetch(`${GS_SB_URL}/rest/v1/raw_submission?${params}`, { headers: GS_SB_HDR });
    if (!r.ok) return;
    const data = await r.json();
    if (!data.length) return;
    if (!reportingActuals[program]) reportingActuals[program] = {};
    data.forEach(row => {
      const id = isNaN(row.indicator_row_id) ? row.indicator_row_id : parseInt(row.indicator_row_id);
      reportingActuals[program][id] = {
        value:        row.actual_value ?? '',
        remarks:      row.remarks ?? '',
        flagged:      !!row.is_flagged,
        updated:      'From DB',
        actualStatus: row.actual_status || 'submitted',
      };
    });
    console.log(`[mrLoadFromDB] Loaded ${data.length} actuals for ${program} ${month}`);
  } catch (e) {
    console.warn('[mrLoadFromDB] Error:', e);
  }
}

// ── MONTHLY REPORTING IMPORT / EXPORT ──────────────────────────────
function mrDownloadTemplate() {
  const prog = btStore.activeProg;
  if (!prog || !publishedFrameworkByProg[prog]) { toast('Load program framework first'); return; }

  const framework = publishedFrameworkByProg[prog];
  const month = btStore.activeMonth || new Date().toLocaleString('en-US', {month:'long', year:'numeric'});

  const wb = XLSX.utils.book_new();

  // Sheet 1: README
  const instrSheet = [
    ['MONTHLY POC INDICATOR SUBMISSION TEMPLATE'],
    ['Program', prog],
    ['Month', month],
    [''],
    ['HOW TO SUBMIT:'],
    ['1. Enter ACTUAL VALUES in column C (Actual Value)'],
    ['2. Add REMARKS in column D if needed (data issues, context, notes)'],
    ['3. Check "Yes" in column E (Flagged) if data needs M&E Admin review'],
    ['4. Save the file and upload back to Monthly Reporting'],
    [''],
    ['IMPORTANT:'],
    ['- Indicator codes in column A are READ-ONLY (do not change)'],
    ['- ACTUAL VALUE is what you must fill in'],
    ['- Remarks are optional but help M&E Admin understand the data'],
    ['- Flag any data that seems wrong or needs verification'],
    [''],
    ['EXAMPLE:'],
    ['IND-001', 'Children enrolled in program', '150', 'Includes new batch from Jan', 'No', 'pending'],
    ['IND-002', 'Training sessions completed', '12', '', 'Yes', 'pending'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrSheet);
  wsInstr['!cols'] = [{wch:30}, {wch:50}];
  XLSX.utils.book_append_sheet(wb, wsInstr, 'README');

  // Sheet 2: Submission Template (blank with headers only)
  const rows = [['Indicator Code','Indicator Name','Actual Value','Remarks','Flagged','Status']];
  framework.rows.forEach(ind => {
    rows.push([ind.indicator_code || '', ind.indicator_name || '', '', '', '', 'pending']);
  });
  const wsSubmit = XLSX.utils.aoa_to_sheet(rows);
  wsSubmit['!cols'] = [{wch:15}, {wch:40}, {wch:15}, {wch:30}, {wch:10}, {wch:12}];
  XLSX.utils.book_append_sheet(wb, wsSubmit, `${month}`);

  // Sheet 3: Instructions by Indicator
  const instrByInd = [['Indicator Code', 'Indicator Name', 'Instructions / Data Source']];
  framework.rows.forEach(ind => {
    instrByInd.push([
      ind.indicator_code || '',
      ind.indicator_name || '',
      'Enter value · Add remarks if data quality issue · Flag if uncertain'
    ]);
  });
  const wsInstrInd = XLSX.utils.aoa_to_sheet(instrByInd);
  wsInstrInd['!cols'] = [{wch:15}, {wch:40}, {wch:60}];
  XLSX.utils.book_append_sheet(wb, wsInstrInd, 'By Indicator');

  const filename = `POC_Template_${prog.replace(/\s+/g,'_')}_${month.replace(/\s+/g,'_')}.xlsx`;
  XLSX.writeFile(wb, filename);
  toast(`✓ Blank submission template downloaded · ${framework.count} indicators`);
}

function mrExportSubmission() {
  const prog = btStore.activeProg;
  if (!prog || !publishedFrameworkByProg[prog]) { toast('No data to export'); return; }

  const framework = publishedFrameworkByProg[prog];
  const month = btStore.activeMonth || new Date().toLocaleString('en-US', {month:'long', year:'numeric'});

  const wb = XLSX.utils.book_new();

  // Sheet 1: Instructions
  const instrSheet = [
    ['MONTHLY INDICATOR SUBMISSION TEMPLATE'],
    ['Program', prog],
    ['Month', month],
    ['Generated', new Date().toLocaleString()],
    [''],
    ['HOW TO SUBMIT DATA:'],
    ['1. Enter "Actual Value" for each indicator (column C)'],
    ['2. Add "Remarks" if needed (column D) - e.g., data quality issues, context'],
    ['3. Check "Flagged" (column E) if this data needs M&E Admin review'],
    ['4. Download, fill, upload back to POC Reporting'],
    [''],
    ['FIELD DEFINITIONS:'],
    ['Indicator Code', 'Unique code (do not modify)'],
    ['Indicator Name', 'What is being measured (do not modify)'],
    ['Actual Value', 'FILL THIS - the reported value for this month'],
    ['Remarks', 'Optional notes about the data'],
    ['Flagged', 'Put "Yes" if data needs review'],
    ['Status', 'Do not modify'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrSheet);
  wsInstr['!cols'] = [{wch:30}, {wch:50}];
  XLSX.utils.book_append_sheet(wb, wsInstr, 'README');

  // Sheet 2: Submission Data
  const rows = [['Indicator Code','Indicator Name','Actual Value','Remarks','Flagged','Status']];
  const data = [];
  framework.rows.forEach(ind => {
    const actual = reportingActuals[prog]?.[ind.indicator_row_id] || {};
    data.push([
      ind.indicator_code || '',
      ind.indicator_name || '',
      actual.value || '',
      actual.remarks || '',
      actual.flagged ? 'Yes' : 'No',
      actual.actualStatus || 'pending'
    ]);
  });
  const wsSubmit = XLSX.utils.aoa_to_sheet([...rows, ...data]);
  wsSubmit['!cols'] = [{wch:15}, {wch:40}, {wch:15}, {wch:30}, {wch:10}, {wch:12}];
  // Highlight first column (codes) as read-only visual hint
  XLSX.utils.book_append_sheet(wb, wsSubmit, `${month}`);

  // Sheet 3: Summary
  const summaryData = [
    ['Total Indicators', framework.count],
    ['Submitted', data.filter(d => d[2]).length],
    ['Pending', data.filter(d => !d[2]).length],
    ['Flagged for Review', data.filter(d => d[4] === 'Yes').length],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet([['Metric', 'Count'], ...summaryData]);
  wsSummary['!cols'] = [{wch:25}, {wch:15}];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  const filename = `POC_Submission_${prog.replace(/\s+/g,'_')}_${month.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, filename);
  toast(`✓ Exported submission template · ${framework.count} indicators · ${month}`);
}

function mrImportSubmission() {
  const inp = document.getElementById('mr-import-file');
  if (inp) { inp.click(); }
}

async function mrProcessImport(evt) {
  const file = evt.target.files?.[0];
  if (!file) return;
  try {
    let rows = [];
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (!lines.length) { toast('Empty file'); return; }
      const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g,'').trim());
      rows = lines.slice(1).map(line => {
        const vals = line.match(/(".*?"|[^,]+)(?=,|$)/g) || line.split(',');
        const obj = {};
        headers.forEach((h,i) => { obj[h] = (vals[i]||'').replace(/^"|"$/g,'').trim(); });
        return obj;
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, {defval:''});
    } else {
      toast('Only CSV and XLSX formats supported'); return;
    }

    if (!rows.length) { toast('No data rows found'); return; }
    const parsed = mrParseImportRows(rows);
    if (!parsed.length) { toast('No valid data found'); return; }

    const summary = `Import Preview\n\n${parsed.length} indicators\n\nProceed with import?`;
    if (confirm(summary)) {
      mrConfirmImport(parsed);
    }
  } catch(e) {
    alert('Could not parse file: ' + e.message);
  }
}

function mrParseImportRows(rows) {
  return rows.filter(r => Object.values(r).some(v => v !== '')).map(row => ({
    code: (row['Indicator Code'] || row['indicator_code'] || '').trim(),
    name: (row['Indicator Name'] || row['indicator_name'] || '').trim(),
    value: (row['Actual Value'] || row['actual_value'] || '').trim(),
    remarks: (row['Remarks'] || row['remarks'] || '').trim(),
    flagged: (row['Flagged'] || row['flagged'] || '').toLowerCase() === 'yes',
    status: (row['Status'] || row['status'] || '').trim()
  }));
}

async function mrConfirmImport(parsed) {
  const prog = btStore.activeProg;
  if (!prog || !publishedFrameworkByProg[prog]) { toast('Framework not loaded'); return; }

  const framework = publishedFrameworkByProg[prog];
  let matched = 0;

  parsed.forEach(imported => {
    const indRow = framework.rows.find(r =>
      (r.indicator_code && r.indicator_code === imported.code) ||
      (r.indicator_name && r.indicator_name === imported.name)
    );
    if (indRow) {
      if (!reportingActuals[prog]) reportingActuals[prog] = {};
      reportingActuals[prog][indRow.indicator_row_id] = {
        value: imported.value || '',
        remarks: imported.remarks || '',
        flagged: imported.flagged,
        actualStatus: imported.status || 'imported'
      };
      matched++;
    }
  });

  btRenderMonthly();
  toast(`✓ Imported ${matched} of ${parsed.length} indicator values`);
  document.getElementById('mr-import-file').value = '';
}

$('m-submit').addEventListener('click', async () => {
  $('modal-submit').classList.add('hidden');
  state.submitted = true;

  // Persist to DB first (gracefully degrades if table missing)
  const submitBtn = $('m-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }
  const ok = await mrSubmitToDB();
  if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Confirm &amp; Submit &#8594;'; }

  // Update in-memory status regardless of DB result
  setProgramActualStatus(state.program, 'submitted');
  $('sheet-status').textContent = 'Submitted — awaiting M&E Admin review';
  renderSheet();

  if (ok) {
    toast('✓ Submitted & saved · ' + state.program + ' · ' + state.month);
  } else {
    toast('Submitted locally · DB save failed — check console', 4000);
  }
});

// ── Sidebar toggle ──
$('btn-sidebar-toggle').addEventListener('click', () => {
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    $('screen-app').classList.toggle('sidebar-open');
  } else {
    $('screen-app').classList.toggle('sidebar-collapsed');
  }
});
// Close mobile sidebar when clicking backdrop
$('screen-app').addEventListener('click', e => {
  if (window.innerWidth <= 768 && e.target === $('screen-app')) {
    $('screen-app').classList.remove('sidebar-open');
  }
});

// ── Topbar controls ──
$('month-select').addEventListener('change', e => {
  state.month = e.target.value;
  $('sb-month').textContent = state.month;
  // Reload reporting data for the new month
  if (state.route === 'data-entry-sheet') {
    mrLoadFromDB(state.program, state.month, state.fy || '2025-26').then(() => renderSheet());
  }
});

// FY selector — updates builder FY badge + filter + reloads reporting data
if ($('fy-select')) {
  $('fy-select').addEventListener('change', async e => {
    state.fy = e.target.value;
    builderFilterFY = state.fy;
    const badge = $('builder-fy-badge');
    if (badge) badge.textContent = `Editing FY: ${state.fy}`;
    
    // Update month dropdown based on new FY
    const fyId = e.target.options[e.target.selectedIndex]?.dataset.fyId;
    if (fyId) await populateTopNavMonthDropdown(fyId);
    
    // Reload reporting data for the new FY
    if (state.route === 'data-entry-sheet') {
      mrLoadFromDB(state.program, state.month, state.fy).then(() => renderSheet());
    }
    
    renderBuilderTable();
    toast(`Switched to FY ${state.fy}`);
  });
}
$('btn-notify').addEventListener('click', () => {
  toast('Karnataka, Odisha, Punjab, MP & Assam pending for Feb 2026 · 18 validation flags unresolved');
});

// ── Theme Toggle ──
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
let isDark = prefersDark.matches; // respect system preference; default light (file is light-first)
const themeBtn = $('btn-theme');
function applyTheme() {
  document.body.classList.toggle('dark', isDark);
  if (themeBtn) themeBtn.innerHTML = isDark ? '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
  if (themeBtn) themeBtn.title = isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme';
}
themeBtn?.addEventListener('click', () => { isDark = !isDark; applyTheme(); toast(isDark ? 'Dark theme' : 'Light theme'); });
applyTheme();

applyRoleUI();

// ── Global search ──
// Wires the topbar search so it is never a dead affordance.
// On the data-entry-sheet page it pushes directly into the sheet's search filter.
// On any other page it routes to Monthly Reporting and pre-populates the filter.
(function() {
  const gSearch = $('global-search');
  if (!gSearch) return;
  let debounceTimer;
  gSearch.addEventListener('input', e => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const q = e.target.value.trim();
      if (!q) return;
      if (state.route === 'data-entry-sheet') {
        // Push directly into sheet filter
        state.filters.search = q;
        renderSheet();
        const fEl = $('f-search');
        if (fEl) fEl.value = q;
      } else {
        // Navigate to reporting and pre-set the search term
        toast('Searching indicators for "' + q + '"…');
        if (state.program) {
          state.filters.search = q;
          showPage('data-entry-sheet');
        } else {
          showPage('data-entry');
          toast('Select a program to search its indicators');
        }
      }
    }, 300);
  });
  gSearch.addEventListener('keydown', e => {
    if (e.key === 'Escape') { gSearch.value = ''; state.filters.search = ''; if (state.route === 'data-entry-sheet') renderSheet(); }
  });
})();

// ═══════════════════════════════════════════════════════════════════
// DATA UPLOAD ENGINE
// Isolated store — never touches reportingActuals, builderRows,
// publishedFrameworkByProg, state.filters, or any other existing store.
// ═══════════════════════════════════════════════════════════════════

// ── Upload store ─────────────────────────────────────────────────
// uploadStore.batches   — array of processed upload batch records
// uploadStore.udise     — { [program]: { schools:[], loadedAt } }
// uploadStore.actuals   — { [program]: { schools: Set<udise>, participants: {stk:count} } }
const uploadStore = {
  batches:  [],   // { id, filename, program, month, uploadedAt, totalRows, matched, unmatched, participants, stkBreakdown, errors, status }
  udise:    {},   // { [prog]: { schools: [{udise, name, district, block, students, teachers}], loadedAt } }
  actuals:  {},   // { [prog]: { udiseCodes: Set, stkCounts: {stk:N} } }
};

// ── Required system fields that a response file must map to ──────
const DU_REQUIRED_FIELDS = [
  { key:'udise_code',       label:'UDISE code',         hint:'11-digit school identifier', required:true  },
  { key:'stakeholder_type', label:'Stakeholder type',   hint:'e.g. Teacher, Student, Leader', required:true },
  { key:'participants',     label:'Participant count',  hint:'Number of people who attended', required:true },
  { key:'activity',         label:'Activity type',      hint:'e.g. Workshop, Capacity Building', required:false },
  { key:'school_name',      label:'School name',        hint:'Reference only — used for unmatched fallback', required:false },
  { key:'date',             label:'Activity date',      hint:'Date of the activity', required:false },
];

// Auto-detect column → system field mapping
const DU_PATTERNS = {
  udise_code:       [/udise/i, /u\.?dise/i, /school.?code/i, /school.?id/i],
  stakeholder_type: [/stakeholder/i, /stk.?type/i, /participant.?type/i, /role/i, /category/i],
  participants:     [/participant/i, /count/i, /no\.?.?of/i, /number/i, /attended/i, /total/i],
  activity:         [/activity/i, /workshop/i, /training/i, /session.?type/i, /program.?type/i],
  school_name:      [/school.?name/i, /name.?of.?school/i, /vidyalaya/i],
  date:             [/date/i, /when/i, /conducted.?on/i],
};

function duAutoDetect(colName) {
  for (const [key, patterns] of Object.entries(DU_PATTERNS)) {
    if (patterns.some(p => p.test(colName))) return key;
  }
  return null;
}

// ── State for the current upload in progress ────────────────────
let duState = {
  file:       null,
  filename:   '',
  headers:    [],     // column names from file
  rows:       [],     // parsed data rows (array of objects)
  mapping:    {},     // { colName: systemFieldKey | 'ignore' }
  program:    '',
  month:      '',
};

// ── CSV / XLSX parser (pure JS — no library needed for CSV) ─────
const DU_TEMPLATE_STAKEHOLDERS = ['State', 'DIET', 'BRC', 'CRC', 'HM', 'Parents', 'Student', 'Teacher'];
const DU_STAKEHOLDER_DEFAULT_LEVEL = {
  'State': 'state',
  'DIET': 'district',
  'BRC': 'block',
  'CRC': 'cluster',
  'HM': 'school',
  'Parents': 'school',
  'Student': 'school',
  'Teacher': 'school',
};
const DU_STAKEHOLDER_DEFAULT_HIERARCHY = {
  'State': 'state',
  'DIET': 'diet',
  'BRC': 'brc',
  'CRC': 'crc',
  'HM': 'hm',
  'Parents': 'school',
  'Student': 'school',
  'Teacher': 'school',
};
const DU_GEO_HIERARCHY_OPTIONS = [
  { key: 'state', label: 'State' },
  { key: 'diet', label: 'DIET' },
  { key: 'diet_brc_mid', label: 'Between DIET and BRC (ADC)' },
  { key: 'brc', label: 'BRC' },
  { key: 'crc', label: 'CRC' },
  { key: 'hm', label: 'HM' },
  { key: 'school', label: 'School / Community' },
  { key: 'custom', label: 'Custom placement' },
];
const DU_GEO_LEVEL_OPTIONS = ['state', 'district', 'block', 'cluster', 'school'];
const DU_TEMPLATE_GEO_LEVELS = ['state', 'district', 'block', 'cluster', 'school'];
const DU_GEO_SCOPE_TYPES = [
  { key: 'state_multi', label: 'Multi-state level', level: 'state', multi: true },
  { key: 'state_single', label: 'State level (single state)', level: 'state', multi: false },
  { key: 'district_multi', label: 'Multi-district level', level: 'district', multi: true },
  { key: 'district_single', label: 'District level (single district)', level: 'district', multi: false },
  { key: 'block_multi', label: 'Multi-block level', level: 'block', multi: true },
  { key: 'block_single', label: 'Block level (single block)', level: 'block', multi: false },
  { key: 'cluster_multi', label: 'Multi-cluster level', level: 'cluster', multi: true },
  { key: 'cluster_single', label: 'Cluster level (single cluster)', level: 'cluster', multi: false },
  { key: 'school_multi', label: 'Multi-school level', level: 'school', multi: true },
  { key: 'school_single', label: 'School level (single school)', level: 'school', multi: false },
];
const DU_COLUMN_ROLE_OPTIONS = [
  { key: 'udise_code', label: 'UDISE code' },
  { key: 'stakeholder_type', label: 'Stakeholder type' },
  { key: 'participants', label: 'Participants' },
  { key: 'activity', label: 'Activity name/type' },
  { key: 'date', label: 'Date' },
  { key: 'school_name', label: 'School name' },
  { key: 'custom', label: 'Custom field' },
];
const DU_TEMPLATE_DEFAULT_COLUMNS = [
  { name: 'Timestamp', type: 'datetime', required: true, role: 'custom' },
  { name: 'UDISE Code', type: 'text', required: true, role: 'udise_code' },
  { name: 'Stakeholder Type', type: 'text', required: true, role: 'stakeholder_type' },
  { name: 'Participant Count', type: 'number', required: true, role: 'participants' },
  { name: 'Activity Name', type: 'text', required: true, role: 'activity' },
];
const DU_TEMPLATE_DEFAULT_MATRIX = [
  { label: 'Unique Schools', source: '__unique_udise__', aggregation: 'unique_count', key: 'unique_schools' },
  { label: 'No. of Students', source: 'role:participants', aggregation: 'sum', key: 'no_of_students' },
  { label: 'No. of Teachers', source: 'role:participants', aggregation: 'sum', key: 'no_of_teachers' },
];
const DU_MATRIX_AGG_OPTIONS = [
  { key: 'sum', label: 'Sum' },
  { key: 'count', label: 'Count Rows' },
  { key: 'unique_count', label: 'Unique Count' },
  { key: 'average', label: 'Average' },
];
const DU_TEMPLATE_FREQUENCY_OPTIONS = ['Monthly', 'Quarter', 'Annual'];

const duTemplateStore = {}; // { [program]: [templateObj] }
let duTemplateState = {
  program: '',
  editId: null,
  columns: [],
  matrix: [],
};
let duTemplateGeoScopeState = {
  state: [],
  district: [],
  block: [],
  cluster: [],
  school: [],
};
const duGeoMapStore = {}; // { [program]: { coverageRows:[], rows:[], updatedAt } }
let duGeoMapState = {
  program: '',
  coverageRows: [],
  rows: [],
  cascade: null,
};
let duProgramMaster = [];

function duOptionProgramsFromDOM(id) {
  const sel = $(id);
  if (!sel) return [];
  return Array.from(sel.options).map(o => String(o.value || '').trim()).filter(Boolean);
}

function duEnsureProgramMasterLoaded() {
  if (duProgramMaster.length) return;
  const fromHeader = duOptionProgramsFromDOM('du-prog-sel');
  const fromUdise = duOptionProgramsFromDOM('du-udise-prog');
  const seen = new Set();
  duProgramMaster = [...fromHeader, ...fromUdise].filter(p => {
    const k = p.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function duRenderProgramSelectors(selectedProgram = '') {
  duEnsureProgramMasterLoaded();
  const optHtml = duProgramMaster.map(p => `<option>${esc(p)}</option>`).join('');

  const progSel = $('du-prog-sel');
  if (progSel) {
    const prev = selectedProgram || progSel.value || '';
    progSel.innerHTML = `<option value="">— Select Program —</option>${optHtml}`;
    if (prev && duProgramMaster.some(p => p.toLowerCase() === prev.toLowerCase())) {
      const exact = duProgramMaster.find(p => p.toLowerCase() === prev.toLowerCase()) || prev;
      progSel.value = exact;
    }
  }

  const udiseSel = $('du-udise-prog');
  if (udiseSel) {
    const prev = selectedProgram || udiseSel.value || '';
    udiseSel.innerHTML = `<option value="">— Select Program —</option>${optHtml}`;
    if (prev && duProgramMaster.some(p => p.toLowerCase() === prev.toLowerCase())) {
      const exact = duProgramMaster.find(p => p.toLowerCase() === prev.toLowerCase()) || prev;
      udiseSel.value = exact;
    }
  }
}

function duAddProgram(programName) {
  const name = String(programName || '').trim();
  if (!name) { toast(IC.warning + ' Program name is required'); return null; }
  duEnsureProgramMasterLoaded();
  const exists = duProgramMaster.find(p => p.toLowerCase() === name.toLowerCase());
  if (exists) {
    duRenderProgramSelectors(exists);
    return exists;
  }
  duProgramMaster.push(name);
  duRenderProgramSelectors(name);
  duRenderUdiseGrid();
  duRenderTemplateProgramCards();
  duRenderGeoProgramCards();
  return name;
}

function duTemplatePrograms() {
  duEnsureProgramMasterLoaded();
  if (duProgramMaster.length) return [...duProgramMaster];
  const sel = $('du-prog-sel');
  if (!sel) return [];
  return Array.from(sel.options).map(o => o.value).filter(Boolean);
}

function duTemplateNewId() {
  return `du-tpl-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function duCurrentFinancialYearLabel(dt = new Date()) {
  const d = dt instanceof Date ? dt : new Date();
  const year = d.getMonth() >= 3 ? d.getFullYear() : (d.getFullYear() - 1);
  const nextYY = String((year + 1) % 100).padStart(2, '0');
  return `${year}-${nextYY}`;
}

function duCloneTemplateColumns() {
  return DU_TEMPLATE_DEFAULT_COLUMNS.map(c => ({ ...c }));
}

function duCloneTemplateMatrix() {
  return DU_TEMPLATE_DEFAULT_MATRIX.map(m => ({ ...m }));
}

function duEnsureTemplateProgramStore(program) {
  if (!program) return;
  if (!duTemplateStore[program]) duTemplateStore[program] = [];
}

function duNormalizeStakeholderName(v) {
  return String(v || '').trim().toLowerCase();
}

function duGeoHierarchyTagFromLevel(level = 'school') {
  const lvl = String(level || '').trim().toLowerCase();
  if (lvl === 'state') return 'state';
  if (lvl === 'district') return 'diet';
  if (lvl === 'block') return 'brc';
  if (lvl === 'cluster') return 'crc';
  return 'school';
}

function duGeoHierarchyDefaultOrderFromLevel(level = 'school') {
  const lvl = String(level || '').trim().toLowerCase();
  if (lvl === 'state') return 10;
  if (lvl === 'district') return 20;
  if (lvl === 'block') return 30;
  if (lvl === 'cluster') return 40;
  return 60;
}

function duGeoDefaultHierarchyTag(stakeholder = '', level = 'school') {
  const name = duNormalizeStakeholderName(stakeholder);
  if (DU_STAKEHOLDER_DEFAULT_HIERARCHY[stakeholder]) return DU_STAKEHOLDER_DEFAULT_HIERARCHY[stakeholder];
  if (name.includes('adc')) return 'diet_brc_mid';
  if (name.includes('diet')) return 'diet';
  if (name.includes('brc')) return 'brc';
  if (name.includes('crc')) return 'crc';
  if (name.includes('hm') || name.includes('head')) return 'hm';
  if (name.includes('state')) return 'state';
  return duGeoHierarchyTagFromLevel(level);
}

function duGeoNormalizeHierarchyTag(tag = '', stakeholder = '', level = 'school') {
  const raw = String(tag || '').trim().toLowerCase();
  if (DU_GEO_HIERARCHY_OPTIONS.some(o => o.key === raw)) return raw;
  return duGeoDefaultHierarchyTag(stakeholder, level);
}

function duGeoNormalizeHierarchyLabel(label = '', tag = '', stakeholder = '', level = 'school') {
  const txt = String(label || '').trim();
  const key = duGeoNormalizeHierarchyTag(tag, stakeholder, level);
  if (key === 'custom') return txt || String(stakeholder || '').trim() || 'Custom';
  return '';
}

function duGeoNormalizeHierarchyOrder(order = '', tag = '', level = 'school') {
  const key = duGeoNormalizeHierarchyTag(tag, '', level);
  if (key !== 'custom') return null;
  const num = Number(order);
  if (Number.isFinite(num) && num > 0) return Math.round(num);
  return duGeoHierarchyDefaultOrderFromLevel(level) + 1;
}

function duGeoHierarchyTagLabel(tag = '', stakeholder = '', level = 'school', hierarchyLabel = '') {
  const key = duGeoNormalizeHierarchyTag(tag, stakeholder, level);
  if (key === 'custom') return duGeoNormalizeHierarchyLabel(hierarchyLabel, key, stakeholder, level);
  return DU_GEO_HIERARCHY_OPTIONS.find(o => o.key === key)?.label || key;
}

function duGeoHierarchyWeight(tag = '', stakeholder = '', level = 'school', hierarchyOrder = null) {
  const key = duGeoNormalizeHierarchyTag(tag, stakeholder, level);
  if (key === 'custom') return duGeoNormalizeHierarchyOrder(hierarchyOrder, key, level);
  if (key === 'state') return 10;
  if (key === 'diet') return 20;
  if (key === 'diet_brc_mid') return 25;
  if (key === 'brc') return 30;
  if (key === 'crc') return 40;
  if (key === 'hm') return 50;
  if (key === 'school') return 60;
  return 70;
}

function duGeoSortStakeholderRows(rows = []) {
  return (rows || []).slice().sort((a, b) => {
    const wa = duGeoHierarchyWeight(a?.hierarchyTag, a?.stakeholder, a?.level, a?.hierarchyOrder);
    const wb = duGeoHierarchyWeight(b?.hierarchyTag, b?.stakeholder, b?.level, b?.hierarchyOrder);
    if (wa !== wb) return wa - wb;
    const sa = String(a?.stakeholder || '').trim().toLowerCase();
    const sb = String(b?.stakeholder || '').trim().toLowerCase();
    if (sa < sb) return -1;
    if (sa > sb) return 1;
    return 0;
  });
}

function duSplitScopeValues(scopeText) {
  return String(scopeText || '')
    .split(/[\n,;|]+/)
    .map(v => v.trim())
    .filter(Boolean);
}

function duScopePreview(values, max = 10) {
  const arr = Array.from(new Set(values || []));
  if (!arr.length) return '';
  if (arr.length <= max) return arr.join(', ');
  return `${arr.slice(0, max).join(', ')} (+${arr.length - max} more)`;
}

function duNormalizeGeoToken(v) {
  return duGeoCanon(v);
}

function duGeoCoverageConstraint(coverageRows = []) {
  const fullLevels = new Set();
  const valueMaps = {
    state: new Map(),
    district: new Map(),
    block: new Map(),
    cluster: new Map(),
    school: new Map(),
  };

  (coverageRows || []).filter(r => r?.enabled).forEach(r => {
    const lvl = String(r.level || '').trim().toLowerCase();
    if (!DU_GEO_LEVEL_OPTIONS.includes(lvl)) return;
    const mode = String(r.mode || 'selected').toLowerCase() === 'full' ? 'full' : 'selected';
    if (mode === 'full') fullLevels.add(lvl);
    duSplitScopeValues(r.scope).forEach(raw => {
      const key = duNormalizeGeoToken(raw);
      if (!key) return;
      if (!valueMaps[lvl].has(key)) valueMaps[lvl].set(key, raw.trim());
    });
  });

  const valuesByLevel = {
    state: new Set(Array.from(valueMaps.state.values())),
    district: new Set(Array.from(valueMaps.district.values())),
    block: new Set(Array.from(valueMaps.block.values())),
    cluster: new Set(Array.from(valueMaps.cluster.values())),
    school: new Set(Array.from(valueMaps.school.values())),
  };
  return { fullLevels, valuesByLevel };
}

function duGeoCoverageLevels(coverageRows = []) {
  const lvls = new Set();
  (coverageRows || []).filter(r => r?.enabled).forEach(r => {
    const lvl = String(r.level || '').trim().toLowerCase();
    if (DU_GEO_LEVEL_OPTIONS.includes(lvl)) lvls.add(lvl);
  });
  return Array.from(lvls);
}

const DU_GEO_STATE_CODES = {
  Bihar: 'BR',
  Jharkhand: 'JH',
  'Uttar Pradesh': 'UP',
  Odisha: 'OD',
  Karnataka: 'KA',
  Punjab: 'PB',
  Rajasthan: 'RJ',
  'Madhya Pradesh': 'MP',
  Assam: 'AS',
  Maharashtra: 'MH',
};
const DU_GEO_STATE_DISTRICTS = {
  Bihar: ['PATNA','GAYA','MUZAFFARPUR','BHAGALPUR','NALANDA','VAISHALI','SITAMARHI','DARBHANGA'],
  Jharkhand: ['RANCHI','DHANBAD','BOKARO','DEOGHAR','HAZARIBAGH','GIRIDIH'],
  'Uttar Pradesh': ['LUCKNOW','AGRA','VARANASI','KANPUR NAGAR','PRAYAGRAJ','MEERUT'],
  Odisha: ['ANGUL','BALASORE','CUTTACK','DHENKANAL','BOLANGIR','GAJAPATI'],
  Karnataka: ['BENGALURU URBAN','MYSURU','BELAGAVI','KALABURAGI','SHIVAMOGGA','TUMAKURU'],
  Punjab: ['LUDHIANA','AMRITSAR','JALANDHAR','PATIALA','BATHINDA'],
  Rajasthan: ['JAIPUR','JODHPUR','KOTA','AJMER','UDAIPUR'],
  'Madhya Pradesh': ['BHOPAL','INDORE','JABALPUR','GWALIOR','UJJAIN'],
  Assam: ['KAMRUP','DIBRUGARH','JORHAT','NAGAON','TINSUKIA'],
  Maharashtra: ['PUNE','NASHIK','AURANGABAD','NAGPUR','SOLAPUR'],
};
let duGeoCatalogCache = null;

function duGeoDefaultCascadeState() {
  return {
    scopeType: 'state_multi',
    states: [],
    districtAll: true,
    districts: [],
    blockAll: true,
    blocks: [],
    clusterAll: true,
    clusters: [],
    schoolAll: true,
    schools: [],
    skipCluster: false,
  };
}

function duGeoCanon(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function duGeoUniqueIds(ids = []) {
  return Array.from(new Set((ids || []).filter(Boolean)));
}

function duGeoScopeTypeDef(scopeType) {
  return DU_GEO_SCOPE_TYPES.find(t => t.key === scopeType) || DU_GEO_SCOPE_TYPES[0];
}

function duGeoScopeUiFlags(scopeType) {
  const def = duGeoScopeTypeDef(scopeType);
  const idx = DU_GEO_LEVEL_OPTIONS.indexOf(def.level);
  return {
    def,
    targetLevel: def.level,
    targetIndex: idx < 0 ? 0 : idx,
    lockDistrict: idx < 1,
    lockBlock: idx < 2,
    lockCluster: idx < 3,
    lockSchool: idx < 4,
  };
}

function duGeoScopeTypeFromCoverageRows(coverageRows = []) {
  const byLevel = {};
  (coverageRows || []).filter(r => r?.enabled).forEach(r => {
    byLevel[String(r.level || '').trim().toLowerCase()] = r;
  });
  const ordered = ['school', 'cluster', 'block', 'district', 'state'];
  for (const level of ordered) {
    const row = byLevel[level];
    if (!row) continue;
    const mode = String(row.mode || 'selected').toLowerCase() === 'full' ? 'full' : 'selected';
    const tokens = duSplitScopeValues(row.scope || '');
    if (mode !== 'selected' || !tokens.length) continue;
    return `${level}_${tokens.length > 1 ? 'multi' : 'single'}`;
  }
  return 'state_multi';
}

function duGeoApplyScopeTypeRules(cascade) {
  const c = cascade || duGeoDefaultCascadeState();
  const { def, targetIndex } = duGeoScopeUiFlags(c.scopeType);
  c.scopeType = def.key;
  c.states = duGeoUniqueIds(c.states);
  c.districts = duGeoUniqueIds(c.districts);
  c.blocks = duGeoUniqueIds(c.blocks);
  c.clusters = duGeoUniqueIds(c.clusters);
  c.schools = duGeoUniqueIds(c.schools);

  if (def.level === 'state' && !def.multi) {
    c.states = c.states.slice(0, 1);
  }
  if (def.level === 'district' && !def.multi) {
    c.districtAll = false;
    c.districts = c.districts.slice(0, 1);
  }
  if (def.level === 'block' && !def.multi) {
    c.blockAll = false;
    c.blocks = c.blocks.slice(0, 1);
  }
  if (def.level === 'cluster' && !def.multi) {
    c.clusterAll = false;
    c.clusters = c.clusters.slice(0, 1);
  }
  if (def.level === 'school' && !def.multi) {
    c.schoolAll = false;
    c.schools = c.schools.slice(0, 1);
  }

  if (targetIndex < 1) {
    c.districtAll = true;
    c.districts = [];
  }
  if (targetIndex < 2) {
    c.blockAll = true;
    c.blocks = [];
  }
  if (targetIndex < 3) {
    c.clusterAll = true;
    c.clusters = [];
  }
  if (targetIndex < 4) {
    c.schoolAll = true;
    c.schools = [];
  }

  if (targetIndex >= 3) {
    c.skipCluster = false;
  }

  return c;
}

function duGeoBuildCatalog() {
  const states = Object.keys(DU_GEO_STATE_DISTRICTS).map((stateName, sIdx) => {
    const stateCode = DU_GEO_STATE_CODES[stateName] || `S${String(sIdx + 1).padStart(2, '0')}`;
    const districts = (DU_GEO_STATE_DISTRICTS[stateName] || []).map((districtName, dIdx) => {
      const districtCode = `${stateCode}-D${String(dIdx + 1).padStart(2, '0')}`;
      const blocks = [1,2,3,4].map(bNo => {
        const blockCode = `${districtCode}-B${String(bNo).padStart(2, '0')}`;
        const blockName = `${districtName} Block ${bNo}`;
        const clusters = [1,2,3].map(cNo => {
          const clusterCode = `${blockCode}-C${String(cNo).padStart(2, '0')}`;
          const clusterName = `${blockName} Cluster ${cNo}`;
          const schools = [1,2,3,4].map(sNo => {
            const udise = `${String(sIdx + 11).padStart(2, '0')}${String(dIdx + 1).padStart(2, '0')}${String(bNo).padStart(2, '0')}${String(cNo).padStart(2, '0')}${String(sNo).padStart(3, '0')}`.slice(0,11);
            const schoolName = `${clusterName} School ${sNo}`;
            return {
              id: `SCH:${udise}`,
              udise,
              name: schoolName,
              label: `${schoolName} (${udise})`,
              stateName,
              stateCode,
              districtName,
              districtCode,
              blockName,
              blockCode,
              clusterName,
              clusterCode,
            };
          });
          return {
            id: `CL:${clusterCode}`,
            code: clusterCode,
            name: clusterName,
            label: `${clusterName} (${clusterCode})`,
            schools,
            stateName,
            stateCode,
            districtName,
            districtCode,
            blockName,
            blockCode,
          };
        });
        const blockSchools = clusters.flatMap(c => c.schools);
        return {
          id: `BL:${blockCode}`,
          code: blockCode,
          name: blockName,
          label: `${blockName} (${blockCode})`,
          clusters,
          schools: blockSchools,
          stateName,
          stateCode,
          districtName,
          districtCode,
        };
      });
      return {
        id: `DT:${districtCode}`,
        code: districtCode,
        name: districtName,
        label: `${districtName} (${districtCode})`,
        blocks,
        stateName,
        stateCode,
      };
    });
    return {
      id: `ST:${stateCode}`,
      code: stateCode,
      name: stateName,
      label: `${stateName} (${stateCode})`,
      districts,
    };
  });
  return { states };
}

function duGeoCatalog() {
  if (!duGeoCatalogCache) duGeoCatalogCache = duGeoBuildCatalog();
  return duGeoCatalogCache;
}

function duGeoMultiValues(id) {
  const sel = $(id);
  if (!sel) return [];
  return Array.from(sel.selectedOptions).map(o => o.value);
}

function duGeoRenderMultiSelect(id, items, selectedIds = [], disabled = false) {
  const sel = $(id);
  if (!sel) return;
  const selectedSet = new Set(selectedIds || []);
  sel.innerHTML = items.map(it => `<option value="${esc(it.id)}" ${selectedSet.has(it.id) ? 'selected' : ''}>${esc(it.label)}</option>`).join('');
  sel.disabled = !!disabled || !items.length;
}

function duGeoResolveByInput(inputText, items = []) {
  const token = duGeoCanon(inputText);
  if (!token) return null;
  const exact = items.find(it =>
    token === duGeoCanon(it.name) ||
    token === duGeoCanon(it.code) ||
    token === duGeoCanon(it.label)
  );
  if (exact) return exact;
  return items.find(it =>
    duGeoCanon(it.name).includes(token) ||
    duGeoCanon(it.code).includes(token) ||
    duGeoCanon(it.label).includes(token)
  ) || null;
}

function duGeoResolveStateByInput(inputText, states = []) {
  return duGeoResolveByInput(inputText, states);
}

function duGeoResolveDistrictByInput(inputText, districts = []) {
  return duGeoResolveByInput(inputText, districts);
}

function duGeoResolveBlockByInput(inputText, blocks = []) {
  return duGeoResolveByInput(inputText, blocks);
}

function duGeoResolveClusterByInput(inputText, clusters = []) {
  return duGeoResolveByInput(inputText, clusters);
}

function duGeoResetCascadeBelowState(cascade) {
  cascade.districtAll = true;
  cascade.districts = [];
  duGeoResetCascadeBelowDistrict(cascade);
}

function duGeoResetCascadeBelowDistrict(cascade) {
  cascade.blockAll = true;
  cascade.blocks = [];
  duGeoResetCascadeBelowBlock(cascade);
}

function duGeoResetCascadeBelowBlock(cascade) {
  cascade.clusterAll = true;
  cascade.clusters = [];
  duGeoResetCascadeBelowCluster(cascade);
}

function duGeoResetCascadeBelowCluster(cascade) {
  cascade.schoolAll = true;
  cascade.schools = [];
}

function duGeoRenderStateCombobox(states, selectedIds = [], maxOne = false) {
  const list = $('du-geo-state-list');
  if (list) {
    list.innerHTML = (states || []).map(s => `<option value="${esc(s.label)}"></option>`).join('');
  }

  const pillbox = $('du-geo-state-pillbox');
  if (!pillbox) return;
  const selectedSet = new Set(selectedIds || []);
  const selectedStates = (states || []).filter(s => selectedSet.has(s.id));
  if (!selectedStates.length) {
    pillbox.innerHTML = `<span style="font-size:10px;color:var(--slate);">No state selected yet.</span>`;
    return;
  }

  pillbox.innerHTML = selectedStates.map(s =>
    `<span class="du-geo-pill">${esc(s.label)} <button type="button" data-geo-state-remove="${esc(s.id)}">&times;</button></span>`
  ).join('');

  qsa('[data-geo-state-remove]', pillbox).forEach(btn => {
    btn.addEventListener('click', () => {
      if (!duGeoMapState.cascade) duGeoMapState.cascade = duGeoDefaultCascadeState();
      duGeoMapState.cascade.states = (duGeoMapState.cascade.states || []).filter(id => id !== btn.dataset.geoStateRemove);
      duGeoResetCascadeBelowState(duGeoMapState.cascade);
      duRenderGeoCascadeSelectors();
    });
  });

  const input = $('du-geo-state-combo');
  if (input) {
    if (maxOne && selectedStates.length >= 1) {
      input.value = '';
      input.placeholder = 'Single state scope selected';
    } else {
      input.placeholder = 'Type state name/code';
    }
  }
}

function duGeoRenderDistrictCombobox(districts, selectedIds = [], opts = {}) {
  const disabled = !!opts.disabled;
  const maxOne = !!opts.maxOne;

  const list = $('du-geo-district-list');
  if (list) {
    list.innerHTML = (districts || []).map(d => `<option value="${esc(d.label)}"></option>`).join('');
  }

  const pillbox = $('du-geo-district-pillbox');
  if (!pillbox) return;
  const selectedSet = new Set(selectedIds || []);
  const selectedDistricts = (districts || []).filter(d => selectedSet.has(d.id));
  if (!selectedDistricts.length) {
    pillbox.innerHTML = `<span style="font-size:10px;color:var(--slate);">${disabled ? 'District selection is locked by scope type.' : 'No district selected yet.'}</span>`;
  } else {
    pillbox.innerHTML = selectedDistricts.map(d =>
      `<span class="du-geo-pill">${esc(d.label)} <button type="button" data-geo-district-remove="${esc(d.id)}">&times;</button></span>`
    ).join('');
  }

  qsa('[data-geo-district-remove]', pillbox).forEach(btn => {
    btn.addEventListener('click', () => {
      if (!duGeoMapState.cascade) duGeoMapState.cascade = duGeoDefaultCascadeState();
      duGeoMapState.cascade.districts = (duGeoMapState.cascade.districts || []).filter(id => id !== btn.dataset.geoDistrictRemove);
      duGeoResetCascadeBelowDistrict(duGeoMapState.cascade);
      duRenderGeoCascadeSelectors();
    });
  });

  const input = $('du-geo-district-combo');
  if (input) {
    if (disabled) {
      input.value = '';
      input.placeholder = 'District selection disabled';
    } else if (maxOne && selectedDistricts.length >= 1) {
      input.value = '';
      input.placeholder = 'Single district scope selected';
    } else {
      input.placeholder = 'Type district name/code';
    }
  }
}

function duGeoRenderBlockCombobox(blocks, selectedIds = [], opts = {}) {
  const disabled = !!opts.disabled;
  const maxOne = !!opts.maxOne;

  const list = $('du-geo-block-list');
  if (list) {
    list.innerHTML = (blocks || []).map(b => `<option value="${esc(b.label)}"></option>`).join('');
  }

  const pillbox = $('du-geo-block-pillbox');
  if (!pillbox) return;
  const selectedSet = new Set(selectedIds || []);
  const selectedBlocks = (blocks || []).filter(b => selectedSet.has(b.id));
  if (!selectedBlocks.length) {
    pillbox.innerHTML = `<span style="font-size:10px;color:var(--slate);">${disabled ? 'Block selection is locked by scope type.' : 'No block selected yet.'}</span>`;
  } else {
    pillbox.innerHTML = selectedBlocks.map(b =>
      `<span class="du-geo-pill">${esc(b.label)} <button type="button" data-geo-block-remove="${esc(b.id)}">&times;</button></span>`
    ).join('');
  }

  qsa('[data-geo-block-remove]', pillbox).forEach(btn => {
    btn.addEventListener('click', () => {
      if (!duGeoMapState.cascade) duGeoMapState.cascade = duGeoDefaultCascadeState();
      duGeoMapState.cascade.blocks = (duGeoMapState.cascade.blocks || []).filter(id => id !== btn.dataset.geoBlockRemove);
      duGeoResetCascadeBelowBlock(duGeoMapState.cascade);
      duRenderGeoCascadeSelectors();
    });
  });

  const input = $('du-geo-block-combo');
  if (input) {
    if (disabled) {
      input.value = '';
      input.placeholder = 'Block selection disabled';
    } else if (maxOne && selectedBlocks.length >= 1) {
      input.value = '';
      input.placeholder = 'Single block scope selected';
    } else {
      input.placeholder = 'Type block name/code';
    }
  }
}

function duGeoRenderClusterCombobox(clusters, selectedIds = [], opts = {}) {
  const disabled = !!opts.disabled;
  const maxOne = !!opts.maxOne;
  const skipped = !!opts.skipped;

  const list = $('du-geo-cluster-list');
  if (list) {
    list.innerHTML = (clusters || []).map(c => `<option value="${esc(c.label)}"></option>`).join('');
  }

  const pillbox = $('du-geo-cluster-pillbox');
  if (!pillbox) return;
  const selectedSet = new Set(selectedIds || []);
  const selectedClusters = (clusters || []).filter(c => selectedSet.has(c.id));
  if (!selectedClusters.length) {
    const msg = skipped
      ? 'Cluster is skipped. Disable "Skip cluster" to select.'
      : (disabled ? 'Cluster selection is locked by scope type.' : 'No cluster selected yet.');
    pillbox.innerHTML = `<span style="font-size:10px;color:var(--slate);">${msg}</span>`;
  } else {
    pillbox.innerHTML = selectedClusters.map(c =>
      `<span class="du-geo-pill">${esc(c.label)} <button type="button" data-geo-cluster-remove="${esc(c.id)}">&times;</button></span>`
    ).join('');
  }

  qsa('[data-geo-cluster-remove]', pillbox).forEach(btn => {
    btn.addEventListener('click', () => {
      if (!duGeoMapState.cascade) duGeoMapState.cascade = duGeoDefaultCascadeState();
      duGeoMapState.cascade.clusters = (duGeoMapState.cascade.clusters || []).filter(id => id !== btn.dataset.geoClusterRemove);
      duGeoResetCascadeBelowCluster(duGeoMapState.cascade);
      duRenderGeoCascadeSelectors();
    });
  });

  const input = $('du-geo-cluster-combo');
  if (input) {
    if (disabled) {
      input.value = '';
      input.placeholder = 'Cluster selection disabled';
    } else if (maxOne && selectedClusters.length >= 1) {
      input.value = '';
      input.placeholder = 'Single cluster scope selected';
    } else {
      input.placeholder = 'Type cluster name/code';
    }
  }
}

function duGeoAddStateFromComboInput() {
  if (!duGeoMapState.program) {
    toast(IC.warning + ' Select a program card first');
    return;
  }
  const input = $('du-geo-state-combo');
  const raw = (input?.value || '').trim();
  if (!raw) {
    toast(IC.warning + ' Type a state name or code');
    return;
  }
  const states = duGeoCatalog().states || [];
  const hit = duGeoResolveStateByInput(raw, states);
  if (!hit) {
    toast(IC.warning + ' State not found in catalog');
    return;
  }
  if (!duGeoMapState.cascade) duGeoMapState.cascade = duGeoDefaultCascadeState();
  const maxOne = duGeoScopeTypeDef(duGeoMapState.cascade.scopeType).key === 'state_single';
  const next = new Set(duGeoMapState.cascade.states || []);
  if (maxOne) {
    duGeoMapState.cascade.states = [hit.id];
  } else {
    next.add(hit.id);
    duGeoMapState.cascade.states = Array.from(next);
  }
  duGeoResetCascadeBelowState(duGeoMapState.cascade);
  if (input) input.value = '';
  duRenderGeoCascadeSelectors();
}

function duGeoAddDistrictFromComboInput() {
  if (!duGeoMapState.program) {
    toast(IC.warning + ' Select a program card first');
    return;
  }
  if (!duGeoMapState.cascade) duGeoMapState.cascade = duGeoDefaultCascadeState();
  const scopeDef = duGeoScopeTypeDef(duGeoMapState.cascade.scopeType);
  if (DU_GEO_LEVEL_OPTIONS.indexOf(scopeDef.level) < 1) {
    toast(IC.warning + ' District selection is locked for current scope type');
    return;
  }
  const input = $('du-geo-district-combo');
  const raw = (input?.value || '').trim();
  if (!raw) {
    toast(IC.warning + ' Type a district name or code');
    return;
  }
  const available = duGeoCascadeAvailable(duGeoMapState.cascade).districts || [];
  const hit = duGeoResolveDistrictByInput(raw, available);
  if (!hit) {
    toast(IC.warning + ' District not found under selected states');
    return;
  }
  duGeoMapState.cascade.districtAll = false;
  const next = new Set(duGeoMapState.cascade.districts || []);
  if (scopeDef.key === 'district_single') {
    duGeoMapState.cascade.districts = [hit.id];
  } else {
    next.add(hit.id);
    duGeoMapState.cascade.districts = Array.from(next);
  }
  duGeoResetCascadeBelowDistrict(duGeoMapState.cascade);
  if (input) input.value = '';
  duRenderGeoCascadeSelectors();
}

function duGeoAddBlockFromComboInput() {
  if (!duGeoMapState.program) {
    toast(IC.warning + ' Select a program card first');
    return;
  }
  if (!duGeoMapState.cascade) duGeoMapState.cascade = duGeoDefaultCascadeState();
  const scopeDef = duGeoScopeTypeDef(duGeoMapState.cascade.scopeType);
  if (DU_GEO_LEVEL_OPTIONS.indexOf(scopeDef.level) < 2) {
    toast(IC.warning + ' Block selection is locked for current scope type');
    return;
  }
  const input = $('du-geo-block-combo');
  const raw = (input?.value || '').trim();
  if (!raw) {
    toast(IC.warning + ' Type a block name or code');
    return;
  }
  const available = duGeoCascadeAvailable(duGeoMapState.cascade).blocks || [];
  const hit = duGeoResolveBlockByInput(raw, available);
  if (!hit) {
    toast(IC.warning + ' Block not found under selected districts');
    return;
  }
  duGeoMapState.cascade.blockAll = false;
  const next = new Set(duGeoMapState.cascade.blocks || []);
  if (scopeDef.key === 'block_single') {
    duGeoMapState.cascade.blocks = [hit.id];
  } else {
    next.add(hit.id);
    duGeoMapState.cascade.blocks = Array.from(next);
  }
  duGeoResetCascadeBelowBlock(duGeoMapState.cascade);
  if (input) input.value = '';
  duRenderGeoCascadeSelectors();
}

function duGeoAddClusterFromComboInput() {
  if (!duGeoMapState.program) {
    toast(IC.warning + ' Select a program card first');
    return;
  }
  if (!duGeoMapState.cascade) duGeoMapState.cascade = duGeoDefaultCascadeState();
  const scopeDef = duGeoScopeTypeDef(duGeoMapState.cascade.scopeType);
  if (DU_GEO_LEVEL_OPTIONS.indexOf(scopeDef.level) < 3) {
    toast(IC.warning + ' Cluster selection is locked for current scope type');
    return;
  }
  if (duGeoMapState.cascade.skipCluster) {
    toast(IC.warning + ' Disable "Skip cluster" to select clusters');
    return;
  }
  const input = $('du-geo-cluster-combo');
  const raw = (input?.value || '').trim();
  if (!raw) {
    toast(IC.warning + ' Type a cluster name or code');
    return;
  }
  const available = duGeoCascadeAvailable(duGeoMapState.cascade).clusters || [];
  const hit = duGeoResolveClusterByInput(raw, available);
  if (!hit) {
    toast(IC.warning + ' Cluster not found under selected blocks');
    return;
  }
  duGeoMapState.cascade.clusterAll = false;
  const next = new Set(duGeoMapState.cascade.clusters || []);
  if (scopeDef.key === 'cluster_single') {
    duGeoMapState.cascade.clusters = [hit.id];
  } else {
    next.add(hit.id);
    duGeoMapState.cascade.clusters = Array.from(next);
  }
  duGeoResetCascadeBelowCluster(duGeoMapState.cascade);
  if (input) input.value = '';
  duRenderGeoCascadeSelectors();
}

function duGeoMatchIdsByTokens(items, tokens = []) {
  const normTokens = (tokens || []).map(duGeoCanon).filter(Boolean);
  if (!normTokens.length) return [];
  const ids = [];
  items.forEach(it => {
    const nameN = duGeoCanon(it.name || '');
    const codeN = duGeoCanon(it.code || '');
    const labelN = duGeoCanon(it.label || '');
    const matched = normTokens.some(t =>
      t === nameN || t === codeN || t === labelN ||
      (nameN && nameN.includes(t)) || (t && t.includes(nameN)) ||
      (codeN && codeN.includes(t))
    );
    if (matched) ids.push(it.id);
  });
  return ids;
}

function duGeoCascadeAvailable(cascade) {
  const cat = duGeoCatalog();
  const states = cat.states || [];
  const stateMap = new Map(states.map(s => [s.id, s]));
  const selectedStates = (cascade.states || []).map(id => stateMap.get(id)).filter(Boolean);

  const districts = selectedStates.flatMap(s => s.districts || []);
  const districtMap = new Map(districts.map(d => [d.id, d]));
  const districtsForPath = cascade.districtAll
    ? districts
    : (cascade.districts || []).map(id => districtMap.get(id)).filter(Boolean);

  const blocks = districtsForPath.flatMap(d => d.blocks || []);
  const blockMap = new Map(blocks.map(b => [b.id, b]));
  const blocksForPath = cascade.blockAll
    ? blocks
    : (cascade.blocks || []).map(id => blockMap.get(id)).filter(Boolean);

  const clusters = blocksForPath.flatMap(b => b.clusters || []);
  const clusterMap = new Map(clusters.map(c => [c.id, c]));
  const clustersForPath = cascade.clusterAll
    ? clusters
    : (cascade.clusters || []).map(id => clusterMap.get(id)).filter(Boolean);

  const schoolRaw = cascade.skipCluster
    ? blocksForPath.flatMap(b => b.schools || [])
    : clustersForPath.flatMap(c => c.schools || []);
  const schoolById = new Map();
  schoolRaw.forEach(s => { if (!schoolById.has(s.id)) schoolById.set(s.id, s); });
  const schools = Array.from(schoolById.values());

  return { states, districts, blocks, clusters, schools };
}

function duGeoNormalizeCascade(cascade, available) {
  const hasId = (arr, id) => arr.some(x => x.id === id);
  cascade.scopeType = duGeoScopeTypeDef(cascade.scopeType).key;
  cascade.states = (cascade.states || []).filter(id => hasId(available.states, id));
  cascade.districts = (cascade.districts || []).filter(id => hasId(available.districts, id));
  cascade.blocks = (cascade.blocks || []).filter(id => hasId(available.blocks, id));
  cascade.clusters = (cascade.clusters || []).filter(id => hasId(available.clusters, id));
  cascade.schools = (cascade.schools || []).filter(id => hasId(available.schools, id));
  if (cascade.districtAll) cascade.districts = [];
  if (cascade.blockAll) cascade.blocks = [];
  if (cascade.clusterAll || cascade.skipCluster) cascade.clusters = [];
  if (cascade.schoolAll) cascade.schools = [];
}

function duGeoBuildCoverageRowsFromCascade(cascade, available) {
  const rows = [];
  const selectedStates = available.states.filter(s => (cascade.states || []).includes(s.id));
  if (!selectedStates.length) return rows;

  rows.push({
    id: duGeoNewId(),
    level: 'state',
    mode: 'selected',
    scope: selectedStates.map(s => s.label).join(', '),
    enabled: true,
    builtIn: true,
  });

  if (available.districts.length) {
    const selected = available.districts.filter(d => (cascade.districts || []).includes(d.id));
    rows.push({
      id: duGeoNewId(),
      level: 'district',
      mode: cascade.districtAll ? 'full' : 'selected',
      scope: cascade.districtAll ? '' : selected.map(d => d.label).join(', '),
      enabled: true,
      builtIn: true,
    });
  }
  if (available.blocks.length) {
    const selected = available.blocks.filter(b => (cascade.blocks || []).includes(b.id));
    rows.push({
      id: duGeoNewId(),
      level: 'block',
      mode: cascade.blockAll ? 'full' : 'selected',
      scope: cascade.blockAll ? '' : selected.map(b => b.label).join(', '),
      enabled: true,
      builtIn: true,
    });
  }
  if (!cascade.skipCluster && available.clusters.length) {
    const selected = available.clusters.filter(c => (cascade.clusters || []).includes(c.id));
    rows.push({
      id: duGeoNewId(),
      level: 'cluster',
      mode: cascade.clusterAll ? 'full' : 'selected',
      scope: cascade.clusterAll ? '' : selected.map(c => c.label).join(', '),
      enabled: true,
      builtIn: true,
    });
  }
  if (available.schools.length) {
    const selected = available.schools.filter(s => (cascade.schools || []).includes(s.id));
    rows.push({
      id: duGeoNewId(),
      level: 'school',
      mode: cascade.schoolAll ? 'full' : 'selected',
      scope: cascade.schoolAll ? '' : selected.map(s => s.label).join(', '),
      enabled: true,
      builtIn: true,
    });
  }
  return rows;
}

function duGeoSyncCoverageRowsFromCascade() {
  const cascade = duGeoMapState.cascade || duGeoDefaultCascadeState();
  const available0 = duGeoCascadeAvailable(cascade);
  duGeoNormalizeCascade(cascade, available0);
  duGeoApplyScopeTypeRules(cascade);
  const available = duGeoCascadeAvailable(cascade);
  duGeoNormalizeCascade(cascade, available);
  duGeoMapState.coverageRows = duGeoBuildCoverageRowsFromCascade(cascade, available);
  return { cascade, available };
}

function duGeoCascadeFromCoverageRows(coverageRows = []) {
  const cascade = duGeoDefaultCascadeState();
  cascade.scopeType = duGeoScopeTypeFromCoverageRows(coverageRows);
  const available0 = duGeoCascadeAvailable(cascade);
  const byLevel = {};
  (coverageRows || []).filter(r => r?.enabled).forEach(r => { byLevel[String(r.level || '').toLowerCase()] = r; });

  const stateTokens = duSplitScopeValues(byLevel.state?.scope || '');
  cascade.states = duGeoMatchIdsByTokens(available0.states, stateTokens);

  let available = duGeoCascadeAvailable(cascade);
  const districtRow = byLevel.district;
  if (districtRow) {
    cascade.districtAll = districtRow.mode === 'full';
    cascade.districts = cascade.districtAll ? [] : duGeoMatchIdsByTokens(available.districts, duSplitScopeValues(districtRow.scope));
  }
  available = duGeoCascadeAvailable(cascade);
  const blockRow = byLevel.block;
  if (blockRow) {
    cascade.blockAll = blockRow.mode === 'full';
    cascade.blocks = cascade.blockAll ? [] : duGeoMatchIdsByTokens(available.blocks, duSplitScopeValues(blockRow.scope));
  }
  available = duGeoCascadeAvailable(cascade);
  const clusterRow = byLevel.cluster;
  cascade.skipCluster = !clusterRow;
  if (clusterRow) {
    cascade.clusterAll = clusterRow.mode === 'full';
    cascade.clusters = cascade.clusterAll ? [] : duGeoMatchIdsByTokens(available.clusters, duSplitScopeValues(clusterRow.scope));
  } else {
    cascade.clusterAll = true;
    cascade.clusters = [];
  }
  available = duGeoCascadeAvailable(cascade);
  const schoolRow = byLevel.school;
  if (schoolRow) {
    cascade.schoolAll = schoolRow.mode === 'full';
    cascade.schools = cascade.schoolAll ? [] : duGeoMatchIdsByTokens(available.schools, duSplitScopeValues(schoolRow.scope));
  }
  duGeoApplyScopeTypeRules(cascade);
  return cascade;
}

function duTemplateStakeholderRowsFromProgram(program, existingRows = []) {
  const existingMap = new Map(
    (existingRows || []).map(r => [duNormalizeStakeholderName(r?.stakeholder), r])
  );
  const geoRows = duGeoSortStakeholderRows((duGeoMapStore?.[program]?.rows || [])
    .filter(r => r?.enabled && String(r.stakeholder || '').trim())
    .map(r => ({
      stakeholder: String(r.stakeholder || '').trim(),
      enabled: true,
      level: r.level || 'school',
      hierarchyTag: duGeoNormalizeHierarchyTag(r.hierarchyTag, r.stakeholder, r.level || 'school'),
      hierarchyLabel: duGeoNormalizeHierarchyLabel(r.hierarchyLabel, r.hierarchyTag, r.stakeholder, r.level || 'school'),
      hierarchyOrder: duGeoNormalizeHierarchyOrder(r.hierarchyOrder, r.hierarchyTag, r.level || 'school'),
      scope: String(r.scope || '').trim(),
    })));
  const fallbackRows = DU_TEMPLATE_STAKEHOLDERS.map(s => ({
    stakeholder: s,
    enabled: true,
    level: DU_STAKEHOLDER_DEFAULT_LEVEL[s] || 'school',
    hierarchyTag: duGeoDefaultHierarchyTag(s, DU_STAKEHOLDER_DEFAULT_LEVEL[s] || 'school'),
    hierarchyLabel: '',
    hierarchyOrder: duGeoNormalizeHierarchyOrder(null, duGeoDefaultHierarchyTag(s, DU_STAKEHOLDER_DEFAULT_LEVEL[s] || 'school'), DU_STAKEHOLDER_DEFAULT_LEVEL[s] || 'school'),
    scope: '',
  }));
  const baseRows = geoRows.length ? geoRows : fallbackRows;

  return duGeoSortStakeholderRows(baseRows.map(r => {
    const hit = existingMap.get(duNormalizeStakeholderName(r.stakeholder));
    return {
      stakeholder: r.stakeholder,
      enabled: hit ? !!hit.enabled : true,
      level: r.level,
      hierarchyTag: r.hierarchyTag,
      hierarchyLabel: r.hierarchyLabel || '',
      hierarchyOrder: r.hierarchyOrder,
      // Geography mapping is source of truth for scope.
      scope: r.scope,
    };
  }));
}

function duTemplateGeoScopeFromProgram(program) {
  const available = duTemplateCoverageAvailableByProgram(program);
  return {
    state: available.state || [],
    district: available.district || [],
    block: available.block || [],
    cluster: available.cluster || [],
    school: available.school || [],
  };
}

function duTemplateGeoEmptyState() {
  return { state: [], district: [], block: [], cluster: [], school: [] };
}

function duTemplateGeoLevelLabel(level) {
  if (level === 'state') return 'State';
  if (level === 'district') return 'District';
  if (level === 'block') return 'Block';
  if (level === 'cluster') return 'Cluster';
  return 'School';
}

function duTemplateGeoFilteredScope(program) {
  const base = duTemplateGeoScopeFromProgram(program);
  const stateById = new Map((base.state || []).map(r => [r.id, r]));
  const districtById = new Map((base.district || []).map(r => [r.id, r]));
  const blockById = new Map((base.block || []).map(r => [r.id, r]));
  const clusterById = new Map((base.cluster || []).map(r => [r.id, r]));

  const selectedStates = (duTemplateGeoScopeState.state || []).map(id => stateById.get(id)).filter(Boolean);
  const selectedDistrictsRaw = (duTemplateGeoScopeState.district || []).map(id => districtById.get(id)).filter(Boolean);
  const selectedBlocksRaw = (duTemplateGeoScopeState.block || []).map(id => blockById.get(id)).filter(Boolean);
  const selectedClustersRaw = (duTemplateGeoScopeState.cluster || []).map(id => clusterById.get(id)).filter(Boolean);

  let districts = (base.district || []).slice();
  if (selectedStates.length) {
    const stateCodes = new Set(selectedStates.map(s => s.code || s.stateCode).filter(Boolean));
    districts = stateCodes.size ? districts.filter(d => stateCodes.has(d.stateCode || d.code)) : districts;
  }

  let blocks = (base.block || []).slice();
  if (selectedDistrictsRaw.length) {
    const districtCodes = new Set(selectedDistrictsRaw.map(d => d.code || d.districtCode).filter(Boolean));
    blocks = districtCodes.size ? blocks.filter(b => districtCodes.has(b.districtCode || b.code)) : blocks;
  } else if (selectedStates.length) {
    const stateCodes = new Set(selectedStates.map(s => s.code || s.stateCode).filter(Boolean));
    blocks = stateCodes.size ? blocks.filter(b => stateCodes.has(b.stateCode || b.code)) : blocks;
  }

  let clusters = (base.cluster || []).slice();
  if (selectedBlocksRaw.length) {
    const blockCodes = new Set(selectedBlocksRaw.map(b => b.code || b.blockCode).filter(Boolean));
    clusters = blockCodes.size ? clusters.filter(c => blockCodes.has(c.blockCode || c.code)) : clusters;
  } else if (selectedDistrictsRaw.length) {
    const districtCodes = new Set(selectedDistrictsRaw.map(d => d.code || d.districtCode).filter(Boolean));
    clusters = districtCodes.size ? clusters.filter(c => districtCodes.has(c.districtCode || c.code)) : clusters;
  } else if (selectedStates.length) {
    const stateCodes = new Set(selectedStates.map(s => s.code || s.stateCode).filter(Boolean));
    clusters = stateCodes.size ? clusters.filter(c => stateCodes.has(c.stateCode || c.code)) : clusters;
  }

  let schools = (base.school || []).slice();
  if (selectedClustersRaw.length) {
    const clusterCodes = new Set(selectedClustersRaw.map(c => c.code || c.clusterCode).filter(Boolean));
    schools = clusterCodes.size ? schools.filter(s => clusterCodes.has(s.clusterCode || s.code)) : schools;
  } else if (selectedBlocksRaw.length) {
    const blockCodes = new Set(selectedBlocksRaw.map(b => b.code || b.blockCode).filter(Boolean));
    schools = blockCodes.size ? schools.filter(s => blockCodes.has(s.blockCode || s.code)) : schools;
  } else if (selectedDistrictsRaw.length) {
    const districtCodes = new Set(selectedDistrictsRaw.map(d => d.code || d.districtCode).filter(Boolean));
    schools = districtCodes.size ? schools.filter(s => districtCodes.has(s.districtCode || s.code)) : schools;
  } else if (selectedStates.length) {
    const stateCodes = new Set(selectedStates.map(s => s.code || s.stateCode).filter(Boolean));
    schools = stateCodes.size ? schools.filter(s => stateCodes.has(s.stateCode || s.code)) : schools;
  }

  return {
    state: (base.state || []).slice(),
    district: districts,
    block: blocks,
    cluster: clusters,
    school: schools,
  };
}

function duTemplateGeoNormalizeSelections(options) {
  let changed = false;
  DU_TEMPLATE_GEO_LEVELS.forEach(level => {
    const validIds = new Set((options[level] || []).map(it => it.id));
    const prev = Array.isArray(duTemplateGeoScopeState[level]) ? duTemplateGeoScopeState[level] : [];
    const nextAll = prev.filter(id => validIds.has(id));
    const next = nextAll.length ? [nextAll[0]] : [];
    if (next.length !== prev.length || next[0] !== prev[0]) changed = true;
    duTemplateGeoScopeState[level] = next;
  });
  return changed;
}

function duTemplateGeoUpdateHiddenFields(optionsByLevel) {
  DU_TEMPLATE_GEO_LEVELS.forEach(level => {
    const hidden = $(`du-tpl-geo-${level}`);
    if (!hidden) return;
    const selectedId = (duTemplateGeoScopeState[level] || [])[0] || '';
    const selectedRow = (optionsByLevel[level] || []).find(r => r.id === selectedId);
    if (selectedRow) {
      hidden.value = selectedRow.label || selectedRow.name || selectedRow.code || '';
      return;
    }
    const total = (optionsByLevel[level] || []).length;
    hidden.value = total ? `All in mapped scope (${total})` : '';
  });
}

function duTemplateGeoRenderLevel(level, rows, hasProgram) {
  const sel = $(`du-tpl-geo-${level}-sel`);
  if (!sel) return;

  const options = rows || [];
  const selectedId = (duTemplateGeoScopeState[level] || [])[0] || '';
  const label = duTemplateGeoLevelLabel(level);

  if (!hasProgram) {
    sel.innerHTML = `<option value="">Select program first</option>`;
    sel.value = '';
    sel.disabled = true;
    return;
  }
  if (!options.length) {
    sel.innerHTML = `<option value="">No mapped ${label.toLowerCase()} available</option>`;
    sel.value = '';
    sel.disabled = true;
    duTemplateGeoScopeState[level] = [];
    return;
  }
  const allLabel = `All mapped ${label.toLowerCase()} (${options.length.toLocaleString()})`;
  sel.innerHTML = `<option value="">${esc(allLabel)}</option>` +
    options.map(r => `<option value="${esc(r.id)}">${esc(r.label || r.name || r.code || '')}</option>`).join('');
  sel.disabled = false;
  sel.value = selectedId && options.some(r => r.id === selectedId) ? selectedId : '';
  duTemplateGeoScopeState[level] = sel.value ? [sel.value] : [];
}

function duTemplateGeoRenderSelectors(program) {
  if (!program) {
    duTemplateGeoScopeState = duTemplateGeoEmptyState();
    DU_TEMPLATE_GEO_LEVELS.forEach(level => {
      if ($(`du-tpl-geo-${level}`)) $(`du-tpl-geo-${level}`).value = '';
      duTemplateGeoRenderLevel(level, [], false);
    });
    if ($('du-tpl-geo-note')) $('du-tpl-geo-note').textContent = 'Scope options come from Geography Mapping. Keep empty to use full mapped scope for a level.';
    return;
  }

  let options = duTemplateGeoFilteredScope(program);
  if (duTemplateGeoNormalizeSelections(options)) options = duTemplateGeoFilteredScope(program);
  if (duTemplateGeoNormalizeSelections(options)) options = duTemplateGeoFilteredScope(program);

  DU_TEMPLATE_GEO_LEVELS.forEach(level => {
    duTemplateGeoRenderLevel(level, options[level] || [], true);
  });
  duTemplateGeoUpdateHiddenFields(options);

  const hasSavedGeo = !!duGeoMapStore?.[program]?.updatedAt;
  if ($('du-tpl-geo-note')) {
    $('du-tpl-geo-note').textContent = hasSavedGeo
      ? `Scope options loaded from Geography Mapping for ${program}.`
      : `Demo geography list (hardcoded) is shown for ${program}. Save Geography Mapping to replace this with program-specific scope.`;
  }
}

function duTemplateGeoHandleLevelChange(level) {
  const sel = $(`du-tpl-geo-${level}-sel`);
  if (!sel) return;
  const val = String(sel.value || '').trim();
  duTemplateGeoScopeState[level] = val ? [val] : [];
  const idx = DU_TEMPLATE_GEO_LEVELS.indexOf(level);
  if (idx >= 0) {
    for (let i = idx + 1; i < DU_TEMPLATE_GEO_LEVELS.length; i++) {
      duTemplateGeoScopeState[DU_TEMPLATE_GEO_LEVELS[i]] = [];
    }
  }
  duTemplateGeoRenderSelectors(duTemplateState.program);
}

function duTemplateGeoLoadFromTemplate(program, geography = {}, geographyIds = null) {
  duTemplateGeoScopeState = duTemplateGeoEmptyState();
  if (!program) {
    duTemplateGeoRenderSelectors('');
    return;
  }

  if (geographyIds && typeof geographyIds === 'object') {
    DU_TEMPLATE_GEO_LEVELS.forEach(level => {
      const ids = duGeoUniqueIds(Array.isArray(geographyIds[level]) ? geographyIds[level] : []);
      duTemplateGeoScopeState[level] = ids.length ? [ids[0]] : [];
    });
    duTemplateGeoRenderSelectors(program);
    return;
  }

  const base = duTemplateGeoScopeFromProgram(program);
  DU_TEMPLATE_GEO_LEVELS.forEach(level => {
    const raw = String(geography?.[level] || '').trim();
    if (!raw || /^all\s+in\s+mapped\s+scope/i.test(raw)) {
      duTemplateGeoScopeState[level] = [];
      return;
    }
    const tokens = duSplitScopeValues(raw);
    const ids = duGeoUniqueIds(duGeoMatchIdsByTokens(base[level] || [], tokens));
    duTemplateGeoScopeState[level] = ids.length ? [ids[0]] : [];
  });
  duTemplateGeoRenderSelectors(program);
}

function duApplyGeoScopeToTemplate(program) {
  duTemplateGeoScopeState = duTemplateGeoEmptyState();
  duTemplateGeoRenderSelectors(program || '');
}

function duTemplateSourceOptions() {
  const opts = [{ value: '__unique_udise__', label: 'UDISE (derived unique)' }];
  const colSeen = new Set();
  const roleSeen = new Set();
  duTemplateState.columns.forEach((col, idx) => {
    const name = (col.name || '').trim();
    const slug = name.toLowerCase();
    if (name && !colSeen.has(slug)) {
      colSeen.add(slug);
      opts.push({ value: `col:${name}`, label: `Column: ${name}` });
    } else if (!name && !colSeen.has(`__unnamed_${idx}`)) {
      colSeen.add(`__unnamed_${idx}`);
      opts.push({ value: `col:__idx_${idx}`, label: `Column ${idx + 1} (unnamed)` });
    }
    if (col.role && col.role !== 'custom' && !roleSeen.has(col.role)) {
      roleSeen.add(col.role);
      const roleLabel = DU_COLUMN_ROLE_OPTIONS.find(o => o.key === col.role)?.label || col.role;
      opts.push({ value: `role:${col.role}`, label: `${roleLabel} (mapped)` });
    }
  });
  if (!roleSeen.has('participants')) {
    opts.push({ value: 'role:participants', label: 'Participants (mapped)' });
  }
  return opts;
}

function duRenderTemplateColumnRows() {
  const wrap = $('du-template-columns');
  if (!wrap) return;
  if (!duTemplateState.columns.length) duTemplateState.columns = duCloneTemplateColumns();

  wrap.innerHTML = duTemplateState.columns.map((col, idx) => {
    const roleOpts = DU_COLUMN_ROLE_OPTIONS
      .map(o => `<option value="${o.key}" ${col.role === o.key ? 'selected' : ''}>${o.label}</option>`)
      .join('');
    return `<div class="du-template-col-row" data-col-idx="${idx}">
      <input class="du-template-input" data-col-field="name" value="${esc(col.name || '')}" placeholder="Column name" />
      <select class="du-template-select" data-col-field="type">
        <option value="text" ${col.type === 'text' ? 'selected' : ''}>Text</option>
        <option value="number" ${col.type === 'number' ? 'selected' : ''}>Number</option>
        <option value="date" ${col.type === 'date' ? 'selected' : ''}>Date</option>
        <option value="datetime" ${col.type === 'datetime' ? 'selected' : ''}>Date & Time</option>
        <option value="choice" ${col.type === 'choice' ? 'selected' : ''}>Single Choice</option>
      </select>
      <div class="du-template-col-required"><input type="checkbox" data-col-field="required" ${col.required ? 'checked' : ''} /></div>
      <select class="du-template-select" data-col-field="role">${roleOpts}</select>
      <button class="btn" data-col-remove="${idx}" style="font-size:10px;padding:3px 7px;">×</button>
    </div>`;
  }).join('');

  qsa('[data-col-field="name"]', wrap).forEach(inp => {
    inp.addEventListener('input', e => {
      const row = e.target.closest('.du-template-col-row');
      if (!row) return;
      const idx = +row.dataset.colIdx;
      if (duTemplateState.columns[idx]) duTemplateState.columns[idx].name = e.target.value;
      duRenderTemplateMatrixRows();
    });
  });
  qsa('[data-col-field="type"]', wrap).forEach(sel => {
    sel.addEventListener('change', e => {
      const row = e.target.closest('.du-template-col-row');
      if (!row) return;
      const idx = +row.dataset.colIdx;
      if (duTemplateState.columns[idx]) duTemplateState.columns[idx].type = e.target.value;
    });
  });
  qsa('[data-col-field="required"]', wrap).forEach(chk => {
    chk.addEventListener('change', e => {
      const row = e.target.closest('.du-template-col-row');
      if (!row) return;
      const idx = +row.dataset.colIdx;
      if (duTemplateState.columns[idx]) duTemplateState.columns[idx].required = !!e.target.checked;
    });
  });
  qsa('[data-col-field="role"]', wrap).forEach(sel => {
    sel.addEventListener('change', e => {
      const row = e.target.closest('.du-template-col-row');
      if (!row) return;
      const idx = +row.dataset.colIdx;
      if (duTemplateState.columns[idx]) duTemplateState.columns[idx].role = e.target.value;
      duRenderTemplateMatrixRows();
    });
  });
  qsa('[data-col-remove]', wrap).forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.colRemove;
      if (duTemplateState.columns.length <= 1) {
        toast(IC.warning + ' Keep at least one response column');
        return;
      }
      duTemplateState.columns.splice(idx, 1);
      duRenderTemplateColumnRows();
      duRenderTemplateMatrixRows();
    });
  });
}

function duAddTemplateColumn() {
  duTemplateState.columns.push({ name: '', type: 'text', required: false, role: 'custom' });
  duRenderTemplateColumnRows();
  duRenderTemplateMatrixRows();
}

function duRenderTemplateMatrixRows() {
  const wrap = $('du-template-matrix-rows');
  if (!wrap) return;
  if (!duTemplateState.matrix.length) duTemplateState.matrix = duCloneTemplateMatrix();
  const sourceOpts = duTemplateSourceOptions();

  wrap.innerHTML = duTemplateState.matrix.map((m, idx) => {
    const sourceOptsHtml = sourceOpts
      .map(o => `<option value="${esc(o.value)}" ${m.source === o.value ? 'selected' : ''}>${esc(o.label)}</option>`)
      .join('');
    const aggOptsHtml = DU_MATRIX_AGG_OPTIONS
      .map(o => `<option value="${o.key}" ${m.aggregation === o.key ? 'selected' : ''}>${o.label}</option>`)
      .join('');
    return `<div class="du-template-col-row" data-matrix-idx="${idx}">
      <input class="du-template-input" data-matrix-field="label" value="${esc(m.label || '')}" placeholder="Metric label" />
      <select class="du-template-select" data-matrix-field="source">${sourceOptsHtml}</select>
      <select class="du-template-select" data-matrix-field="aggregation">${aggOptsHtml}</select>
      <input class="du-template-input" data-matrix-field="key" value="${esc(m.key || '')}" placeholder="output_key" />
      <button class="btn" data-matrix-remove="${idx}" style="font-size:10px;padding:3px 7px;">×</button>
    </div>`;
  }).join('');

  qsa('[data-matrix-field="label"]', wrap).forEach(inp => {
    inp.addEventListener('input', e => {
      const row = e.target.closest('.du-template-col-row');
      if (!row) return;
      const idx = +row.dataset.matrixIdx;
      if (duTemplateState.matrix[idx]) duTemplateState.matrix[idx].label = e.target.value;
    });
  });
  qsa('[data-matrix-field="source"]', wrap).forEach(sel => {
    sel.addEventListener('change', e => {
      const row = e.target.closest('.du-template-col-row');
      if (!row) return;
      const idx = +row.dataset.matrixIdx;
      if (duTemplateState.matrix[idx]) duTemplateState.matrix[idx].source = e.target.value;
    });
  });
  qsa('[data-matrix-field="aggregation"]', wrap).forEach(sel => {
    sel.addEventListener('change', e => {
      const row = e.target.closest('.du-template-col-row');
      if (!row) return;
      const idx = +row.dataset.matrixIdx;
      if (duTemplateState.matrix[idx]) duTemplateState.matrix[idx].aggregation = e.target.value;
    });
  });
  qsa('[data-matrix-field="key"]', wrap).forEach(inp => {
    inp.addEventListener('input', e => {
      const row = e.target.closest('.du-template-col-row');
      if (!row) return;
      const idx = +row.dataset.matrixIdx;
      if (duTemplateState.matrix[idx]) duTemplateState.matrix[idx].key = e.target.value;
    });
  });
  qsa('[data-matrix-remove]', wrap).forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.matrixRemove;
      if (duTemplateState.matrix.length <= 1) {
        toast(IC.warning + ' Keep at least one matrix metric');
        return;
      }
      duTemplateState.matrix.splice(idx, 1);
      duRenderTemplateMatrixRows();
    });
  });
}

function duAddTemplateMatrixMetric() {
  duTemplateState.matrix.push({ label: '', source: 'role:participants', aggregation: 'sum', key: '' });
  duRenderTemplateMatrixRows();
}

function duTemplateTargetStakeholderNames(rows = null) {
  const data = duGeoSortStakeholderRows((rows && rows.length) ? rows : duCollectStakeholderMappings());
  const seen = new Set();
  return data
    .map(r => String(r.stakeholder || '').trim())
    .filter(name => {
      if (!name) return false;
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function duTemplateStakeholderInputName(raw = '') {
  return String(raw || '').replace(/\s*\(\s*[\d,]+\s*\)\s*$/, '').trim();
}

function duTemplateDemoCoverage(program = '') {
  const empty = { state: [], district: [], block: [], cluster: [], school: [] };
  const states = duGeoCatalog().states || [];
  if (!states.length) return empty;

  const pToken = duGeoCanon(program);
  let chosenStates = states;
  if (pToken) {
    const matched = states.filter(s =>
      duGeoCanon(s.name).includes(pToken) ||
      duGeoCanon(s.code).includes(pToken) ||
      duGeoCanon(s.label).includes(pToken)
    );
    if (matched.length) chosenStates = matched;
  }

  const districts = chosenStates.flatMap(s => s.districts || []);
  const blocks = districts.flatMap(d => d.blocks || []);
  const clusters = blocks.flatMap(b => b.clusters || []);
  const schools = clusters.flatMap(c => c.schools || []);

  return {
    state: chosenStates,
    district: districts,
    block: blocks,
    cluster: clusters,
    school: schools,
  };
}

function duTemplateCoverageAvailableByProgram(program) {
  const empty = { state: [], district: [], block: [], cluster: [], school: [] };
  if (!program) return empty;

  const sourceRows = (duGeoMapState.program === program && Array.isArray(duGeoMapState.coverageRows) && duGeoMapState.coverageRows.length)
    ? duGeoMapState.coverageRows
    : (duGeoMapStore?.[program]?.coverageRows || []);
  if (!sourceRows.length) return duTemplateDemoCoverage(program);

  const cleanCoverageRows = sourceRows
    .filter(r => r?.enabled)
    .map(r => ({
      ...r,
      level: String(r.level || '').trim().toLowerCase(),
      mode: String(r.mode || 'selected').toLowerCase() === 'full' ? 'full' : 'selected',
      scope: String(r.scope || '').trim(),
    }))
    .filter(r => DU_GEO_LEVEL_OPTIONS.includes(r.level));
  if (!cleanCoverageRows.length) return duTemplateDemoCoverage(program);

  const cascade = duGeoCascadeFromCoverageRows(cleanCoverageRows);
  duGeoApplyScopeTypeRules(cascade);
  const available = duGeoCascadeAvailable(cascade);
  const stateMap = new Map((duGeoCatalog().states || []).map(s => [s.id, s]));
  const selectedStates = (cascade.states || []).map(id => stateMap.get(id)).filter(Boolean);

  return {
    state: selectedStates,
    district: available.districts || [],
    block: available.blocks || [],
    cluster: available.clusters || [],
    school: available.schools || [],
  };
}

function duTemplateStakeholderCount(row, levelPools) {
  if (!row) return 0;
  const level = DU_GEO_LEVEL_OPTIONS.includes(String(row.level || '').trim().toLowerCase())
    ? String(row.level || '').trim().toLowerCase()
    : 'school';
  const pool = Array.isArray(levelPools?.[level]) ? levelPools[level] : [];
  const tokens = duSplitScopeValues(row.scope || '');
  if (!tokens.length) return pool.length;
  if (!pool.length) return tokens.length;
  const matchedIds = duGeoUniqueIds(duGeoMatchIdsByTokens(pool, tokens));
  return matchedIds.length || tokens.length;
}

function duTemplateStakeholderCountMap(rows = [], program = '') {
  const pools = duTemplateCoverageAvailableByProgram(program);
  const out = {};
  duGeoSortStakeholderRows(rows || []).forEach(r => {
    const name = String(r?.stakeholder || '').trim();
    if (!name) return;
    if (Object.prototype.hasOwnProperty.call(out, name)) return;
    out[name] = duTemplateStakeholderCount(r, pools);
  });
  return out;
}

function duTemplateStakeholderDisplayName(name, countMap = {}) {
  const n = String(name || '').trim();
  if (!n) return '';
  const count = Number(countMap?.[n]);
  const safeCount = Number.isFinite(count) && count >= 0 ? count : 0;
  return `${n} (${safeCount.toLocaleString()})`;
}

function duApplyTemplateTargetStakeholders(pickedSet = new Set()) {
  const wrap = $('du-template-stk-map');
  if (!wrap) return;
  qsa('.du-template-stk-row', wrap).forEach(row => {
    const name = row.querySelector('[data-stk-field="name"]')?.value || '';
    const chk = row.querySelector('[data-stk-field="enabled"]');
    if (chk) chk.checked = pickedSet.has(name);
  });
  duRenderTemplateTargetStakeholderPicker();
}

function duRenderTemplateTargetStakeholderPicker(rows = null) {
  const sel = $('du-tpl-target-stk');
  const list = $('du-tpl-target-stk-list');
  const combo = $('du-tpl-target-stk-combo');
  const addBtn = $('du-tpl-target-stk-add-btn');
  const pillbox = $('du-tpl-target-stk-pillbox');
  if (!sel || !list || !combo || !addBtn || !pillbox) return;
  const data = duGeoSortStakeholderRows((rows && rows.length) ? rows : duCollectStakeholderMappings());
  const names = duTemplateTargetStakeholderNames(data);
  const countMap = duTemplateStakeholderCountMap(data, duTemplateState.program);
  if (!data.length || !names.length) {
    sel.innerHTML = '';
    list.innerHTML = '';
    pillbox.innerHTML = `<span style="font-size:10px;color:var(--slate);">No stakeholder types available yet.</span>`;
    sel.disabled = true;
    combo.disabled = true;
    addBtn.disabled = true;
    return;
  }
  const selectedSet = new Set(data.filter(r => r.enabled).map(r => String(r.stakeholder || '').trim()).filter(Boolean));
  sel.innerHTML = names
    .map(name => `<option value="${esc(name)}" ${selectedSet.has(name) ? 'selected' : ''}>${esc(duTemplateStakeholderDisplayName(name, countMap))}</option>`)
    .join('');
  list.innerHTML = names.map(name => `<option value="${esc(duTemplateStakeholderDisplayName(name, countMap))}"></option>`).join('');
  sel.disabled = false;
  combo.disabled = false;
  addBtn.disabled = false;
  combo.placeholder = 'Type stakeholder type (count shown)';

  const selectedNames = names.filter(name => selectedSet.has(name));
  if (!selectedNames.length) {
    pillbox.innerHTML = `<span style="font-size:10px;color:var(--slate);">No target stakeholder selected.</span>`;
  } else {
    pillbox.innerHTML = selectedNames
      .map(name => `<span class="du-geo-pill">${esc(duTemplateStakeholderDisplayName(name, countMap))} <button type="button" data-tpl-target-remove="${esc(name)}">&times;</button></span>`)
      .join('');
  }
  qsa('[data-tpl-target-remove]', pillbox).forEach(btn => {
    btn.addEventListener('click', () => {
      const next = new Set(Array.from(sel.selectedOptions).map(o => o.value));
      next.delete(btn.dataset.tplTargetRemove || '');
      duApplyTemplateTargetStakeholders(next);
    });
  });
}

function duApplyTemplateTargetStakeholdersFromPicker() {
  const sel = $('du-tpl-target-stk');
  if (!sel) return;
  const picked = new Set(Array.from(sel.selectedOptions).map(o => o.value));
  duApplyTemplateTargetStakeholders(picked);
}

function duAddTemplateTargetStakeholderFromComboInput() {
  const combo = $('du-tpl-target-stk-combo');
  const sel = $('du-tpl-target-stk');
  if (!combo || !sel || combo.disabled) return;
  const raw = String(combo.value || '').trim();
  if (!raw) {
    toast(IC.warning + ' Type stakeholder type to add');
    return;
  }
  const names = duTemplateTargetStakeholderNames();
  if (!names.length) {
    toast(IC.warning + ' No stakeholder types available');
    return;
  }
  const token = duGeoCanon(duTemplateStakeholderInputName(raw));
  if (!token) {
    toast(IC.warning + ' Stakeholder type not found in this program');
    return;
  }
  const exact = names.find(n => duGeoCanon(n) === token);
  const hit = exact || names.find(n => duGeoCanon(n).includes(token) || token.includes(duGeoCanon(n)));
  if (!hit) {
    toast(IC.warning + ' Stakeholder type not found in this program');
    return;
  }
  const next = new Set(Array.from(sel.selectedOptions).map(o => o.value));
  next.add(hit);
  combo.value = '';
  duApplyTemplateTargetStakeholders(next);
}

function duRenderTemplateStakeholderRows(rows = null) {
  const wrap = $('du-template-stk-map');
  if (!wrap) return;
  const dataRaw = (rows && rows.length)
    ? rows
    : duTemplateStakeholderRowsFromProgram(duTemplateState.program);
  const data = duGeoSortStakeholderRows(dataRaw);
  wrap.innerHTML = data.map((r, idx) => {
    const levelOpts = DU_GEO_LEVEL_OPTIONS
      .map(l => `<option value="${l}" ${r.level === l ? 'selected' : ''}>${l}</option>`)
      .join('');
    return `<div class="du-template-stk-row" data-stk-row="${idx}">
      <label class="du-template-stk-pill">
        <input type="checkbox" data-stk-field="enabled" ${r.enabled ? 'checked' : ''} />
        <span>${esc(r.stakeholder)}</span>
      </label>
      <select class="du-template-select" data-stk-field="level" disabled>${levelOpts}</select>
      <input class="du-template-input" data-stk-field="scope" value="${esc(r.scope || '')}" placeholder="Inherited from geography mapping" readonly />
      <input type="hidden" data-stk-field="name" value="${esc(r.stakeholder)}" />
      <input type="hidden" data-stk-field="hierarchyTag" value="${esc(duGeoNormalizeHierarchyTag(r.hierarchyTag, r.stakeholder, r.level))}" />
      <input type="hidden" data-stk-field="hierarchyLabel" value="${esc(duGeoNormalizeHierarchyLabel(r.hierarchyLabel, r.hierarchyTag, r.stakeholder, r.level))}" />
      <input type="hidden" data-stk-field="hierarchyOrder" value="${esc(duGeoNormalizeHierarchyOrder(r.hierarchyOrder, r.hierarchyTag, r.level))}" />
    </div>`;
  }).join('');

  qsa('[data-stk-field="enabled"]', wrap).forEach(chk => {
    chk.addEventListener('change', () => duRenderTemplateTargetStakeholderPicker());
  });
  duRenderTemplateTargetStakeholderPicker(data);
}

function duCollectStakeholderMappings() {
  return qsa('.du-template-stk-row', $('du-template-stk-map')).map(row => {
    const get = f => row.querySelector(`[data-stk-field="${f}"]`);
    const stakeholder = get('name')?.value || '';
    const level = get('level')?.value || 'school';
    return {
      stakeholder,
      enabled: !!get('enabled')?.checked,
      level,
      hierarchyTag: duGeoNormalizeHierarchyTag(get('hierarchyTag')?.value || '', stakeholder, level),
      hierarchyLabel: duGeoNormalizeHierarchyLabel(get('hierarchyLabel')?.value || '', get('hierarchyTag')?.value || '', stakeholder, level),
      hierarchyOrder: duGeoNormalizeHierarchyOrder(get('hierarchyOrder')?.value || '', get('hierarchyTag')?.value || '', level),
      scope: (get('scope')?.value || '').trim(),
    };
  });
}

function duRenderTemplateProgramCards() {
  const grid = $('du-template-prog-grid');
  if (!grid) return;
  const programs = duTemplatePrograms();
  grid.innerHTML = programs.map(p => {
    const list = duTemplateStore[p] || [];
    const published = list.filter(t => t.status === 'published').length;
    const active = duTemplateState.program === p ? ' active' : '';
    return `<div class="du-template-prog-card${active}" data-tpl-prog="${esc(p)}">
      <div class="du-template-prog-name">${esc(p)}</div>
      <div class="du-template-prog-meta"><span>${list.length} templates</span><span>${published} published</span></div>
    </div>`;
  }).join('');
  qsa('[data-tpl-prog]', grid).forEach(card => {
    card.addEventListener('click', () => duSelectTemplateProgram(card.dataset.tplProg));
  });
}

function duTemplateResetForm() {
  duTemplateState.editId = null;
  duTemplateState.columns = duCloneTemplateColumns();
  duTemplateState.matrix = duCloneTemplateMatrix();
  if ($('du-template-form-title')) {
    $('du-template-form-title').textContent = `Create activity response template${duTemplateState.program ? ` · ${duTemplateState.program}` : ''}`;
  }
  if ($('du-tpl-name')) $('du-tpl-name').value = '';
  if ($('du-tpl-frequency')) $('du-tpl-frequency').value = 'Monthly';
  if ($('du-tpl-activity-type')) $('du-tpl-activity-type').value = 'Workshop';
  if ($('du-tpl-activity-name')) $('du-tpl-activity-name').value = '';
  if ($('du-tpl-activity-desc')) $('du-tpl-activity-desc').value = '';
  if ($('du-tpl-fy')) $('du-tpl-fy').value = duCurrentFinancialYearLabel();
  duRenderTemplateColumnRows();
  duRenderTemplateMatrixRows();
  duRenderTemplateStakeholderRows(duTemplateStakeholderRowsFromProgram(duTemplateState.program));
  duApplyGeoScopeToTemplate(duTemplateState.program);
}

function duSelectTemplateProgram(program, opts = {}) {
  const syncTopSelect = opts.syncTopSelect !== false;
  const resetForm = opts.resetForm !== false;
  duTemplateState.program = program || '';
  const ws = $('du-template-workspace');
  if (ws) ws.classList.toggle('hidden', !duTemplateState.program);
  if (syncTopSelect && $('du-prog-sel') && program) $('du-prog-sel').value = program;
  duEnsureTemplateProgramStore(duTemplateState.program);
  duRenderTemplateProgramCards();
  if (resetForm) {
    duTemplateResetForm();
  } else if (duTemplateState.program) {
    const currentRows = duCollectStakeholderMappings();
    const mergedRows = duTemplateStakeholderRowsFromProgram(duTemplateState.program, currentRows);
    duRenderTemplateStakeholderRows(mergedRows);
    duApplyGeoScopeToTemplate(duTemplateState.program);
  }
  duRenderTemplateList();
}

function duCollectTemplateDraft() {
  if (!duTemplateState.program) { toast(IC.warning + ' Select a program card first'); return null; }
  const name = ($('du-tpl-name')?.value || '').trim();
  const frequency = ($('du-tpl-frequency')?.value || 'Monthly').trim();
  const financialYear = ($('du-tpl-fy')?.value || '').trim().replace(/^fy\s*/i, '');
  const activityType = $('du-tpl-activity-type')?.value || 'Workshop';
  const activityName = ($('du-tpl-activity-name')?.value || '').trim();
  const activityDescription = ($('du-tpl-activity-desc')?.value || '').trim();
  const stakeholders = duGeoSortStakeholderRows(duCollectStakeholderMappings().filter(s => s.enabled));
  const columns = duTemplateState.columns.map(c => ({ ...c, name: (c.name || '').trim() })).filter(c => c.name);
  const matrix = duTemplateState.matrix.map(m => ({
    label: (m.label || '').trim(),
    source: m.source || 'role:participants',
    aggregation: m.aggregation || 'sum',
    key: (m.key || '').trim(),
  })).filter(m => m.label && m.key);

  if (!name) { toast(IC.warning + ' Template name is required'); return null; }
  if (!activityName) { toast(IC.warning + ' Activity name is required'); return null; }
  if (!DU_TEMPLATE_FREQUENCY_OPTIONS.includes(frequency)) { toast(IC.warning + ' Select Frequency'); return null; }
  if (!financialYear) { toast(IC.warning + ' Financial Year is required'); return null; }
  if (!columns.length) { toast(IC.warning + ' Define at least one response column'); return null; }
  if (!stakeholders.length) { toast(IC.warning + ' Enable at least one stakeholder'); return null; }
  if (!matrix.length) { toast(IC.warning + ' Define at least one matrix metric'); return null; }

  return {
    id: duTemplateState.editId || duTemplateNewId(),
    program: duTemplateState.program,
    name,
    frequency,
    financialYear,
    activityType,
    activityName,
    activityDescription,
    columns,
    matrix,
    stakeholders,
    geography: {
      state: ($('du-tpl-geo-state')?.value || '').trim(),
      district: ($('du-tpl-geo-district')?.value || '').trim(),
      block: ($('du-tpl-geo-block')?.value || '').trim(),
      cluster: ($('du-tpl-geo-cluster')?.value || '').trim(),
      school: ($('du-tpl-geo-school')?.value || '').trim(),
    },
    geographyIds: {
      state: duGeoUniqueIds(duTemplateGeoScopeState.state || []),
      district: duGeoUniqueIds(duTemplateGeoScopeState.district || []),
      block: duGeoUniqueIds(duTemplateGeoScopeState.block || []),
      cluster: duGeoUniqueIds(duTemplateGeoScopeState.cluster || []),
      school: duGeoUniqueIds(duTemplateGeoScopeState.school || []),
    },
    updatedAt: new Date().toISOString(),
  };
}

function duSaveTemplate(status = 'draft') {
  const draft = duCollectTemplateDraft();
  if (!draft) return;
  duEnsureTemplateProgramStore(draft.program);
  const list = duTemplateStore[draft.program];
  const idx = list.findIndex(t => t.id === draft.id);
  const existing = idx >= 0 ? list[idx] : null;
  const row = {
    ...existing,
    ...draft,
    status,
    createdAt: existing?.createdAt || new Date().toISOString(),
    publishedAt: status === 'published' ? new Date().toISOString() : existing?.publishedAt || null,
  };
  if (idx >= 0) list[idx] = row; else list.unshift(row);
  duTemplateState.editId = row.id;
  duRenderTemplateProgramCards();
  duRenderTemplateList();
  toast(status === 'published'
    ? `${IC['check-circle']} Template published for ${row.program}`
    : `${IC['check-circle']} Template saved as draft`);
}

function duLoadTemplateForEdit(templateId) {
  const list = duTemplateStore[duTemplateState.program] || [];
  const tpl = list.find(t => t.id === templateId);
  if (!tpl) return;
  duTemplateState.editId = tpl.id;
  if ($('du-template-form-title')) $('du-template-form-title').textContent = `Edit template · ${tpl.program}`;
  if ($('du-tpl-name')) $('du-tpl-name').value = tpl.name || '';
  if ($('du-tpl-frequency')) $('du-tpl-frequency').value = DU_TEMPLATE_FREQUENCY_OPTIONS.includes(tpl.frequency) ? tpl.frequency : 'Monthly';
  if ($('du-tpl-activity-type')) $('du-tpl-activity-type').value = tpl.activityType || 'Workshop';
  if ($('du-tpl-activity-name')) $('du-tpl-activity-name').value = tpl.activityName || '';
  if ($('du-tpl-activity-desc')) $('du-tpl-activity-desc').value = tpl.activityDescription || '';
  if ($('du-tpl-fy')) $('du-tpl-fy').value = tpl.financialYear || duCurrentFinancialYearLabel();
  duTemplateState.columns = (tpl.columns || []).map(c => ({ ...c }));
  duTemplateState.matrix = (tpl.matrix || []).map(m => ({ ...m }));
  duRenderTemplateColumnRows();
  duRenderTemplateMatrixRows();
  const mergedStakeholders = duTemplateStakeholderRowsFromProgram(
    tpl.program,
    (tpl.stakeholders || []).map(s => ({ ...s }))
  );
  duRenderTemplateStakeholderRows(mergedStakeholders);
  duApplyGeoScopeToTemplate(tpl.program);
  duTemplateGeoLoadFromTemplate(tpl.program, tpl.geography || {}, tpl.geographyIds || null);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function duRenderTemplateList() {
  const body = $('du-template-list-body');
  const meta = $('du-template-list-meta');
  if (!body || !meta) return;
  if (!duTemplateState.program) {
    meta.textContent = 'No program selected';
    body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--slate);">Select a program card to start creating templates</td></tr>`;
    return;
  }
  const list = duTemplateStore[duTemplateState.program] || [];
  meta.textContent = `${duTemplateState.program} · ${list.length} template${list.length !== 1 ? 's' : ''}`;
  if (!list.length) {
    body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--slate);">No templates yet for ${esc(duTemplateState.program)}</td></tr>`;
    return;
  }

  body.innerHTML = list.map(t => {
    const stks = (t.stakeholders || []).filter(s => s.enabled).map(s => s.stakeholder);
    const statusCls = t.status === 'published' ? 'ok' : 'warn';
    const statusTxt = t.status === 'published' ? 'Published' : 'Draft';
    const matrixSummary = (t.matrix || []).slice(0, 2).map(m => m.label).join(', ');
    const freqTxt = DU_TEMPLATE_FREQUENCY_OPTIONS.includes(t.frequency) ? t.frequency : 'Monthly';
    const fyTxt = t.financialYear || '-';
    const descTxt = (t.activityDescription || '').trim();
    return `<tr>
      <td><strong>${esc(t.name || '-')}</strong><div style="font-size:10px;color:var(--slate);margin-top:2px;">${(t.columns || []).length} columns</div></td>
      <td><strong>${esc(freqTxt)}</strong><div style="font-size:10px;color:var(--slate);margin-top:2px;">FY ${esc(fyTxt)}</div></td>
      <td>${esc(t.activityType || '-')}<div style="font-size:10px;color:var(--slate);margin-top:2px;">${esc(t.activityName || '')}</div>${descTxt ? `<div style="font-size:10px;color:var(--ink);margin-top:2px;">${esc(descTxt)}</div>` : ''}</td>
      <td>${stks.map(s => `<span class="du-template-chip">${esc(s)}</span>`).join('') || '-'}</td>
      <td style="font-size:11px;">${esc(matrixSummary || '-')}<div style="font-size:10px;color:var(--slate);margin-top:2px;">${(t.matrix || []).length} metrics</div></td>
      <td><span class="du-badge ${statusCls}">${statusTxt}</span></td>
      <td><button class="btn" data-tpl-edit="${esc(t.id)}" style="font-size:11px;padding:3px 9px;">Edit</button></td>
    </tr>`;
  }).join('');

  qsa('[data-tpl-edit]', body).forEach(btn => {
    btn.addEventListener('click', () => duLoadTemplateForEdit(btn.dataset.tplEdit));
  });
}

function duGenerateTemplatePreview() {
  const draft = duCollectTemplateDraft();
  if (!draft) return;
  const cols = draft.columns.map(c => c.name).join(', ');
  toast(`Template columns ready (${draft.columns.length}): ${cols}`);
}

function duGeoNewId() {
  return `du-geo-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function duGeoDefaultCoverageRows(program) {
  return [{
    id: duGeoNewId(),
    level: 'state',
    mode: 'selected',
    scope: '',
    enabled: true,
    builtIn: true,
  }];
}

function duGeoDefaultRows() {
  return DU_TEMPLATE_STAKEHOLDERS.map(stk => {
    const level = DU_STAKEHOLDER_DEFAULT_LEVEL[stk] || 'school';
    const hierarchyTag = duGeoDefaultHierarchyTag(stk, level);
    return {
      id: duGeoNewId(),
      stakeholder: stk,
      level,
      hierarchyTag,
      hierarchyLabel: '',
      hierarchyOrder: duGeoNormalizeHierarchyOrder(null, hierarchyTag, level),
      scope: '',
      enabled: true,
      builtIn: true,
    };
  });
}

function duEnsureGeoProgramStore(program) {
  if (!program) return;
  if (!duGeoMapStore[program]) {
    duGeoMapStore[program] = {
      scopeType: 'state_multi',
      coverageRows: duGeoDefaultCoverageRows(program),
      rows: duGeoDefaultRows(),
      updatedAt: null,
    };
    return;
  }
  const row = duGeoMapStore[program];
  if (!Array.isArray(row.coverageRows) || !row.coverageRows.length) {
    row.coverageRows = duGeoDefaultCoverageRows(program);
  }
  if (!Array.isArray(row.rows) || !row.rows.length) {
    row.rows = duGeoDefaultRows();
  }
  row.rows = duGeoSortStakeholderRows((row.rows || []).map(r => ({
    ...r,
    hierarchyTag: duGeoNormalizeHierarchyTag(r?.hierarchyTag, r?.stakeholder, r?.level),
    hierarchyLabel: duGeoNormalizeHierarchyLabel(r?.hierarchyLabel, r?.hierarchyTag, r?.stakeholder, r?.level),
    hierarchyOrder: duGeoNormalizeHierarchyOrder(r?.hierarchyOrder, r?.hierarchyTag, r?.level),
  })));
  row.scopeType = duGeoScopeTypeDef(row.scopeType || duGeoScopeTypeFromCoverageRows(row.coverageRows)).key;
}

function duRenderGeoProgramCards() {
  const grid = $('du-geo-prog-grid');
  if (!grid) return;
  const programs = duTemplatePrograms();
  grid.innerHTML = programs.map(p => {
    duEnsureGeoProgramStore(p);
    const coverageCount = (duGeoMapStore[p]?.coverageRows || []).filter(r => r.enabled).length;
    const activeCount = (duGeoMapStore[p]?.rows || []).filter(r => r.enabled).length;
    const active = duGeoMapState.program === p ? ' active' : '';
    return `<div class="du-template-prog-card${active}" data-geo-prog="${esc(p)}">
      <div class="du-template-prog-name">${esc(p)}</div>
      <div class="du-template-prog-meta"><span>${coverageCount} coverage</span><span>${activeCount} stakeholder maps</span></div>
    </div>`;
  }).join('');

  qsa('[data-geo-prog]', grid).forEach(card => {
    card.addEventListener('click', () => duSelectGeoProgram(card.dataset.geoProg));
  });
}

function duRenderGeoCascadeSelectors() {
  if (!duGeoMapState.cascade) duGeoMapState.cascade = duGeoDefaultCascadeState();
  const cascade = duGeoMapState.cascade;
  const noProgram = !duGeoMapState.program;
  const available0 = duGeoCascadeAvailable(cascade);
  duGeoNormalizeCascade(cascade, available0);
  duGeoApplyScopeTypeRules(cascade);
  const available = duGeoCascadeAvailable(cascade);
  duGeoNormalizeCascade(cascade, available);
  const scopeFlags = duGeoScopeUiFlags(cascade.scopeType);
  const isSingleState = scopeFlags.def.key === 'state_single';
  const isSingleDistrict = scopeFlags.def.key === 'district_single';
  const isSingleBlock = scopeFlags.def.key === 'block_single';
  const isSingleCluster = scopeFlags.def.key === 'cluster_single';
  const isSingleSchool = scopeFlags.def.key === 'school_single';
  const districtComboDisabled = noProgram || scopeFlags.lockDistrict || !!cascade.districtAll || !available.districts.length;
  const blockComboDisabled = noProgram || scopeFlags.lockBlock || !!cascade.blockAll || !available.blocks.length;
  const clusterComboDisabled = noProgram || scopeFlags.lockCluster || !!cascade.skipCluster || !!cascade.clusterAll || !available.clusters.length;
  const blockLocked = scopeFlags.lockBlock;
  const clusterLocked = scopeFlags.lockCluster;
  const schoolLocked = scopeFlags.lockSchool;

  duGeoRenderMultiSelect('du-geo-state-sel', available.states, cascade.states, false);
  duGeoRenderMultiSelect('du-geo-district-sel', available.districts, cascade.districts, districtComboDisabled);
  duGeoRenderMultiSelect('du-geo-block-sel', available.blocks, cascade.blocks, blockLocked || cascade.blockAll);
  duGeoRenderMultiSelect('du-geo-cluster-sel', available.clusters, cascade.clusters, clusterLocked || cascade.skipCluster || cascade.clusterAll);
  duGeoRenderMultiSelect('du-geo-school-sel', available.schools, cascade.schools, schoolLocked || cascade.schoolAll);
  duGeoRenderStateCombobox(available.states, cascade.states, isSingleState);
  duGeoRenderDistrictCombobox(available.districts, cascade.districts, { disabled: districtComboDisabled, maxOne: isSingleDistrict });
  duGeoRenderBlockCombobox(available.blocks, cascade.blocks, { disabled: blockComboDisabled, maxOne: isSingleBlock });
  duGeoRenderClusterCombobox(available.clusters, cascade.clusters, { disabled: clusterComboDisabled, maxOne: isSingleCluster, skipped: !!cascade.skipCluster });

  if ($('du-geo-scope-type')) $('du-geo-scope-type').value = cascade.scopeType;

  if ($('du-geo-district-all')) $('du-geo-district-all').checked = !!cascade.districtAll;
  if ($('du-geo-block-all')) $('du-geo-block-all').checked = !!cascade.blockAll;
  if ($('du-geo-cluster-all')) $('du-geo-cluster-all').checked = !!cascade.clusterAll;
  if ($('du-geo-school-all')) $('du-geo-school-all').checked = !!cascade.schoolAll;
  if ($('du-geo-skip-cluster')) $('du-geo-skip-cluster').checked = !!cascade.skipCluster;

  if ($('du-geo-scope-type')) $('du-geo-scope-type').disabled = noProgram;
  if ($('du-geo-state-combo')) $('du-geo-state-combo').disabled = noProgram || !available.states.length;
  if ($('du-geo-state-add-btn')) $('du-geo-state-add-btn').disabled = noProgram || !available.states.length;
  if ($('du-geo-district-combo')) $('du-geo-district-combo').disabled = districtComboDisabled;
  if ($('du-geo-district-add-btn')) $('du-geo-district-add-btn').disabled = districtComboDisabled;
  if ($('du-geo-block-combo')) $('du-geo-block-combo').disabled = blockComboDisabled;
  if ($('du-geo-block-add-btn')) $('du-geo-block-add-btn').disabled = blockComboDisabled;
  if ($('du-geo-cluster-combo')) $('du-geo-cluster-combo').disabled = clusterComboDisabled;
  if ($('du-geo-cluster-add-btn')) $('du-geo-cluster-add-btn').disabled = clusterComboDisabled;

  if ($('du-geo-district-all')) $('du-geo-district-all').disabled = noProgram || scopeFlags.lockDistrict || isSingleDistrict || !available.districts.length;
  if ($('du-geo-block-all')) $('du-geo-block-all').disabled = noProgram || blockLocked || isSingleBlock || !available.blocks.length;
  if ($('du-geo-cluster-all')) $('du-geo-cluster-all').disabled = noProgram || clusterLocked || isSingleCluster || !!cascade.skipCluster || !available.clusters.length;
  if ($('du-geo-school-all')) $('du-geo-school-all').disabled = noProgram || schoolLocked || isSingleSchool || !available.schools.length;
  if ($('du-geo-skip-cluster')) $('du-geo-skip-cluster').disabled = noProgram || clusterLocked || scopeFlags.targetIndex >= 3;

  if ($('du-geo-block-sel')) $('du-geo-block-sel').disabled = blockLocked || !!cascade.blockAll || !available.blocks.length;
  if ($('du-geo-cluster-sel')) $('du-geo-cluster-sel').disabled = clusterLocked || !!cascade.skipCluster || !!cascade.clusterAll || !available.clusters.length;
  if ($('du-geo-school-sel')) $('du-geo-school-sel').disabled = schoolLocked || !!cascade.schoolAll || !available.schools.length;

  const synced = duGeoSyncCoverageRowsFromCascade();
  duRenderGeoCoverageRows();
  duRenderGeoRows();
  return synced;
}

function duRenderGeoCoverageRows() {
  const body = $('du-geo-coverage-body');
  if (!body) return;
  if (!duGeoMapState.program) {
    body.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--slate);">Select a program card to define coverage</td></tr>`;
    return;
  }
  if (!duGeoMapState.coverageRows.length) {
    body.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--slate);">Select state/district/block scope to generate coverage.</td></tr>`;
    return;
  }

  body.innerHTML = duGeoMapState.coverageRows.map(row => {
    const modeTxt = row.mode === 'full' ? 'Full Level' : 'Selected List';
    const scopeTxt = row.mode === 'full'
      ? `All ${row.level}`
      : (row.scope || '—');
    return `<tr>
      <td style="text-transform:capitalize;">${esc(row.level || '—')}</td>
      <td>${esc(modeTxt)}</td>
      <td style="font-size:11px;color:var(--ink-2);">${esc(scopeTxt)}</td>
    </tr>`;
  }).join('');
}

function duRenderGeoRows() {
  const body = $('du-geo-rows-body');
  if (!body) return;
  if (!duGeoMapState.program) {
    body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--slate);">Select a program card to start geography mapping</td></tr>`;
    return;
  }

  if (!duGeoMapState.rows.length) {
    body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--slate);">No stakeholder mappings yet. Add one to continue.</td></tr>`;
    return;
  }

  const coverage = duGeoCoverageConstraint(duGeoMapState.coverageRows);
  const coveredLevels = duGeoCoverageLevels(duGeoMapState.coverageRows);
  const levelChoices = coveredLevels.length ? coveredLevels : DU_GEO_LEVEL_OPTIONS;
  duGeoMapState.rows = duGeoSortStakeholderRows(duGeoMapState.rows || []);

  body.innerHTML = duGeoMapState.rows.map((row, idx) => {
    if (!levelChoices.includes(row.level)) row.level = levelChoices[0];
    row.hierarchyTag = duGeoNormalizeHierarchyTag(row.hierarchyTag, row.stakeholder, row.level);
    row.hierarchyLabel = duGeoNormalizeHierarchyLabel(row.hierarchyLabel, row.hierarchyTag, row.stakeholder, row.level);
    row.hierarchyOrder = duGeoNormalizeHierarchyOrder(row.hierarchyOrder, row.hierarchyTag, row.level);
    const levelOpts = levelChoices
      .map(l => `<option value="${l}" ${row.level === l ? 'selected' : ''}>${l}</option>`)
      .join('');
    const hierarchyOpts = DU_GEO_HIERARCHY_OPTIONS
      .map(o => `<option value="${o.key}" ${row.hierarchyTag === o.key ? 'selected' : ''}>${esc(o.label)}</option>`)
      .join('');
    const customHierarchyVisible = row.hierarchyTag === 'custom';
    const trCls = row.builtIn ? '' : ' class="du-geo-row-custom"';
    const allowedVals = Array.from(coverage.valuesByLevel[row.level] || []);
    const scopeHint = coverage.fullLevels.has(row.level)
      ? `Any ${row.level} within program coverage`
      : allowedVals.length
        ? `Allowed: ${duScopePreview(allowedVals, 8)}`
        : `Define ${row.level} coverage first`;
    return `<tr data-geo-row="${idx}"${trCls}>
      <td><input class="du-template-input du-geo-stk-input" data-geo-field="stakeholder" value="${esc(row.stakeholder || '')}" placeholder="Stakeholder type" /></td>
      <td>
        <select class="du-template-select" data-geo-field="hierarchyTag">${hierarchyOpts}</select>
        <div style="${customHierarchyVisible ? 'display:grid;' : 'display:none;'}margin-top:6px;grid-template-columns:1fr 84px;gap:6px;">
          <input class="du-template-input" data-geo-field="hierarchyLabel" value="${esc(row.hierarchyLabel || '')}" placeholder="Custom hierarchy (e.g. ADC)" />
          <input class="du-template-input" data-geo-field="hierarchyOrder" type="number" min="1" step="1" value="${esc(row.hierarchyOrder ?? '')}" placeholder="Order" />
        </div>
      </td>
      <td><select class="du-template-select" data-geo-field="level">${levelOpts}</select></td>
      <td><input class="du-template-input du-geo-scope-input" data-geo-field="scope" value="${esc(row.scope || '')}" placeholder="${esc(scopeHint)}" /></td>
      <td><div class="du-geo-check"><input type="checkbox" data-geo-field="enabled" ${row.enabled ? 'checked' : ''} /></div></td>
      <td style="text-align:center;"><button class="btn" data-geo-remove="${idx}" style="font-size:10px;padding:3px 8px;">Remove</button></td>
    </tr>`;
  }).join('');

  qsa('[data-geo-field="stakeholder"]', body).forEach(inp => {
    inp.addEventListener('input', e => {
      const tr = e.target.closest('[data-geo-row]');
      if (!tr) return;
      const idx = +tr.dataset.geoRow;
      if (duGeoMapState.rows[idx]) {
        duGeoMapState.rows[idx].stakeholder = e.target.value;
        duGeoMapState.rows[idx].hierarchyTag = duGeoNormalizeHierarchyTag(
          duGeoMapState.rows[idx].hierarchyTag,
          duGeoMapState.rows[idx].stakeholder,
          duGeoMapState.rows[idx].level
        );
        if (duGeoMapState.rows[idx].hierarchyTag === 'custom' && !String(duGeoMapState.rows[idx].hierarchyLabel || '').trim()) {
          duGeoMapState.rows[idx].hierarchyLabel = String(duGeoMapState.rows[idx].stakeholder || '').trim();
        }
      }
    });
  });
  qsa('[data-geo-field="hierarchyTag"]', body).forEach(sel => {
    sel.addEventListener('change', e => {
      const tr = e.target.closest('[data-geo-row]');
      if (!tr) return;
      const idx = +tr.dataset.geoRow;
      if (duGeoMapState.rows[idx]) {
        duGeoMapState.rows[idx].hierarchyTag = duGeoNormalizeHierarchyTag(
          e.target.value,
          duGeoMapState.rows[idx].stakeholder,
          duGeoMapState.rows[idx].level
        );
        if (duGeoMapState.rows[idx].hierarchyTag === 'custom') {
          duGeoMapState.rows[idx].hierarchyLabel = duGeoNormalizeHierarchyLabel(
            duGeoMapState.rows[idx].hierarchyLabel,
            duGeoMapState.rows[idx].hierarchyTag,
            duGeoMapState.rows[idx].stakeholder,
            duGeoMapState.rows[idx].level
          );
        } else {
          duGeoMapState.rows[idx].hierarchyLabel = '';
        }
        duGeoMapState.rows[idx].hierarchyOrder = duGeoNormalizeHierarchyOrder(
          duGeoMapState.rows[idx].hierarchyOrder,
          duGeoMapState.rows[idx].hierarchyTag,
          duGeoMapState.rows[idx].level
        );
        duRenderGeoRows();
      }
    });
  });
  qsa('[data-geo-field="hierarchyLabel"]', body).forEach(inp => {
    inp.addEventListener('input', e => {
      const tr = e.target.closest('[data-geo-row]');
      if (!tr) return;
      const idx = +tr.dataset.geoRow;
      if (!duGeoMapState.rows[idx]) return;
      duGeoMapState.rows[idx].hierarchyLabel = duGeoNormalizeHierarchyLabel(
        e.target.value,
        duGeoMapState.rows[idx].hierarchyTag,
        duGeoMapState.rows[idx].stakeholder,
        duGeoMapState.rows[idx].level
      );
    });
  });
  qsa('[data-geo-field="hierarchyOrder"]', body).forEach(inp => {
    inp.addEventListener('input', e => {
      const tr = e.target.closest('[data-geo-row]');
      if (!tr) return;
      const idx = +tr.dataset.geoRow;
      if (!duGeoMapState.rows[idx]) return;
      duGeoMapState.rows[idx].hierarchyOrder = duGeoNormalizeHierarchyOrder(
        e.target.value,
        duGeoMapState.rows[idx].hierarchyTag,
        duGeoMapState.rows[idx].level
      );
    });
  });
  qsa('[data-geo-field="level"]', body).forEach(sel => {
    sel.addEventListener('change', e => {
      const tr = e.target.closest('[data-geo-row]');
      if (!tr) return;
      const idx = +tr.dataset.geoRow;
      if (duGeoMapState.rows[idx]) {
        duGeoMapState.rows[idx].level = e.target.value;
        duGeoMapState.rows[idx].hierarchyTag = duGeoNormalizeHierarchyTag(
          duGeoMapState.rows[idx].hierarchyTag,
          duGeoMapState.rows[idx].stakeholder,
          duGeoMapState.rows[idx].level
        );
        duGeoMapState.rows[idx].hierarchyOrder = duGeoNormalizeHierarchyOrder(
          duGeoMapState.rows[idx].hierarchyOrder,
          duGeoMapState.rows[idx].hierarchyTag,
          duGeoMapState.rows[idx].level
        );
      }
    });
  });
  qsa('[data-geo-field="scope"]', body).forEach(inp => {
    inp.addEventListener('input', e => {
      const tr = e.target.closest('[data-geo-row]');
      if (!tr) return;
      const idx = +tr.dataset.geoRow;
      if (duGeoMapState.rows[idx]) duGeoMapState.rows[idx].scope = e.target.value;
    });
  });
  qsa('[data-geo-field="enabled"]', body).forEach(chk => {
    chk.addEventListener('change', e => {
      const tr = e.target.closest('[data-geo-row]');
      if (!tr) return;
      const idx = +tr.dataset.geoRow;
      if (duGeoMapState.rows[idx]) duGeoMapState.rows[idx].enabled = !!e.target.checked;
    });
  });
  qsa('[data-geo-remove]', body).forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.geoRemove;
      const row = duGeoMapState.rows[idx];
      if (!row) return;
      if (duGeoMapState.rows.length <= 1) {
        toast(IC.warning + ' Keep at least one stakeholder mapping');
        return;
      }
      duGeoMapState.rows.splice(idx, 1);
      duRenderGeoRows();
    });
  });
}

function duRenderGeoList() {
  const body = $('du-geo-list-body');
  const meta = $('du-geo-list-meta');
  if (!body || !meta) return;

  if (!duGeoMapState.program) {
    meta.textContent = 'No program selected';
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--slate);">Select a program card to view saved mappings</td></tr>`;
    return;
  }

  duEnsureGeoProgramStore(duGeoMapState.program);
  const storeRow = duGeoMapStore[duGeoMapState.program] || { rows: [], updatedAt: null };
  const rows = storeRow.rows || [];
  const covRows = (storeRow.coverageRows || []).filter(r => r.enabled);
  const updated = storeRow.updatedAt ? new Date(storeRow.updatedAt).toLocaleString() : 'Not saved yet';
  meta.textContent = `${duGeoMapState.program} · ${covRows.length} coverage row${covRows.length !== 1 ? 's' : ''} · ${rows.length} mapping${rows.length !== 1 ? 's' : ''} · ${updated}`;

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--slate);">No saved mappings for ${esc(duGeoMapState.program)}</td></tr>`;
    return;
  }

  body.innerHTML = duGeoSortStakeholderRows(rows).map(r => {
    const statusCls = r.enabled ? 'ok' : 'warn';
    const statusTxt = r.enabled ? 'Active' : 'Inactive';
    return `<tr>
      <td>${esc(r.stakeholder || '—')}${r.builtIn ? '' : ' <span class="du-template-chip">custom</span>'}</td>
      <td>${esc(duGeoHierarchyTagLabel(r.hierarchyTag, r.stakeholder, r.level, r.hierarchyLabel))}</td>
      <td>${esc(r.level || '—')}</td>
      <td style="font-size:11px;color:var(--ink-2);">${esc(r.scope || 'All under selected geography')}</td>
      <td><span class="du-badge ${statusCls}">${statusTxt}</span></td>
    </tr>`;
  }).join('');
}

function duSelectGeoProgram(program, opts = {}) {
  const syncTopSelect = opts.syncTopSelect !== false;
  const loadRows = opts.loadRows !== false;
  duGeoMapState.program = program || '';
  const ws = $('du-geo-workspace');
  if (ws) ws.classList.toggle('hidden', !duGeoMapState.program);
  if (syncTopSelect && $('du-prog-sel') && program) $('du-prog-sel').value = program;
  if (duGeoMapState.program) duEnsureGeoProgramStore(duGeoMapState.program);
  if (loadRows && duGeoMapState.program) {
    const saved = duGeoMapStore[duGeoMapState.program] || {};
    duGeoMapState.coverageRows = (saved.coverageRows || duGeoDefaultCoverageRows(duGeoMapState.program)).map(r => ({ ...r }));
    duGeoMapState.rows = duGeoSortStakeholderRows((saved.rows || duGeoDefaultRows()).map(r => ({
      ...r,
      hierarchyTag: duGeoNormalizeHierarchyTag(r.hierarchyTag, r.stakeholder, r.level || 'school'),
      hierarchyLabel: duGeoNormalizeHierarchyLabel(r.hierarchyLabel, r.hierarchyTag, r.stakeholder, r.level || 'school'),
      hierarchyOrder: duGeoNormalizeHierarchyOrder(r.hierarchyOrder, r.hierarchyTag, r.level || 'school'),
    })));
    duGeoMapState.cascade = duGeoCascadeFromCoverageRows(duGeoMapState.coverageRows);
    duGeoMapState.cascade.scopeType = duGeoScopeTypeDef(saved.scopeType || duGeoMapState.cascade.scopeType).key;
    duGeoApplyScopeTypeRules(duGeoMapState.cascade);
  }
  if (!duGeoMapState.program) {
    duGeoMapState.coverageRows = [];
    duGeoMapState.rows = [];
    duGeoMapState.cascade = duGeoDefaultCascadeState();
  } else if (!duGeoMapState.cascade) {
    duGeoMapState.cascade = duGeoCascadeFromCoverageRows(duGeoMapState.coverageRows);
  }
  if ($('du-geo-form-title')) {
    $('du-geo-form-title').textContent = `Stakeholder geography mapping${duGeoMapState.program ? ` · ${duGeoMapState.program}` : ''}`;
  }
  duRenderGeoProgramCards();
  duRenderGeoCascadeSelectors();
  duRenderGeoList();
}

function duAddGeoMappingRow() {
  if (!duGeoMapState.program) {
    toast(IC.warning + ' Select a program card first');
    return;
  }
  duGeoSyncCoverageRowsFromCascade();
  const coveredLevels = duGeoCoverageLevels(duGeoMapState.coverageRows);
  const level = coveredLevels[0] || 'school';
  const hierarchyTag = duGeoDefaultHierarchyTag('', level);
  duGeoMapState.rows.push({
    id: duGeoNewId(),
    stakeholder: '',
    level,
    hierarchyTag,
    hierarchyLabel: '',
    hierarchyOrder: duGeoNormalizeHierarchyOrder(null, hierarchyTag, level),
    scope: '',
    enabled: true,
    builtIn: false,
  });
  duRenderGeoRows();
}

function duResetGeoMappingForm() {
  if (!duGeoMapState.program) return;
  duEnsureGeoProgramStore(duGeoMapState.program);
  const saved = duGeoMapStore[duGeoMapState.program] || {};
  duGeoMapState.coverageRows = (saved.coverageRows || duGeoDefaultCoverageRows(duGeoMapState.program)).map(r => ({ ...r }));
  duGeoMapState.rows = duGeoSortStakeholderRows((saved.rows || duGeoDefaultRows()).map(r => ({
    ...r,
    hierarchyTag: duGeoNormalizeHierarchyTag(r.hierarchyTag, r.stakeholder, r.level || 'school'),
    hierarchyLabel: duGeoNormalizeHierarchyLabel(r.hierarchyLabel, r.hierarchyTag, r.stakeholder, r.level || 'school'),
    hierarchyOrder: duGeoNormalizeHierarchyOrder(r.hierarchyOrder, r.hierarchyTag, r.level || 'school'),
  })));
  duGeoMapState.cascade = duGeoCascadeFromCoverageRows(duGeoMapState.coverageRows);
  duGeoMapState.cascade.scopeType = duGeoScopeTypeDef(saved.scopeType || duGeoMapState.cascade.scopeType).key;
  duGeoApplyScopeTypeRules(duGeoMapState.cascade);
  duRenderGeoCascadeSelectors();
}

function duSaveGeoMappings() {
  if (!duGeoMapState.program) {
    toast(IC.warning + ' Select a program card first');
    return;
  }
  duGeoSyncCoverageRowsFromCascade();
  const cleanCoverageRows = duGeoMapState.coverageRows
    .map(r => ({
      ...r,
      level: String(r.level || '').trim().toLowerCase(),
      mode: String(r.mode || 'selected').toLowerCase() === 'full' ? 'full' : 'selected',
      scope: (r.scope || '').trim(),
      enabled: !!r.enabled,
    }))
    .filter(r => DU_GEO_LEVEL_OPTIONS.includes(r.level));

  if (!cleanCoverageRows.length || !cleanCoverageRows.some(r => r.enabled)) {
    toast(IC.warning + ' Add at least one active program coverage row');
    return;
  }
  const missingCoverageScope = cleanCoverageRows.find(r => r.enabled && r.mode === 'selected' && !duSplitScopeValues(r.scope).length);
  if (missingCoverageScope) {
    toast(IC.warning + `Coverage row for ${missingCoverageScope.level} needs scope values`);
    return;
  }

  const coverage = duGeoCoverageConstraint(cleanCoverageRows);
  const coveredLevels = new Set(duGeoCoverageLevels(cleanCoverageRows));
  const cleanRows = duGeoMapState.rows
    .map(r => ({
      ...r,
      stakeholder: (r.stakeholder || '').trim(),
      level: String(r.level || 'school').trim().toLowerCase(),
      hierarchyTag: duGeoNormalizeHierarchyTag(r.hierarchyTag, r.stakeholder, r.level || 'school'),
      hierarchyLabel: duGeoNormalizeHierarchyLabel(r.hierarchyLabel, r.hierarchyTag, r.stakeholder, r.level || 'school'),
      hierarchyOrder: duGeoNormalizeHierarchyOrder(r.hierarchyOrder, r.hierarchyTag, r.level || 'school'),
      scope: (r.scope || '').trim(),
      enabled: !!r.enabled,
    }))
    .filter(r => r.stakeholder && DU_GEO_LEVEL_OPTIONS.includes(r.level));

  if (!cleanRows.length) {
    toast(IC.warning + ' Add at least one stakeholder mapping');
    return;
  }
  if (!cleanRows.some(r => r.enabled)) {
    toast(IC.warning + ' Keep at least one active stakeholder mapping');
    return;
  }

  const invalidLevelRow = cleanRows.find(r => r.enabled && !coveredLevels.has(r.level));
  if (invalidLevelRow) {
    toast(IC.warning + `Stakeholder "${invalidLevelRow.stakeholder}" uses level "${invalidLevelRow.level}" outside Program Coverage`);
    return;
  }
  const invalidScopeRow = cleanRows.find(r => {
    if (!r.enabled || !r.scope) return false;
    if (coverage.fullLevels.has(r.level)) return false;
    const allowed = coverage.valuesByLevel[r.level] || new Set();
    if (!allowed.size) return true;
    const allowedNorm = new Set(Array.from(allowed).map(duNormalizeGeoToken));
    return duSplitScopeValues(r.scope).some(v => !allowedNorm.has(duNormalizeGeoToken(v)));
  });
  if (invalidScopeRow) {
    toast(IC.warning + `Stakeholder "${invalidScopeRow.stakeholder}" scope is outside Program Coverage`);
    return;
  }
  const sortedRows = duGeoSortStakeholderRows(cleanRows);

  duGeoMapStore[duGeoMapState.program] = {
    scopeType: duGeoScopeTypeDef(duGeoMapState.cascade?.scopeType || 'state_multi').key,
    coverageRows: cleanCoverageRows.map(r => ({ ...r })),
    rows: sortedRows.map(r => ({ ...r })),
    updatedAt: new Date().toISOString(),
  };
  duGeoMapState.coverageRows = cleanCoverageRows.map(r => ({ ...r }));
  duGeoMapState.rows = sortedRows.map(r => ({ ...r }));
  duRenderGeoProgramCards();
  duRenderGeoCoverageRows();
  duRenderGeoRows();
  duRenderGeoList();

  // Keep Activity Template in sync with one-time geography source of truth.
  if (duTemplateState.program === duGeoMapState.program) {
    const currentTemplateRows = duCollectStakeholderMappings();
    const mergedTemplateRows = duTemplateStakeholderRowsFromProgram(duTemplateState.program, currentTemplateRows);
    duRenderTemplateStakeholderRows(mergedTemplateRows);
    duApplyGeoScopeToTemplate(duTemplateState.program);
  }

  toast(`${IC['check-circle']} Geography mapping saved for ${duGeoMapState.program}`);
}

function duParseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers:[], rows:[] };
  const parse = line => {
    const cells = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    cells.push(cur.trim());
    return cells;
  };
  const headers = parse(lines[0]);
  const rows = lines.slice(1).map(l => {
    const cells = parse(l);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i] || ''; });
    return obj;
  });
  return { headers, rows };
}

// ── File read handler ────────────────────────────────────────────
function duHandleFile(file) {
  duState.file = file;
  duState.filename = file.name;
  duState.program = $('du-prog-sel').value;
  duState.month   = $('du-month-sel').value;

  if (!duState.program) {
    toast(IC.warning + ' Please select a program before uploading');
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    let headers = [], rows = [];

    if (file.name.endsWith('.csv')) {
      const parsed = duParseCSV(e.target.result);
      headers = parsed.headers;
      rows    = parsed.rows;
    } else {
      // For xlsx: simulate with a demo dataset based on the filename
      // In production this uses SheetJS. For prototype we generate realistic demo data.
      headers = duGenerateDemoHeaders(file.name);
      rows    = duGenerateDemoRows(headers, duState.program, 50 + Math.floor(Math.random()*150));
    }

    duState.headers = headers;
    duState.rows    = rows;
    // Auto-detect mapping
    duState.mapping = {};
    headers.forEach(h => {
      const detected = duAutoDetect(h);
      duState.mapping[h] = detected || 'ignore';
    });

    duBuildMapper();
  };

  if (file.name.endsWith('.csv')) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}

// Demo header/row generators for xlsx prototype (real app uses SheetJS)
function duGenerateDemoHeaders(filename) {
  if (/train|capacity/i.test(filename))
    return ['UDISE_CODE','School Name','District','Block','Stakeholder Type','No. of Participants','Activity','Date','Remarks'];
  if (/community|parent/i.test(filename))
    return ['udise_code','school_name','stakeholder_category','participant_count','program_activity','conducted_on'];
  return ['Udise Code','School Name','District Name','Stakeholder Type','Participants Count','Activity Type','Workshop Date'];
}

function duGenerateDemoRows(headers, program, n) {
  const udiseUniverse = uploadStore.udise[program]?.schools || [];
  const stks = ['Teacher','Student','Leader','Community','Block Education Officer','Cluster Resource Coordinator'];
  const acts = ['Capacity Building','Workshop','Observation Visit','Mentoring Session','Assessment'];
  const rows = [];
  for (let i = 0; i < n; i++) {
    const school = udiseUniverse.length
      ? udiseUniverse[Math.floor(Math.random()*udiseUniverse.length)]
      : null;
    const udise = school
      ? school.udise
      : String(21150100301 + Math.floor(Math.random()*1000)).padStart(11,'0');
    const obj = {};
    headers.forEach(h => {
      const key = duAutoDetect(h);
      if (key === 'udise_code')       obj[h] = udise;
      else if (key === 'school_name') obj[h] = school?.name || 'Sample School';
      else if (key === 'stakeholder_type') obj[h] = stks[Math.floor(Math.random()*stks.length)];
      else if (key === 'participants')     obj[h] = String(1 + Math.floor(Math.random()*40));
      else if (key === 'activity')         obj[h] = acts[Math.floor(Math.random()*acts.length)];
      else if (key === 'date')             obj[h] = '2026-02-' + String(1+Math.floor(Math.random()*28)).padStart(2,'0');
      else obj[h] = '';
    });
    rows.push(obj);
  }
  return rows;
}

// ── Build mapper UI ──────────────────────────────────────────────
function duBuildMapper() {
  const mapper   = $('du-mapper');
  const body     = $('du-mapper-body');
  const filename = $('du-mapper-filename');
  const meta     = $('du-mapper-meta');
  if (!mapper || !body) return;

  filename.textContent = duState.filename;
  meta.textContent = `${duState.rows.length} rows · ${duState.headers.length} columns`;

  const matchedCount   = Object.values(duState.mapping).filter(v => v && v !== 'ignore').length;
  const unmatchedCount = Object.values(duState.mapping).filter(v => v === 'ignore').length;
  $('du-mapper-matched-badge').textContent = `${matchedCount} matched`;
  const wb = $('du-mapper-unmatched-badge');
  if (unmatchedCount > 0) {
    wb.style.display = ''; wb.textContent = `${unmatchedCount} unmapped`;
  } else {
    wb.style.display = 'none';
  }

  // Check required fields are covered
  const mappedKeys = new Set(Object.values(duState.mapping).filter(v=>v&&v!=='ignore'));
  const missingRequired = DU_REQUIRED_FIELDS.filter(f => f.required && !mappedKeys.has(f.key));

  body.innerHTML = '';

  // Validation summary
  if (missingRequired.length > 0) {
    const warn = document.createElement('div');
    warn.className = 'du-validation-row warn';
    warn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    Required fields not yet mapped: <strong>${missingRequired.map(f=>f.label).join(', ')}</strong>`;
    body.appendChild(warn);
  }

  // Column header row
  const hdr = document.createElement('div');
  hdr.style.cssText = 'display:grid;grid-template-columns:1fr 32px 1fr 28px;gap:8px;margin-bottom:4px;';
  hdr.innerHTML = `<span style="font-size:10px;font-weight:700;color:var(--slate);text-transform:uppercase;letter-spacing:.4px;">Your file column</span>
    <span></span>
    <span style="font-size:10px;font-weight:700;color:var(--slate);text-transform:uppercase;letter-spacing:.4px;">System field</span>
    <span></span>`;
  body.appendChild(hdr);

  duState.headers.forEach(col => {
    const mapped = duState.mapping[col];
    const sysField = DU_REQUIRED_FIELDS.find(f => f.key === mapped);
    const isIgnored = mapped === 'ignore' || !mapped;
    const isRequired = sysField?.required;

    const row = document.createElement('div');
    row.className = 'du-map-row';

    // File column name
    const fileCell = document.createElement('div');
    fileCell.className = 'du-map-file';
    fileCell.textContent = col;
    fileCell.title = col;

    // Arrow
    const arrow = document.createElement('div');
    arrow.className = 'du-map-arrow';
    arrow.innerHTML = IC['arrow-right'];

    // System field dropdown
    const sel = document.createElement('select');
    sel.className = 'du-map-sel';
    sel.innerHTML = `<option value="ignore">— ignore this column —</option>` +
      DU_REQUIRED_FIELDS.map(f =>
        `<option value="${f.key}" ${mapped===f.key?'selected':''}>${f.label}${f.required?' *':''}</option>`
      ).join('');
    sel.addEventListener('change', () => {
      duState.mapping[col] = sel.value;
      duBuildMapper(); // re-render to update badges + validation
    });

    // Status badge
    const badge = document.createElement('div');
    badge.className = 'du-map-badge ' + (isIgnored ? 'skip' : isRequired ? 'ok' : 'ok');
    badge.textContent = isIgnored ? '–' : '✓';

    row.appendChild(fileCell);
    row.appendChild(arrow);
    row.appendChild(sel);
    row.appendChild(badge);
    body.appendChild(row);
  });

  mapper.classList.remove('hidden');
  $('du-result')?.classList.add('hidden');
}

// ── Process upload ───────────────────────────────────────────────
function duProcessUpload() {
  const mappedKeys = new Set(Object.values(duState.mapping).filter(v=>v&&v!=='ignore'));
  if (!mappedKeys.has('udise_code')) {
    toast(IC.warning + ' Map the UDISE code column before processing'); return;
  }
  if (!mappedKeys.has('stakeholder_type')) {
    toast(IC.warning + ' Map the Stakeholder type column before processing'); return;
  }

  // Get col names for each system key
  const colFor = key => Object.entries(duState.mapping).find(([,v]) => v === key)?.[0];
  const udiseCol = colFor('udise_code');
  const stkCol   = colFor('stakeholder_type');
  const partCol  = colFor('participants');
  const actCol   = colFor('activity');

  const udiseUniverse = uploadStore.udise[duState.program]?.schools || [];
  const udiseMap = {};
  udiseUniverse.forEach(s => { udiseMap[String(s.udise).replace(/\.0$/,'')] = s; });

  // Progress simulation
  const progressWrap  = $('du-progress-wrap');
  const progressBar   = $('du-progress-bar');
  const progressLabel = $('du-progress-label');
  const processBtn    = $('du-process-btn');
  progressWrap.style.display = '';
  progressLabel.style.display = '';
  processBtn.disabled = true;
  processBtn.textContent = 'Processing…';

  let pct = 0;
  const tick = setInterval(() => {
    pct = Math.min(pct + Math.random()*18 + 4, 95);
    progressBar.style.width = pct + '%';
    const done = Math.floor((pct/100) * duState.rows.length);
    progressLabel.textContent = `Processing ${done} of ${duState.rows.length} rows…`;
  }, 120);

  setTimeout(() => {
    clearInterval(tick);
    progressBar.style.width = '100%';
    progressLabel.textContent = 'Finalising…';

    // Actual processing
    let matched = 0, unmatched = 0;
    const errors = [];
    const stkCounts = {};
    const matchedUdise = new Set();

    duState.rows.forEach((row, idx) => {
      const rawUdise = String(row[udiseCol] || '').replace(/\.0$/,'').trim();
      const stk      = (row[stkCol] || '').trim();
      const partRaw  = (row[partCol] || '1').trim();
      const partN    = parseInt(partRaw, 10) || 1;

      if (!rawUdise) {
        errors.push({ row: idx+2, msg: 'Missing UDISE code' }); unmatched++; return;
      }

      const school = udiseMap[rawUdise];
      if (!school && udiseUniverse.length > 0) {
        errors.push({ row: idx+2, msg: `UDISE ${rawUdise} not found in ${duState.program} school universe` });
        unmatched++;
        return;
      }

      // Matched (or no universe loaded — accept all)
      matched++;
      matchedUdise.add(rawUdise);
      if (stk) stkCounts[stk] = (stkCounts[stk] || 0) + partN;
    });

    const totalParticipants = Object.values(stkCounts).reduce((a,b)=>a+b, 0);

    // Write to uploadStore.actuals (cumulative, program-scoped)
    if (!uploadStore.actuals[duState.program]) {
      uploadStore.actuals[duState.program] = { udiseCodes: new Set(), stkCounts: {} };
    }
    const progActuals = uploadStore.actuals[duState.program];
    matchedUdise.forEach(u => progActuals.udiseCodes.add(u));
    Object.entries(stkCounts).forEach(([stk, n]) => {
      progActuals.stkCounts[stk] = (progActuals.stkCounts[stk] || 0) + n;
    });

    // Write batch record
    const batch = {
      id:           Date.now(),
      filename:     duState.filename,
      program:      duState.program,
      month:        duState.month,
      uploadedAt:   new Date().toLocaleString(),
      totalRows:    duState.rows.length,
      matched,
      unmatched,
      participants: totalParticipants,
      stkBreakdown: { ...stkCounts },
      errors,
      status:       errors.length === 0 ? 'ok' : unmatched > 0 ? 'partial' : 'ok',
    };
    uploadStore.batches.unshift(batch);

    // Update UI
    progressWrap.style.display = 'none';
    progressLabel.style.display = 'none';
    processBtn.disabled = false;
    processBtn.innerHTML = 'Confirm mapping &amp; process ' + IC['arrow-right'];

    duShowResult(batch);
    duRefreshKPIs();
    duRenderHistory();
    $('du-mapper').classList.add('hidden');

    toast(`✓ Processed ${matched} rows · ${Object.keys(matchedUdise).length} schools · ${totalParticipants} participants`);
  }, 1800);
}

// ── Show result summary after processing ─────────────────────────
function duShowResult(batch) {
  const resultEl = $('du-result');
  const okEl     = $('du-result-ok');
  const warnEl   = $('du-result-warn');
  if (!resultEl) return;

  resultEl.classList.remove('hidden');
  $('du-result-ok-msg').textContent =
    `${batch.matched} rows processed · ${batch.matched} schools matched · ${batch.participants} participants recorded`;

  if (batch.unmatched > 0) {
    warnEl.classList.remove('hidden');
    $('du-result-warn-msg').textContent =
      `${batch.unmatched} rows could not be matched to the school universe`;
    // Build error detail panel
    const panel = $('du-error-panel');
    panel.innerHTML = batch.errors.slice(0,20).map(e =>
      `<div class="du-error-row"><span class="du-error-row-num">Row ${e.row}</span><span class="du-error-msg">${esc(e.msg)}</span></div>`
    ).join('') + (batch.errors.length > 20
      ? `<div class="du-error-row"><span class="du-error-msg" style="color:var(--slate);">… and ${batch.errors.length-20} more errors</span></div>`
      : '');
  } else {
    warnEl.classList.add('hidden');
  }
}

// ── Refresh impact KPI strip ─────────────────────────────────────
function duRefreshKPIs() {
  const prog = $('du-prog-sel')?.value || '';
  let totalSchools = 0, totalChildren = 0, totalStk = 0;
  const stkAgg = {};

  const progsToSum = prog ? [prog] : Object.keys(uploadStore.actuals);
  progsToSum.forEach(p => {
    const actuals = uploadStore.actuals[p];
    if (!actuals) return;

    // Unique schools
    totalSchools += actuals.udiseCodes.size;

    // Children impacted — sum students from UDISE master for matched schools
    const udiseUniverse = uploadStore.udise[p]?.schools || [];
    const udiseMap = {};
    udiseUniverse.forEach(s => { udiseMap[String(s.udise).replace(/\.0$/,'')] = s; });
    actuals.udiseCodes.forEach(u => {
      const school = udiseMap[u];
      totalChildren += school ? (school.students || 0) : 0;
    });

    // Stakeholder capacity built
    Object.entries(actuals.stkCounts).forEach(([stk, n]) => {
      stkAgg[stk] = (stkAgg[stk] || 0) + n;
      totalStk += n;
    });
  });

  if ($('du-val-schools')) $('du-val-schools').textContent = totalSchools.toLocaleString();
  if ($('du-val-children')) $('du-val-children').textContent = totalChildren > 0
    ? totalChildren.toLocaleString()
    : (totalSchools > 0 ? '—' : '0');
  if ($('du-val-stk')) $('du-val-stk').textContent = totalStk.toLocaleString();

  const subSchools = $('du-sub-schools');
  if (subSchools) {
    const universe = prog && uploadStore.udise[prog]
      ? uploadStore.udise[prog].schools.length.toLocaleString() + ' in universe'
      : 'Cumulative · all uploads';
    subSchools.textContent = `Cumulative · ${universe}`;
  }

  // Stakeholder breakdown chips
  const breakdown = $('du-stk-breakdown');
  if (breakdown) {
    const top = Object.entries(stkAgg).sort((a,b)=>b[1]-a[1]).slice(0,4);
    const clsMap = { Teacher:'teacher', Leader:'leader', Student:'teacher', Community:'community' };
    breakdown.innerHTML = top.map(([stk,n]) =>
      `<span class="du-kpi-chip ${clsMap[stk]||'teacher'}">${esc(stk)}: ${n.toLocaleString()}</span>`
    ).join('');
  }
}

// ── Render upload history table ──────────────────────────────────
function duRenderHistory() {
  const tbody = $('du-history-body');
  if (!tbody) return;
  if (!uploadStore.batches.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--slate);font-size:13px;">No uploads yet</td></tr>`;
    return;
  }
  const prog = $('du-prog-sel')?.value || '';
  const batches = prog
    ? uploadStore.batches.filter(b => b.program === prog)
    : uploadStore.batches;

  tbody.innerHTML = batches.map(b => {
    const statusCls = b.status === 'ok' ? 'ok' : b.status === 'partial' ? 'warn' : 'err';
    const statusTxt = b.status === 'ok' ? 'Processed' : b.status === 'partial' ? 'Partial' : 'Failed';
    const stkSummary = Object.entries(b.stkBreakdown).slice(0,2)
      .map(([s,n])=>`${s}:${n}`).join(' · ');
    return `<tr>
      <td style="font-weight:600;">${esc(b.filename)}</td>
      <td>${esc(b.program)}</td>
      <td>${esc(b.month)}</td>
      <td style="font-family:var(--mono);">${b.totalRows}</td>
      <td style="font-family:var(--mono);color:var(--ok);">${b.matched}</td>
      <td style="font-family:var(--mono);color:${b.unmatched>0?'var(--warn)':'var(--slate)'};">${b.unmatched||'—'}</td>
      <td style="font-family:var(--mono);">${b.participants.toLocaleString()}${stkSummary?' <span style="font-size:10px;color:var(--slate);">'+esc(stkSummary)+'</span>':''}</td>
      <td style="color:var(--slate);font-size:11px;">${esc(b.uploadedAt)}</td>
      <td><span class="du-badge ${statusCls}">${statusTxt}</span></td>
    </tr>`;
  }).join('');

  $('du-history-meta').textContent = prog
    ? `${prog} · all months · ${batches.length} upload${batches.length!==1?'s':''}`
    : `All programs · ${batches.length} upload${batches.length!==1?'s':''}`;
}

// ── Render UDISE setup grid ──────────────────────────────────────
function duRenderUdiseGrid() {
  const grid = $('du-udise-prog-grid');
  if (!grid) return;
  const progs = duTemplatePrograms();
  if (!progs.length) {
    grid.innerHTML = `<div style="font-size:12px;color:var(--slate);padding:8px;">No programs configured yet.</div>`;
    return;
  }
  grid.innerHTML = progs.map(p => {
    const u = uploadStore.udise[p];
    const hasData = u && u.schools.length > 0;
    return `<div class="du-prog-udise-card">
      <div class="du-prog-udise-name">${esc(p)}</div>
      <div class="du-prog-udise-stat">
        ${hasData
          ? `<strong>${u.schools.length.toLocaleString()}</strong> schools loaded · ${new Date(u.loadedAt).toLocaleDateString()}`
          : `<span style="color:var(--slate);">No UDISE data loaded</span>`}
      </div>
      <span class="du-badge ${hasData?'ok':'warn'}">${hasData?'Ready':'Setup needed'}</span>
    </div>`;
  }).join('');
}

// ── UDISE master file upload (admin) ────────────────────────────
function duHandleUdiseFile(file) {
  const prog = $('du-udise-prog').value;
  if (!prog) { toast(IC.warning + ' Select a program first'); return; }

  $('du-udise-file-label').textContent = file.name;
  $('du-udise-upload-btn').style.display = '';

  $('du-udise-upload-btn').onclick = () => {
    const progWrap  = $('du-udise-progress-wrap');
    const progBar   = $('du-udise-progress-bar');
    const resultEl  = $('du-udise-result');
    progWrap.style.display = '';
    let p = 0;
    const t = setInterval(() => {
      p = Math.min(p + Math.random()*20 + 5, 95);
      progBar.style.width = p + '%';
    }, 150);

    setTimeout(() => {
      clearInterval(t);
      progBar.style.width = '100%';

      // Simulate parsing — in real app SheetJS reads actual file
      // We generate a synthetic school list representative of the program's state
      const demoSchools = duGenerateUdiseSchools(prog, 44750);
      uploadStore.udise[prog] = { schools: demoSchools, loadedAt: new Date() };

      progWrap.style.display = 'none';
      resultEl.style.display = '';
      resultEl.textContent = `✓ ${demoSchools.length.toLocaleString()} schools loaded for ${prog} · UDISE master ready`;
      $('du-udise-upload-btn').style.display = 'none';
      $('du-udise-file-label').textContent = 'No file chosen';
      duRenderUdiseGrid();
      toast(`UDISE master loaded for ${prog} — ${demoSchools.length.toLocaleString()} schools`);
    }, 2200);
  };
}

function duGenerateUdiseSchools(prog, n) {
  // Generate a representative set of school records
  // In production this parses the actual uploaded UDISE Excel file
  const districts = {
    'Odisha':         ['ANGUL','BALASORE','BARAGARH','BHADRAK','BOLANGIR','BOUDH','CUTTACK','DEOGARH','DHENKANAL','GAJAPATI'],
    'Bihar':          ['PATNA','GAYA','MUZAFFARPUR','BHAGALPUR','NALANDA','VAISHALI','SITAMARHI','BEGUSARAI','DARBHANGA','SAMASTIPUR'],
    'Karnataka':      ['BENGALURU URBAN','MYSURU','HUBLI-DHARWAD','BELAGAVI','KALABURAGI','SHIVAMOGGA','TUMAKURU','DAVANAGERE'],
    'Uttar Pradesh':  ['LUCKNOW','AGRA','VARANASI','KANPUR NAGAR','PRAYAGRAJ','MEERUT','BAREILLY','ALIGARH'],
    'Punjab':         ['LUDHIANA','AMRITSAR','JALANDHAR','PATIALA','BATHINDA','MOHALI','GURDASPUR'],
    'Rajasthan':      ['JAIPUR','JODHPUR','KOTA','AJMER','BIKANER','UDAIPUR','ALWAR','BHARATPUR'],
    'Madhya Pradesh': ['BHOPAL','INDORE','JABALPUR','GWALIOR','UJJAIN','SAGAR','DEWAS','SATNA'],
    'Jharkhand':      ['RANCHI','DHANBAD','BOKARO','DEOGHAR','HAZARIBAGH','GIRIDIH','JAMSHEDPUR'],
    'Assam':          ['KAMRUP','DIBRUGARH','JORHAT','SIBSAGAR','LAKHIMPUR','TINSUKIA','NAGAON'],
    'Maharashtra':    ['PUNE','NASHIK','AURANGABAD','NAGPUR','SOLAPUR','KOLHAPUR','AMRAVATI'],
  };
  const cats = ['Primary','Upper Primary','Secondary','Higher Secondary','Primary with Upper Primary'];
  const dists = districts[prog] || ['DISTRICT-1','DISTRICT-2','DISTRICT-3'];
  const schools = [];
  const base = 20000000000 + Math.floor(Math.random()*9000000000);
  for (let i = 0; i < n; i++) {
    const dist = dists[i % dists.length];
    schools.push({
      udise:    String(base + i).slice(0,11),
      name:     `${dist} School ${i+1}`,
      district: dist,
      block:    `${dist}-BLK-${(i%5)+1}`,
      students: 20 + Math.floor(Math.random()*400),
      teachers: 1 + Math.floor(Math.random()*15),
      category: cats[i % cats.length],
    });
  }
  return schools;
}

// ── Tab switcher ─────────────────────────────────────────────────
function duSwitchTab(tabKey) {
  ['upload','history','templates','setup','geo-map'].forEach(k => {
    $(`du-panel-${k}`)?.classList.toggle('hidden', k !== tabKey);
  });
  qsa('.du-tab').forEach(t => t.classList.toggle('active', t.dataset.duTab === tabKey));
  if (tabKey === 'templates') {
    const selectedProgram = $('du-prog-sel')?.value || duTemplateState.program || '';
    if (selectedProgram) {
      const shouldReset = duTemplateState.program !== selectedProgram || !duTemplateState.columns.length;
      duSelectTemplateProgram(selectedProgram, { syncTopSelect: false, resetForm: shouldReset });
    } else {
      duRenderTemplateProgramCards();
      duRenderTemplateList();
      $('du-template-workspace')?.classList.add('hidden');
    }
  } else if (tabKey === 'geo-map') {
    const selectedProgram = $('du-prog-sel')?.value || duGeoMapState.program || '';
    if (selectedProgram) {
      const shouldLoadGeo = duGeoMapState.program !== selectedProgram || !duGeoMapState.rows.length;
      duSelectGeoProgram(selectedProgram, { syncTopSelect: false, loadRows: shouldLoadGeo });
    } else {
      duRenderGeoProgramCards();
      duRenderGeoCoverageRows();
      duRenderGeoList();
      $('du-geo-workspace')?.classList.add('hidden');
    }
  }
}

// ── Data Upload — INIT event wiring ─────────────────────────────
(function() {
  duEnsureProgramMasterLoaded();
  duRenderProgramSelectors($('du-prog-sel')?.value || '');

  // Tab switcher
  qsa('.du-tab').forEach(t => {
    t.addEventListener('click', () => duSwitchTab(t.dataset.duTab));
  });

  // Browse button → hidden file input
  $('du-browse-btn')?.addEventListener('click', () => $('du-file-input')?.click());
  $('du-file-input')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) duHandleFile(file);
    e.target.value = '';
  });

  // Drag-and-drop on dropzone
  const dz = $('du-dropzone');
  if (dz) {
    dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', ()  => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) duHandleFile(file);
    });
  }

  // Process & cancel buttons
  $('du-process-btn')?.addEventListener('click', duProcessUpload);
  $('du-cancel-btn')?.addEventListener('click', () => {
    $('du-mapper')?.classList.add('hidden');
    $('du-result')?.classList.add('hidden');
    duState = { file:null, filename:'', headers:[], rows:[], mapping:{}, program:'', month:'' };
  });

  // Show / hide unmatched error detail
  $('du-show-errors-btn')?.addEventListener('click', () => {
    const p = $('du-error-panel');
    if (p) p.classList.toggle('show');
    const btn = $('du-show-errors-btn');
    if (btn) btn.textContent = p?.classList.contains('show') ? 'Hide errors' : 'View errors';
  });

  // Program / month selectors refresh KPIs + history
  $('du-prog-sel')?.addEventListener('change',  () => {
    duRefreshKPIs();
    duRenderHistory();
    const selectedProgram = $('du-prog-sel')?.value || '';
    const shouldReset = !!selectedProgram && (duTemplateState.program !== selectedProgram || !duTemplateState.columns.length);
    duSelectTemplateProgram(selectedProgram, { syncTopSelect: false, resetForm: shouldReset });
    const shouldLoadGeo = !!selectedProgram && (duGeoMapState.program !== selectedProgram || !duGeoMapState.rows.length);
    duSelectGeoProgram(selectedProgram, { syncTopSelect: false, loadRows: shouldLoadGeo });
  });
  $('du-month-sel')?.addEventListener('change', () => { duRenderHistory(); });

  // Activity templates — form actions
  $('du-tpl-add-col-btn')?.addEventListener('click', duAddTemplateColumn);
  $('du-tpl-add-matrix-btn')?.addEventListener('click', duAddTemplateMatrixMetric);
  $('du-tpl-reset-btn')?.addEventListener('click', duTemplateResetForm);
  $('du-tpl-save-btn')?.addEventListener('click', () => duSaveTemplate('draft'));
  $('du-tpl-publish-btn')?.addEventListener('click', () => duSaveTemplate('published'));
  $('du-tpl-generate-btn')?.addEventListener('click', duGenerateTemplatePreview);
  $('du-tpl-target-stk')?.addEventListener('change', duApplyTemplateTargetStakeholdersFromPicker);
  $('du-tpl-target-stk-add-btn')?.addEventListener('click', duAddTemplateTargetStakeholderFromComboInput);
  $('du-tpl-target-stk-combo')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      duAddTemplateTargetStakeholderFromComboInput();
    }
  });
  DU_TEMPLATE_GEO_LEVELS.forEach(level => {
    $(`du-tpl-geo-${level}-sel`)?.addEventListener('change', () => duTemplateGeoHandleLevelChange(level));
  });

  // Geography mapping — form actions
  $('du-geo-add-prog-btn')?.addEventListener('click', () => {
    const input = $('du-geo-new-prog-name');
    const added = duAddProgram(input?.value || '');
    if (!added) return;
    if (input) input.value = '';
    duSelectTemplateProgram(added, { syncTopSelect: true, resetForm: true });
    duSelectGeoProgram(added, { syncTopSelect: true, loadRows: true });
    duSwitchTab('geo-map');
    toast(`${IC['check-circle']} Program added: ${added}`);
  });
  $('du-geo-new-prog-name')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('du-geo-add-prog-btn')?.click();
    }
  });
  const duCascadeRefresh = () => {
    if (!duGeoMapState.program) return;
    if (!duGeoMapState.cascade) duGeoMapState.cascade = duGeoDefaultCascadeState();
    duGeoMapState.cascade.scopeType = $('du-geo-scope-type')?.value || duGeoMapState.cascade.scopeType || 'state_multi';
    duGeoMapState.cascade.states = duGeoMultiValues('du-geo-state-sel');
    duGeoMapState.cascade.districtAll = !!$('du-geo-district-all')?.checked;
    duGeoMapState.cascade.districts = duGeoMapState.cascade.districtAll ? [] : duGeoMultiValues('du-geo-district-sel');
    duGeoMapState.cascade.blockAll = !!$('du-geo-block-all')?.checked;
    duGeoMapState.cascade.blocks = duGeoMapState.cascade.blockAll ? [] : duGeoMultiValues('du-geo-block-sel');
    duGeoMapState.cascade.skipCluster = !!$('du-geo-skip-cluster')?.checked;
    duGeoMapState.cascade.clusterAll = duGeoMapState.cascade.skipCluster ? true : !!$('du-geo-cluster-all')?.checked;
    duGeoMapState.cascade.clusters = (duGeoMapState.cascade.skipCluster || duGeoMapState.cascade.clusterAll) ? [] : duGeoMultiValues('du-geo-cluster-sel');
    duGeoMapState.cascade.schoolAll = !!$('du-geo-school-all')?.checked;
    duGeoMapState.cascade.schools = duGeoMapState.cascade.schoolAll ? [] : duGeoMultiValues('du-geo-school-sel');
    duGeoApplyScopeTypeRules(duGeoMapState.cascade);
    duRenderGeoCascadeSelectors();
  };
  $('du-geo-scope-type')?.addEventListener('change', duCascadeRefresh);
  $('du-geo-state-add-btn')?.addEventListener('click', duGeoAddStateFromComboInput);
  $('du-geo-state-combo')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      duGeoAddStateFromComboInput();
    }
  });
  $('du-geo-district-add-btn')?.addEventListener('click', duGeoAddDistrictFromComboInput);
  $('du-geo-district-combo')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      duGeoAddDistrictFromComboInput();
    }
  });
  $('du-geo-block-add-btn')?.addEventListener('click', duGeoAddBlockFromComboInput);
  $('du-geo-block-combo')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      duGeoAddBlockFromComboInput();
    }
  });
  $('du-geo-cluster-add-btn')?.addEventListener('click', duGeoAddClusterFromComboInput);
  $('du-geo-cluster-combo')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      duGeoAddClusterFromComboInput();
    }
  });
  $('du-geo-state-sel')?.addEventListener('change', () => {
    if (!duGeoMapState.cascade) duGeoMapState.cascade = duGeoDefaultCascadeState();
    duGeoMapState.cascade.states = duGeoMultiValues('du-geo-state-sel');
    duGeoResetCascadeBelowState(duGeoMapState.cascade);
    duCascadeRefresh();
  });
  $('du-geo-district-all')?.addEventListener('change', duCascadeRefresh);
  $('du-geo-district-sel')?.addEventListener('change', () => {
    if (!duGeoMapState.cascade) duGeoMapState.cascade = duGeoDefaultCascadeState();
    duGeoResetCascadeBelowDistrict(duGeoMapState.cascade);
    duCascadeRefresh();
  });
  $('du-geo-block-all')?.addEventListener('change', duCascadeRefresh);
  $('du-geo-block-sel')?.addEventListener('change', () => {
    if (!duGeoMapState.cascade) duGeoMapState.cascade = duGeoDefaultCascadeState();
    duGeoResetCascadeBelowBlock(duGeoMapState.cascade);
    duCascadeRefresh();
  });
  $('du-geo-skip-cluster')?.addEventListener('change', duCascadeRefresh);
  $('du-geo-cluster-all')?.addEventListener('change', duCascadeRefresh);
  $('du-geo-cluster-sel')?.addEventListener('change', () => {
    if (!duGeoMapState.cascade) duGeoMapState.cascade = duGeoDefaultCascadeState();
    duGeoResetCascadeBelowCluster(duGeoMapState.cascade);
    duCascadeRefresh();
  });
  $('du-geo-school-all')?.addEventListener('change', duCascadeRefresh);
  $('du-geo-school-sel')?.addEventListener('change', duCascadeRefresh);
  $('du-geo-add-row-btn')?.addEventListener('click', duAddGeoMappingRow);
  $('du-geo-reset-btn')?.addEventListener('click', duResetGeoMappingForm);
  $('du-geo-save-btn')?.addEventListener('click', duSaveGeoMappings);

  // UDISE setup — browse + upload
  $('du-udise-browse-btn')?.addEventListener('click', () => $('du-udise-file-input')?.click());
  $('du-udise-file-input')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) duHandleUdiseFile(file);
    e.target.value = '';
  });
})();

// ═══════════════════════════════════════════════════════════════════
// BUDGET TRACKER ENGINE
// Isolated store — btStore. Never touches any existing store.
// Maps directly to schema: grants, grant_framework_budget,
// grant_budget_monthly_actuals, grant_disbursement_schedule,
// grant_reporting_schedule
// ═══════════════════════════════════════════════════════════════════

const FMT = n => {
  if (n == null || n === '') return '—';
  const abs = Math.abs(n);
  if (abs >= 10000000) return (n < 0 ? '-' : '') + '₹' + (abs/10000000).toFixed(2) + 'Cr';
  if (abs >= 100000)   return (n < 0 ? '-' : '') + '₹' + (abs/100000).toFixed(2) + 'L';
  return (n < 0 ? '-₹' : '₹') + Math.abs(n).toLocaleString('en-IN');
};
const MONTHS_FY = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];

const btStore = {
  activeProg:  null,
  activeGrant: null,
  activeView:  'lines',

  programs: [
    { id:'KA',  name:'Karnataka',      fy:'2025-26', state:'Karnataka' },
    { id:'BR',  name:'Bihar',          fy:'2025-26', state:'Bihar' },
    { id:'UP',  name:'Uttar Pradesh',  fy:'2025-26', state:'Uttar Pradesh' },
    { id:'OD',  name:'Odisha',         fy:'2025-26', state:'Odisha' },
    { id:'MH',  name:'Maharashtra',    fy:'2025-26', state:'Maharashtra' },
    { id:'PB',  name:'Punjab',         fy:'2025-26', state:'Punjab' },
    { id:'RJ',  name:'Rajasthan',      fy:'2025-26', state:'Rajasthan' },
    { id:'MP',  name:'Madhya Pradesh', fy:'2025-26', state:'Madhya Pradesh' },
    { id:'JH',  name:'Jharkhand',      fy:'2025-26', state:'Jharkhand' },
    { id:'AS',  name:'Assam',          fy:'2025-26', state:'Assam' },
  ],

  grants: {
    'KA': [
      { id:'G-KA-WF',    donor:'Wells Fargo',  code:'WF-KA-2526',  status:'active',  total:4336000,  css:'wf',
        start:'2025-04-01', end:'2026-03-31', currency:'INR' },
      { id:'G-KA-SF',    donor:'Salesforce',   code:'SF-KA-2526',  status:'active',  total:8194000,  css:'sf',
        start:'2025-04-01', end:'2026-03-31', currency:'INR' },
      { id:'G-KA-BOSCH', donor:'BOSCH',        code:'BSH-KA-2526', status:'active',  total:7182950,  css:'bosch',
        start:'2025-04-01', end:'2026-03-31', currency:'INR' },
      { id:'G-KA-LTTS',  donor:'LTTS',         code:'LTTS-KA-26',  status:'active',  total:5690000,  css:'ltts',
        start:'2025-04-01', end:'2026-03-31', currency:'INR' },
    ],
    'BR': [
      { id:'G-BR-CSR1', donor:'India CSR Fund', code:'CSR-BR-2527', status:'pipeline', total:15000000, css:'generic',
        start:'2026-04-01', end:'2027-03-31', currency:'INR' },
    ],
    'OD': [
      { id:'G-OD-GOV1', donor:'Government Grant', code:'GOV-OD-2526', status:'active', total:6200000, css:'generic',
        start:'2025-04-01', end:'2026-03-31', currency:'INR' },
    ],
    'MH': [
      { id:'G-MH-SF',   donor:'Salesforce',  code:'SF-MH-2526',  status:'active', total:4500000, css:'sf',    start:'2025-04-01', end:'2026-03-31', currency:'INR' },
      { id:'G-MH-TATA', donor:'Tata Trust',  code:'TT-MH-2526',  status:'active', total:3800000, css:'generic', start:'2025-04-01', end:'2026-03-31', currency:'INR' },
    ],
  },

  budgetLines: {
    'G-KA-WF': [
      { id:'WF-B1',  code:'B.1',  cat:'B', head:'Content, Printing & Stationaries and other program support materials', allocated:960000,  revised:null, utilised:958821 },
      { id:'WF-B2',  code:'B.2',  cat:'B', head:'HM Capacity Building Workshop',              allocated:800000,  revised:null, utilised:799908 },
      { id:'WF-B3',  code:'B.3',  cat:'B', head:'CRP Capacity Building Workshop',             allocated:500000,  revised:null, utilised:442727 },
      { id:'WF-B4',  code:'B.4',  cat:'B', head:'DRT Capacity Building Workshop',             allocated:100000,  revised:null, utilised:67359  },
      { id:'WF-B5',  code:'B.5',  cat:'B', head:'DIET & Block Leaders Planning Workshop',     allocated:250000,  revised:null, utilised:248959 },
      { id:'WF-B6',  code:'B.6',  cat:'B', head:'Diet Review Meeting',                        allocated:10000,   revised:null, utilised:9687   },
      { id:'WF-B7',  code:'B.7',  cat:'B', head:'Block Review Meeting',                       allocated:10000,   revised:null, utilised:0      },
      { id:'WF-B8',  code:'B.8',  cat:'B', head:'District Level Celebration',                 allocated:1000000, revised:null, utilised:1009674},
      { id:'WF-B9',  code:'B.9',  cat:'B', head:'BRC Revival',                                allocated:500000,  revised:null, utilised:470702 },
      { id:'WF-B10', code:'B.10', cat:'B', head:'Travel',                                     allocated:216000,  revised:null, utilised:164126 },
    ],
    'G-KA-SF': [
      { id:'SF-B1',  code:'B.1', cat:'B', head:'State Program - Capacity Building Workshops - Officials',              allocated:1200000, revised:null, utilised:1202293 },
      { id:'SF-B2',  code:'B.2', cat:'B', head:'Kalaburagi & Yadgir - Capacity Building at District Level',            allocated:350000,  revised:null, utilised:242435  },
      { id:'SF-B3',  code:'B.3', cat:'B', head:'Kalaburagi & Yadgir - School Leadership Workshop (Block Level)',       allocated:440000,  revised:null, utilised:419816  },
      { id:'SF-B4',  code:'B.4', cat:'B', head:'Kalaburagi & Yadgir - Planning and Review Meeting',                   allocated:24000,   revised:null, utilised:0       },
      { id:'SF-B5',  code:'B.5', cat:'B', head:'State Program - Content towards Capacity Building',                   allocated:1320000, revised:null, utilised:1336820 },
      { id:'SF-B6',  code:'B.6', cat:'B', head:'Printing and Stationary',                                              allocated:200000,  revised:null, utilised:190127  },
      { id:'SF-B7',  code:'B.7', cat:'B', head:'Kalaburagi & Yadgir - Program Support Materials',                     allocated:200000,  revised:null, utilised:194227  },
      { id:'SF-B8',  code:'B.8', cat:'B', head:'State Program - Education Conclave (Pragatiya Hejje)',                allocated:600000,  revised:null, utilised:201466  },
      { id:'SF-B9',  code:'B.9', cat:'B', head:'Kalaburagi & Yadgir - Showcase and Celebration',                      allocated:700000,  revised:null, utilised:710261  },
      { id:'SF-C1',  code:'C.1', cat:'C', head:'State Program - Travel Conveyance',                                   allocated:480000,  revised:null, utilised:485954  },
      { id:'SF-C2',  code:'C.2', cat:'C', head:'Kalaburagi & Yadgir - Travel Conveyance',                             allocated:480000,  revised:null, utilised:467388  },
      { id:'SF-C3',  code:'C.3', cat:'C', head:'Communication and Impact Coverage',                                   allocated:200000,  revised:null, utilised:200600  },
      { id:'SF-C4',  code:'C.4', cat:'C', head:'Impact Assessment (M&E)',                                             allocated:1500000, revised:null, utilised:0       },
      { id:'SF-C5',  code:'C.5', cat:'C', head:'Team Capacity Building',                                              allocated:200000,  revised:null, utilised:159955  },
      { id:'SF-D1',  code:'D.1', cat:'D', head:'Restocking of STEM Lab',                                              allocated:300000,  revised:null, utilised:299720  },
      { id:'SF-D2',  code:'D.2', cat:'D', head:'Infrastructure',                                                      allocated:1500000, revised:null, utilised:750000  },
    ],
    'G-KA-BOSCH': [
      { id:'BSH-B1', code:'B.1', cat:'B', head:'State Program - Capacity Building Workshops for Leaders',             allocated:1700000, revised:null, utilised:1724306 },
      { id:'BSH-B2', code:'B.2', cat:'B', head:'State Program - Content towards Capacity Building (Calendar/HB)',     allocated:2394000, revised:null, utilised:2319733 },
      { id:'BSH-B3', code:'B.3', cat:'B', head:'State Program - Education Conclave (Pragatiya Hejje)',                allocated:1000000, revised:null, utilised:1045991 },
      { id:'BSH-C1', code:'C.1', cat:'C', head:'State Program - Travel Conveyance',                                   allocated:420000,  revised:null, utilised:441931  },
      { id:'BSH-C2', code:'C.2', cat:'C', head:'Communication and Impact Coverage',                                   allocated:250000,  revised:null, utilised:247800  },
      { id:'BSH-C3', code:'C.3', cat:'C', head:'Impact Assessment',                                                   allocated:0,       revised:null, utilised:0       },
      { id:'BSH-C4', code:'C.4', cat:'C', head:'Team Capacity Building',                                              allocated:100000,  revised:null, utilised:100600  },
      { id:'BSH-C5', code:'C.5', cat:'C', head:'Vision Setting Workshop',                                             allocated:1000000, revised:null, utilised:449664  },
      { id:'BSH-D1', code:'D.1', cat:'D', head:'Restocking of STEM Lab (Bengaluru Urban)',                            allocated:250000,  revised:null, utilised:250000  },
      { id:'BSH-E1', code:'E.1', cat:'E', head:'Admin and Accounting',                                                allocated:68950,   revised:null, utilised:68988   },
    ],
    'G-KA-LTTS': [
      { id:'LT-A1', code:'A.1', cat:'A', head:'Revival of Training Centres',                                          allocated:1150000, revised:null, utilised:1172327, units:2,    cpu:575000 },
      { id:'LT-A2', code:'A.2', cat:'A', head:'STEM Kits',                                                            allocated:1625000, revised:null, utilised:1625228, units:650,  cpu:2500   },
      { id:'LT-A3', code:'A.3', cat:'A', head:'STEM Lab Restocking',                                                  allocated:500000,  revised:null, utilised:501293,  units:10,   cpu:50000  },
      { id:'LT-A4', code:'A.4', cat:'A', head:'Handbook and Resource Printing',                                       allocated:550000,  revised:null, utilised:543771,  units:2000, cpu:275    },
      { id:'LT-A5', code:'A.5', cat:'A', head:'STEM Curriculum / Handbook Development',                              allocated:100000,  revised:null, utilised:100000  },
      { id:'LT-A6', code:'A.6', cat:'A', head:'Capacity Building - School Heads & Education Functionaries',           allocated:500000,  revised:null, utilised:295293  },
      { id:'LT-A7', code:'A.7', cat:'A', head:'Capacity Building - Science Teachers',                                allocated:162500,  revised:null, utilised:161438  },
      { id:'LT-A8', code:'A.8', cat:'A', head:'Exhibition of STEM Projects by Students and Teachers',                allocated:500000,  revised:null, utilised:282265  },
      { id:'LT-A9', code:'A.9', cat:'A', head:'Student Assessment',                                                   allocated:250000,  revised:null, utilised:250000  },
      { id:'LT-C1', code:'C.1', cat:'C', head:'Travel',                                                               allocated:202500,  revised:null, utilised:220929  },
      { id:'LT-C2', code:'C.2', cat:'C', head:'Team Capacity Building',                                               allocated:150000,  revised:null, utilised:132876  },
    ],
  },

  monthlyActuals: {
    'WF-B1':  { '0_actual':252,'2_actual':181310,'3_actual':26004,'4_actual':1240,'5_actual':418412,'6_actual':38238,'7_actual':592,'8_actual':3746,'9_actual':165811 },
    'WF-B2':  { '2_actual':632854,'3_actual':11583,'4_actual':5492,'9_actual':35141 },
    'WF-B3':  { '4_actual':163606,'5_actual':41594,'6_actual':5231,'7_actual':730,'8_actual':7317,'9_actual':137477 },
    'WF-B4':  { '5_actual':6300,'6_actual':3960,'7_actual':159 },
    'WF-B5':  { '4_actual':6372,'5_actual':135347,'6_actual':107240 },
    'WF-B6':  { '2_actual':4500 },
    'WF-B8':  { '9_actual':632023 },
    'WF-B9':  { '5_actual':44800,'7_actual':278480,'9_actual':123138 },
    'WF-B10': { '0_actual':7916,'1_actual':1792,'3_actual':12725,'4_actual':8754,'5_actual':10133,'6_actual':10633,'7_actual':7010,'8_actual':12560,'9_actual':13543 },
    'LT-A1':  { '3_actual':350000,'5_actual':76045,'6_actual':349259,'7_actual':26081,'8_actual':298273,'9_actual':72669 },
    'LT-A2':  { '3_actual':1590000,'5_actual':35228 },
    'LT-A3':  { '3_actual':450000,'5_actual':51293 },
    'LT-A4':  { '3_actual':223404,'5_actual':124241,'8_actual':8094,'9_actual':128032 },
    'LT-A6':  { '3_actual':14280,'4_actual':23895,'8_actual':47729,'9_actual':209389 },
    'LT-A7':  { '5_actual':47723,'7_actual':21945,'8_actual':91770 },
    'LT-C1':  { '3_actual':14452,'5_actual':57258,'6_actual':22798,'7_actual':12320,'8_actual':68865,'9_actual':43436 },
    'LT-C2':  { '5_actual':2694,'6_actual':53078,'7_actual':9474,'8_actual':3417,'9_actual':48463 },
  },

  disbursements: {
    'G-KA-WF': [
      { no:1, due:'2025-05-01', expected:2168000, received:2168000, date:'2025-05-03', status:'received_full', notes:'First tranche received on time' },
      { no:2, due:'2025-10-01', expected:2168000, received:2168000, date:'2025-10-15', status:'received_full', notes:'Second tranche — Sep UC attached' },
    ],
    'G-KA-SF': [
      { no:1, due:'2025-04-15', expected:4097000, received:4097000, date:'2025-04-18', status:'received_full', notes:'' },
      { no:2, due:'2025-10-15', expected:4097000, received:4097000, date:'2025-11-02', status:'received_full', notes:'Delayed 18 days' },
    ],
    'G-KA-BOSCH': [
      { no:1, due:'2025-05-01', expected:3591475, received:3591475, date:'2025-05-12', status:'received_full', notes:'' },
      { no:2, due:'2025-11-01', expected:3591475, received:3591475, date:'2025-11-08', status:'received_full', notes:'' },
    ],
    'G-KA-LTTS': [
      { no:1, due:'2025-04-01', expected:2845000, received:2845000, date:'2025-04-05', status:'received_full', notes:'Full FY advance' },
      { no:2, due:'2025-10-01', expected:2845000, received:2845000, date:'2025-10-20', status:'received_full', notes:'' },
    ],
  },

  reportingSchedule: {
    'G-KA-WF': [
      { type:'utilization', label:'Sep UC (H1)',       period:'Apr–Sep 2025', due:'2025-10-15', submitted:'2025-10-12', status:'submitted' },
      { type:'narrative',   label:'Interim Report',    period:'Apr–Sep 2025', due:'2025-11-30', submitted:'2025-11-28', status:'submitted' },
      { type:'utilization', label:'Final UC (FY End)', period:'Apr–Mar 2026', due:'2026-04-30', submitted:null,         status:'planned'   },
      { type:'annual',      label:'Annual Impact Report', period:'FY 2025-26', due:'2026-05-31', submitted:null,        status:'planned'   },
    ],
    'G-KA-SF': [
      { type:'utilization', label:'Sep UC (Q2)',        period:'Apr–Sep 2025', due:'2025-10-31', submitted:'2025-10-29', status:'submitted' },
      { type:'utilization', label:'Final UC',           period:'Apr–Mar 2026', due:'2026-04-30', submitted:null,         status:'due'       },
    ],
    'G-KA-BOSCH': [
      { type:'utilization', label:'Sep UC',             period:'Apr–Sep 2025', due:'2025-10-31', submitted:'2025-11-02', status:'submitted' },
      { type:'indicator',   label:'Indicator Report',   period:'Apr–Dec 2025', due:'2026-01-31', submitted:null,         status:'planned'   },
      { type:'utilization', label:'Final UC',           period:'Apr–Mar 2026', due:'2026-04-30', submitted:null,         status:'planned'   },
    ],
    'G-KA-LTTS': [
      { type:'utilization', label:'Sep UC (Annexure)',  period:'Apr–Sep 2025', due:'2025-10-15', submitted:'2025-10-14', status:'submitted' },
      { type:'utilization', label:'Final UC',           period:'Apr–Mar 2026', due:'2026-04-30', submitted:null,         status:'planned'   },
    ],
  },
};

function btGetGrants(progId)  { return btStore.grants[progId] || []; }
function btGetLines(grantId)  { return btStore.budgetLines[grantId] || []; }
function btGetDisb(grantId)   { return btStore.disbursements[grantId] || []; }
function btGetReports(grantId){ return btStore.reportingSchedule[grantId] || []; }

function btGrantTotals(grantId) {
  const lines = btGetLines(grantId);
  const allocated = lines.reduce((s,l) => s+(l.allocated||0), 0);
  const utilised  = lines.reduce((s,l) => s+(l.utilised||0),  0);
  const variance  = allocated - utilised;
  const pct       = allocated > 0 ? Math.round(utilised/allocated*100) : 0;
  return { allocated, utilised, variance, pct };
}

function btProgTotals(progId) {
  const grants = btGetGrants(progId);
  let allocated=0, utilised=0;
  grants.forEach(g => { const t=btGrantTotals(g.id); allocated+=t.allocated; utilised+=t.utilised; });
  return { allocated, utilised, pct: allocated>0 ? Math.round(utilised/allocated*100) : 0 };
}

function btMonthVal(lineId, mi, et) {
  return btStore.monthlyActuals[lineId]?.[`${mi}_${et}`] || null;
}
function btSetMonthVal(lineId, mi, et, val) {
  if (!btStore.monthlyActuals[lineId]) btStore.monthlyActuals[lineId] = {};
  const key = `${mi}_${et}`;
  if (val === null || val === '') delete btStore.monthlyActuals[lineId][key];
  else btStore.monthlyActuals[lineId][key] = val;
}

function btShowProgSelector() {
  $('bt-detail')?.classList.add('hidden');
  $('bt-prog-selector')?.classList.remove('hidden');
  $('bt-uc-btn').style.display = 'none';
  btStore.activeProg = null; btStore.activeGrant = null;

  const fy = $('bt-fy-sel')?.value || '2025-26';
  let totalCommitted=0, totalUtilised=0;
  btStore.programs.forEach(p => { const t=btProgTotals(p.id); totalCommitted+=t.allocated; totalUtilised+=t.utilised; });
  if($('bt-portfolio-meta')) $('bt-portfolio-meta').textContent = `${btStore.programs.length} programs · FY ${fy}`;
  if($('bt-portfolio-committed')) $('bt-portfolio-committed').textContent = FMT(totalCommitted) + ' Committed';
  if($('bt-portfolio-utilised'))  $('bt-portfolio-utilised').textContent  = FMT(totalUtilised)  + ' Utilised';

  const grid = $('bt-prog-grid');
  if (!grid) return;
  grid.innerHTML = btStore.programs.map(p => {
    const grants = btGetGrants(p.id);
    const t = btProgTotals(p.id);
    const statusCls = t.pct >= 90 ? 'active' : t.pct > 0 ? 'draft' : 'empty';
    const barColor  = t.pct >= 90 ? 'var(--ok)' : t.pct >= 60 ? 'var(--warn)' : 'var(--danger)';
    const utilCls   = t.pct >= 90 ? 'ok' : t.pct >= 60 ? 'warn' : 'danger';
    const chips = grants.slice(0,3).map(g => `<span class="bt-donor-chip">${esc(g.donor.split(' ')[0])}</span>`).join('')
      + (grants.length > 3 ? `<span class="bt-donor-chip">+${grants.length-3}</span>` : '');
    return `<div class="bt-prog-card ${statusCls}" onclick="btOpenProg('${p.id}')">
      <div class="bt-prog-name">${esc(p.name)}</div>
      <div class="bt-prog-fy">FY ${p.fy} · ${grants.length} grant${grants.length!==1?'s':''}</div>
      <div class="bt-prog-stat">
        <div class="bt-prog-total">${t.allocated > 0 ? FMT(t.allocated) : '—'}</div>
        ${t.allocated > 0 ? `<span class="bt-prog-util ${utilCls}">${t.pct}%</span>` : '<span class="bt-prog-util" style="background:var(--mist-3);color:var(--slate);">No data</span>'}
      </div>
      <div class="bt-prog-donors">${chips}</div>
      <div class="bt-prog-bar"><div class="bt-prog-bar-fill" style="width:${t.pct}%;background:${barColor};"></div></div>
    </div>`;
  }).join('');
}

function btOpenProg(progId) {
  btStore.activeProg = progId; btStore.activeGrant = null;
  const prog = btStore.programs.find(p => p.id === progId);
  if (!prog) return;
  $('bt-prog-selector')?.classList.add('hidden');
  $('bt-detail')?.classList.remove('hidden');
  $('bt-bc-prog').textContent = prog.name;
  $('bt-active-prog').textContent = prog.name;
  $('bt-uc-btn').style.display = 'inline-flex';
  if($('crumb-title')) $('crumb-title').textContent = `${prog.name} · FY ${prog.fy}`;
  btRenderGrantStrip(progId);
  const grants = btGetGrants(progId);
  if (grants.length > 0) btSelectGrant(grants[0].id);
}

function btRenderGrantStrip(progId) {
  const grants = btGetGrants(progId);
  const strip  = $('bt-grant-strip');
  if (!strip) return;
  if (!grants.length) { strip.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--slate);font-size:13px;">No grants configured yet</div>`; return; }
  strip.innerHTML = grants.map(g => {
    const t = btGrantTotals(g.id);
    const pctCls   = t.pct >= 90 ? 'ok' : t.pct >= 60 ? 'warn' : 'danger';
    const barColor = t.pct >= 90 ? 'var(--ok)' : t.pct >= 60 ? 'var(--warn)' : 'var(--danger)';
    const gopActive = btGopState.activeGrant === g.id && $('bt-grant-outcome-panel')?.classList.contains('open');
    return `<div class="bt-grant-card ${g.css}${g.id===btStore.activeGrant?' selected':''}" onclick="btSelectGrant('${g.id}')">
      <div class="bt-grant-donor">${esc(g.donor)}</div>
      <div class="bt-grant-amount">${FMT(t.allocated)}</div>
      <div class="bt-grant-util">${FMT(t.utilised)} utilised · ${FMT(t.variance)} var</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
        <span class="bt-grant-pct ${pctCls}">${t.pct}%</span>
        <span style="font-size:10px;color:var(--slate);">${g.code}</span>
      </div>
      <div class="bt-grant-mini-bar"><div class="bt-grant-mini-fill" style="width:${t.pct}%;background:${barColor};"></div></div>
      <button class="bt-gop-btn${gopActive?' active':''}"
        onclick="event.stopPropagation();btGopOpen('${g.id}')"
        title="View outcome commitments &amp; impact for ${esc(g.donor)}">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> Outcomes &amp; Impact
      </button>
    </div>`;
  }).join('');
}

function btSelectGrant(grantId) {
  btStore.activeGrant = grantId;
  const grant = btGetGrants(btStore.activeProg).find(g => g.id === grantId);
  if (!grant) return;
  $('bt-selected-grant-label').textContent = `${grant.donor} · ${grant.code}`;
  btRenderGrantStrip(btStore.activeProg);
  btRenderCurrentView();
}

function btRenderCurrentView() {
  const v = btStore.activeView;
  $('bt-view-lines')?.classList.toggle('hidden', v !== 'lines');
  $('bt-view-monthly')?.classList.toggle('hidden', v !== 'monthly');
  $('bt-view-disbursements')?.classList.toggle('hidden', v !== 'disbursements');
  $('bt-view-reporting')?.classList.toggle('hidden', v !== 'reporting');
  if (v === 'lines')         btRenderLines();
  if (v === 'monthly')       btRenderMonthly();
  if (v === 'disbursements') btRenderDisbursements();
  if (v === 'reporting')     btRenderReporting();
}

function btRenderLines() {
  const grantId = btStore.activeGrant;
  const grant   = btGetGrants(btStore.activeProg).find(g => g.id === grantId);
  const lines   = btGetLines(grantId);
  if ($('bt-lines-title')) $('bt-lines-title').textContent = `Budget Lines — ${grant?.donor || ''}`;
  if ($('bt-lines-meta'))  $('bt-lines-meta').textContent  = `${lines.length} budget heads · ${grant?.code || ''}`;
  const body = $('bt-lines-body'); if (!body) return;

  const catOrder = ['A','B','C','D','E','F'];
  const catNames = { A:'A — Project Activity', B:'B — Program Cost', C:'C — Logistics & Support', D:'D — Infrastructure', E:'E — Admin', F:'F — Volunteering' };
  const grouped  = {};
  lines.forEach(l => { if (!grouped[l.cat]) grouped[l.cat]=[]; grouped[l.cat].push(l); });

  let html='', grandAlloc=0, grandUtil=0;
  catOrder.forEach(cat => {
    if (!grouped[cat]) return;
    html += `<tr class="bt-cat-hd"><td colspan="8">${catNames[cat]||cat}</td></tr>`;
    let catAlloc=0, catUtil=0;
    grouped[cat].forEach(l => {
      const alloc = l.allocated||0, util = l.utilised||0;
      const eff   = l.revised || alloc;
      const var_  = eff - util;
      const pct   = alloc > 0 ? Math.round(util/alloc*100) : 0;
      const barW  = Math.min(pct,100);
      const barC  = pct <= 100 ? 'var(--ok)' : 'var(--danger)';
      catAlloc += alloc; catUtil += util; grandAlloc += alloc; grandUtil += util;
      const unitNote = l.units ? `<br><span style="font-size:10px;color:var(--slate);">${l.units} × ₹${(l.cpu||0).toLocaleString('en-IN')}</span>` : '';
      // ── Allocation cell: display mode + inline edit mode ──────────
      const wasRevised = l._allocRevised;  // flag set when PM edits
      const allocCell = `
        <div class="bt-alloc-display" id="bt-alloc-disp-${l.id}">
          <span class="bt-alloc-val">${FMT(alloc)}</span>
          ${wasRevised ? `<span class="bt-revised-badge">revised</span>` : ''}
          <button class="bt-edit-alloc-btn" title="Edit allocation"
            onclick="btStartAllocEdit('${l.id}',${alloc})" aria-label="Edit allocation for ${esc(l.head)}">${IC.edit}</button>
        </div>
        <div class="bt-alloc-inp-wrap" id="bt-alloc-edit-${l.id}">
          <input type="number" min="0" step="1" id="bt-alloc-inp-${l.id}"
            value="${alloc}" aria-label="New allocation amount" />
          <button class="bt-alloc-save-btn" onclick="btSaveAllocEdit('${l.id}')">✓ Save</button>
          <button class="bt-alloc-cancel-btn" onclick="btCancelAllocEdit('${l.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
        </div>`;
      html += `<tr id="bt-line-row-${l.id}">
        <td><span class="bt-code">${esc(l.code)}</span></td>
        <td><span class="bt-head-name">${esc(l.head)}</span>${unitNote}</td>
        <td class="num" id="bt-alloc-cell-${l.id}">${allocCell}</td>
        <td class="num">${l.revised ? FMT(l.revised) : '<span style="color:var(--muted);">—</span>'}</td>
        <td class="num">${FMT(util)}<div class="bt-variance-bar"><div class="bt-variance-fill" style="width:${barW}%;background:${barC};"></div></div></td>
        <td class="num ${var_>=0?'pos':'neg'}" id="bt-var-cell-${l.id}">${var_>=0?'+':''}${FMT(var_)}</td>
        <td class="num" id="bt-pct-cell-${l.id}" style="color:${pct>100?'var(--danger)':pct>=90?'var(--ok)':'var(--warn)'};font-weight:700;">${pct}%</td>
        <td class="bt-editable-cell">
          ${state.role === 'leader' || state.role === 'donor' ? '' :
            `<input type="number" min="0" step="1" data-lid="${l.id}" value="${util||''}" placeholder="₹0" />`}
        </td>
      </tr>`;
    });
    const cp = catAlloc > 0 ? Math.round(catUtil/catAlloc*100) : 0;
    html += `<tr><td></td><td style="font-size:11px;color:var(--slate);font-weight:700;">Subtotal ${cat}</td>
      <td class="num" style="font-weight:700;">${FMT(catAlloc)}</td><td></td>
      <td class="num" style="font-weight:700;">${FMT(catUtil)}</td>
      <td class="num ${catAlloc-catUtil>=0?'pos':'neg'}" style="font-weight:700;">${catAlloc-catUtil>=0?'+':''}${FMT(catAlloc-catUtil)}</td>
      <td class="num" style="font-weight:700;">${cp}%</td><td></td></tr>`;
  });
  const gv = grandAlloc - grandUtil;
  html += `<tr class="bt-total-row"><td colspan="2">TOTAL</td>
    <td class="num">${FMT(grandAlloc)}</td><td></td>
    <td class="num">${FMT(grandUtil)}</td>
    <td class="num ${gv>=0?'pos':'neg'}">${gv>=0?'+':''}${FMT(gv)}</td>
    <td class="num">${grandAlloc>0?Math.round(grandUtil/grandAlloc*100):0}%</td><td></td></tr>`;
  body.innerHTML = html;

  // ── Wire utilised (existing) inputs ────────────────────────────
  qsa('input[data-lid]', body).forEach(inp => {
    inp.addEventListener('change', e => {
      const line = btGetLines(grantId).find(l => l.id === e.target.dataset.lid);
      if (line) { line.utilised = parseFloat(e.target.value)||0; btRenderGrantStrip(btStore.activeProg); toast('Saved · ' + new Date().toLocaleTimeString()); }
    });
  });

  // ── Wire allocation edit inputs: Enter = save, Escape = cancel ──
  lines.forEach(l => {
    const inp = $(`bt-alloc-inp-${l.id}`);
    if (!inp) return;
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); btSaveAllocEdit(l.id); }
      if (e.key === 'Escape') { e.preventDefault(); btCancelAllocEdit(l.id); }
    });
  });
}

// ── Allocation inline-edit helpers (new — scoped to Budget Tracker) ──
function btStartAllocEdit(lineId, currentVal) {
  // Close any other open edit first
  qsa('[id^="bt-alloc-edit-"]').forEach(el => {
    if (el.id !== `bt-alloc-edit-${lineId}` && el.style.display === 'flex') {
      const otherId = el.id.replace('bt-alloc-edit-', '');
      btCancelAllocEdit(otherId);
    }
  });
  const disp = $(`bt-alloc-disp-${lineId}`);
  const edit = $(`bt-alloc-edit-${lineId}`);
  const inp  = $(`bt-alloc-inp-${lineId}`);
  if (!disp || !edit || !inp) return;
  disp.style.display = 'none';
  edit.style.display = 'flex';
  inp.value = currentVal || 0;
  inp.select();
  inp.focus();
}

function btSaveAllocEdit(lineId) {
  const grantId = btStore.activeGrant;
  const line    = btGetLines(grantId).find(l => l.id === lineId);
  const inp     = $(`bt-alloc-inp-${lineId}`);
  if (!line || !inp) return;

  const newVal = parseFloat(inp.value);
  if (isNaN(newVal) || newVal < 0) { toast(IC.warning + ' Enter a valid positive amount'); inp.focus(); return; }

  const oldVal = line.allocated || 0;
  line.allocated      = newVal;
  line._allocRevised  = true;   // marks the "revised" badge on next render

  // Update the display cell in-place (no full re-render — nothing else disturbed)
  const disp = $(`bt-alloc-disp-${lineId}`);
  const edit = $(`bt-alloc-edit-${lineId}`);
  if (disp) {
    disp.style.display = '';
    const valSpan = disp.querySelector('.bt-alloc-val');
    if (valSpan) valSpan.textContent = FMT(newVal);
    // Add/update revised badge
    let badge = disp.querySelector('.bt-revised-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'bt-revised-badge';
      badge.textContent = 'revised';
      disp.insertBefore(badge, disp.querySelector('.bt-edit-alloc-btn'));
    }
  }
  if (edit) edit.style.display = 'none';

  // Recalculate variance + % for this row only
  const util  = line.utilised || 0;
  const eff   = newVal;
  const var_  = eff - util;
  const pct   = newVal > 0 ? Math.round(util / newVal * 100) : 0;
  const varCell = $(`bt-var-cell-${lineId}`);
  const pctCell = $(`bt-pct-cell-${lineId}`);
  if (varCell) {
    varCell.className = `num ${var_>=0?'pos':'neg'}`;
    varCell.textContent = (var_>=0?'+':'') + FMT(var_);
  }
  if (pctCell) {
    pctCell.style.color = pct > 100 ? 'var(--danger)' : pct >= 90 ? 'var(--ok)' : 'var(--warn)';
    pctCell.textContent = pct + '%';
  }

  // Refresh grant strip totals
  btRenderGrantStrip(btStore.activeProg);

  const diff = newVal - oldVal;
  const sign = diff >= 0 ? '+' : '';
  toast(`Allocation updated · ${FMT(newVal)} (${sign}${FMT(diff)}) · ${new Date().toLocaleTimeString()}`);
}

function btCancelAllocEdit(lineId) {
  const disp = $(`bt-alloc-disp-${lineId}`);
  const edit = $(`bt-alloc-edit-${lineId}`);
  if (disp) disp.style.display = '';
  if (edit) edit.style.display = 'none';
}

function btRenderMonthly() {
  const grantId   = btStore.activeGrant;
  const grant     = btGetGrants(btStore.activeProg).find(g => g.id === grantId);
  const lines     = btGetLines(grantId);
  const et        = $('bt-monthly-type-sel')?.value || 'actual';
  const wrap      = $('bt-monthly-wrap'); if (!wrap) return;
  if ($('bt-monthly-title')) $('bt-monthly-title').textContent = `Monthly ${et==='actual'?'Actuals':'Forecast'} — ${grant?.donor||''}`;

  const catOrder = ['A','B','C','D','E','F'];
  const grouped  = {};
  lines.forEach(l => { if (!grouped[l.cat]) grouped[l.cat]=[]; grouped[l.cat].push(l); });
  const catNames = { A:'Project Activity', B:'Program Cost', C:'Logistics', D:'Infrastructure', E:'Admin', F:'Volunteering' };

  let trs='', grandTotals=new Array(12).fill(0), grandAlloc=0, grandMonthly=0;

  catOrder.forEach(cat => {
    if (!grouped[cat]) return;
    trs += `<tr style="background:var(--mist-3);"><td style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;color:var(--slate);padding:5px 12px;position:sticky;left:0;background:var(--mist-3);" colspan="16">${catNames[cat]||cat}</td></tr>`;
    grouped[cat].forEach(l => {
      const cells = MONTHS_FY.map((_,i) => {
        const v = btMonthVal(l.id, i, et);
        return `<td class="num"><input class="bt-month-inp" type="number" min="0" step="1" data-lid="${l.id}" data-mi="${i}" data-et="${et}" value="${v!==null?v:''}" placeholder="—" /></td>`;
      });
      const rowTotal = MONTHS_FY.reduce((s,_,i) => s+(btMonthVal(l.id,i,et)||0), 0);
      const var_ = (l.allocated||0) - rowTotal;
      MONTHS_FY.forEach((_,i) => { grandTotals[i] += (btMonthVal(l.id,i,et)||0); });
      grandAlloc += (l.allocated||0); grandMonthly += rowTotal;
      trs += `<tr>
        <td style="position:sticky;left:0;background:var(--white);z-index:2;font-size:11.5px;min-width:220px;">
          <span class="bt-code">${esc(l.code)}</span> ${esc(l.head.length>35?l.head.slice(0,35)+'…':l.head)}
        </td>
        <td class="num">${FMT(l.allocated)}</td>
        ${cells.join('')}
        <td class="num" style="font-weight:700;">${FMT(rowTotal)}</td>
        <td class="num ${var_>=0?'pos':'neg'}" style="font-weight:700;">${var_>=0?'+':''}${FMT(var_)}</td>
      </tr>`;
    });
  });
  trs += `<tr style="background:var(--canvas);font-weight:700;border-top:2px solid var(--mist-2);">
    <td style="position:sticky;left:0;background:var(--canvas);z-index:2;">TOTAL</td>
    <td class="num">${FMT(grandAlloc)}</td>
    ${grandTotals.map(v => `<td class="num">${v>0?FMT(v):'—'}</td>`).join('')}
    <td class="num">${FMT(grandMonthly)}</td>
    <td class="num ${grandAlloc-grandMonthly>=0?'pos':'neg'}">${grandAlloc-grandMonthly>=0?'+':''}${FMT(grandAlloc-grandMonthly)}</td>
  </tr>`;

  wrap.innerHTML = `<div style="overflow-x:auto;"><table class="bt-tbl" style="min-width:${220+90+72*12+90+90}px;">
    <thead><tr>
      <th style="min-width:220px;position:sticky;left:0;background:var(--canvas);z-index:3;">Budget Head</th>
      <th class="num" style="min-width:90px;">Allocated</th>
      ${MONTHS_FY.map(m=>`<th class="num" style="min-width:72px;">${m}</th>`).join('')}
      <th class="num" style="min-width:90px;">Total</th>
      <th class="num" style="min-width:90px;">Variance</th>
    </tr></thead>
    <tbody>${trs}</tbody>
  </table></div>`;

  qsa('input.bt-month-inp', wrap).forEach(inp => {
    inp.addEventListener('change', e => {
      const {lid, mi, et:et_} = e.target.dataset;
      const val = parseFloat(e.target.value) || null;
      btSetMonthVal(lid, parseInt(mi), et_, val);
      if (et_ === 'actual') {
        const line = btGetLines(grantId).find(l => l.id === lid);
        if (line) { line.utilised = MONTHS_FY.reduce((s,_,i) => s+(btMonthVal(lid,i,'actual')||0), 0); btRenderGrantStrip(btStore.activeProg); }
      }
    });
  });
}

function btRenderDisbursements() {
  const grantId = btStore.activeGrant;
  const grant   = btGetGrants(btStore.activeProg).find(g => g.id === grantId);
  const disbs   = btGetDisb(grantId);
  if ($('bt-disb-title')) $('bt-disb-title').textContent = `Disbursements — ${grant?.donor||''}`;
  const body = $('bt-disb-body'); if (!body) return;
  if (!disbs.length) { body.innerHTML = `<div class="bt-empty">No installments recorded yet</div>`; return; }
  const sLabels = { received_full:'Received', received_partial:'Partial', due:'Due', planned:'Planned', delayed:'Delayed', cancelled:'Cancelled' };
  const sCls    = s => s==='received_full'?'ok':s==='delayed'?'warn':'muted';
  const totalE  = disbs.reduce((s,d)=>s+(d.expected||0),0);
  const totalR  = disbs.reduce((s,d)=>s+(d.received||0),0);
  body.innerHTML = disbs.map(d => `<div class="bt-disb-row">
    <div class="bt-disb-num ${sCls(d.status)}">${d.no}</div>
    <div style="flex:1;"><div style="font-weight:600;">Installment ${d.no}</div><div class="bt-disb-date">${d.notes||'No notes'}</div></div>
    <div class="bt-disb-date">Due: ${d.due}</div>
    <div class="bt-disb-amt">${FMT(d.expected)}</div>
    <div class="bt-disb-date">Recd: ${d.date||'—'}</div>
    <div class="bt-disb-amt" style="color:var(--ok);">${FMT(d.received)}</div>
    <div><span class="bt-disb-status ${sCls(d.status)}">${sLabels[d.status]||d.status}</span></div>
  </div>`).join('') + `<div style="display:flex;justify-content:flex-end;gap:24px;padding:12px 14px;background:var(--canvas);border-top:2px solid var(--mist-2);font-size:12px;font-weight:700;">
    <span>Expected: <span style="font-family:var(--mono);">${FMT(totalE)}</span></span>
    <span>Received: <span style="font-family:var(--mono);color:var(--ok);">${FMT(totalR)}</span></span>
    <span>Pending: <span style="font-family:var(--mono);color:${totalE-totalR>0?'var(--warn)':'var(--ok)'};">${FMT(totalE-totalR)}</span></span>
  </div>`;
}

function btRenderReporting() {
  const grantId = btStore.activeGrant;
  const grant   = btGetGrants(btStore.activeProg).find(g => g.id === grantId);
  const reports = btGetReports(grantId);
  if ($('bt-rep-title')) $('bt-rep-title').textContent = `Reporting Schedule — ${grant?.donor||''}`;
  const body = $('bt-reporting-body'); if (!body) return;
  if (!reports.length) { body.innerHTML = `<div class="bt-empty">No reports scheduled yet</div>`; return; }
  const sCls  = s => s==='submitted'?'ok':s==='due'?'warn':'muted';
  const sTxt  = s => ({submitted:'Submitted',due:'Due',planned:'Planned',overdue:'Overdue',closed:'Closed'}[s]||s);
  body.innerHTML = reports.map(r => `<div class="bt-report-row">
    <div><div class="bt-report-type">${esc(r.label)}</div><div class="bt-report-period">${esc(r.period)} · ${r.type}</div></div>
    <div style="font-size:12px;">${r.due}</div>
    <div style="font-size:12px;color:var(--ok);">${r.submitted||'—'}</div>
    <div><span class="bt-disb-status ${sCls(r.status)}">${sTxt(r.status)}</span></div>
  </div>`).join('');
}

function btGenerateUC() {
  const grantId = btStore.activeGrant;
  if (!grantId) { toast('Select a grant first to generate a UC'); return; }
  const grant = btGetGrants(btStore.activeProg).find(g => g.id === grantId);
  const lines = btGetLines(grantId);
  const t     = btGrantTotals(grantId);
  if ($('bt-uc-subtitle')) $('bt-uc-subtitle').textContent = `${grant?.donor} · ${grant?.code} · FY 2025-26 · ${new Date().toLocaleDateString('en-IN')}`;

  const catOrder = ['A','B','C','D','E','F'];
  const catNames = { A:'Project Activity Expenditure', B:'Program Cost', C:'Logistics & Support', D:'Infrastructure', E:'Administrative Cost', F:'Volunteering Expenses' };
  const grouped  = {};
  lines.forEach(l => { if (!grouped[l.cat]) grouped[l.cat]=[]; grouped[l.cat].push(l); });

  let rows='', grandAlloc=0, grandUtil=0, sn=1;
  catOrder.forEach(cat => {
    if (!grouped[cat]) return;
    rows += `<tr class="bt-uc-head"><td colspan="6" style="font-family:var(--sans);">${catNames[cat]||cat} (${cat})</td></tr>`;
    let cA=0, cU=0;
    grouped[cat].forEach(l => {
      const a=l.allocated||0, u=l.utilised||0, v=a-u;
      cA+=a; cU+=u; grandAlloc+=a; grandUtil+=u;
      rows += `<tr><td>${sn++}</td><td>${l.code}</td><td style="font-family:var(--sans);text-align:left;">${l.head}</td>
        <td>${a.toLocaleString('en-IN')}</td><td>${u.toLocaleString('en-IN')}</td>
        <td style="color:${v>=0?'var(--ok)':'var(--danger)'};">${v>=0?'+':''}${v.toLocaleString('en-IN')}</td></tr>`;
    });
    const cv=cA-cU;
    rows += `<tr style="background:var(--mist-3);"><td colspan="3" style="font-weight:700;font-family:var(--sans);">Subtotal (${cat})</td>
      <td style="font-weight:700;">${cA.toLocaleString('en-IN')}</td>
      <td style="font-weight:700;">${cU.toLocaleString('en-IN')}</td>
      <td style="font-weight:700;color:${cv>=0?'var(--ok)':'var(--danger)'};">${cv>=0?'+':''}${cv.toLocaleString('en-IN')}</td></tr>`;
  });
  const gv=grandAlloc-grandUtil;
  rows += `<tr class="bt-uc-total"><td colspan="3" style="font-family:var(--sans);">GRAND TOTAL</td>
    <td>${grandAlloc.toLocaleString('en-IN')}</td><td>${grandUtil.toLocaleString('en-IN')}</td>
    <td style="color:${gv>=0?'var(--ok)':'var(--danger)'};">${gv>=0?'+':''}${gv.toLocaleString('en-IN')}</td></tr>`;

  if ($('bt-uc-body')) $('bt-uc-body').innerHTML = `
    <table class="bt-uc-tbl">
      <thead><tr><th style="width:36px;">S.No</th><th style="width:52px;">Code</th><th style="text-align:left;">Budget Head</th>
        <th>Allocated (₹)</th><th>Utilised (₹)</th><th>Variance (₹)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:14px;padding:12px;background:var(--ok-bg);border:1px solid var(--ok-border);border-radius:var(--r);font-size:12px;">
      <strong>Utilisation: ${t.pct}%</strong> · Allocated: ${FMT(grandAlloc)} · Utilised: ${FMT(grandUtil)} · Balance: ${FMT(gv)}
    </div>`;

  $('bt-uc-modal').classList.remove('hidden');
}

// ═══════════════════════════════════════════════════════════════════
//  GRANT OUTCOME PANEL  (btGop*)
//  Opens inline below the grant strip when PM clicks "Outcomes & Impact"
//  on any grant card. Fully scoped — zero overlap with existing bt* fns.
// ═══════════════════════════════════════════════════════════════════

const btGopState = {
  activeGrant: null,
  activeTab:   'outcomes',
  configMode:  false,
  commitments: {},  // { grantId: { indicatorId: { alias, target, freq, remarks, committed } } }
};

// Seed indicator library — mirrors published M&E framework (isKeyOutcome + all others)
const BT_GOP_INDICATORS = [
  { id:'ind-k1', name:'% teachers demonstrating improved classroom practice',   abbr:'TICP', type:'Outcome', stk:'Teacher',   intv:'Teacher Capacity Building',        unit:'%',     freq:'quarterly', isKeyOutcome:true  },
  { id:'ind-k2', name:'% schools with functional School Management Committees', abbr:'SMC',  type:'Outcome', stk:'Leader',    intv:'School Leadership Development',    unit:'%',     freq:'annual',    isKeyOutcome:true  },
  { id:'ind-k3', name:'% students achieving grade-level reading competency',    abbr:'GRC',  type:'Impact',  stk:'Student',   intv:'Foundational Literacy & Numeracy', unit:'%',     freq:'annual',    isKeyOutcome:true  },
  { id:'ind-k4', name:'% students achieving grade-level numeracy competency',   abbr:'GNC',  type:'Impact',  stk:'Student',   intv:'Foundational Literacy & Numeracy', unit:'%',     freq:'annual',    isKeyOutcome:true  },
  { id:'ind-k5', name:'Community awareness score on education importance',      abbr:'CAS',  type:'Outcome', stk:'Community', intv:'Community Engagement',             unit:'score', freq:'annual',    isKeyOutcome:true  },
  { id:'ind-o1', name:'No. of teacher training workshops conducted',            abbr:'TWC',  type:'Output',  stk:'Teacher',   intv:'Teacher Capacity Building',        unit:'count', freq:'monthly',   isKeyOutcome:false },
  { id:'ind-o2', name:'No. of teachers trained / participated',                 abbr:'TTP',  type:'Output',  stk:'Teacher',   intv:'Teacher Capacity Building',        unit:'count', freq:'monthly',   isKeyOutcome:false },
  { id:'ind-o3', name:'No. of classroom observations conducted',                abbr:'COC',  type:'Output',  stk:'Teacher',   intv:'Teacher Capacity Building',        unit:'count', freq:'monthly',   isKeyOutcome:false },
  { id:'ind-o4', name:'No. of school leader orientation sessions',              abbr:'SLO',  type:'Output',  stk:'Leader',    intv:'School Leadership Development',    unit:'count', freq:'monthly',   isKeyOutcome:false },
  { id:'ind-o5', name:'No. of parent / community meetings held',                abbr:'PCM',  type:'Output',  stk:'Community', intv:'Community Engagement',             unit:'count', freq:'monthly',   isKeyOutcome:false },
  { id:'ind-o6', name:'No. of students assessed (baseline)',                    abbr:'SAB',  type:'Output',  stk:'Student',   intv:'Learning Assessment',              unit:'count', freq:'one_time',  isKeyOutcome:false },
  { id:'ind-o7', name:'No. of digital literacy sessions delivered',             abbr:'DLS',  type:'Output',  stk:'Teacher',   intv:'Digital Literacy',                 unit:'count', freq:'monthly',   isKeyOutcome:false },
  { id:'ind-o8', name:'No. of FLN reading sessions conducted',                 abbr:'FRS',  type:'Output',  stk:'Student',   intv:'Foundational Literacy & Numeracy', unit:'count', freq:'monthly',   isKeyOutcome:false },
  { id:'ind-p1', name:'% of planned activities completed on schedule',          abbr:'OTS',  type:'Process', stk:'Teacher',   intv:'Teacher Capacity Building',        unit:'%',     freq:'quarterly', isKeyOutcome:false },
  { id:'ind-p2', name:'Data quality score for submitted reports',               abbr:'DQS',  type:'Process', stk:'Leader',    intv:'School Leadership Development',    unit:'score', freq:'quarterly', isKeyOutcome:false },
];

// Simulated raw_submission aggregation by grant geography
const BT_GOP_IMPACT_SEED = {
  'Karnataka': {
    geo:'Karnataka · Bengaluru Urban, Kalaburagi, Yadgir',
    schools:1247, students:342819, teachers:18640,
    stk:[
      { type:'Teacher',                 count:18640, intv:'TCB, DL'  },
      { type:'Student',                 count:342819,intv:'FLN, LA'  },
      { type:'School Head / Leader',    count:1247,  intv:'SLD'      },
      { type:'Community / Parent',      count:8940,  intv:'CE'       },
      { type:'Block Education Officer', count:42,    intv:'SLD, TCB' },
      { type:'Cluster Resource Coord.', count:186,   intv:'TCB'      },
    ]
  },
  'Bihar': {
    geo:'Bihar · Darbhanga, Muzaffarpur, East Champaran',
    schools:2340, students:618200, teachers:31420,
    stk:[
      { type:'Teacher',                 count:31420, intv:'TCB, FLN' },
      { type:'Student',                 count:618200,intv:'FLN, LA'  },
      { type:'School Head / Leader',    count:2340,  intv:'SLD'      },
      { type:'Community / Parent',      count:19200, intv:'CE'       },
      { type:'Block Education Officer', count:78,    intv:'SLD'      },
    ]
  },
};

function btGopGetImpact(progId) {
  const prog = btStore.programs.find(p => p.id === progId);
  return BT_GOP_IMPACT_SEED[prog?.name] || BT_GOP_IMPACT_SEED['Bihar'];
}

function btGopOpen(grantId) {
  const panel = $('bt-grant-outcome-panel');
  if (!panel) return;
  if (btGopState.activeGrant === grantId && panel.classList.contains('open')) {
    btGopClose(); return;
  }
  btGopState.activeGrant = grantId;
  btGopState.configMode  = false;  // always start on progress view for a new grant
  const grant = btGetGrants(btStore.activeProg).find(g => g.id === grantId);
  if (!grant) return;
  if ($('bt-gop-title'))    $('bt-gop-title').textContent    = `${grant.donor} · Outcome Commitments & Impact`;
  if ($('bt-gop-subtitle')) $('bt-gop-subtitle').textContent = `${grant.code} · map indicators · track achieved impact`;
  panel.classList.add('open');
  btGopSwitchTab(btGopState.activeTab || 'outcomes');
  btRenderGrantStrip(btStore.activeProg);
  setTimeout(() => panel.scrollIntoView({ behavior:'smooth', block:'nearest' }), 50);
}

function btGopClose() {
  const panel = $('bt-grant-outcome-panel');
  if (panel) panel.classList.remove('open');
  btGopState.activeGrant = null;
  btRenderGrantStrip(btStore.activeProg);
}

function btGopSwitchTab(tab) {
  btGopState.activeTab = tab;
  ['outcomes','impact'].forEach(t => {
    $(`bt-gop-tab-${t}`)?.classList.toggle('active', t === tab);
    $(`bt-gop-body-${t}`)?.classList.toggle('active', t === tab);
  });
  if (tab === 'outcomes') btGopRenderOutcomes();
  if (tab === 'impact')   btGopRenderImpact();
}

function btGopGetCommitments(grantId) {
  if (!btGopState.commitments[grantId]) btGopState.commitments[grantId] = {};
  return btGopState.commitments[grantId];
}

function btGopRenderOutcomes() {
  // Decides which sub-view to show based on btGopState.configMode
  if (btGopState.configMode) {
    btGopRenderConfigList();
  } else {
    btGopRenderProgress();
  }
}

// ── Progress Dashboard (Tab A default view) ────────────────────────
// Seed achieved values — simulates indicator_actuals from published reporting
const BT_GOP_ACTUALS_SEED = {
  'ind-k1': { achieved: 62,  period: 'Q3 FY26' },
  'ind-k2': { achieved: 78,  period: 'Q3 FY26' },
  'ind-k3': { achieved: 43,  period: 'Annual FY26' },
  'ind-k4': { achieved: 38,  period: 'Annual FY26' },
  'ind-k5': { achieved: 3.2, period: 'Annual FY26' },
  'ind-o1': { achieved: 24,  period: 'Feb 2026' },
  'ind-o2': { achieved: 487, period: 'Feb 2026' },
  'ind-o3': { achieved: 156, period: 'Feb 2026' },
  'ind-o4': { achieved: 38,  period: 'Feb 2026' },
  'ind-o5': { achieved: 92,  period: 'Feb 2026' },
  'ind-o6': { achieved: 0,   period: 'Not started' },
  'ind-o7': { achieved: 18,  period: 'Feb 2026' },
  'ind-o8': { achieved: 312, period: 'Feb 2026' },
  'ind-p1': { achieved: 84,  period: 'Q3 FY26' },
  'ind-p2': { achieved: 7.8, period: 'Q3 FY26' },
};

function btGopGetStatus(achieved, target) {
  if (!target || target === 0) return achieved > 0 ? 'at-risk' : 'not-started';
  const pct = achieved / target * 100;
  if (pct >= 85)  return 'on-track';
  if (pct >= 50)  return 'at-risk';
  if (achieved === 0) return 'not-started';
  return 'behind';
}

function btGopStatusLabel(s) {
  return ({ 'on-track':'On Track', 'at-risk':'At Risk', 'behind':'Behind', 'not-started':'Not Started' })[s] || s;
}

function btGopRenderProgress() {
  const grantId     = btGopState.activeGrant;
  const commitments = btGopGetCommitments(grantId);
  const committed   = BT_GOP_INDICATORS.filter(ind => commitments[ind.id]?.committed);
  const grant       = btGetGrants(btStore.activeProg).find(g => g.id === grantId);

  // Update tab badge
  if ($('bt-gop-outcomes-badge')) $('bt-gop-outcomes-badge').textContent = committed.length;

  // Show/hide sub-views
  const progView   = $('bt-gop-progress-view');
  const configView = $('bt-gop-config-view');
  if (progView)   progView.style.display   = '';
  if (configView) configView.style.display = 'none';

  const summaryEl = $('bt-gop-prog-summary');
  const gridEl    = $('bt-gop-prog-grid');
  if (!summaryEl || !gridEl) return;

  // Empty state — no committed indicators yet
  if (!committed.length) {
    summaryEl.innerHTML = '';
    gridEl.innerHTML = `
      <div class="bt-gop-empty" style="grid-column:1/-1;">
        <div class="gop-empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></div>
        <div style="font-size:14px;font-weight:700;color:var(--ink);margin-bottom:8px;">No indicators committed yet</div>
        <div style="font-size:12.5px;color:var(--slate);margin-bottom:16px;">
          Configure which indicators ${esc(grant?.donor||'this donor')} should track,<br>set targets and donor aliases.
        </div>
        <button class="btn btn-primary" style="font-size:12.5px;background:var(--purple);border-color:var(--purple);display:inline-flex;align-items:center;gap:6px;${state.role==='leader'||state.role==='donor'?'display:none;':''}"
          onclick="btGopShowConfig()">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/></svg> Configure Commitments
        </button>
      </div>`;
    return;
  }

  // Summary stats
  const statuses  = committed.map(ind => {
    const c        = commitments[ind.id];
    const actual   = BT_GOP_ACTUALS_SEED[ind.id];
    const achieved = actual?.achieved ?? 0;
    const target   = parseFloat(c.target) || 0;
    return btGopGetStatus(achieved, target);
  });
  const onTrack    = statuses.filter(s => s === 'on-track').length;
  const atRisk     = statuses.filter(s => s === 'at-risk').length;
  const behind     = statuses.filter(s => s === 'behind' || s === 'not-started').length;
  const overallPct = (() => {
    let sumPct = 0, count = 0;
    committed.forEach(ind => {
      const c = commitments[ind.id];
      const a = BT_GOP_ACTUALS_SEED[ind.id]?.achieved ?? 0;
      const t = parseFloat(c.target) || 0;
      if (t > 0) { sumPct += Math.min(a/t*100, 100); count++; }
    });
    return count > 0 ? Math.round(sumPct/count) : 0;
  })();

  summaryEl.innerHTML = `
    <div class="bt-gop-sum-card">
      <div class="bt-gop-sum-label">Indicators Tracked</div>
      <div class="bt-gop-sum-val purple">${committed.length}</div>
    </div>
    <div class="bt-gop-sum-card">
      <div class="bt-gop-sum-label">On Track</div>
      <div class="bt-gop-sum-val ok">${onTrack}</div>
    </div>
    <div class="bt-gop-sum-card">
      <div class="bt-gop-sum-label">At Risk / Behind</div>
      <div class="bt-gop-sum-val warn">${atRisk + behind}</div>
    </div>
    <div class="bt-gop-sum-card">
      <div class="bt-gop-sum-label">Overall Achievement</div>
      <div class="bt-gop-sum-val ${overallPct>=85?'ok':overallPct>=50?'warn':'ink'}">${overallPct}%</div>
    </div>`;

  // Configure button — manager only, not viewer
  if (state.role !== 'leader' && state.role !== 'donor') {
    summaryEl.insertAdjacentHTML('afterend', `
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px;margin-top:-6px;">
        <button class="btn" style="font-size:11.5px;border-color:var(--purple-border);color:var(--purple);background:var(--purple-bg);"
          onclick="btGopShowConfig()">${IC.wrench} Edit Commitments</button>
      </div>`);
  }

  const typeCls = t => ({'Output':'type-output','Outcome':'type-outcome','Process':'type-process','Impact':'type-impact'})[t]||'type-output';
  const typePill= t => ({'Output':'tp-output','Outcome':'tp-outcome','Process':'tp-process','Impact':'tp-impact'})[t]||'tp-output';
  const freqLbl = f => ({'monthly':'Monthly','quarterly':'Quarterly','annual':'Annual','one_time':'One-time'})[f]||f;

  gridEl.innerHTML = committed.map(ind => {
    const c        = commitments[ind.id];
    const actual   = BT_GOP_ACTUALS_SEED[ind.id];
    const achieved = actual?.achieved ?? 0;
    const target   = parseFloat(c.target) || 0;
    const pct      = target > 0 ? Math.min(Math.round(achieved/target*100), 100) : 0;
    const overflow = target > 0 && achieved/target > 1;
    const status   = btGopGetStatus(achieved, target);
    const alias    = c.alias || ind.name;
    const barColor = status === 'on-track' ? 'var(--ok)' : status === 'at-risk' ? 'var(--warn)' : status === 'behind' ? 'var(--danger)' : 'var(--mist)';

    return `<div class="bt-gop-prog-card ${typeCls(ind.type)}">
      ${(state.role==='leader'||state.role==='donor') ? '' : `<button class="bt-gop-pc-edit" onclick="btGopShowConfig()" title="Edit commitments">${IC.edit}</button>`}
      <div class="bt-gop-pc-hd">
        <div class="bt-gop-pc-names">
          <div class="bt-gop-pc-alias" title="${esc(alias)}">${esc(alias)}</div>
          ${alias !== ind.name ? `<div class="bt-gop-pc-orig" title="${esc(ind.name)}">M&amp;E: ${esc(ind.name)}</div>` : ''}
        </div>
        <span class="bt-gop-status ${status}">${btGopStatusLabel(status)}</span>
      </div>
      <div class="bt-gop-pc-nums">
        <span class="bt-gop-pc-achieved">${achieved.toLocaleString('en-IN')}</span>
        ${target > 0 ? `<span class="bt-gop-pc-sep">/</span><span class="bt-gop-pc-target">${target.toLocaleString('en-IN')}</span>` : ''}
        <span class="bt-gop-pc-unit">${esc(ind.unit)}</span>
        ${overflow ? `<span style="font-size:10px;color:var(--ok);font-weight:700;margin-left:4px;">${IC.party} exceeded</span>` : ''}
      </div>
      <div class="bt-gop-pc-bar-wrap">
        <div class="bt-gop-pc-bar-fill" style="width:${pct}%;background:${barColor};"></div>
      </div>
      <div class="bt-gop-pc-meta">
        <span class="bt-gop-pc-pct" style="color:${barColor};">${target>0?pct+'%':'No target set'}</span>
        <div class="bt-gop-pc-tags">
          <span class="bt-gop-type-pill ${typePill(ind.type)}">${ind.type}</span>
          ${ind.isKeyOutcome?`<span class="bt-gop-key-badge">${IC.star} Key</span>`:''}
          <span class="bt-gop-ind-freq">${freqLbl(c.freq||ind.freq)}</span>
          ${actual?.period ? `<span class="bt-gop-ind-stk" style="font-size:10px;">· ${esc(actual.period)}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

// Show config (mapping) mode
function btGopShowConfig() {
  if (state.role === 'leader' || state.role === 'donor') { toast('View-only access · contact your Program Manager to update commitments'); return; }
  btGopState.configMode = true;
  const progView   = $('bt-gop-progress-view');
  const configView = $('bt-gop-config-view');
  // Remove any injected "Edit Commitments" button that sits between summary and grid
  document.querySelectorAll('#bt-gop-body-outcomes > div[style*="justify-content:flex-end"]').forEach(el => el.remove());
  if (progView)   progView.style.display   = 'none';
  if (configView) configView.style.display = '';
  btGopRenderConfigList();
}

// Return to progress view
function btGopShowProgress() {
  btGopState.configMode = false;
  btGopRenderProgress();
}

// ── Config list renderer (the mapping/form view) ───────────────────
function btGopRenderConfigList() {
  const grantId     = btGopState.activeGrant;
  const commitments = btGopGetCommitments(grantId);
  const searchQ     = ($('bt-gop-search')?.value  || '').toLowerCase();
  const typeF       = $('bt-gop-type-filter')?.value  || '';
  const stkF        = $('bt-gop-stk-filter')?.value   || '';
  const commitF     = $('bt-gop-committed-filter')?.value || '';

  // Populate stakeholder filter once
  const stkSel = $('bt-gop-stk-filter');
  if (stkSel && stkSel.options.length <= 1) {
    [...new Set(BT_GOP_INDICATORS.map(i => i.stk))].sort().forEach(s => {
      const o = document.createElement('option'); o.value = s; o.textContent = s;
      stkSel.appendChild(o);
    });
  }

  const filtered = BT_GOP_INDICATORS.filter(ind => {
    if (searchQ && !ind.name.toLowerCase().includes(searchQ) && !ind.abbr.toLowerCase().includes(searchQ)) return false;
    if (typeF   && ind.type !== typeF) return false;
    if (stkF    && ind.stk  !== stkF)  return false;
    if (commitF === 'committed'   && !commitments[ind.id]?.committed) return false;
    if (commitF === 'uncommitted' &&  commitments[ind.id]?.committed) return false;
    return true;
  });

  const committedTotal = Object.values(commitments).filter(c => c.committed).length;
  if ($('bt-gop-outcomes-badge'))  $('bt-gop-outcomes-badge').textContent  = committedTotal;
  if ($('bt-gop-committed-count')) $('bt-gop-committed-count').textContent = `${committedTotal} committed`;
  if ($('bt-gop-save-count'))      $('bt-gop-save-count').textContent      = `${committedTotal} indicator${committedTotal!==1?'s':''}`;

  const list = $('bt-gop-ind-list');
  if (!list) return;
  if (!filtered.length) {
    list.innerHTML = `<div class="bt-gop-empty"><div class="gop-empty-icon">${IC.search}</div>No indicators match your filters.</div>`;
    return;
  }

  const typeCls  = t => ({'Output':'tp-output','Outcome':'tp-outcome','Process':'tp-process','Impact':'tp-impact'})[t]||'tp-output';
  const freqLbl  = f => ({'monthly':'Monthly','quarterly':'Quarterly','annual':'Annual','one_time':'One-time'})[f]||f;
  const donorName = btGetGrants(btStore.activeProg).find(g=>g.id===grantId)?.donor || 'donor';

  list.innerHTML = filtered.map(ind => {
    const c     = commitments[ind.id] || {};
    const isCom = !!c.committed;
    return `<div class="bt-gop-ind-row${isCom?' committed':''}" id="bt-gop-row-${ind.id}">
      <div class="bt-gop-toggle-col">
        <div class="bt-gop-toggle" onclick="btGopToggleCommit('${ind.id}')"
          title="${isCom?'Remove from commitments':'Commit to donor'}">${isCom?'✓':''}</div>
      </div>
      <div class="bt-gop-ind-info">
        <div class="bt-gop-ind-name">${esc(ind.name)}</div>
        <div class="bt-gop-ind-meta">
          <span class="bt-gop-type-pill ${typeCls(ind.type)}">${ind.type}</span>
          ${ind.isKeyOutcome?`<span class="bt-gop-key-badge">${IC.star} Key Outcome</span>`:''}
          <span class="bt-gop-ind-stk">${esc(ind.stk)}</span>
          <span class="bt-gop-intv-tag">· ${esc(ind.intv)}</span>
        </div>
        <div class="bt-gop-commit-form" id="bt-gop-form-${ind.id}">
          <div class="bt-gop-commit-field" style="min-width:220px;">
            <label>Donor Alias <span style="color:var(--purple);">*</span></label>
            <input type="text" id="bt-gop-alias-${ind.id}"
              value="${esc(c.alias||'')}" placeholder="e.g. Teacher Quality Score"
              oninput="btGopSaveField('${ind.id}','alias',this.value)" />
            <div class="bt-gop-alias-hint">${esc(donorName)} sees this name · M&amp;E admin sees original</div>
          </div>
          <div class="bt-gop-commit-field">
            <label>Committed Target</label>
            <input type="number" min="0" id="bt-gop-tgt-${ind.id}"
              value="${esc(c.target||'')}" placeholder="0" style="font-family:var(--mono);"
              oninput="btGopSaveField('${ind.id}','target',this.value)" />
          </div>
          <div class="bt-gop-commit-field">
            <label>Reporting Frequency</label>
            <select id="bt-gop-freq-${ind.id}" onchange="btGopSaveField('${ind.id}','freq',this.value)">
              <option value="monthly"   ${(c.freq||ind.freq)==='monthly'  ?'selected':''}>Monthly</option>
              <option value="quarterly" ${(c.freq||ind.freq)==='quarterly'?'selected':''}>Quarterly</option>
              <option value="annual"    ${(c.freq||ind.freq)==='annual'   ?'selected':''}>Annual</option>
              <option value="one_time"  ${(c.freq||ind.freq)==='one_time' ?'selected':''}>One-time</option>
            </select>
          </div>
          <div class="bt-gop-commit-field" style="flex:1;min-width:180px;">
            <label>Remarks for donor</label>
            <input type="text" id="bt-gop-rmk-${ind.id}"
              value="${esc(c.remarks||'')}" placeholder="e.g. Baseline to be established Q1"
              oninput="btGopSaveField('${ind.id}','remarks',this.value)" />
          </div>
        </div>
      </div>
      <div class="bt-gop-act-col">
        <span class="bt-gop-ind-unit">${esc(ind.unit)}</span>
        <span class="bt-gop-ind-freq">${freqLbl(ind.freq)}</span>
      </div>
    </div>`;
  }).join('');
}

function btGopToggleCommit(indId) {
  const c = btGopGetCommitments(btGopState.activeGrant);
  if (!c[indId]) c[indId] = {};
  c[indId].committed = !c[indId].committed;
  btGopRenderConfigList(); // stay in config mode
}

function btGopSaveField(indId, field, value) {
  const c = btGopGetCommitments(btGopState.activeGrant);
  if (!c[indId]) c[indId] = {};
  c[indId][field] = value;
}

function btGopFilterInds() { btGopRenderOutcomes(); }

function btGopSaveCommitments() {
  const grantId   = btGopState.activeGrant;
  const grant     = btGetGrants(btStore.activeProg).find(g => g.id === grantId);
  const c         = btGopGetCommitments(grantId);
  const committed = Object.entries(c).filter(([,v]) => v.committed);
  const noAlias   = committed.filter(([,v]) => !v.alias?.trim());

  if (noAlias.length) {
    toast(`\u26a0 ${noAlias.length} committed indicator${noAlias.length!==1?'s':''} need a donor alias`);
    noAlias.forEach(([id]) => {
      const inp = $(`bt-gop-alias-${id}`);
      if (inp) { inp.style.borderColor='var(--danger)'; inp.focus(); }
    });
    return;
  }

  /* Supabase: upsert each committed indicator into grant_indicator_commitment
     Fields: grant_id, indicator_id, financial_year_id, is_key_outcome_indicator,
             committed_target_value, reporting_frequency, remarks (stores alias)     */
  toast(`\u2713 ${committed.length} indicator${committed.length!==1?'s':''} committed to ${grant?.donor} \u00b7 ${new Date().toLocaleTimeString()}`);
  btGopShowProgress(); // return to progress dashboard after save
}

function btGopRenderImpact() {
  const impact = btGopGetImpact(btStore.activeProg);
  if ($('bt-gop-geo-text')) $('bt-gop-geo-text').textContent = impact.geo;
  if ($('bt-gop-stk-meta')) $('bt-gop-stk-meta').textContent = `${impact.stk.length} stakeholder types \u00b7 ${impact.geo.split('\u00b7')[0].trim()}`;

  const kpiGrid = $('bt-gop-kpi-grid');
  if (kpiGrid) kpiGrid.innerHTML = `
    <div class="bt-gop-kpi-card schools">
      <div class="bt-gop-kpi-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div>
      <div class="bt-gop-kpi-val">${impact.schools.toLocaleString('en-IN')}</div>
      <div class="bt-gop-kpi-label">Schools Covered</div>
      <div class="bt-gop-kpi-sub">Distinct school_ids · raw_submission</div>
    </div>
    <div class="bt-gop-kpi-card students">
      <div class="bt-gop-kpi-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5"/><path d="M8 10h8"/><path d="M8 18h8"/></svg></div>
      <div class="bt-gop-kpi-val">${impact.students.toLocaleString('en-IN')}</div>
      <div class="bt-gop-kpi-label">Students Reached</div>
      <div class="bt-gop-kpi-sub">Sum of total_students · matched schools</div>
    </div>
    <div class="bt-gop-kpi-card teachers">
      <div class="bt-gop-kpi-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
      <div class="bt-gop-kpi-val">${impact.teachers.toLocaleString('en-IN')}</div>
      <div class="bt-gop-kpi-label">Teachers Engaged</div>
      <div class="bt-gop-kpi-sub">raw_submission · Teacher stakeholder type</div>
    </div>
    <div class="bt-gop-kpi-card stk">
      <div class="bt-gop-kpi-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/></svg></div>
      <div class="bt-gop-kpi-val">${impact.stk.length}</div>
      <div class="bt-gop-kpi-label">Stakeholder Types</div>
      <div class="bt-gop-kpi-sub">Across all interventions in grant scope</div>
    </div>`;

  const tbody = $('bt-gop-stk-tbody');
  if (!tbody) return;
  const total = impact.stk.reduce((s,r) => s+r.count, 0);
  tbody.innerHTML = impact.stk.map(r => {
    const pct = total > 0 ? Math.round(r.count/total*100) : 0;
    return `<tr>
      <td style="font-weight:600;">${esc(r.type)}</td>
      <td style="font-family:var(--mono);font-weight:700;">${r.count.toLocaleString('en-IN')}</td>
      <td style="font-family:var(--mono);">${pct}%</td>
      <td><div class="bt-gop-stk-bar-wrap"><div class="bt-gop-stk-bar-fill" style="width:${Math.min(pct,100)}%;"></div></div></td>
      <td style="font-size:11.5px;color:var(--slate);">${esc(r.intv)}</td>
    </tr>`;
  }).join('');
}

// ── Grant Management sub-nav toggle ──────────────────────────────
// Called by the parent nav button onclick to expand/collapse sub-nav
// without triggering a route change when clicking the parent label.
function gmToggleSub(e) {
  const sub  = $('nav-gm-sub');
  const btn  = document.getElementById('nav-budget');
  const isOpen = sub?.classList.contains('open');
  if (isOpen) {
    // If sub is already open, collapse and navigate to portfolio
    // (clicking the parent when open acts as "go to portfolio")
    showPage('grant-mgmt');
  } else {
    // Open sub-nav and go to portfolio by default
    showPage('grant-mgmt');
  }
}

// ── Budget Tracker INIT wiring ────────────────────────────────────
(function() {
  // View toggle buttons
  qsa('.bt-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.bt-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      btStore.activeView = btn.dataset.btView;
      btRenderCurrentView();
    });
  });
  // Breadcrumb back
  $('bt-bc-home')?.addEventListener('click', () => btShowProgSelector());
  // Grant cards — wired via onclick in HTML (btSelectGrant)
  // FY selector
  $('bt-fy-sel')?.addEventListener('change', () => {
    if (btStore.activeProg) btOpenProg(btStore.activeProg);
    else btShowProgSelector();
  });
  // Save buttons
  $('bt-save-lines-btn')?.addEventListener('click',   () => { btRenderLines();   toast('Budget lines saved · ' + new Date().toLocaleTimeString()); });
  $('bt-save-monthly-btn')?.addEventListener('click', async () => {
    const ok = await mrSubmitToDB();
    if (ok) {
      btRenderMonthly();
      toast('✓ Submitted to M&E database · ' + new Date().toLocaleTimeString());
    } else {
      toast('✗ Failed to submit — check connection');
    }
  });
  // Entry type selectors
  $('bt-entry-type-sel')?.addEventListener('change',    () => btRenderLines());
  $('bt-monthly-type-sel')?.addEventListener('change',  () => btRenderMonthly());
  // Generate UC
  $('bt-uc-btn')?.addEventListener('click',   btGenerateUC);
  $('bt-uc-close')?.addEventListener('click', () => $('bt-uc-modal').classList.add('hidden'));
  $('bt-uc-print')?.addEventListener('click', () => { window.print(); toast('Opening print dialog'); });
  // Add stubs
  $('bt-add-disb-btn')?.addEventListener('click',   () => toast('Add Installment — coming soon'));
  $('bt-add-report-btn')?.addEventListener('click', () => toast('Add Report — coming soon'));
})();

(function() {
  const modal = $('modal-submit');
  if (!modal) return;
  let lastFocus;
  // Observe when modal becomes visible and trap focus
  const observer = new MutationObserver(() => {
    if (!modal.classList.contains('hidden')) {
      lastFocus = document.activeElement;
      const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (first) first.focus();
      modal._trapHandler = e => {
        if (e.key !== 'Tab') return;
        if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
        else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
      };
      modal._escHandler = e => { if (e.key === 'Escape') $('m-cancel')?.click(); };
      document.addEventListener('keydown', modal._trapHandler);
      document.addEventListener('keydown', modal._escHandler);
    } else {
      document.removeEventListener('keydown', modal._trapHandler);
      document.removeEventListener('keydown', modal._escHandler);
      if (lastFocus) lastFocus.focus();
    }
  });
  observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
})();

// ════════════════════════════════════════════════════════════════
//  BUDGET BOOK  —  Global registry: Budget Heads · Donors · Grants
//  All API calls use the same Supabase project (MEBK_URL / MEBK_HDR)
// ════════════════════════════════════════════════════════════════

window.bbFilter = { bc: 'active', bh: 'active', dn: 'active', gr: 'active' };

// ── Entry point ──────────────────────────────────────────────────
async function bbInit() {
  await Promise.all([bbLoadStats(), bbLoadCats(), bbLoadHeads(), bbLoadDonors(), bbLoadGrants()]);
  bbSwitchTab('bc');
}

// ── Tab switching ────────────────────────────────────────────────
function bbSwitchTab(tab) {
  ['bc','bh','dn','gr'].forEach(t => {
    document.getElementById(`bb-tab-${t}`)?.classList.toggle('active', t === tab);
    const p = document.getElementById(`bb-panel-${t}`);
    if (p) p.style.display = t === tab ? '' : 'none';
  });
}

// ── Filter pills ─────────────────────────────────────────────────
function bbSetFilter(tab, value) {
  window.bbFilter[tab] = value;
  ['active','all','inactive'].forEach(v => {
    document.getElementById(`bb-fpill-${tab}-${v}`)?.classList.toggle('sel', v === value);
  });
  if (tab === 'bc') bbLoadCats();
  else if (tab === 'bh') bbLoadHeads();
  else if (tab === 'dn') bbLoadDonors();
  else bbLoadGrants();
}

// ── Search ───────────────────────────────────────────────────────
function bbSearch(tab, q) {
  if (tab === 'bc') { bbLoadCats(); return; }
  const lq = (q || '').toLowerCase();
  document.querySelectorAll(`#bb-list-${tab} .bb-card`).forEach(card => {
    const txt = card.textContent.toLowerCase();
    card.style.display = (!lq || txt.includes(lq)) ? '' : 'none';
  });
}

// ── Show add form ────────────────────────────────────────────────
function bbShowForm(tab) {
  if (tab === 'bc') { document.getElementById('bb-form-bc').style.display = ''; return; }
  const f = document.getElementById(`bb-form-${tab}`);
  if (f) {
    f.style.display = 'flex';
    // populate donor dropdown when showing grant form
    if (tab === 'gr') bbPopulateDonorSelect('bb-gr-donor');
    f.querySelector('input')?.focus();
  }
}

// ── Stats ─────────────────────────────────────────────────────────
async function bbLoadStats() {
  try {
    const hdr = { ...MEBK_HDR, 'Prefer': 'count=exact' };
    const [bcR, bhR, dnR, grR] = await Promise.all([
      fetch(`${MEBK_URL}/rest/v1/budget_category?is_active=eq.true&select=budget_category_id&limit=1`, { headers: hdr }),
      fetch(`${MEBK_URL}/rest/v1/budget_head?is_active=eq.true&select=budget_head_id&limit=1`, { headers: hdr }),
      fetch(`${MEBK_URL}/rest/v1/donor?is_active=eq.true&select=donor_id&limit=1`, { headers: hdr }),
      fetch(`${MEBK_URL}/rest/v1/grant_program?is_active=eq.true&select=grant_program_id&limit=1`, { headers: hdr }),
    ]);
    const n = r => r.headers.get('Content-Range')?.split('/')[1] ?? '?';
    const s = id => document.getElementById(id);
    if (s('bb-stat-bc')) s('bb-stat-bc').textContent = n(bcR);
    if (s('bb-stat-bh')) s('bb-stat-bh').textContent = n(bhR);
    if (s('bb-stat-dn')) s('bb-stat-dn').textContent = n(dnR);
    if (s('bb-stat-gr')) s('bb-stat-gr').textContent = n(grR);
  } catch(e) { /* decorative */ }
}

// ── Shared toggle switch (reuse from mebk pattern) ───────────────
function bbSwitch(isOn, onClickExpr, titleOn, titleOff) {
  const title = isOn ? titleOn : titleOff;
  return `<span class="mebk-sw" title="${title}" onclick="event.stopPropagation();${onClickExpr}">
    <span class="mebk-sw-track${isOn ? ' on' : ''}"><span class="mebk-sw-thumb"></span></span>
  </span>`;
}

// ══════════════════════════════════════════════════════
//  BUDGET HEADS
// ══════════════════════════════════════════════════════
async function bbLoadHeads() {
  const el = document.getElementById('bb-list-bh');
  if (el) el.innerHTML = '<div class="bb-loading">Loading…</div>';
  const fv = window.bbFilter.bh;
  const af = fv === 'active' ? '&is_active=eq.true' : fv === 'inactive' ? '&is_active=eq.false' : '';
  try {
    const res  = await fetch(
      `${MEBK_URL}/rest/v1/budget_head?select=budget_head_id,head_code,head_name,category,description,is_active&order=sort_order.asc,head_name.asc${af}&limit=300`,
      { headers: MEBK_HDR }
    );
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error(JSON.stringify(data));
    if (!el) return;
    if (!data.length) {
      const msg = fv === 'inactive' ? 'No inactive budget heads' : 'No budget heads yet — click "+ Add Budget Head"';
      el.innerHTML = `<div class="bb-empty"><div class="bb-empty-icon">${IC.chart}</div>${msg}</div>`; return;
    }
    el.innerHTML = data.map(h => {
      const isActive = h.is_active !== false;
      const sw = bbSwitch(isActive, `bbSetActiveHead('${h.budget_head_id}',${!isActive})`, 'Active — click to deactivate', 'Inactive — click to reactivate');
      return `
      <div class="bb-card${isActive ? '' : ' inactive'}" id="bb-bh-${h.budget_head_id}">
        <div class="bb-card-hd">
          <span class="bb-code-chip bh">${h.head_code || '—'}</span>
          <span class="bb-name">${esc(h.head_name)}</span>
          ${h.category ? `<span class="bb-pill cat">${esc(h.category)}</span>` : ''}
          ${h.description ? `<span class="bb-desc">${esc(h.description)}</span>` : ''}
          ${isActive ? '' : '<span class="bb-badge-inactive">Inactive</span>'}
          <span class="bb-card-actions" onclick="event.stopPropagation()">
            ${isActive ? `<button class="bb-action-btn" title="Edit" onclick="bbEditHead('${h.budget_head_id}','${(h.head_name||'').replace(/'/g,"\\'")}','${(h.category||'').replace(/'/g,"\\'")}','${(h.description||'').replace(/'/g,"\\'")}')">
              ${IC.edit}</button>` : ''}
            ${sw}
          </span>
        </div>
        <div class="bb-edit-panel" id="bb-bh-ep-${h.budget_head_id}">
          <input class="bb-inp bb-inp-lg" id="bb-bh-ei-name-${h.budget_head_id}" value="${(h.head_name||'').replace(/"/g,'&quot;')}" placeholder="Budget head name…"/>
          <select class="bb-sel" id="bb-bh-ei-cat-${h.budget_head_id}">
            <option value="">Category…</option>
            ${['Personnel','Programs','Operations','Overheads','Infrastructure'].map(c => `<option value="${c}" ${h.category===c?'selected':''}>${c}</option>`).join('')}
          </select>
          <input class="bb-inp bb-inp-lg" id="bb-bh-ei-desc-${h.budget_head_id}" value="${(h.description||'').replace(/"/g,'&quot;')}" placeholder="Description…"/>
          <button class="btn btn-ok" style="font-size:12px;padding:6px 12px;" onclick="bbSaveEditHead('${h.budget_head_id}')">Save</button>
          <button class="btn" style="font-size:12px;padding:6px 10px;" onclick="document.getElementById('bb-bh-ep-${h.budget_head_id}').style.display='none'">Cancel</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) { if (el) el.innerHTML = `<div class="bb-err">${IC.warning} ${e.message}</div>`; }
}

function bbEditHead(id, name, cat, desc) {
  document.querySelectorAll('.bb-edit-panel').forEach(ep => ep.style.display = 'none');
  const ep = document.getElementById(`bb-bh-ep-${id}`);
  if (ep) { ep.style.display = 'flex'; document.getElementById(`bb-bh-ei-name-${id}`)?.focus(); }
}
async function bbSaveEditHead(id) {
  const name = document.getElementById(`bb-bh-ei-name-${id}`)?.value.trim();
  const cat  = document.getElementById(`bb-bh-ei-cat-${id}`)?.value;
  const desc = document.getElementById(`bb-bh-ei-desc-${id}`)?.value.trim();
  if (!name) { alert('Budget head name is required.'); return; }
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/budget_head?budget_head_id=eq.${id}`, {
      method: 'PATCH', headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body: JSON.stringify({ head_name: name, category: cat || null, description: desc || null })
    });
    if (!res.ok) throw new Error(await res.text());
    await bbLoadHeads(); bbToast('Budget head updated ✓');
  } catch(e) { alert('Error: ' + e.message); }
}
async function bbSetActiveHead(id, newActive) {
  if (!confirm(`${newActive ? 'Reactivate' : 'Deactivate'} this budget head?`)) return;
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/budget_head?budget_head_id=eq.${id}`, {
      method: 'PATCH', headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body: JSON.stringify({ is_active: newActive })
    });
    if (!res.ok) throw new Error(await res.text());
    await Promise.all([bbLoadHeads(), bbLoadStats()]);
    bbToast(newActive ? 'Budget head reactivated ✓' : 'Budget head deactivated ✓');
  } catch(e) { alert('Error: ' + e.message); }
}
async function bbSaveHead() {
  const name  = document.getElementById('bb-bh-name')?.value.trim();
  const cat   = document.getElementById('bb-bh-cat')?.value;
  const desc  = document.getElementById('bb-bh-desc')?.value.trim();
  if (!name) { alert('Please enter a budget head name.'); return; }
  const btn = document.getElementById('bb-bh-save-btn');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/budget_head`, {
      method: 'POST', headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body: JSON.stringify({ head_name: name, category: cat || null, description: desc || null, is_active: true })
    });
    if (!res.ok) throw new Error(await res.text());
    document.getElementById('bb-bh-name').value = '';
    document.getElementById('bb-bh-cat').value  = '';
    document.getElementById('bb-bh-desc').value = '';
    document.getElementById('bb-form-bh').style.display = 'none';
    await Promise.all([bbLoadHeads(), bbLoadStats()]);
    bbToast('Budget head added ✓');
  } catch(e) { alert('Error: ' + e.message); }
  if (btn) btn.disabled = false;
}

// ══════════════════════════════════════════════════════
//  DONORS
// ══════════════════════════════════════════════════════
async function bbLoadDonors() {
  const el = document.getElementById('bb-list-dn');
  if (el) el.innerHTML = '<div class="bb-loading">Loading…</div>';
  const fv = window.bbFilter.dn;
  const af = fv === 'active' ? '&is_active=eq.true' : fv === 'inactive' ? '&is_active=eq.false' : '';
  try {
    const res = await fetch(
      `${MEBK_URL}/rest/v1/donor?select=donor_id,donor_code,donor_name,donor_type,country,website,is_active&order=donor_name.asc${af}&limit=300`,
      { headers: MEBK_HDR }
    );
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error(JSON.stringify(data));
    if (!el) return;
    if (!data.length) {
      const msg = fv === 'inactive' ? 'No inactive donors' : 'No donors yet — click "+ Add Donor"';
      el.innerHTML = `<div class="bb-empty"><div class="bb-empty-icon">${IC.users}</div>${msg}</div>`; return;
    }
    el.innerHTML = data.map(d => {
      const isActive = d.is_active !== false;
      const sw = bbSwitch(isActive, `bbSetActiveDonor('${d.donor_id}',${!isActive})`, 'Active — click to deactivate', 'Inactive — click to reactivate');
      return `
      <div class="bb-card${isActive ? '' : ' inactive'}" id="bb-dn-${d.donor_id}">
        <div class="bb-card-hd">
          <span class="bb-code-chip dn">${d.donor_code || '—'}</span>
          <span class="bb-name">${esc(d.donor_name)}</span>
          ${d.donor_type ? `<span class="bb-pill type">${esc(d.donor_type)}</span>` : ''}
          ${d.country    ? `<span class="bb-meta">${IC['map-pin']} ${esc(d.country)}</span>` : ''}
          ${d.website    ? `<span class="bb-meta"><a href="${esc(d.website)}" target="_blank" rel="noopener" style="color:var(--blue);font-size:11px;">${IC.link} Website</a></span>` : ''}
          ${isActive ? '' : '<span class="bb-badge-inactive">Inactive</span>'}
          <span class="bb-card-actions" onclick="event.stopPropagation()">
            ${isActive ? `<button class="bb-action-btn" title="Edit" onclick="bbEditDonor('${d.donor_id}')">
              ${IC.edit}</button>` : ''}
            ${sw}
          </span>
        </div>
        <div class="bb-edit-panel" id="bb-dn-ep-${d.donor_id}">
          <input class="bb-inp bb-inp-lg" id="bb-dn-ei-name-${d.donor_id}"    value="${(d.donor_name||'').replace(/"/g,'&quot;')}"    placeholder="Donor name…"/>
          <select class="bb-sel"          id="bb-dn-ei-type-${d.donor_id}">
            <option value="">Donor type…</option>
            ${['Bilateral','Multilateral','Private Foundation','CSR','Government','Individual'].map(t => `<option value="${t}" ${d.donor_type===t?'selected':''}>${t}</option>`).join('')}
          </select>
          <input class="bb-inp bb-inp-md" id="bb-dn-ei-country-${d.donor_id}" value="${(d.country||'').replace(/"/g,'&quot;')}"       placeholder="Country…"/>
          <input class="bb-inp bb-inp-lg" id="bb-dn-ei-web-${d.donor_id}"     value="${(d.website||'').replace(/"/g,'&quot;')}"       placeholder="Website…"/>
          <button class="btn btn-ok" style="font-size:12px;padding:6px 12px;" onclick="bbSaveEditDonor('${d.donor_id}')">Save</button>
          <button class="btn" style="font-size:12px;padding:6px 10px;" onclick="document.getElementById('bb-dn-ep-${d.donor_id}').style.display='none'">Cancel</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) { if (el) el.innerHTML = `<div class="bb-err">${IC.warning} ${e.message}</div>`; }
}

function bbEditDonor(id) {
  document.querySelectorAll('.bb-edit-panel').forEach(ep => ep.style.display = 'none');
  const ep = document.getElementById(`bb-dn-ep-${id}`);
  if (ep) { ep.style.display = 'flex'; document.getElementById(`bb-dn-ei-name-${id}`)?.focus(); }
}
async function bbSaveEditDonor(id) {
  const name    = document.getElementById(`bb-dn-ei-name-${id}`)?.value.trim();
  const type    = document.getElementById(`bb-dn-ei-type-${id}`)?.value;
  const country = document.getElementById(`bb-dn-ei-country-${id}`)?.value.trim();
  const website = document.getElementById(`bb-dn-ei-web-${id}`)?.value.trim();
  if (!name) { alert('Donor name is required.'); return; }
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/donor?donor_id=eq.${id}`, {
      method: 'PATCH', headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body: JSON.stringify({ donor_name: name, donor_type: type || null, country: country || null, website: website || null })
    });
    if (!res.ok) throw new Error(await res.text());
    await bbLoadDonors(); bbToast('Donor updated ✓');
  } catch(e) { alert('Error: ' + e.message); }
}
async function bbSetActiveDonor(id, newActive) {
  if (!confirm(`${newActive ? 'Reactivate' : 'Deactivate'} this donor?`)) return;
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/donor?donor_id=eq.${id}`, {
      method: 'PATCH', headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body: JSON.stringify({ is_active: newActive })
    });
    if (!res.ok) throw new Error(await res.text());
    await Promise.all([bbLoadDonors(), bbLoadStats()]);
    bbToast(newActive ? 'Donor reactivated ✓' : 'Donor deactivated ✓');
  } catch(e) { alert('Error: ' + e.message); }
}
async function bbSaveDonor() {
  const name    = document.getElementById('bb-dn-name')?.value.trim();
  const type    = document.getElementById('bb-dn-type')?.value;
  const country = document.getElementById('bb-dn-country')?.value.trim();
  const website = document.getElementById('bb-dn-website')?.value.trim();
  if (!name) { alert('Please enter a donor name.'); return; }
  const btn = document.getElementById('bb-dn-save-btn');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/donor`, {
      method: 'POST', headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body: JSON.stringify({ donor_name: name, donor_type: type || null, country: country || null, website: website || null, is_active: true })
    });
    if (!res.ok) throw new Error(await res.text());
    ['bb-dn-name','bb-dn-type','bb-dn-country','bb-dn-website'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
    document.getElementById('bb-form-dn').style.display = 'none';
    await Promise.all([bbLoadDonors(), bbLoadStats()]);
    bbToast('Donor added ✓');
  } catch(e) { alert('Error: ' + e.message); }
  if (btn) btn.disabled = false;
}

// ══════════════════════════════════════════════════════
//  GRANTS
// ══════════════════════════════════════════════════════
async function bbPopulateDonorSelect(selId) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  try {
    const res  = await fetch(`${MEBK_URL}/rest/v1/donor?is_active=eq.true&select=donor_id,donor_name&order=donor_name.asc`, { headers: MEBK_HDR });
    const data = await res.json();
    const cur  = sel.value;
    sel.innerHTML = '<option value="">Select donor…</option>' +
      (Array.isArray(data) ? data.map(d => `<option value="${d.donor_id}" ${d.donor_id===cur?'selected':''}>${esc(d.donor_name)}</option>`).join('') : '');
  } catch(e) { /* ignore */ }
}

async function bbLoadGrants() {
  const el = document.getElementById('bb-list-gr');
  if (el) el.innerHTML = '<div class="bb-loading">Loading…</div>';
  const fv = window.bbFilter.gr;
  const af = fv === 'active' ? '&is_active=eq.true' : fv === 'inactive' ? '&is_active=eq.false' : '';
  try {
    const res = await fetch(
      `${MEBK_URL}/rest/v1/grant_program?select=grant_program_id,grant_code,grant_name,grant_type,currency,total_amount,start_date,end_date,is_active,donor(donor_id,donor_name)&order=grant_name.asc${af}&limit=300`,
      { headers: MEBK_HDR }
    );
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error(JSON.stringify(data));
    if (!el) return;
    if (!data.length) {
      const msg = fv === 'inactive' ? 'No inactive grants' : 'No grants yet — click "+ Add Grant"';
      el.innerHTML = `<div class="bb-empty"><div class="bb-empty-icon">${IC.database}</div>${msg}</div>`; return;
    }
    const fmtAmt = (cur, amt) => amt != null ? `${cur} ${Number(amt).toLocaleString('en-IN')}` : '—';
    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{year:'numeric',month:'short'}) : '?';
    el.innerHTML = data.map(g => {
      const isActive   = g.is_active !== false;
      const donorName  = g.donor?.donor_name || '—';
      const sw = bbSwitch(isActive, `bbSetActiveGrant('${g.grant_program_id}',${!isActive})`, 'Active — click to deactivate', 'Inactive — click to reactivate');
      return `
      <div class="bb-card${isActive ? '' : ' inactive'}" id="bb-gr-${g.grant_program_id}">
        <div class="bb-card-hd">
          <span class="bb-code-chip gr">${g.grant_code || '—'}</span>
          <span class="bb-name">${esc(g.grant_name)}</span>
          <span class="bb-pill type">${esc(donorName)}</span>
          ${g.grant_type ? `<span class="bb-pill gtype">${esc(g.grant_type)}</span>` : ''}
          <span class="bb-pill currency">${esc(g.currency||'INR')}</span>
          <span class="bb-meta">
            ${g.total_amount != null ? `<strong style="font-family:var(--mono);font-size:12px;">${fmtAmt(g.currency||'INR',g.total_amount)}</strong><span style="color:var(--mist);">·</span>` : ''}
            ${fmtDate(g.start_date)} — ${fmtDate(g.end_date)}
          </span>
          ${isActive ? '' : '<span class="bb-badge-inactive">Inactive</span>'}
          <span class="bb-card-actions" onclick="event.stopPropagation()">
            ${isActive ? `<button class="bb-action-btn" title="Edit" onclick="bbEditGrant('${g.grant_program_id}')">
              ${IC.edit}</button>` : ''}
            ${sw}
          </span>
        </div>
        <div class="bb-edit-panel" id="bb-gr-ep-${g.grant_program_id}">
          <input class="bb-inp bb-inp-lg" id="bb-gr-ei-name-${g.grant_program_id}" value="${(g.grant_name||'').replace(/"/g,'&quot;')}" placeholder="Grant name…"/>
          <select class="bb-sel"          id="bb-gr-ei-donor-${g.grant_program_id}"><option value="${g.donor?.donor_id||''}">Loading…</option></select>
          <select class="bb-sel"          id="bb-gr-ei-type-${g.grant_program_id}">
            <option value="">Grant type…</option>
            ${['Restricted Project','Unrestricted Core','Emergency Relief','Research Grant','Capacity Building'].map(t => `<option value="${t}" ${g.grant_type===t?'selected':''}>${t}</option>`).join('')}
          </select>
          <select class="bb-sel" id="bb-gr-ei-cur-${g.grant_program_id}" style="flex:0 0 80px;min-width:80px;">
            ${['INR','USD','EUR','GBP','JPY'].map(c => `<option value="${c}" ${(g.currency||'INR')===c?'selected':''}>${c}</option>`).join('')}
          </select>
          <input class="bb-inp bb-inp-sm" id="bb-gr-ei-amt-${g.grant_program_id}"   type="number" min="0" value="${g.total_amount??''}" placeholder="Amount"/>
          <input class="bb-inp bb-inp-sm" id="bb-gr-ei-start-${g.grant_program_id}" type="date" value="${g.start_date||''}"/>
          <input class="bb-inp bb-inp-sm" id="bb-gr-ei-end-${g.grant_program_id}"   type="date" value="${g.end_date||''}"/>
          <button class="btn btn-ok" style="font-size:12px;padding:6px 12px;" onclick="bbSaveEditGrant('${g.grant_program_id}')">Save</button>
          <button class="btn" style="font-size:12px;padding:6px 10px;" onclick="document.getElementById('bb-gr-ep-${g.grant_program_id}').style.display='none'">Cancel</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) { if (el) el.innerHTML = `<div class="bb-err">${IC.warning} ${e.message}</div>`; }
}

async function bbEditGrant(id) {
  document.querySelectorAll('.bb-edit-panel').forEach(ep => ep.style.display = 'none');
  const ep = document.getElementById(`bb-gr-ep-${id}`);
  if (ep) {
    ep.style.display = 'flex';
    await bbPopulateDonorSelect(`bb-gr-ei-donor-${id}`);
    document.getElementById(`bb-gr-ei-name-${id}`)?.focus();
  }
}
async function bbSaveEditGrant(id) {
  const name  = document.getElementById(`bb-gr-ei-name-${id}`)?.value.trim();
  const donor = document.getElementById(`bb-gr-ei-donor-${id}`)?.value;
  const type  = document.getElementById(`bb-gr-ei-type-${id}`)?.value;
  const cur   = document.getElementById(`bb-gr-ei-cur-${id}`)?.value || 'INR';
  const amt   = document.getElementById(`bb-gr-ei-amt-${id}`)?.value;
  const start = document.getElementById(`bb-gr-ei-start-${id}`)?.value;
  const end   = document.getElementById(`bb-gr-ei-end-${id}`)?.value;
  if (!name) { alert('Grant name is required.'); return; }
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/grant_program?grant_program_id=eq.${id}`, {
      method: 'PATCH', headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body: JSON.stringify({ grant_name: name, donor_id: donor || null, grant_type: type || null, currency: cur, total_amount: amt !== '' ? parseFloat(amt) : null, start_date: start || null, end_date: end || null })
    });
    if (!res.ok) throw new Error(await res.text());
    await bbLoadGrants(); bbToast('Grant updated ✓');
  } catch(e) { alert('Error: ' + e.message); }
}
async function bbSetActiveGrant(id, newActive) {
  if (!confirm(`${newActive ? 'Reactivate' : 'Deactivate'} this grant?`)) return;
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/grant_program?grant_program_id=eq.${id}`, {
      method: 'PATCH', headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body: JSON.stringify({ is_active: newActive })
    });
    if (!res.ok) throw new Error(await res.text());
    await Promise.all([bbLoadGrants(), bbLoadStats()]);
    bbToast(newActive ? 'Grant reactivated ✓' : 'Grant deactivated ✓');
  } catch(e) { alert('Error: ' + e.message); }
}
async function bbSaveGrant() {
  const name  = document.getElementById('bb-gr-name')?.value.trim();
  const donor = document.getElementById('bb-gr-donor')?.value;
  const type  = document.getElementById('bb-gr-type')?.value;
  const cur   = document.getElementById('bb-gr-currency')?.value || 'INR';
  const amt   = document.getElementById('bb-gr-amount')?.value;
  const start = document.getElementById('bb-gr-start')?.value;
  const end   = document.getElementById('bb-gr-end')?.value;
  if (!name) { alert('Please enter a grant name.'); return; }
  const btn = document.getElementById('bb-gr-save-btn');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`${MEBK_URL}/rest/v1/grant_program`, {
      method: 'POST', headers: { ...MEBK_HDR, 'Prefer': 'return=representation' },
      body: JSON.stringify({ grant_name: name, donor_id: donor || null, grant_type: type || null, currency: cur, total_amount: amt !== '' ? parseFloat(amt) : null, start_date: start || null, end_date: end || null, is_active: true })
    });
    if (!res.ok) throw new Error(await res.text());
    ['bb-gr-name','bb-gr-donor','bb-gr-type','bb-gr-amount','bb-gr-start','bb-gr-end'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
    document.getElementById('bb-gr-currency').value = 'INR';
    document.getElementById('bb-form-gr').style.display = 'none';
    await Promise.all([bbLoadGrants(), bbLoadStats()]);
    bbToast('Grant added ✓');
  } catch(e) { alert('Error: ' + e.message); }
  if (btn) btn.disabled = false;
}

// ── Budget Categories (CRUD) ──────────────────────────────────────
async function bbLoadCats() {
  const el = document.getElementById('bb-cats-list'); if (!el) return;
  try {
    const fv = (window.bbFilter||{}).bc || 'active';
    const af = fv === 'active' ? '&is_active=eq.true' : fv === 'inactive' ? '&is_active=eq.false' : '';
    const q  = (document.getElementById('bb-search-bc')?.value||'').toLowerCase();
    const res = await fetch(
      `${MEBK_URL}/rest/v1/budget_category?select=budget_category_id,cat_code,cat_label,cat_color,sort_order,is_active&order=sort_order.asc,cat_code.asc${af}&limit=100`,
      { headers: MEBK_HDR }
    );
    let data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Failed to load categories');
    if (q) data = data.filter(c => c.cat_code?.toLowerCase().includes(q) || c.cat_label?.toLowerCase().includes(q));
    if (!data.length) {
      const msg = fv === 'inactive' ? 'No inactive categories' : 'No categories yet — click "+ Add Category"';
      el.innerHTML = `<div class="bb-empty"><div class="bb-empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg></div>${msg}</div>`; return;
    }
    // Store for Grant Setup to use
    window.gsCategoryDefs = data;
    el.innerHTML = data.map(c => {
      const isActive = c.is_active !== false;
      const color = c.cat_color || '#6b7280';
      const sw = bbSwitch(isActive, `bbSetActiveCat('${c.budget_category_id}',${!isActive})`, 'Active', 'Inactive');
      return `<div class="bb-card${isActive?'':' inactive'}" id="bb-bc-${c.budget_category_id}" style="display:flex;align-items:center;gap:12px;padding:10px 14px;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:8px;background:${color}20;border:2px solid ${color};font-weight:800;font-size:15px;font-family:var(--mono);color:${color};flex-shrink:0;">${esc(c.cat_code)}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:13px;">${esc(c.cat_label)}</div>
          <div style="font-size:11px;color:var(--slate);">Sort: ${c.sort_order ?? 0}</div>
        </div>
        ${isActive ? '' : '<span class="bb-badge-inactive">Inactive</span>'}
        <span class="bb-card-actions" onclick="event.stopPropagation()">
          ${isActive ? `<button class="bb-action-btn" title="Edit" onclick="bbEditCat('${c.budget_category_id}','${esc(c.cat_code)}','${esc(c.cat_label)}','${c.cat_color||'#3b82f6'}',${c.sort_order||0})">${IC.edit}</button>` : ''}
          ${sw}
        </span>
        <div class="bb-edit-panel" id="bb-bc-ep-${c.budget_category_id}" style="display:none;width:100%;flex-wrap:wrap;gap:8px;margin-top:8px;">
          <input class="bb-inp" id="bb-bc-ei-code-${c.budget_category_id}" value="${esc(c.cat_code)}" placeholder="Code" style="width:70px;text-transform:uppercase;" maxlength="10"/>
          <input class="bb-inp bb-inp-lg" id="bb-bc-ei-label-${c.budget_category_id}" value="${esc(c.cat_label)}" placeholder="Label…"/>
          <input class="bb-inp" id="bb-bc-ei-color-${c.budget_category_id}" type="color" value="${c.cat_color||'#3b82f6'}" style="width:44px;padding:2px 4px;height:34px;cursor:pointer;"/>
          <input class="bb-inp" id="bb-bc-ei-sort-${c.budget_category_id}" type="number" value="${c.sort_order||0}" style="width:64px;" min="0"/>
          <button class="btn btn-ok" style="font-size:12px;padding:6px 12px;" onclick="bbSaveEditCat('${c.budget_category_id}')">Save</button>
          <button class="btn" style="font-size:12px;padding:6px 10px;" onclick="document.getElementById('bb-bc-ep-${c.budget_category_id}').style.display='none'">Cancel</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) { if (el) el.innerHTML = `<div class="bb-err">${IC.warning} ${e.message}</div>`; }
}

function bbEditCat(id, code, label, color, sort) {
  const ep = document.getElementById(`bb-bc-ep-${id}`); if (!ep) return;
  ep.style.display = 'flex';
  ep.closest('.bb-card').querySelectorAll('.bb-card-actions').forEach(el => el.style.opacity='0');
}

async function bbSaveEditCat(id) {
  const code  = document.getElementById(`bb-bc-ei-code-${id}`)?.value?.trim().toUpperCase();
  const label = document.getElementById(`bb-bc-ei-label-${id}`)?.value?.trim();
  const color = document.getElementById(`bb-bc-ei-color-${id}`)?.value;
  const sort  = parseInt(document.getElementById(`bb-bc-ei-sort-${id}`)?.value) || 0;
  if (!code || !label) { bbToast('Code and label are required'); return; }
  const res = await fetch(`${MEBK_URL}/rest/v1/budget_category?budget_category_id=eq.${id}`, {
    method: 'PATCH', headers: { ...MEBK_HDR, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ cat_code: code, cat_label: label, cat_color: color, sort_order: sort })
  });
  if (!res.ok) { bbToast('Save failed'); return; }
  bbToast('Category updated'); bbLoadCats();
}

async function bbSetActiveCat(id, newActive) {
  const res = await fetch(`${MEBK_URL}/rest/v1/budget_category?budget_category_id=eq.${id}`, {
    method: 'PATCH', headers: { ...MEBK_HDR, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ is_active: newActive })
  });
  if (!res.ok) { bbToast('Update failed'); return; }
  bbToast(newActive ? 'Category activated' : 'Category deactivated'); bbLoadCats();
}

async function bbSaveCat() {
  const code  = document.getElementById('bb-bc-code')?.value?.trim().toUpperCase();
  const label = document.getElementById('bb-bc-label')?.value?.trim();
  const color = document.getElementById('bb-bc-color')?.value || '#3b82f6';
  const sort  = parseInt(document.getElementById('bb-bc-sort')?.value) || 0;
  if (!code) { bbToast('Category code is required'); return; }
  if (!label) { bbToast('Category label is required'); return; }
  const res = await fetch(`${MEBK_URL}/rest/v1/budget_category`, {
    method: 'POST', headers: { ...MEBK_HDR, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({ cat_code: code, cat_label: label, cat_color: color, sort_order: sort, is_active: true })
  });
  const data = await res.json();
  if (!res.ok) { bbToast('Save failed: ' + (data?.message||'unknown error')); return; }
  bbToast('Category ' + code + ' added');
  document.getElementById('bb-form-bc').style.display = 'none';
  ['bb-bc-code','bb-bc-label'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  bbLoadCats();
}

// ── Toast ─────────────────────────────────────────────────────────
function bbToast(msg) {
  let t = document.getElementById('bb-toast');
  if (!t) {
    t = document.createElement('div'); t.id = 'bb-toast';
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#0891b2;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);transition:opacity .3s;pointer-events:none;';
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.opacity = '1';
  clearTimeout(t._timer); t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2500);
}

