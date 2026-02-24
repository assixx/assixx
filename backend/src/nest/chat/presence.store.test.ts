/**
 * Presence Store – Unit Tests
 *
 * Zero dependencies: pure in-memory Set-based store.
 * Tests: add/remove, isOnline, getOnlineUserIds, idempotency, multiple users.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { PresenceStore } from './presence.store.js';

describe('PresenceStore', () => {
  let store: PresenceStore;

  beforeEach(() => {
    store = new PresenceStore();
  });

  // -----------------------------------------------------------
  // add / isOnline
  // -----------------------------------------------------------

  describe('add()', () => {
    it('should mark user as online', () => {
      store.add(1);

      expect(store.isOnline(1)).toBe(true);
    });

    it('should handle duplicate add idempotently', () => {
      const userId = 1;
      store.add(userId);
      // eslint-disable-next-line sonarjs/no-element-overwrite -- intentional: testing Set idempotency on duplicate add
      store.add(userId);

      expect(store.isOnline(userId)).toBe(true);
      expect(store.getOnlineUserIds().size).toBe(1);
    });
  });

  // -----------------------------------------------------------
  // remove
  // -----------------------------------------------------------

  describe('remove()', () => {
    it('should mark user as offline', () => {
      store.add(1);
      store.remove(1);

      expect(store.isOnline(1)).toBe(false);
    });

    it('should not throw when removing non-existent user', () => {
      expect(() => store.remove(999)).not.toThrow();
    });
  });

  // -----------------------------------------------------------
  // isOnline
  // -----------------------------------------------------------

  describe('isOnline()', () => {
    it('should return false for unknown user', () => {
      expect(store.isOnline(42)).toBe(false);
    });
  });

  // -----------------------------------------------------------
  // getOnlineUserIds
  // -----------------------------------------------------------

  describe('getOnlineUserIds()', () => {
    it('should return empty set initially', () => {
      expect(store.getOnlineUserIds().size).toBe(0);
    });

    it('should return all online users', () => {
      store.add(1);
      store.add(2);
      store.add(3);

      const ids = store.getOnlineUserIds();

      expect(ids.size).toBe(3);
      expect(ids.has(1)).toBe(true);
      expect(ids.has(2)).toBe(true);
      expect(ids.has(3)).toBe(true);
    });

    it('should reflect removals', () => {
      store.add(1);
      store.add(2);
      store.remove(1);

      const ids = store.getOnlineUserIds();

      expect(ids.size).toBe(1);
      expect(ids.has(2)).toBe(true);
      expect(ids.has(1)).toBe(false);
    });
  });
});
