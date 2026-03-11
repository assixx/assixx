/**
 * Unit tests for navigation-config.ts
 *
 * Tests filterMenuByFeatures(), filterMenuByAccess(), and getMenuItemsForRole().
 * Pure functions — no mocks needed.
 *
 * @see FEAT_FRONTEND_FEATURE_GUARDS_MASTERPLAN.md Phase 3
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_HIERARCHY_LABELS } from '$lib/types/hierarchy-labels';

import {
  type NavItem,
  filterMenuByAccess,
  filterMenuByFeatures,
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

/** All 8 feature codes used in the codebase */
const ALL_FEATURE_CODES = new Set([
  'blackboard',
  'calendar',
  'chat',
  'documents',
  'kvp',
  'surveys',
  'shift_planning',
  'vacation',
]);

/** No features active */
const NO_FEATURES = new Set<string>();

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
      featureCode: 'blackboard',
      submenu: [
        { id: 'bb-main', label: 'Main', url: '/blackboard' },
        { id: 'bb-archive', label: 'Archiv', url: '/blackboard/archived' },
      ],
    },
    {
      id: 'calendar',
      label: 'Kalender',
      url: '/calendar',
      featureCode: 'calendar',
    },
    {
      id: ID_LEAN,
      label: 'LEAN',
      submenu: [
        {
          id: 'kvp',
          label: 'KVP',
          featureCode: 'kvp',
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
          featureCode: 'surveys',
        },
      ],
    },
    { id: 'profile', label: 'Profil', url: '/profile' },
  ];
}

// =============================================================================
// filterMenuByFeatures — HAPPY PATH
// =============================================================================

describe('filterMenuByFeatures: all features active', () => {
  it('should return all items unchanged', () => {
    const result = filterMenuByFeatures(createTestMenu(), ALL_FEATURE_CODES);
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
    const result = filterMenuByFeatures(createTestMenu(), ALL_FEATURE_CODES);
    const bb = findById(result, 'blackboard');

    expect(bb?.submenu).toHaveLength(2);
    expect(bb?.submenu?.[0].id).toBe('bb-main');
    expect(bb?.submenu?.[1].id).toBe('bb-archive');
  });

  it('should not mutate the original array', () => {
    const menu = createTestMenu();
    const originalLength = menu.length;
    filterMenuByFeatures(menu, ALL_FEATURE_CODES);

    expect(menu).toHaveLength(originalLength);
  });
});

// =============================================================================
// filterMenuByFeatures — SINGLE FEATURE DISABLED
// =============================================================================

describe('filterMenuByFeatures: single feature disabled', () => {
  it('should remove blackboard and its children when disabled', () => {
    const features = new Set(ALL_FEATURE_CODES);
    features.delete('blackboard');
    const result = filterMenuByFeatures(createTestMenu(), features);

    expect(collectIds(result)).not.toContain('blackboard');
    expect(collectIds(result)).not.toContain('bb-main');
    expect(collectIds(result)).not.toContain('bb-archive');
  });

  it('should remove calendar when disabled', () => {
    const features = new Set(ALL_FEATURE_CODES);
    features.delete('calendar');
    const result = filterMenuByFeatures(createTestMenu(), features);

    expect(collectIds(result)).not.toContain('calendar');
  });

  it('should remove kvp but keep surveys under lean-management', () => {
    const features = new Set(ALL_FEATURE_CODES);
    features.delete('kvp');
    const ids = collectIds(filterMenuByFeatures(createTestMenu(), features));

    expect(ids).not.toContain('kvp');
    expect(ids).not.toContain('kvp-main');
    expect(ids).not.toContain('kvp-categories');
    expect(ids).toContain('surveys');
    expect(ids).toContain(ID_LEAN);
  });

  it('should remove surveys but keep kvp under lean-management', () => {
    const features = new Set(ALL_FEATURE_CODES);
    features.delete('surveys');
    const ids = collectIds(filterMenuByFeatures(createTestMenu(), features));

    expect(ids).not.toContain('surveys');
    expect(ids).toContain('kvp');
    expect(ids).toContain(ID_LEAN);
  });
});

// =============================================================================
// filterMenuByFeatures — RECURSION + EMPTY PARENT
// =============================================================================

describe('filterMenuByFeatures: empty parent containers', () => {
  it('should remove lean-management when both kvp AND surveys are disabled', () => {
    const features = new Set(ALL_FEATURE_CODES);
    features.delete('kvp');
    features.delete('surveys');
    const ids = collectIds(filterMenuByFeatures(createTestMenu(), features));

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
          { id: 'child', label: 'Child', url: '/c', featureCode: 'blackboard' },
        ],
      },
    ];
    const result = filterMenuByFeatures(menu, NO_FEATURES);

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
          { id: 'child', label: 'Child', url: '/c', featureCode: 'blackboard' },
        ],
      },
    ];

    expect(filterMenuByFeatures(menu, NO_FEATURES)).toHaveLength(0);
  });
});

// =============================================================================
// filterMenuByFeatures — CORE ITEMS SAFETY
// =============================================================================

describe('filterMenuByFeatures: no features active (core safety)', () => {
  it('should always keep items WITHOUT featureCode', () => {
    const ids = collectIds(filterMenuByFeatures(createTestMenu(), NO_FEATURES));

    expect(ids).toContain('dashboard');
    expect(ids).toContain('profile');
  });

  it('should remove ALL feature-gated items', () => {
    const ids = collectIds(filterMenuByFeatures(createTestMenu(), NO_FEATURES));

    expect(ids).not.toContain('blackboard');
    expect(ids).not.toContain('calendar');
    expect(ids).not.toContain('kvp');
    expect(ids).not.toContain('surveys');
  });

  it('should remove lean-management (empty container)', () => {
    const ids = collectIds(filterMenuByFeatures(createTestMenu(), NO_FEATURES));

    expect(ids).not.toContain(ID_LEAN);
  });
});

// =============================================================================
// filterMenuByFeatures — REAL MENUS
// =============================================================================

describe('filterMenuByFeatures: real rootMenuItems', () => {
  it('should keep core items when no features are active', () => {
    const ids = collectIds(filterMenuByFeatures(rootMenuItems, NO_FEATURES));

    expect(ids).toContain('dashboard');
    expect(ids).toContain('root-users');
    expect(ids).toContain('admins');
    expect(ids).toContain('areas');
    expect(ids).toContain('departments');
    expect(ids).toContain('features');
    expect(ids).toContain('logs');
    expect(ids).toContain('profile');
    expect(ids).toContain('system');
  });

  it('should remove all feature-gated items when no features active', () => {
    const ids = collectIds(filterMenuByFeatures(rootMenuItems, NO_FEATURES));

    expect(ids).not.toContain('blackboard');
    expect(ids).not.toContain('calendar');
    expect(ids).not.toContain('chat');
    expect(ids).not.toContain('documents');
    expect(ids).not.toContain('vacation');
    expect(ids).not.toContain('kvp');
    expect(ids).not.toContain('surveys');
    expect(ids).not.toContain(ID_LEAN);
  });

  it('should keep all items when all features are active', () => {
    const ids = collectIds(
      filterMenuByFeatures(rootMenuItems, ALL_FEATURE_CODES),
    );

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

describe('filterMenuByFeatures: real adminMenuItems', () => {
  it('should keep core items when no features are active', () => {
    const ids = collectIds(filterMenuByFeatures(adminMenuItems, NO_FEATURES));

    expect(ids).toContain('dashboard');
    expect(ids).toContain('employees');
    expect(ids).toContain('teams');
    expect(ids).toContain('assets');
    expect(ids).toContain('settings');
    expect(ids).toContain('profile');
  });

  it('should remove shifts when shift_planning is disabled', () => {
    const features = new Set(ALL_FEATURE_CODES);
    features.delete('shift_planning');

    expect(
      collectIds(filterMenuByFeatures(adminMenuItems, features)),
    ).not.toContain('shifts');
  });
});

describe('filterMenuByFeatures: real employeeMenuItems', () => {
  it('should keep core items when no features are active', () => {
    const ids = collectIds(
      filterMenuByFeatures(employeeMenuItems, NO_FEATURES),
    );

    expect(ids).toContain('dashboard');
    expect(ids).toContain('settings');
    expect(ids).toContain('profile');
  });

  it('should remove lean-management when kvp+surveys disabled', () => {
    const features = new Set(ALL_FEATURE_CODES);
    features.delete('kvp');
    features.delete('surveys');

    expect(
      collectIds(filterMenuByFeatures(employeeMenuItems, features)),
    ).not.toContain(ID_LEAN);
  });

  it('should keep lean-management when only kvp is active', () => {
    const ids = collectIds(
      filterMenuByFeatures(employeeMenuItems, new Set(['kvp'])),
    );

    expect(ids).toContain(ID_LEAN);
    expect(ids).toContain('kvp');
    expect(ids).not.toContain('surveys');
  });
});

// =============================================================================
// filterMenuByFeatures — EDGE CASES
// =============================================================================

describe('filterMenuByFeatures: edge cases', () => {
  it('should handle empty menu array', () => {
    expect(filterMenuByFeatures([], ALL_FEATURE_CODES)).toHaveLength(0);
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
              { id: 'l3', label: 'L3', url: '/deep', featureCode: 'kvp' },
            ],
          },
        ],
      },
    ];

    expect(collectIds(filterMenuByFeatures(menu, new Set(['kvp'])))).toEqual([
      'l1',
      'l2',
      'l3',
    ]);
    expect(filterMenuByFeatures(menu, NO_FEATURES)).toHaveLength(0);
  });

  it('should handle unknown feature codes gracefully', () => {
    const menu: NavItem[] = [
      { id: 'x', label: 'X', url: '/x', featureCode: 'nonexistent' },
    ];

    expect(filterMenuByFeatures(menu, ALL_FEATURE_CODES)).toHaveLength(0);
  });

  it('should return new array references (immutable)', () => {
    const menu = createTestMenu();
    expect(filterMenuByFeatures(menu, ALL_FEATURE_CODES)).not.toBe(menu);
  });
});

// =============================================================================
// getMenuItemsForRole
// =============================================================================

describe('getMenuItemsForRole', () => {
  it('should return items with areas/departments for root', () => {
    const items = getMenuItemsForRole('root');
    const ids = collectIds(items);

    expect(ids).toContain('areas');
    expect(ids).toContain('departments');
  });

  it('should return items with teams/assets for admin', () => {
    const items = getMenuItemsForRole('admin');
    const ids = collectIds(items);

    expect(ids).toContain('teams');
    expect(ids).toContain('assets');
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
