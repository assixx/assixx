/**
 * Unit tests for UpsertUserPermissionsSchema (Zod)
 *
 * Tests schema validation via .safeParse() — no mocks needed.
 * Business validation (featureCode/moduleCode existence) is in the service,
 * these tests cover structural Zod validation only.
 *
 * @see docs/USER-PERMISSIONS-UNIT-TEST-PLAN.md — Test-Datei 2
 */
import { describe, expect, it } from 'vitest';

import { UpsertUserPermissionsSchema } from './upsert-user-permissions.dto.js';

// =============================================================
// Factories
// =============================================================

function createValidEntry(overrides?: Record<string, unknown>) {
  return {
    featureCode: 'blackboard',
    moduleCode: 'blackboard-posts',
    canRead: true,
    canWrite: false,
    canDelete: false,
    ...overrides,
  };
}

// =============================================================
// Tests
// =============================================================

describe('SECURITY: UpsertUserPermissionsSchema', () => {
  // -----------------------------------------------------------
  // Valid Cases
  // -----------------------------------------------------------

  describe('Valid Cases', () => {
    it('should accept valid single permission', () => {
      const result = UpsertUserPermissionsSchema.safeParse({
        permissions: [createValidEntry()],
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid multiple permissions', () => {
      const result = UpsertUserPermissionsSchema.safeParse({
        permissions: [
          createValidEntry({
            featureCode: 'blackboard',
            moduleCode: 'blackboard-posts',
          }),
          createValidEntry({
            featureCode: 'calendar',
            moduleCode: 'calendar-events',
          }),
          createValidEntry({ featureCode: 'kvp', moduleCode: 'kvp-proposals' }),
        ],
      });

      expect(result.success).toBe(true);
      // Use .parse() for value extraction (avoids conditional expect)
      const parsed = UpsertUserPermissionsSchema.parse({
        permissions: [
          createValidEntry({
            featureCode: 'blackboard',
            moduleCode: 'blackboard-posts',
          }),
          createValidEntry({
            featureCode: 'calendar',
            moduleCode: 'calendar-events',
          }),
          createValidEntry({ featureCode: 'kvp', moduleCode: 'kvp-proposals' }),
        ],
      });
      expect(parsed.permissions).toHaveLength(3);
    });

    it('should accept all booleans as true', () => {
      const result = UpsertUserPermissionsSchema.safeParse({
        permissions: [
          createValidEntry({ canRead: true, canWrite: true, canDelete: true }),
        ],
      });

      expect(result.success).toBe(true);
    });

    it('should accept all booleans as false', () => {
      const result = UpsertUserPermissionsSchema.safeParse({
        permissions: [
          createValidEntry({
            canRead: false,
            canWrite: false,
            canDelete: false,
          }),
        ],
      });

      expect(result.success).toBe(true);
    });

    it('should reject empty permissions array (min 1 required)', () => {
      // Schema enforces .min(1) — empty array is not valid
      const result = UpsertUserPermissionsSchema.safeParse({
        permissions: [],
      });

      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------
  // featureCode Validation
  // -----------------------------------------------------------

  describe('featureCode Validation', () => {
    it('should reject missing featureCode', () => {
      const result = UpsertUserPermissionsSchema.safeParse({
        permissions: [
          {
            moduleCode: 'blackboard-posts',
            canRead: true,
            canWrite: false,
            canDelete: false,
          },
        ],
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty string featureCode', () => {
      const result = UpsertUserPermissionsSchema.safeParse({
        permissions: [createValidEntry({ featureCode: '' })],
      });

      expect(result.success).toBe(false);
    });

    it('should reject non-string featureCode', () => {
      const result = UpsertUserPermissionsSchema.safeParse({
        permissions: [createValidEntry({ featureCode: 123 })],
      });

      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------
  // moduleCode Validation
  // -----------------------------------------------------------

  describe('moduleCode Validation', () => {
    it('should reject missing moduleCode', () => {
      const result = UpsertUserPermissionsSchema.safeParse({
        permissions: [
          {
            featureCode: 'blackboard',
            canRead: true,
            canWrite: false,
            canDelete: false,
          },
        ],
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty string moduleCode', () => {
      const result = UpsertUserPermissionsSchema.safeParse({
        permissions: [createValidEntry({ moduleCode: '' })],
      });

      expect(result.success).toBe(false);
    });

    it('should reject non-string moduleCode', () => {
      const result = UpsertUserPermissionsSchema.safeParse({
        permissions: [createValidEntry({ moduleCode: 42 })],
      });

      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------
  // Boolean Validation
  // -----------------------------------------------------------

  describe('Boolean Validation', () => {
    it('should reject missing canRead', () => {
      const { canRead: _, ...entry } = createValidEntry();
      const result = UpsertUserPermissionsSchema.safeParse({
        permissions: [entry],
      });

      expect(result.success).toBe(false);
    });

    it('should reject missing canWrite', () => {
      const { canWrite: _, ...entry } = createValidEntry();
      const result = UpsertUserPermissionsSchema.safeParse({
        permissions: [entry],
      });

      expect(result.success).toBe(false);
    });

    it('should reject missing canDelete', () => {
      const { canDelete: _, ...entry } = createValidEntry();
      const result = UpsertUserPermissionsSchema.safeParse({
        permissions: [entry],
      });

      expect(result.success).toBe(false);
    });

    it('should reject string instead of boolean for canRead', () => {
      const result = UpsertUserPermissionsSchema.safeParse({
        permissions: [createValidEntry({ canRead: 'true' })],
      });

      expect(result.success).toBe(false);
    });

    it('should reject number instead of boolean', () => {
      const result = UpsertUserPermissionsSchema.safeParse({
        permissions: [createValidEntry({ canWrite: 1 })],
      });

      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------
  // Structure Validation
  // -----------------------------------------------------------

  describe('Structure Validation', () => {
    it('should reject non-array permissions', () => {
      const result = UpsertUserPermissionsSchema.safeParse({
        permissions: 'not-an-array',
      });

      expect(result.success).toBe(false);
    });

    it('should reject when permissions key is missing', () => {
      const result = UpsertUserPermissionsSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });
});
