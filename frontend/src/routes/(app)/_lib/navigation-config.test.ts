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

import {
  type NavItem,
  filterMenuByAccess,
  filterMenuByAddons,
  getMenuItemsForRole,
} from './navigation-config.js';

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
  'vacation',
]);

/** No addons active */
const NO_ADDONS = new Set<string>();

/** Commonly referenced IDs — extracted to satisfy sonarjs/no-duplicate-string */
const ID_LEAN = 'lean-management';

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
          url: '/survey-admin',
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
        submenu: [
          { id: 'child', label: 'Child', url: '/c', addonCode: 'blackboard' },
        ],
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
        submenu: [
          { id: 'child', label: 'Child', url: '/c', addonCode: 'blackboard' },
        ],
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
    expect(ids).toContain('root-users');
    expect(ids).toContain('admins');
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
    expect(ids).toContain('employees');
    expect(ids).toContain('assets');
    expect(ids).toContain('settings');
    expect(ids).toContain('profile');
  });

  it('should remove shifts when shift_planning is disabled', () => {
    const addons = new Set(ALL_ADDON_CODES);
    addons.delete('shift_planning');

    expect(
      collectIds(filterMenuByAddons(adminMenuItems, addons)),
    ).not.toContain('shifts');
  });
});

describe('filterMenuByAddons: real employeeMenuItems', () => {
  it('should keep core items when no addons are active', () => {
    const ids = collectIds(filterMenuByAddons(employeeMenuItems, NO_ADDONS));

    expect(ids).toContain('dashboard');
    expect(ids).toContain('settings');
    expect(ids).toContain('profile');
  });

  it('should remove lean-management when kvp+surveys disabled', () => {
    const addons = new Set(ALL_ADDON_CODES);
    addons.delete('kvp');
    addons.delete('surveys');

    expect(
      collectIds(filterMenuByAddons(employeeMenuItems, addons)),
    ).not.toContain(ID_LEAN);
  });

  it('should keep lean-management when only kvp is active', () => {
    const ids = collectIds(
      filterMenuByAddons(employeeMenuItems, new Set(['kvp'])),
    );

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
            submenu: [
              { id: 'l3', label: 'L3', url: '/deep', addonCode: 'kvp' },
            ],
          },
        ],
      },
    ];

    expect(collectIds(filterMenuByAddons(menu, new Set(['kvp'])))).toEqual([
      'l1',
      'l2',
      'l3',
    ]);
    expect(filterMenuByAddons(menu, NO_ADDONS)).toHaveLength(0);
  });

  it('should handle unknown addon codes gracefully', () => {
    const menu: NavItem[] = [
      { id: 'x', label: 'X', url: '/x', addonCode: 'nonexistent' },
    ];

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
    expect(getMenuItemsForRole('employee')).toBe(employeeMenuItems);
  });

  it('should return dummyMenuItems for dummy', () => {
    expect(getMenuItemsForRole('dummy')).toBe(dummyMenuItems);
  });

  it('should use custom labels when provided', () => {
    const customLabels = {
      hall: 'Gebäude',
      area: 'Werke',
      department: 'Segmente',
      team: 'Crews',
      asset: 'Maschinen',
    };
    const items = getMenuItemsForRole('root', customLabels);
    const areasItem = items.find((item) => item.id === 'areas');
    const deptsItem = items.find((item) => item.id === 'departments');

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
    expect(collectIds(filterMenuByAccess(rootMenuItems, false))).not.toContain(
      'kvp-categories',
    );
  });

  it('should keep kvp-main when hasFullAccess is false', () => {
    expect(collectIds(filterMenuByAccess(rootMenuItems, false))).toContain(
      'kvp-main',
    );
  });
});
