/**
 * Unit tests for AuditRequestFilterService
 *
 * Phase 11: Service tests — no external dependencies (pure logic).
 * Focus: shouldSkipRequest (method/auth/throttle branching),
 *        shouldThrottleCurrentUser (in-memory cache),
 *        shouldThrottleListOrView.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditRequestFilterService } from './audit-request-filter.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('./audit.constants.js', () => ({
  CURRENT_USER_THROTTLE_MS: 5000,
  LIST_ACTION_THROTTLE_MS: 30000,
}));

vi.mock('./audit.helpers.js', () => ({
  isCurrentUserEndpoint: vi.fn((path: string) => path.includes('/users/me')),
  shouldSkipGetRequest: vi.fn((path: string) => path.includes('/health')),
}));

// =============================================================
// AuditRequestFilterService
// =============================================================

describe('AuditRequestFilterService', () => {
  let service: AuditRequestFilterService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    service = new AuditRequestFilterService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =============================================================
  // shouldSkipRequest
  // =============================================================

  describe('shouldSkipRequest', () => {
    it('should skip unauthenticated non-auth requests', () => {
      const result = service.shouldSkipRequest(
        'GET',
        '/api/data',
        false,
        undefined,
      );

      expect(result).toBe(true);
    });

    it('should not skip auth endpoint even without user', () => {
      const result = service.shouldSkipRequest(
        'POST',
        '/api/auth/login',
        true,
        undefined,
      );

      expect(result).toBe(false);
    });

    it('should skip GET health requests', () => {
      const user = { id: 5 } as never;

      const result = service.shouldSkipRequest('GET', '/health', false, user);

      expect(result).toBe(true);
    });

    it('should not skip POST requests', () => {
      const user = { id: 5 } as never;

      const result = service.shouldSkipRequest(
        'POST',
        '/api/data',
        false,
        user,
      );

      expect(result).toBe(false);
    });

    it('should throttle current user endpoint', () => {
      const user = { id: 5 } as never;

      // First call: not throttled
      const first = service.shouldSkipRequest('GET', '/users/me', false, user);
      expect(first).toBe(false);

      // Second call within window: throttled
      const second = service.shouldSkipRequest('GET', '/users/me', false, user);
      expect(second).toBe(true);
    });
  });

  // =============================================================
  // shouldThrottleCurrentUser
  // =============================================================

  describe('shouldThrottleCurrentUser', () => {
    it('should not throttle first call', () => {
      const result = service.shouldThrottleCurrentUser(5, '/users/me');

      expect(result).toBe(false);
    });

    it('should throttle within window', () => {
      service.shouldThrottleCurrentUser(5, '/users/me');

      const result = service.shouldThrottleCurrentUser(5, '/users/me');

      expect(result).toBe(true);
    });

    it('should allow after throttle window expires', () => {
      service.shouldThrottleCurrentUser(5, '/users/me');

      vi.advanceTimersByTime(6000); // > CURRENT_USER_THROTTLE_MS (5000)

      const result = service.shouldThrottleCurrentUser(5, '/users/me');

      expect(result).toBe(false);
    });
  });

  // =============================================================
  // shouldThrottleListOrView
  // =============================================================

  describe('shouldThrottleListOrView', () => {
    it('should not throttle non-list actions', () => {
      const user = { id: 5 } as never;

      const result = service.shouldThrottleListOrView(
        'create',
        user,
        '/api/data',
      );

      expect(result).toBe(false);
    });

    it('should not throttle without user', () => {
      const result = service.shouldThrottleListOrView(
        'list',
        undefined,
        '/api/data',
      );

      expect(result).toBe(false);
    });

    it('should throttle repeated list actions', () => {
      const user = { id: 5 } as never;

      const first = service.shouldThrottleListOrView(
        'list',
        user,
        '/api/entries',
      );
      expect(first).toBe(false);

      const second = service.shouldThrottleListOrView(
        'list',
        user,
        '/api/entries',
      );
      expect(second).toBe(true);
    });

    it('should normalize query params for throttling', () => {
      const user = { id: 5 } as never;

      service.shouldThrottleListOrView('view', user, '/api/entries?page=1');
      const result = service.shouldThrottleListOrView(
        'view',
        user,
        '/api/entries?page=2',
      );

      expect(result).toBe(true);
    });

    it('should allow after list throttle window expires', () => {
      const user = { id: 5 } as never;

      service.shouldThrottleListOrView('list', user, '/api/entries');

      vi.advanceTimersByTime(31_000); // > LIST_ACTION_THROTTLE_MS (30000)

      const result = service.shouldThrottleListOrView(
        'list',
        user,
        '/api/entries',
      );

      expect(result).toBe(false);
    });
  });

  // =============================================================
  // cleanupRecentLogs (via setInterval timer)
  // =============================================================

  describe('cleanupRecentLogs', () => {
    it('should remove expired entries after interval fires', () => {
      const user = { id: 5 } as never;

      // Create an entry
      service.shouldSkipRequest('GET', '/users/me', false, user);
      // Second call within window → throttled
      expect(
        service.shouldSkipRequest('GET', '/users/me', false, user),
      ).toBe(true);

      // Advance past the cleanup interval (5 min) + 2× throttle window
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      // After cleanup, the entry should be gone → not throttled
      expect(
        service.shouldSkipRequest('GET', '/users/me', false, user),
      ).toBe(false);
    });
  });
});
