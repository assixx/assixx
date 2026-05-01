/**
 * Unit tests for navigation-config.ts
 *
 * Tests filterMenuByAddons(), filterMenuByAccess(), and getMenuItemsForRole().
 * Renamed from feature-based to addon-based naming (Phase 5 of addon system refactor).
 * Pure functions — no mocks needed.
 *
 * @see FEAT_FRONTEND_FEATURE_GUARDS_MASTERPLAN.md Phase 3
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_HIERARCHY_LABELS } from '$lib/types/hierarchy-labels';
import { DEFAULT_ORG_SCOPE } from '$lib/types/organizational-scope';

import {
  type NavItem,
  applySurveysVariant,
  canManageSurveys,
  filterMenuByAccess,
  filterMenuByAddons,
  filterMenuByScope,
  getMenuItemsForRole,
} from './navigation-config.js';

import type { OrganizationalScope } from '$lib/types/organizational-scope';

/** Convenience: build real menus with default labels for tests */
const rootMenuItems = getMenuItemsForRole('root', DEFAULT_HIERARCHY_LABELS);
const adminMenuItems = getMenuItemsForRole('admin', DEFAULT_HIERARCHY_LABELS);
const employeeMenuItems = getMenuItemsForRole('employee');
const dummyMenuItems = getMenuItemsForRole('dummy');

// =============================================================================
// TEST HELPERS + CONSTANTS
// =============================================================================

/** All purchasable addon codes used in the codebase */
const ALL_ADDON_CODES = new Set([
  'blackboard',
  'calendar',
  'chat',
  'documents',
  'kvp',
  'surveys',
  'shift_planning',
  'tpm',
  'vacation',
  'work_orders',
]);

/** No addons active */
const NO_ADDONS = new Set<string>();

/** Commonly referenced IDs — extracted to satisfy sonarjs/no-duplicate-string */
const ID_LEAN = 'lean-management';
const ID_TPM_OVERVIEW = 'tpm-overview';

/** Helper: extract all item IDs from a (possibly nested) menu */
function collectIds(items: NavItem[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    ids.push(item.id);
    if (item.submenu !== undefined) {
      ids.push(...collectIds(item.submenu));
    }
  }
  return ids;
}

/** Helper: find item by ID in nested menu */
function findById(items: NavItem[], id: string): NavItem | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.submenu !== undefined) {
      const found = findById(item.submenu, id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** Minimal core-only menu for isolated tests */
function createTestMenu(): NavItem[] {
  return [
    { id: 'dashboard', label: 'Dashboard', url: '/dashboard' },
    {
      id: 'blackboard',
      label: 'Schwarzes Brett',
      addonCode: 'blackboard',
      submenu: [
        { id: 'bb-main', label: 'Main', url: '/blackboard' },
        { id: 'bb-archive', label: 'Archiv', url: '/blackboard/archived' },
      ],
    },
    {
      id: 'calendar',
      label: 'Kalender',
      url: '/calendar',
      addonCode: 'calendar',
    },
    {
      id: ID_LEAN,
      label: 'LEAN',
      submenu: [
        {
          id: 'kvp',
          label: 'KVP',
          addonCode: 'kvp',
          submenu: [
            { id: 'kvp-main', label: 'Vorschläge', url: '/kvp' },
            {
              id: 'kvp-categories',
              label: 'Definitionen',
              url: '/kvp-categories',
            },
          ],
        },
        {
          id: 'surveys',
          label: 'Umfragen',
          url: '/surveys',
          addonCode: 'surveys',
        },
      ],
    },
    { id: 'profile', label: 'Profil', url: '/profile' },
  ];
}

// =============================================================================
// filterMenuByAddons — HAPPY PATH
// =============================================================================

describe('filterMenuByAddons: all addons active', () => {
  it('should return all items unchanged', () => {
    const result = filterMenuByAddons(createTestMenu(), ALL_ADDON_CODES);
    const ids = collectIds(result);

    expect(ids).toContain('dashboard');
    expect(ids).toContain('blackboard');
    expect(ids).toContain('calendar');
    expect(ids).toContain('kvp');
    expect(ids).toContain('surveys');
    expect(ids).toContain('profile');
    expect(ids).toContain(ID_LEAN);
  });

  it('should preserve submenu structure', () => {
    const result = filterMenuByAddons(createTestMenu(), ALL_ADDON_CODES);
    const bb = findById(result, 'blackboard');

    expect(bb?.submenu).toHaveLength(2);
    expect(bb?.submenu?.[0].id).toBe('bb-main');
    expect(bb?.submenu?.[1].id).toBe('bb-archive');
  });

  it('should not mutate the original array', () => {
    const menu = createTestMenu();
    const originalLength = menu.length;
    filterMenuByAddons(menu, ALL_ADDON_CODES);

    expect(menu).toHaveLength(originalLength);
  });
});

// =============================================================================
// filterMenuByAddons — SINGLE FEATURE DISABLED
// =============================================================================

describe('filterMenuByAddons: single addon disabled', () => {
  it('should remove blackboard and its children when disabled', () => {
    const addons = new Set(ALL_ADDON_CODES);
    addons.delete('blackboard');
    const result = filterMenuByAddons(createTestMenu(), addons);

    expect(collectIds(result)).not.toContain('blackboard');
    expect(collectIds(result)).not.toContain('bb-main');
    expect(collectIds(result)).not.toContain('bb-archive');
  });

  it('should remove calendar when disabled', () => {
    const addons = new Set(ALL_ADDON_CODES);
    addons.delete('calendar');
    const result = filterMenuByAddons(createTestMenu(), addons);

    expect(collectIds(result)).not.toContain('calendar');
  });

  it('should remove kvp but keep surveys under lean-management', () => {
    const addons = new Set(ALL_ADDON_CODES);
    addons.delete('kvp');
    const ids = collectIds(filterMenuByAddons(createTestMenu(), addons));

    expect(ids).not.toContain('kvp');
    expect(ids).not.toContain('kvp-main');
    expect(ids).not.toContain('kvp-categories');
    expect(ids).toContain('surveys');
    expect(ids).toContain(ID_LEAN);
  });

  it('should remove surveys but keep kvp under lean-management', () => {
    const addons = new Set(ALL_ADDON_CODES);
    addons.delete('surveys');
    const ids = collectIds(filterMenuByAddons(createTestMenu(), addons));

    expect(ids).not.toContain('surveys');
    expect(ids).toContain('kvp');
    expect(ids).toContain(ID_LEAN);
  });
});

// =============================================================================
// filterMenuByAddons — RECURSION + EMPTY PARENT
// =============================================================================

describe('filterMenuByAddons: empty parent containers', () => {
  it('should remove lean-management when both kvp AND surveys are disabled', () => {
    const addons = new Set(ALL_ADDON_CODES);
    addons.delete('kvp');
    addons.delete('surveys');
    const ids = collectIds(filterMenuByAddons(createTestMenu(), addons));

    expect(ids).not.toContain(ID_LEAN);
    expect(ids).not.toContain('kvp');
    expect(ids).not.toContain('surveys');
  });

  it('should keep parent with own URL even if all children removed', () => {
    const menu: NavItem[] = [
      {
        id: 'parent-with-url',
        label: 'Parent',
        url: '/parent',
        submenu: [{ id: 'child', label: 'Child', url: '/c', addonCode: 'blackboard' }],
      },
    ];
    const result = filterMenuByAddons(menu, NO_ADDONS);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('parent-with-url');
    expect(result[0].submenu).toHaveLength(0);
  });

  it('should remove parent WITHOUT url when all children removed', () => {
    const menu: NavItem[] = [
      {
        id: 'parent-no-url',
        label: 'Parent',
        submenu: [{ id: 'child', label: 'Child', url: '/c', addonCode: 'blackboard' }],
      },
    ];

    expect(filterMenuByAddons(menu, NO_ADDONS)).toHaveLength(0);
  });
});

// =============================================================================
// filterMenuByAddons — CORE ITEMS SAFETY
// =============================================================================

describe('filterMenuByAddons: no addons active (core safety)', () => {
  it('should always keep items WITHOUT addonCode', () => {
    const ids = collectIds(filterMenuByAddons(createTestMenu(), NO_ADDONS));

    expect(ids).toContain('dashboard');
    expect(ids).toContain('profile');
  });

  it('should remove ALL addon-gated items', () => {
    const ids = collectIds(filterMenuByAddons(createTestMenu(), NO_ADDONS));

    expect(ids).not.toContain('blackboard');
    expect(ids).not.toContain('calendar');
    expect(ids).not.toContain('kvp');
    expect(ids).not.toContain('surveys');
  });

  it('should remove lean-management (empty container)', () => {
    const ids = collectIds(filterMenuByAddons(createTestMenu(), NO_ADDONS));

    expect(ids).not.toContain(ID_LEAN);
  });
});

// =============================================================================
// filterMenuByAddons — REAL MENUS
// =============================================================================

describe('filterMenuByAddons: real rootMenuItems', () => {
  it('should keep core items when no addons are active', () => {
    const ids = collectIds(filterMenuByAddons(rootMenuItems, NO_ADDONS));

    expect(ids).toContain('dashboard');
    expect(ids).toContain('verwalten');
    expect(ids).toContain('root-users');
    expect(ids).toContain('admins-list');
    expect(ids).toContain('areas');
    expect(ids).toContain('departments');
    expect(ids).toContain('addons');
    expect(ids).toContain('logs');
    expect(ids).toContain('profile');
    expect(ids).toContain('system');
  });

  it('should remove all addon-gated items when no addons active', () => {
    const ids = collectIds(filterMenuByAddons(rootMenuItems, NO_ADDONS));

    expect(ids).not.toContain('blackboard');
    expect(ids).not.toContain('calendar');
    expect(ids).not.toContain('chat');
    expect(ids).not.toContain('documents');
    expect(ids).not.toContain('vacation');
    expect(ids).not.toContain('kvp');
    expect(ids).not.toContain('surveys');
    expect(ids).not.toContain(ID_LEAN);
  });

  it('should keep all items when all addons are active', () => {
    const ids = collectIds(filterMenuByAddons(rootMenuItems, ALL_ADDON_CODES));

    expect(ids).toContain('blackboard');
    expect(ids).toContain('calendar');
    expect(ids).toContain('chat');
    expect(ids).toContain('documents');
    expect(ids).toContain('vacation');
    expect(ids).toContain('kvp');
    expect(ids).toContain('surveys');
    expect(ids).toContain(ID_LEAN);
  });
});

describe('filterMenuByAddons: real adminMenuItems', () => {
  it('should keep core items when no addons are active', () => {
    const ids = collectIds(filterMenuByAddons(adminMenuItems, NO_ADDONS));

    expect(ids).toContain('dashboard');
    expect(ids).toContain('verwalten');
    expect(ids).toContain('employees-list');
    expect(ids).toContain('assets');
    expect(ids).toContain('settings');
    expect(ids).toContain('profile');
  });

  it('should remove shifts when shift_planning is disabled', () => {
    const addons = new Set(ALL_ADDON_CODES);
    addons.delete('shift_planning');

    expect(collectIds(filterMenuByAddons(adminMenuItems, addons))).not.toContain('shifts');
  });
});

describe('filterMenuByAddons: real employeeMenuItems', () => {
  it('should keep core items when no addons are active', () => {
    const ids = collectIds(filterMenuByAddons(employeeMenuItems, NO_ADDONS));

    expect(ids).toContain('dashboard');
    expect(ids).toContain('settings');
    expect(ids).toContain('profile');
  });

  it('should remove lean-management when all LEAN addons disabled (kvp+surveys+tpm)', () => {
    const addons = new Set(ALL_ADDON_CODES);
    addons.delete('kvp');
    addons.delete('surveys');
    addons.delete('tpm');

    expect(collectIds(filterMenuByAddons(employeeMenuItems, addons))).not.toContain(ID_LEAN);
  });

  it('should keep lean-management when only tpm is active', () => {
    const ids = collectIds(filterMenuByAddons(employeeMenuItems, new Set(['tpm'])));

    expect(ids).toContain(ID_LEAN);
    expect(ids).toContain('tpm');
    expect(ids).not.toContain('kvp');
    expect(ids).not.toContain('surveys');
  });

  it('should keep lean-management when only kvp is active', () => {
    const ids = collectIds(filterMenuByAddons(employeeMenuItems, new Set(['kvp'])));

    expect(ids).toContain(ID_LEAN);
    expect(ids).toContain('kvp');
    expect(ids).not.toContain('surveys');
  });
});

// =============================================================================
// filterMenuByAddons — EDGE CASES
// =============================================================================

describe('filterMenuByAddons: edge cases', () => {
  it('should handle empty menu array', () => {
    expect(filterMenuByAddons([], ALL_ADDON_CODES)).toHaveLength(0);
  });

  it('should handle deeply nested submenus (3 levels)', () => {
    const menu: NavItem[] = [
      {
        id: 'l1',
        label: 'L1',
        submenu: [
          {
            id: 'l2',
            label: 'L2',
            submenu: [{ id: 'l3', label: 'L3', url: '/deep', addonCode: 'kvp' }],
          },
        ],
      },
    ];

    expect(collectIds(filterMenuByAddons(menu, new Set(['kvp'])))).toEqual(['l1', 'l2', 'l3']);
    expect(filterMenuByAddons(menu, NO_ADDONS)).toHaveLength(0);
  });

  it('should handle unknown addon codes gracefully', () => {
    const menu: NavItem[] = [{ id: 'x', label: 'X', url: '/x', addonCode: 'nonexistent' }];

    expect(filterMenuByAddons(menu, ALL_ADDON_CODES)).toHaveLength(0);
  });

  it('should return new array references (immutable)', () => {
    const menu = createTestMenu();
    expect(filterMenuByAddons(menu, ALL_ADDON_CODES)).not.toBe(menu);
  });
});

// =============================================================================
// getMenuItemsForRole
// =============================================================================

describe('getMenuItemsForRole', () => {
  it('should return items with areas/departments/teams for root', () => {
    const items = getMenuItemsForRole('root');
    const ids = collectIds(items);

    expect(ids).toContain('areas');
    expect(ids).toContain('departments');
    expect(ids).toContain('teams');
  });

  it('should return items with assets/halls for admin', () => {
    const items = getMenuItemsForRole('admin');
    const ids = collectIds(items);

    expect(ids).toContain('assets');
    expect(ids).toContain('halls');
  });

  it('should return employeeMenuItems for employee', () => {
    expect(getMenuItemsForRole('employee')).toEqual(employeeMenuItems);
  });

  it('should include my-team in employee base menu', () => {
    const ids = collectIds(employeeMenuItems);
    expect(ids).toContain('my-team');
  });

  it('should have teams submenu with teams-manage and my-team for root', () => {
    const items = getMenuItemsForRole('root');
    const teams = findById(items, 'teams');
    expect(teams?.submenu).toBeDefined();
    const subIds = (teams?.submenu ?? []).map((i: NavItem) => i.id);
    expect(subIds).toContain('teams-manage');
    expect(subIds).toContain('my-team');
  });

  it('should return dummyMenuItems for dummy', () => {
    expect(getMenuItemsForRole('dummy')).toBe(dummyMenuItems);
  });

  it('should use custom labels when provided', () => {
    const customLabels = {
      hall: 'Gebäude',
      area: 'Werke',
      areaLeadPrefix: 'Werks',
      department: 'Segmente',
      departmentLeadPrefix: 'Segment',
      team: 'Teams',
      teamLeadPrefix: 'Team',
      asset: 'Maschinen',
    };
    const items = getMenuItemsForRole('root', customLabels);
    const areasItem = findById(items, 'areas');
    const deptsItem = findById(items, 'departments');

    expect(areasItem?.label).toBe('Werke');
    expect(deptsItem?.label).toBe('Segmente');
  });
});

// =============================================================================
// filterMenuByAccess
// =============================================================================

describe('filterMenuByAccess', () => {
  it('should return all items when hasFullAccess is true', () => {
    expect(filterMenuByAccess(adminMenuItems, true)).toBe(adminMenuItems);
  });

  it('should remove kvp-categories when hasFullAccess is false', () => {
    expect(collectIds(filterMenuByAccess(rootMenuItems, false))).not.toContain('kvp-categories');
  });

  it('should keep kvp-main when hasFullAccess is false', () => {
    expect(collectIds(filterMenuByAccess(rootMenuItems, false))).toContain('kvp-main');
  });
});

// =============================================================================
// filterMenuByScope — APPROVALS INJECTION
// =============================================================================

/** Helper: create scope with specific lead flags */
function scopeWith(overrides: Partial<OrganizationalScope>): OrganizationalScope {
  return { ...DEFAULT_ORG_SCOPE, ...overrides };
}

describe('filterMenuByScope: root', () => {
  it('should pass through without changes (approvals already static)', () => {
    const result = filterMenuByScope(rootMenuItems, DEFAULT_ORG_SCOPE, 'root');

    expect(result).toBe(rootMenuItems);
  });

  it('should contain approvals in static root menu', () => {
    expect(collectIds(rootMenuItems)).toContain('approvals');
  });
});

describe('filterMenuByScope: admin', () => {
  it('should contain approvals in static admin menu', () => {
    expect(collectIds(adminMenuItems)).toContain('approvals');
  });

  it('should inject manage items into verwalten submenu for admin with org scope', () => {
    const scope = scopeWith({ type: 'full' });
    const result = filterMenuByScope(adminMenuItems, scope, 'admin');
    const verwalten = findById(result, 'verwalten');
    const subIds = collectIds(verwalten?.submenu ?? []);

    expect(subIds).toContain('employees-list');
    expect(subIds).toContain('areas');
    expect(subIds).toContain('departments');
    expect(subIds).toContain('teams');
    expect(subIds).toContain('assets');
    expect(subIds).toContain('halls');
  });
});

describe('filterMenuByScope: employee team lead', () => {
  it('should inject approvals for team lead', () => {
    const scope = scopeWith({ isTeamLead: true, isAnyLead: true });
    const result = filterMenuByScope(employeeMenuItems, scope, 'employee');
    const ids = collectIds(result);

    expect(ids).toContain('approvals');
  });

  it('should inject teams + employees for team lead', () => {
    const scope = scopeWith({ isTeamLead: true, isAnyLead: true });
    const result = filterMenuByScope(employeeMenuItems, scope, 'employee');
    const ids = collectIds(result);

    expect(ids).toContain('teams');
    expect(ids).toContain('employees');
  });

  it('should create teams submenu with teams-manage and my-team for team lead', () => {
    const scope = scopeWith({ isTeamLead: true, isAnyLead: true });
    const result = filterMenuByScope(employeeMenuItems, scope, 'employee');
    const teams = findById(result, 'teams');

    expect(teams?.submenu).toBeDefined();
    const subIds = (teams?.submenu ?? []).map((i: NavItem) => i.id);
    expect(subIds).toContain('teams-manage');
    expect(subIds).toContain('my-team');
  });

  it('should place approvals before profile', () => {
    const scope = scopeWith({ isTeamLead: true, isAnyLead: true });
    const result = filterMenuByScope(employeeMenuItems, scope, 'employee');
    const ids = collectIds(result);
    const approvalsIdx = ids.indexOf('approvals');
    const profileIdx = ids.indexOf('profile');

    expect(approvalsIdx).toBeGreaterThan(-1);
    expect(profileIdx).toBeGreaterThan(-1);
    expect(approvalsIdx).toBeLessThan(profileIdx);
  });
});

describe('filterMenuByScope: employee area lead', () => {
  it('should inject approvals for area lead', () => {
    const scope = scopeWith({ isAreaLead: true, isAnyLead: true });
    const result = filterMenuByScope(employeeMenuItems, scope, 'employee');

    expect(collectIds(result)).toContain('approvals');
  });

  it('should NOT inject teams/employees for area lead (only team lead gets those)', () => {
    const scope = scopeWith({ isAreaLead: true, isAnyLead: true });
    const result = filterMenuByScope(employeeMenuItems, scope, 'employee');
    const ids = collectIds(result);

    expect(ids).not.toContain('teams');
    expect(ids).not.toContain('employees');
  });
});

describe('filterMenuByScope: employee department lead', () => {
  it('should inject approvals for department lead', () => {
    const scope = scopeWith({ isDepartmentLead: true, isAnyLead: true });
    const result = filterMenuByScope(employeeMenuItems, scope, 'employee');

    expect(collectIds(result)).toContain('approvals');
  });

  it('should place approvals before profile', () => {
    const scope = scopeWith({ isDepartmentLead: true, isAnyLead: true });
    const result = filterMenuByScope(employeeMenuItems, scope, 'employee');
    const ids = collectIds(result);

    expect(ids.indexOf('approvals')).toBeLessThan(ids.indexOf('profile'));
  });
});

describe('filterMenuByScope: employee without lead', () => {
  it('should NOT inject approvals for regular employee', () => {
    const result = filterMenuByScope(employeeMenuItems, DEFAULT_ORG_SCOPE, 'employee');

    expect(collectIds(result)).not.toContain('approvals');
  });

  it('should return items unchanged', () => {
    const result = filterMenuByScope(employeeMenuItems, DEFAULT_ORG_SCOPE, 'employee');

    expect(result).toBe(employeeMenuItems);
  });

  it('should NOT have tpm-overview in base employee menu', () => {
    expect(collectIds(employeeMenuItems)).not.toContain(ID_TPM_OVERVIEW);
  });

  it('should have tpm-boards in base employee menu', () => {
    expect(collectIds(employeeMenuItems)).toContain('tpm-boards');
  });
});

// =============================================================================
// filterMenuByScope — TPM MANAGEMENT ACCESS
// =============================================================================

describe('filterMenuByScope: TPM management for team lead', () => {
  const teamLeadScope = scopeWith({ isTeamLead: true, isAnyLead: true });

  it('should inject tpm-overview for team lead', () => {
    const result = filterMenuByScope(employeeMenuItems, teamLeadScope, 'employee');

    expect(collectIds(result)).toContain(ID_TPM_OVERVIEW);
  });

  it('should place tpm-overview before tpm-boards', () => {
    const result = filterMenuByScope(employeeMenuItems, teamLeadScope, 'employee');
    const tpm = findById(result, 'tpm');
    const subIds = (tpm?.submenu ?? []).map((i: NavItem) => i.id);

    expect(subIds).toEqual([ID_TPM_OVERVIEW, 'tpm-boards']);
  });

  it('should set correct URL for tpm-overview', () => {
    const result = filterMenuByScope(employeeMenuItems, teamLeadScope, 'employee');
    const tpmOverview = findById(result, ID_TPM_OVERVIEW);

    expect(tpmOverview?.url).toBe('/lean-management/tpm');
  });
});

describe('filterMenuByScope: TPM management for area/dept lead (non-team-lead)', () => {
  it('should NOT inject tpm-overview for area lead', () => {
    const scope = scopeWith({ isAreaLead: true, isAnyLead: true });
    const result = filterMenuByScope(employeeMenuItems, scope, 'employee');

    expect(collectIds(result)).not.toContain(ID_TPM_OVERVIEW);
  });

  it('should NOT inject tpm-overview for department lead', () => {
    const scope = scopeWith({ isDepartmentLead: true, isAnyLead: true });
    const result = filterMenuByScope(employeeMenuItems, scope, 'employee');

    expect(collectIds(result)).not.toContain(ID_TPM_OVERVIEW);
  });
});

describe('filterMenuByScope: dummy', () => {
  it('should NOT inject approvals for dummy users', () => {
    const result = filterMenuByScope(dummyMenuItems, DEFAULT_ORG_SCOPE, 'dummy');

    expect(collectIds(result)).not.toContain('approvals');
  });
});

// =============================================================================
// canManageSurveys
// =============================================================================

describe('canManageSurveys', () => {
  it('should return true for root (regardless of other flags)', () => {
    expect(canManageSurveys('root', false, false)).toBe(true);
  });

  it('should return true for admin with hasFullAccess', () => {
    expect(canManageSurveys('admin', true, false)).toBe(true);
  });

  it('should return false for admin WITHOUT hasFullAccess and no lead scope', () => {
    expect(canManageSurveys('admin', false, false)).toBe(false);
  });

  it('should return true for admin WITHOUT hasFullAccess BUT with lead scope', () => {
    expect(canManageSurveys('admin', false, true)).toBe(true);
  });

  it('should return true for employee with any lead scope (team/area/dept/deputy)', () => {
    expect(canManageSurveys('employee', false, true)).toBe(true);
  });

  it('should return false for pure employee (no lead, no deputy)', () => {
    expect(canManageSurveys('employee', false, false)).toBe(false);
  });

  it('should ignore stray hasFullAccess on employee role', () => {
    // Defensive: hasFullAccess on employee shouldn't happen in practice but
    // if it does, it must NOT grant manage rights — only role-gated admin wins.
    expect(canManageSurveys('employee', true, false)).toBe(false);
  });

  it('should return false when role is undefined', () => {
    expect(canManageSurveys(undefined, true, false)).toBe(false);
  });
});

// =============================================================================
// applySurveysVariant
// =============================================================================

describe('applySurveysVariant: canManage=false', () => {
  it('should return items unchanged (single /surveys link stays)', () => {
    const menu = createTestMenu();
    const result = applySurveysVariant(menu, false);

    const surveys = findById(result, 'surveys');
    expect(surveys?.url).toBe('/surveys');
    expect(surveys?.submenu).toBeUndefined();
  });
});

describe('applySurveysVariant: canManage=true', () => {
  it('should expand surveys entry into submenu with Meine Umfragen + Verwaltung', () => {
    const result = applySurveysVariant(createTestMenu(), true);
    const surveys = findById(result, 'surveys');

    expect(surveys?.url).toBeUndefined();
    expect(surveys?.submenu).toBeDefined();
    expect(surveys?.submenu).toHaveLength(2);

    const ids = surveys?.submenu?.map((child) => child.id) ?? [];
    expect(ids).toContain('surveys-my');
    expect(ids).toContain('surveys-manage');
  });

  it('should point surveys-my to /surveys and surveys-manage to /manage-surveys', () => {
    const result = applySurveysVariant(createTestMenu(), true);
    const surveys = findById(result, 'surveys');

    const my = surveys?.submenu?.find((c) => c.id === 'surveys-my');
    const manage = surveys?.submenu?.find((c) => c.id === 'surveys-manage');

    expect(my?.url).toBe('/surveys');
    expect(manage?.url).toBe('/manage-surveys');
  });

  it('should preserve surveys label and addonCode', () => {
    const result = applySurveysVariant(createTestMenu(), true);
    const surveys = findById(result, 'surveys');

    expect(surveys?.label).toBe('Umfragen');
    expect(surveys?.addonCode).toBe('surveys');
  });

  it('should be a no-op when menu has no lean-management', () => {
    const menu: NavItem[] = [{ id: 'dashboard', label: 'Dashboard', url: '/dashboard' }];
    const result = applySurveysVariant(menu, true);

    expect(result).toEqual(menu);
  });

  it('should be a no-op when lean submenu has no surveys child', () => {
    const menu: NavItem[] = [
      {
        id: ID_LEAN,
        label: 'LEAN',
        submenu: [{ id: 'kvp', label: 'KVP', url: '/kvp' }],
      },
    ];
    const result = applySurveysVariant(menu, true);

    expect(findById(result, 'surveys')).toBeUndefined();
    expect(findById(result, 'kvp')).toBeDefined();
  });
});

// =============================================================================
// BLACKBOARD PIN POSITION — UX requirement 2026-04-15
// WHY: "Schwarzes Brett" must always sit directly under Dashboard for root,
//      admin and employee. No my-team, no lead injection in between.
//      Regression guard — see navigation-config.ts EMPLOYEE_BLACKBOARD_ITEM.
// =============================================================================

describe('Blackboard pin position (directly under Dashboard)', () => {
  it('should place blackboard at index 1 for root', () => {
    const items = getMenuItemsForRole('root');
    expect(items[0].id).toBe('dashboard');
    expect(items[1].id).toBe('blackboard');
  });

  it('should place blackboard at index 1 for admin', () => {
    const items = getMenuItemsForRole('admin');
    expect(items[0].id).toBe('dashboard');
    expect(items[1].id).toBe('blackboard');
  });

  it('should place blackboard at index 1 for employee (no lead)', () => {
    const items = getMenuItemsForRole('employee');
    expect(items[0].id).toBe('dashboard');
    expect(items[1].id).toBe('blackboard');
  });

  it('should keep blackboard at index 1 after team-lead injection', () => {
    const scope = scopeWith({ isTeamLead: true, isAnyLead: true });
    const result = filterMenuByScope(employeeMenuItems, scope, 'employee');

    expect(result[0].id).toBe('dashboard');
    expect(result[1].id).toBe('blackboard');
  });

  it('should keep blackboard at index 1 after admin scope injection', () => {
    const scope = scopeWith({ type: 'full' });
    const result = filterMenuByScope(adminMenuItems, scope, 'admin');

    expect(result[0].id).toBe('dashboard');
    expect(result[1].id).toBe('blackboard');
  });
});
