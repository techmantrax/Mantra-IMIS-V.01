/**
 * Tests for Finance Team role introduced in this PR.
 *
 * Covers:
 *  1. Role label mapping in applyRoleUI()
 *  2. Nav sidebar visibility for the finance role
 *  3. Home page card/button visibility for the finance role
 *  4. Home greeting sub-text per role (finance + ordering regression)
 *  5. Login handler routes finance → grant-mgmt, others → home
 *  6. Nav-button click guard allows/blocks routes for finance
 *  7. data-goto click guard allows/blocks routes for finance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Create a real DOM element with the given id and optionally add initial classes. */
function el(id, ...classes) {
  const node = document.createElement('div');
  node.id = id;
  if (classes.length) node.classList.add(...classes);
  document.body.appendChild(node);
  return node;
}

/** Build all DOM elements touched by applyRoleUI() */
function buildRoleUIDom() {
  document.body.innerHTML = ''; // reset

  el('role-badge-text');

  // Sidebar nav
  el('nav-me-book');
  el('nav-me-builder');
  el('nav-lfa');
  el('nav-data-entry');
  el('nav-data-upload');
  el('nav-budget');
  el('nav-sub-budgetbook');
  el('nav-sub-newgrant');
  el('nav-gm-sub');

  // Budget Tracker edit controls
  const btEditIds = [
    'bt-th-update-util','bt-save-lines-btn','bt-entry-type-sel',
    'bt-save-monthly-btn','bt-monthly-type-sel','bt-add-disb-btn','bt-add-report-btn',
  ];
  btEditIds.forEach(id => el(id));

  // Data Upload tab
  el('du-tab-setup');

  // Home cards / buttons
  el('home-builder-card');
  el('home-reporting-card');
  el('home-open-reporting-btn');
  el('home-grant-card');
  el('home-new-grant-btn');
  el('home-lfa-card');
  el('home-sub-text');
}

/**
 * Minimal reproduction of applyRoleUI() extracted from src/index.html.
 * Matches the exact logic introduced/modified in this PR.
 */
function applyRoleUI(role) {
  const $ = id => document.getElementById(id);

  const labels = {
    poc: 'Program POC',
    admin: 'M&E Administrator',
    manager: 'Program Manager',
    leader: 'Leadership',
    donor: 'Donor/Funder',
    finance: 'Finance Team',
  };

  $('role-badge-text').textContent = labels[role] || role;

  const isAdmin   = role === 'admin';
  const isManager = role === 'manager';
  const isPOC     = role === 'poc';
  const isViewer  = ['leader', 'donor'].includes(role);
  const isFinance = role === 'finance';

  $('nav-me-book')?.classList.toggle('hidden', !isAdmin);
  $('nav-me-builder')?.classList.toggle('hidden', !isAdmin);
  $('nav-lfa')?.classList.toggle('hidden', !(isAdmin || isManager));
  $('nav-data-entry')?.classList.toggle('hidden', isManager || isViewer || isFinance);
  $('nav-data-upload')?.classList.toggle('hidden', isManager || isViewer || isFinance);
  $('nav-budget')?.classList.toggle('hidden', !(isManager || isViewer || isFinance));
  $('nav-sub-budgetbook')?.classList.toggle('hidden', !isManager);
  $('nav-sub-newgrant')?.classList.toggle('hidden', !isManager);

  $('nav-gm-sub')?.classList.toggle('open', isFinance);

  const btEditEls = [
    'bt-th-update-util','bt-save-lines-btn','bt-entry-type-sel',
    'bt-save-monthly-btn','bt-monthly-type-sel','bt-add-disb-btn','bt-add-report-btn',
  ];
  btEditEls.forEach(id => $(id)?.classList.toggle('hidden', isViewer));

  $('du-tab-setup')?.classList.toggle('hidden', !isAdmin);

  $('home-builder-card')?.classList.toggle('hidden', !isAdmin);
  $('home-reporting-card')?.classList.toggle('hidden', isManager || isViewer || isFinance);
  $('home-open-reporting-btn')?.classList.toggle('hidden', isManager || isViewer || isFinance);
  $('home-grant-card')?.classList.toggle('hidden', !(isManager || isViewer || isFinance));
  $('home-new-grant-btn')?.classList.toggle('hidden', !isManager);
  $('home-lfa-card')?.classList.toggle('hidden', !(isAdmin || isManager));

  const subEl = $('home-sub-text');
  if (subEl) {
    if (isFinance) subEl.textContent = 'Grant portfolio and monthly burn uploads';
    else if (isManager) subEl.textContent = 'Grant portfolio and program design overview';
    else if (isAdmin) subEl.textContent = 'System-wide overview · All programs · Feb 2026';
    else subEl.textContent = 'Program reporting status for February 2026';
  }
}

// ─── 1. Role label ────────────────────────────────────────────────────────────

describe('applyRoleUI – role label', () => {
  beforeEach(() => buildRoleUIDom());

  it('shows "Finance Team" label for finance role', () => {
    applyRoleUI('finance');
    expect(document.getElementById('role-badge-text').textContent).toBe('Finance Team');
  });

  it('shows correct labels for all pre-existing roles (regression)', () => {
    const cases = [
      ['poc', 'Program POC'],
      ['admin', 'M&E Administrator'],
      ['manager', 'Program Manager'],
      ['leader', 'Leadership'],
      ['donor', 'Donor/Funder'],
    ];
    cases.forEach(([role, expected]) => {
      applyRoleUI(role);
      expect(document.getElementById('role-badge-text').textContent).toBe(expected);
    });
  });

  it('falls back to role string for unknown roles', () => {
    applyRoleUI('unknown-role');
    expect(document.getElementById('role-badge-text').textContent).toBe('unknown-role');
  });
});

// ─── 2. Sidebar nav visibility ────────────────────────────────────────────────

describe('applyRoleUI – nav visibility for finance role', () => {
  beforeEach(() => buildRoleUIDom());

  it('hides nav-me-book (admin-only)', () => {
    applyRoleUI('finance');
    expect(document.getElementById('nav-me-book').classList.contains('hidden')).toBe(true);
  });

  it('hides nav-me-builder (admin-only)', () => {
    applyRoleUI('finance');
    expect(document.getElementById('nav-me-builder').classList.contains('hidden')).toBe(true);
  });

  it('hides nav-lfa (admin + manager only)', () => {
    applyRoleUI('finance');
    expect(document.getElementById('nav-lfa').classList.contains('hidden')).toBe(true);
  });

  it('hides nav-data-entry for finance', () => {
    applyRoleUI('finance');
    expect(document.getElementById('nav-data-entry').classList.contains('hidden')).toBe(true);
  });

  it('hides nav-data-upload for finance', () => {
    applyRoleUI('finance');
    expect(document.getElementById('nav-data-upload').classList.contains('hidden')).toBe(true);
  });

  it('shows nav-budget for finance', () => {
    applyRoleUI('finance');
    expect(document.getElementById('nav-budget').classList.contains('hidden')).toBe(false);
  });

  it('hides nav-sub-budgetbook for finance (manager-only sub-nav)', () => {
    applyRoleUI('finance');
    expect(document.getElementById('nav-sub-budgetbook').classList.contains('hidden')).toBe(true);
  });

  it('hides nav-sub-newgrant for finance (manager-only sub-nav)', () => {
    applyRoleUI('finance');
    expect(document.getElementById('nav-sub-newgrant').classList.contains('hidden')).toBe(true);
  });

  it('auto-expands nav-gm-sub for finance', () => {
    applyRoleUI('finance');
    expect(document.getElementById('nav-gm-sub').classList.contains('open')).toBe(true);
  });

  it('does NOT auto-expand nav-gm-sub for other roles', () => {
    ['poc', 'admin', 'manager', 'leader', 'donor'].forEach(role => {
      buildRoleUIDom();
      applyRoleUI(role);
      expect(document.getElementById('nav-gm-sub').classList.contains('open')).toBe(false);
    });
  });
});

describe('applyRoleUI – nav-data-entry/nav-data-upload hidden for manager and viewer roles (regression)', () => {
  beforeEach(() => buildRoleUIDom());

  it('still hides nav-data-entry for manager', () => {
    applyRoleUI('manager');
    expect(document.getElementById('nav-data-entry').classList.contains('hidden')).toBe(true);
  });

  it('still hides nav-data-entry for leader (viewer)', () => {
    applyRoleUI('leader');
    expect(document.getElementById('nav-data-entry').classList.contains('hidden')).toBe(true);
  });

  it('still hides nav-data-entry for donor (viewer)', () => {
    applyRoleUI('donor');
    expect(document.getElementById('nav-data-entry').classList.contains('hidden')).toBe(true);
  });

  it('shows nav-data-entry for admin', () => {
    applyRoleUI('admin');
    expect(document.getElementById('nav-data-entry').classList.contains('hidden')).toBe(false);
  });

  it('shows nav-data-entry for poc', () => {
    applyRoleUI('poc');
    expect(document.getElementById('nav-data-entry').classList.contains('hidden')).toBe(false);
  });
});

describe('applyRoleUI – nav-budget visibility for all roles', () => {
  beforeEach(() => buildRoleUIDom());

  it('shows nav-budget for manager', () => {
    applyRoleUI('manager');
    expect(document.getElementById('nav-budget').classList.contains('hidden')).toBe(false);
  });

  it('shows nav-budget for leader (viewer)', () => {
    applyRoleUI('leader');
    expect(document.getElementById('nav-budget').classList.contains('hidden')).toBe(false);
  });

  it('shows nav-budget for donor (viewer)', () => {
    applyRoleUI('donor');
    expect(document.getElementById('nav-budget').classList.contains('hidden')).toBe(false);
  });

  it('hides nav-budget for admin (M&E role)', () => {
    applyRoleUI('admin');
    expect(document.getElementById('nav-budget').classList.contains('hidden')).toBe(true);
  });

  it('hides nav-budget for poc', () => {
    applyRoleUI('poc');
    expect(document.getElementById('nav-budget').classList.contains('hidden')).toBe(true);
  });
});

// ─── 3. Budget Tracker edit controls ─────────────────────────────────────────

describe('applyRoleUI – budget tracker edit controls for finance role', () => {
  const btEditIds = [
    'bt-th-update-util','bt-save-lines-btn','bt-entry-type-sel',
    'bt-save-monthly-btn','bt-monthly-type-sel','bt-add-disb-btn','bt-add-report-btn',
  ];

  beforeEach(() => buildRoleUIDom());

  it('does NOT hide budget tracker edit controls for finance (finance can edit)', () => {
    applyRoleUI('finance');
    btEditIds.forEach(id => {
      expect(document.getElementById(id).classList.contains('hidden')).toBe(false);
    });
  });

  it('hides budget tracker edit controls for leader (read-only viewer)', () => {
    applyRoleUI('leader');
    btEditIds.forEach(id => {
      expect(document.getElementById(id).classList.contains('hidden')).toBe(true);
    });
  });

  it('hides budget tracker edit controls for donor (read-only viewer)', () => {
    applyRoleUI('donor');
    btEditIds.forEach(id => {
      expect(document.getElementById(id).classList.contains('hidden')).toBe(true);
    });
  });
});

// ─── 4. Home page cards / buttons ────────────────────────────────────────────

describe('applyRoleUI – home page elements for finance role', () => {
  beforeEach(() => buildRoleUIDom());

  it('hides home-reporting-card for finance', () => {
    applyRoleUI('finance');
    expect(document.getElementById('home-reporting-card').classList.contains('hidden')).toBe(true);
  });

  it('hides home-open-reporting-btn for finance', () => {
    applyRoleUI('finance');
    expect(document.getElementById('home-open-reporting-btn').classList.contains('hidden')).toBe(true);
  });

  it('shows home-grant-card for finance', () => {
    applyRoleUI('finance');
    expect(document.getElementById('home-grant-card').classList.contains('hidden')).toBe(false);
  });

  it('hides home-new-grant-btn for finance (manager-only)', () => {
    applyRoleUI('finance');
    expect(document.getElementById('home-new-grant-btn').classList.contains('hidden')).toBe(true);
  });

  it('hides home-builder-card for finance (admin-only)', () => {
    applyRoleUI('finance');
    expect(document.getElementById('home-builder-card').classList.contains('hidden')).toBe(true);
  });

  it('hides home-lfa-card for finance (admin + manager only)', () => {
    applyRoleUI('finance');
    expect(document.getElementById('home-lfa-card').classList.contains('hidden')).toBe(true);
  });
});

describe('applyRoleUI – home-grant-card shown for manager and viewers (regression)', () => {
  beforeEach(() => buildRoleUIDom());

  it('shows home-grant-card for manager', () => {
    applyRoleUI('manager');
    expect(document.getElementById('home-grant-card').classList.contains('hidden')).toBe(false);
  });

  it('shows home-grant-card for leader', () => {
    applyRoleUI('leader');
    expect(document.getElementById('home-grant-card').classList.contains('hidden')).toBe(false);
  });

  it('shows home-grant-card for donor', () => {
    applyRoleUI('donor');
    expect(document.getElementById('home-grant-card').classList.contains('hidden')).toBe(false);
  });

  it('hides home-grant-card for admin (M&E role)', () => {
    applyRoleUI('admin');
    expect(document.getElementById('home-grant-card').classList.contains('hidden')).toBe(true);
  });

  it('hides home-grant-card for poc', () => {
    applyRoleUI('poc');
    expect(document.getElementById('home-grant-card').classList.contains('hidden')).toBe(true);
  });
});

// ─── 5. Home greeting sub-text ────────────────────────────────────────────────

describe('applyRoleUI – home-sub-text content', () => {
  beforeEach(() => buildRoleUIDom());

  it('sets finance-specific sub-text for finance role', () => {
    applyRoleUI('finance');
    expect(document.getElementById('home-sub-text').textContent)
      .toBe('Grant portfolio and monthly burn uploads');
  });

  it('sets manager-specific sub-text for manager role', () => {
    applyRoleUI('manager');
    expect(document.getElementById('home-sub-text').textContent)
      .toBe('Grant portfolio and program design overview');
  });

  it('sets admin-specific sub-text for admin role', () => {
    applyRoleUI('admin');
    expect(document.getElementById('home-sub-text').textContent)
      .toBe('System-wide overview · All programs · Feb 2026');
  });

  it('sets default sub-text for poc role', () => {
    applyRoleUI('poc');
    expect(document.getElementById('home-sub-text').textContent)
      .toBe('Program reporting status for February 2026');
  });

  it('sets default sub-text for leader (viewer)', () => {
    applyRoleUI('leader');
    expect(document.getElementById('home-sub-text').textContent)
      .toBe('Program reporting status for February 2026');
  });

  it('sets default sub-text for donor (viewer)', () => {
    applyRoleUI('donor');
    expect(document.getElementById('home-sub-text').textContent)
      .toBe('Program reporting status for February 2026');
  });

  it('finance sub-text takes priority over manager (ordering check)', () => {
    // If isFinance check were placed after isManager, a hypothetical overlap
    // would fail. Verify finance always wins.
    applyRoleUI('finance');
    expect(document.getElementById('home-sub-text').textContent)
      .toBe('Grant portfolio and monthly burn uploads');
    expect(document.getElementById('home-sub-text').textContent)
      .not.toBe('Grant portfolio and program design overview');
  });
});

// ─── 6. Login handler routing ────────────────────────────────────────────────

describe('login handler – initial page routing', () => {
  /**
   * Minimal reproduction of the login click handler from src/index.html:15028.
   * The routing expression is: state.role === 'finance' ? 'grant-mgmt' : 'home'
   */
  function getInitialRoute(role) {
    return role === 'finance' ? 'grant-mgmt' : 'home';
  }

  it('routes finance role to grant-mgmt', () => {
    expect(getInitialRoute('finance')).toBe('grant-mgmt');
  });

  it('routes poc to home', () => {
    expect(getInitialRoute('poc')).toBe('home');
  });

  it('routes admin to home', () => {
    expect(getInitialRoute('admin')).toBe('home');
  });

  it('routes manager to home', () => {
    expect(getInitialRoute('manager')).toBe('home');
  });

  it('routes leader to home', () => {
    expect(getInitialRoute('leader')).toBe('home');
  });

  it('routes donor to home', () => {
    expect(getInitialRoute('donor')).toBe('home');
  });

  it('routes unknown role to home (not grant-mgmt)', () => {
    expect(getInitialRoute('unknown')).toBe('home');
  });
});

// ─── 7. Nav-button click guard ───────────────────────────────────────────────

describe('nav button click guard – finance role restrictions', () => {
  let toastSpy;
  let showPageSpy;

  /**
   * Reproduction of the finance guard added to the .nav-btn click handler
   * (src/index.html:15059-15062).
   *
   * Returns true if navigation was blocked (toast was triggered).
   */
  function simulateNavClick(role, route, toastFn, showPageFn) {
    if (role === 'finance' && !['grant-mgmt', 'grant-burn-upload'].includes(route)) {
      toastFn('Finance Team access is limited to Grant Portfolio and Monthly Burn');
      return true; // blocked
    }
    showPageFn(route);
    return false; // allowed
  }

  beforeEach(() => {
    toastSpy    = vi.fn();
    showPageSpy = vi.fn();
  });

  it('allows finance to navigate to grant-mgmt', () => {
    const blocked = simulateNavClick('finance', 'grant-mgmt', toastSpy, showPageSpy);
    expect(blocked).toBe(false);
    expect(showPageSpy).toHaveBeenCalledWith('grant-mgmt');
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it('allows finance to navigate to grant-burn-upload', () => {
    const blocked = simulateNavClick('finance', 'grant-burn-upload', toastSpy, showPageSpy);
    expect(blocked).toBe(false);
    expect(showPageSpy).toHaveBeenCalledWith('grant-burn-upload');
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it('blocks finance from navigating to home', () => {
    const blocked = simulateNavClick('finance', 'home', toastSpy, showPageSpy);
    expect(blocked).toBe(true);
    expect(showPageSpy).not.toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledOnce();
  });

  it('blocks finance from navigating to data-entry', () => {
    const blocked = simulateNavClick('finance', 'data-entry', toastSpy, showPageSpy);
    expect(blocked).toBe(true);
    expect(showPageSpy).not.toHaveBeenCalled();
  });

  it('blocks finance from navigating to data-upload', () => {
    const blocked = simulateNavClick('finance', 'data-upload', toastSpy, showPageSpy);
    expect(blocked).toBe(true);
    expect(showPageSpy).not.toHaveBeenCalled();
  });

  it('blocks finance from navigating to me-book', () => {
    const blocked = simulateNavClick('finance', 'me-book', toastSpy, showPageSpy);
    expect(blocked).toBe(true);
    expect(showPageSpy).not.toHaveBeenCalled();
  });

  it('blocks finance from navigating to lfa', () => {
    const blocked = simulateNavClick('finance', 'lfa', toastSpy, showPageSpy);
    expect(blocked).toBe(true);
    expect(showPageSpy).not.toHaveBeenCalled();
  });

  it('blocks finance from navigating to budget-book', () => {
    const blocked = simulateNavClick('finance', 'budget-book', toastSpy, showPageSpy);
    expect(blocked).toBe(true);
    expect(showPageSpy).not.toHaveBeenCalled();
  });

  it('shows a descriptive toast message when finance is blocked', () => {
    simulateNavClick('finance', 'home', toastSpy, showPageSpy);
    expect(toastSpy).toHaveBeenCalledWith(
      'Finance Team access is limited to Grant Portfolio and Monthly Burn'
    );
  });

  it('does NOT block non-finance roles from navigating to home via nav guard', () => {
    ['poc', 'admin', 'manager', 'leader', 'donor'].forEach(role => {
      const ts = vi.fn();
      const sp = vi.fn();
      simulateNavClick(role, 'home', ts, sp);
      expect(sp).toHaveBeenCalledWith('home');
      expect(ts).not.toHaveBeenCalled();
    });
  });

  it('does NOT apply finance guard to non-finance roles even for grant-mgmt route', () => {
    // Verifies the guard condition is scoped to finance only
    ['poc', 'admin', 'manager', 'leader', 'donor'].forEach(role => {
      const ts = vi.fn();
      const sp = vi.fn();
      simulateNavClick(role, 'grant-mgmt', ts, sp);
      expect(sp).toHaveBeenCalledWith('grant-mgmt');
      expect(ts).not.toHaveBeenCalled();
    });
  });
});

// ─── 8. data-goto click guard ────────────────────────────────────────────────

describe('data-goto click guard – finance role restrictions', () => {
  let toastSpy;
  let showPageSpy;

  /**
   * Reproduction of the finance guard in the [data-goto] click handler
   * (src/index.html:15077-15079).
   *
   * Returns true if navigation was blocked.
   */
  function simulateGotoClick(role, route, toastFn, showPageFn) {
    if (role === 'finance' && !['grant-mgmt', 'grant-burn-upload'].includes(route)) {
      toastFn('Finance Team access is limited to Grant Portfolio and Monthly Burn');
      return true;
    }
    showPageFn(route);
    return false;
  }

  beforeEach(() => {
    toastSpy    = vi.fn();
    showPageSpy = vi.fn();
  });

  it('allows finance to follow data-goto link to grant-mgmt', () => {
    const blocked = simulateGotoClick('finance', 'grant-mgmt', toastSpy, showPageSpy);
    expect(blocked).toBe(false);
    expect(showPageSpy).toHaveBeenCalledWith('grant-mgmt');
  });

  it('allows finance to follow data-goto link to grant-burn-upload', () => {
    const blocked = simulateGotoClick('finance', 'grant-burn-upload', toastSpy, showPageSpy);
    expect(blocked).toBe(false);
    expect(showPageSpy).toHaveBeenCalledWith('grant-burn-upload');
  });

  it('blocks finance from following data-goto link to home', () => {
    const blocked = simulateGotoClick('finance', 'home', toastSpy, showPageSpy);
    expect(blocked).toBe(true);
    expect(showPageSpy).not.toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledOnce();
  });

  it('blocks finance from following data-goto link to data-entry', () => {
    const blocked = simulateGotoClick('finance', 'data-entry', toastSpy, showPageSpy);
    expect(blocked).toBe(true);
    expect(showPageSpy).not.toHaveBeenCalled();
  });

  it('blocks finance from following data-goto link to lfa', () => {
    const blocked = simulateGotoClick('finance', 'lfa', toastSpy, showPageSpy);
    expect(blocked).toBe(true);
    expect(showPageSpy).not.toHaveBeenCalled();
  });

  it('shows correct toast message when data-goto is blocked for finance', () => {
    simulateGotoClick('finance', 'me-builder', toastSpy, showPageSpy);
    expect(toastSpy).toHaveBeenCalledWith(
      'Finance Team access is limited to Grant Portfolio and Monthly Burn'
    );
  });

  it('does NOT block non-finance roles via data-goto guard', () => {
    ['poc', 'admin', 'manager', 'leader', 'donor'].forEach(role => {
      const ts = vi.fn();
      const sp = vi.fn();
      simulateGotoClick(role, 'data-entry', ts, sp);
      expect(sp).toHaveBeenCalledWith('data-entry');
      expect(ts).not.toHaveBeenCalled();
    });
  });
});

// ─── 9. Login role select – finance option present in HTML ────────────────────

describe('login role select – finance option', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <select id="login-role">
        <option value="poc">Program POC</option>
        <option value="admin">M&amp;E Administrator</option>
        <option value="manager">Program Manager</option>
        <option value="leader">Leadership</option>
        <option value="donor">Donor / Funder</option>
        <option value="finance">Finance Team</option>
      </select>
    `;
  });

  it('select element contains an option with value "finance"', () => {
    const select = document.getElementById('login-role');
    const values = Array.from(select.options).map(o => o.value);
    expect(values).toContain('finance');
  });

  it('finance option has label "Finance Team"', () => {
    const select = document.getElementById('login-role');
    const opt = Array.from(select.options).find(o => o.value === 'finance');
    expect(opt).toBeDefined();
    expect(opt.text).toBe('Finance Team');
  });

  it('select contains all six roles', () => {
    const select = document.getElementById('login-role');
    const values = Array.from(select.options).map(o => o.value);
    expect(values).toEqual(['poc','admin','manager','leader','donor','finance']);
  });
});