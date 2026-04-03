/**
 * Unit tests for addon-guard.ts
 *
 * Tests requireAddon() — the page-level addon guard utility.
 * Mocks @sveltejs/kit redirect since it throws a special Redirect object.
 *
 * @see FEAT_FRONTEND_FEATURE_GUARDS_MASTERPLAN.md Phase 3
 */
import { describe, expect, it, vi } from 'vitest';

import { requireAddon } from './addon-guard.js';

// Mock @sveltejs/kit redirect — vi.mock is hoisted by Vitest automatically
const mockRedirect = vi.fn();
vi.mock('@sveltejs/kit', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error(`REDIRECT:${String(args[0])}:${String(args[1])}`);
  },
}));

/** All purchasable addon codes used across the app */
const ADDON_CODES = [
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
] as const;

// =============================================================================
// HAPPY PATH — addon is active → no redirect
// =============================================================================

describe('requireAddon: addon active (no redirect)', () => {
  it('should not throw when addon is in activeAddons', () => {
    expect(() => {
      requireAddon(['blackboard', 'calendar'], 'blackboard');
    }).not.toThrow();
  });

  it('should not call redirect when addon is present', () => {
    mockRedirect.mockClear();
    requireAddon(['blackboard'], 'blackboard');

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('should not throw when all addons are active', () => {
    const allAddons = [...ADDON_CODES];
    for (const code of ADDON_CODES) {
      expect(() => {
        requireAddon(allAddons, code);
      }).not.toThrow();
    }
  });
});

// =============================================================================
// REDIRECT — addon is NOT active
// =============================================================================

describe('requireAddon: addon missing (redirect)', () => {
  it('should throw when addon is missing', () => {
    mockRedirect.mockClear();

    expect(() => {
      requireAddon(['calendar'], 'blackboard');
    }).toThrow();

    expect(mockRedirect).toHaveBeenCalledWith(302, '/addon-unavailable?addon=blackboard');
  });

  it('should redirect with correct addon code in query param', () => {
    mockRedirect.mockClear();

    expect(() => {
      requireAddon([], 'vacation');
    }).toThrow();

    expect(mockRedirect).toHaveBeenCalledWith(302, '/addon-unavailable?addon=vacation');
  });

  it('should use HTTP 302 status code', () => {
    mockRedirect.mockClear();

    expect(() => {
      requireAddon([], 'chat');
    }).toThrow();

    expect(mockRedirect).toHaveBeenCalledWith(302, expect.any(String));
  });
});

// =============================================================================
// EMPTY ARRAY — no addons active → always redirect
// =============================================================================

describe('requireAddon: empty activeAddons', () => {
  it('should redirect for any addon code', () => {
    for (const code of ADDON_CODES) {
      mockRedirect.mockClear();

      expect(() => {
        requireAddon([], code);
      }).toThrow();

      expect(mockRedirect).toHaveBeenCalledWith(302, `/addon-unavailable?addon=${code}`);
    }
  });
});

// =============================================================================
// ALL 10 ADDON CODES — parametrized
// =============================================================================

describe('requireAddon: all 10 addon codes', () => {
  it.each(ADDON_CODES)('should pass when "%s" is in activeAddons', (code) => {
    expect(() => {
      requireAddon([code], code);
    }).not.toThrow();
  });

  it.each(ADDON_CODES)('should redirect when "%s" is NOT in activeAddons', (code) => {
    mockRedirect.mockClear();

    expect(() => {
      requireAddon([], code);
    }).toThrow();

    expect(mockRedirect).toHaveBeenCalledWith(302, `/addon-unavailable?addon=${code}`);
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('requireAddon: edge cases', () => {
  it('should be case-sensitive', () => {
    expect(() => {
      requireAddon(['Blackboard'], 'blackboard');
    }).toThrow();
  });

  it('should not match partial strings', () => {
    expect(() => {
      requireAddon(['black'], 'blackboard');
    }).toThrow();
  });

  it('should handle single-element array correctly', () => {
    expect(() => {
      requireAddon(['vacation'], 'vacation');
    }).not.toThrow();
  });
});
