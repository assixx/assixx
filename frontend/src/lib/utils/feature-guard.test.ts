/**
 * Unit tests for feature-guard.ts
 *
 * Tests requireFeature() — the page-level feature guard utility.
 * Mocks @sveltejs/kit redirect since it throws a special Redirect object.
 *
 * @see FEAT_FRONTEND_FEATURE_GUARDS_MASTERPLAN.md Phase 3
 */
import { describe, expect, it, vi } from 'vitest';

import { requireFeature } from './feature-guard.js';

// Mock @sveltejs/kit redirect — vi.mock is hoisted by Vitest automatically
const mockRedirect = vi.fn();
vi.mock('@sveltejs/kit', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error(`REDIRECT:${String(args[0])}:${String(args[1])}`);
  },
}));

/** All 8 feature codes used across the app */
const FEATURE_CODES = [
  'blackboard',
  'calendar',
  'chat',
  'documents',
  'kvp',
  'surveys',
  'shift_planning',
  'vacation',
] as const;

// =============================================================================
// HAPPY PATH — feature is active → no redirect
// =============================================================================

describe('requireFeature: feature active (no redirect)', () => {
  it('should not throw when feature is in activeFeatures', () => {
    expect(() => {
      requireFeature(['blackboard', 'calendar'], 'blackboard');
    }).not.toThrow();
  });

  it('should not call redirect when feature is present', () => {
    mockRedirect.mockClear();
    requireFeature(['blackboard'], 'blackboard');

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('should not throw when all features are active', () => {
    const allFeatures = [...FEATURE_CODES];
    for (const code of FEATURE_CODES) {
      expect(() => {
        requireFeature(allFeatures, code);
      }).not.toThrow();
    }
  });
});

// =============================================================================
// REDIRECT — feature is NOT active
// =============================================================================

describe('requireFeature: feature missing (redirect)', () => {
  it('should throw when feature is missing', () => {
    mockRedirect.mockClear();

    expect(() => {
      requireFeature(['calendar'], 'blackboard');
    }).toThrow();

    expect(mockRedirect).toHaveBeenCalledWith(
      302,
      '/feature-unavailable?feature=blackboard',
    );
  });

  it('should redirect with correct feature code in query param', () => {
    mockRedirect.mockClear();

    expect(() => {
      requireFeature([], 'vacation');
    }).toThrow();

    expect(mockRedirect).toHaveBeenCalledWith(
      302,
      '/feature-unavailable?feature=vacation',
    );
  });

  it('should use HTTP 302 status code', () => {
    mockRedirect.mockClear();

    expect(() => {
      requireFeature([], 'chat');
    }).toThrow();

    expect(mockRedirect).toHaveBeenCalledWith(302, expect.any(String));
  });
});

// =============================================================================
// EMPTY ARRAY — no features active → always redirect
// =============================================================================

describe('requireFeature: empty activeFeatures', () => {
  it('should redirect for any feature code', () => {
    for (const code of FEATURE_CODES) {
      mockRedirect.mockClear();

      expect(() => {
        requireFeature([], code);
      }).toThrow();

      expect(mockRedirect).toHaveBeenCalledWith(
        302,
        `/feature-unavailable?feature=${code}`,
      );
    }
  });
});

// =============================================================================
// ALL 8 FEATURE CODES — parametrized
// =============================================================================

describe('requireFeature: all 8 feature codes', () => {
  it.each(FEATURE_CODES)(
    'should pass when "%s" is in activeFeatures',
    (code) => {
      expect(() => {
        requireFeature([code], code);
      }).not.toThrow();
    },
  );

  it.each(FEATURE_CODES)(
    'should redirect when "%s" is NOT in activeFeatures',
    (code) => {
      mockRedirect.mockClear();

      expect(() => {
        requireFeature([], code);
      }).toThrow();

      expect(mockRedirect).toHaveBeenCalledWith(
        302,
        `/feature-unavailable?feature=${code}`,
      );
    },
  );
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('requireFeature: edge cases', () => {
  it('should be case-sensitive', () => {
    expect(() => {
      requireFeature(['Blackboard'], 'blackboard');
    }).toThrow();
  });

  it('should not match partial strings', () => {
    expect(() => {
      requireFeature(['black'], 'blackboard');
    }).toThrow();
  });

  it('should handle single-element array correctly', () => {
    expect(() => {
      requireFeature(['vacation'], 'vacation');
    }).not.toThrow();
  });
});
