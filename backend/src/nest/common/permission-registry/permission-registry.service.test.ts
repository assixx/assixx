/**
 * Unit tests for PermissionRegistryService
 *
 * Pure in-memory singleton — no DB access, no mocks needed.
 * Tests: register(), getAll(), getByCode(), isValidModule(), getAllowedPermissions(), edge cases.
 *
 * @see docs/USER-PERMISSIONS-UNIT-TEST-PLAN.md — Test-Datei 1
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { PermissionRegistryService } from './permission-registry.service.js';
import type { PermissionCategoryDef } from './permission.types.js';

// =============================================================
// Factories
// =============================================================

function createCategory(
  overrides?: Partial<PermissionCategoryDef>,
): PermissionCategoryDef {
  return {
    code: 'blackboard',
    label: 'Schwarzes Brett',
    icon: 'fa-clipboard',
    modules: [
      {
        code: 'blackboard-posts',
        label: 'Beiträge',
        icon: 'fa-sticky-note',
        allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
      },
    ],
    ...overrides,
  };
}

// =============================================================
// Tests
// =============================================================

describe('PermissionRegistryService', () => {
  let service: PermissionRegistryService;

  beforeEach(() => {
    service = new PermissionRegistryService();
  });

  // -----------------------------------------------------------
  // register()
  // -----------------------------------------------------------

  describe('register()', () => {
    it('should store a category', () => {
      const category = createCategory();
      service.register(category);

      const all = service.getAll();
      expect(all).toHaveLength(1);
      expect(all[0]?.code).toBe('blackboard');
    });

    it('should store multiple categories', () => {
      service.register(createCategory({ code: 'blackboard' }));
      service.register(createCategory({ code: 'calendar' }));
      service.register(createCategory({ code: 'kvp' }));

      expect(service.getAll()).toHaveLength(3);
    });

    it('should throw Error on duplicate code', () => {
      service.register(createCategory({ code: 'blackboard' }));

      expect(() =>
        service.register(createCategory({ code: 'blackboard' })),
      ).toThrow('Permission category "blackboard" already registered');
    });

    it('should not modify registry when duplicate throws', () => {
      service.register(createCategory({ code: 'blackboard' }));

      try {
        service.register(createCategory({ code: 'blackboard' }));
      } catch {
        // expected
      }

      expect(service.getAll()).toHaveLength(1);
    });

    it('should store reference (mutation affects internal state)', () => {
      const category = createCategory();
      service.register(category);

      // Implementation stores by reference — mutation IS visible
      category.label = 'MUTATED';
      const stored = service.getByCode('blackboard');
      expect(stored?.label).toBe('MUTATED');

      // Callers are responsible for not mutating after registration
      // (register is called once at module init, never again)
    });
  });

  // -----------------------------------------------------------
  // getAll()
  // -----------------------------------------------------------

  describe('getAll()', () => {
    it('should return empty array when nothing registered', () => {
      expect(service.getAll()).toEqual([]);
    });

    it('should return all registered categories', () => {
      service.register(createCategory({ code: 'blackboard' }));
      service.register(createCategory({ code: 'calendar' }));
      service.register(createCategory({ code: 'kvp' }));

      const all = service.getAll();
      expect(all).toHaveLength(3);
    });

    it('should return categories with correct structure', () => {
      service.register(createCategory());

      const all = service.getAll();
      const cat = all[0];

      expect(cat).toBeDefined();
      expect(cat).toHaveProperty('code');
      expect(cat).toHaveProperty('label');
      expect(cat).toHaveProperty('icon');
      expect(cat).toHaveProperty('modules');
      expect(Array.isArray(cat?.modules)).toBe(true);
    });
  });

  // -----------------------------------------------------------
  // getByCode()
  // -----------------------------------------------------------

  describe('getByCode()', () => {
    it('should return correct category for known code', () => {
      service.register(createCategory({ code: 'blackboard' }));

      const result = service.getByCode('blackboard');
      expect(result).toBeDefined();
      expect(result?.code).toBe('blackboard');
    });

    it('should return undefined for unknown code', () => {
      service.register(createCategory({ code: 'blackboard' }));

      expect(service.getByCode('nonexistent')).toBeUndefined();
    });
  });

  // -----------------------------------------------------------
  // isValidModule()
  // -----------------------------------------------------------

  describe('isValidModule()', () => {
    beforeEach(() => {
      service.register(createCategory());
    });

    it('should return true for valid feature+module combination', () => {
      expect(service.isValidModule('blackboard', 'blackboard-posts')).toBe(
        true,
      );
    });

    it('should return false for unknown featureCode', () => {
      expect(service.isValidModule('unknown', 'blackboard-posts')).toBe(false);
    });

    it('should return false for unknown moduleCode within known feature', () => {
      expect(service.isValidModule('blackboard', 'unknown-module')).toBe(false);
    });

    it('should return false when both codes are unknown', () => {
      expect(service.isValidModule('unknown', 'unknown')).toBe(false);
    });
  });

  // -----------------------------------------------------------
  // getAllowedPermissions()
  // -----------------------------------------------------------

  describe('getAllowedPermissions()', () => {
    it('should return correct permissions for known module', () => {
      service.register(createCategory());

      expect(
        service.getAllowedPermissions('blackboard', 'blackboard-posts'),
      ).toEqual(['canRead', 'canWrite', 'canDelete']);
    });

    it('should return limited permissions for read-only module', () => {
      service.register(
        createCategory({
          code: 'readonly-feature',
          modules: [
            {
              code: 'readonly-mod',
              label: 'Read Only',
              icon: 'fa-eye',
              allowedPermissions: ['canRead'],
            },
          ],
        }),
      );

      expect(
        service.getAllowedPermissions('readonly-feature', 'readonly-mod'),
      ).toEqual(['canRead']);
    });

    it('should return empty array for unknown featureCode', () => {
      service.register(createCategory());

      expect(service.getAllowedPermissions('unknown', 'x')).toEqual([]);
    });

    it('should return empty array for unknown moduleCode', () => {
      service.register(createCategory());

      expect(service.getAllowedPermissions('blackboard', 'unknown')).toEqual(
        [],
      );
    });
  });

  // -----------------------------------------------------------
  // Edge Cases
  // -----------------------------------------------------------

  describe('Edge Cases', () => {
    it('should handle category with empty modules array', () => {
      service.register(
        createCategory({
          code: 'empty',
          modules: [],
        }),
      );

      expect(service.isValidModule('empty', 'x')).toBe(false);
      expect(service.getByCode('empty')?.modules).toEqual([]);
    });

    it('should handle category with multiple modules', () => {
      service.register(
        createCategory({
          code: 'multi',
          modules: [
            {
              code: 'mod-a',
              label: 'Module A',
              icon: 'fa-a',
              allowedPermissions: ['canRead'],
            },
            {
              code: 'mod-b',
              label: 'Module B',
              icon: 'fa-b',
              allowedPermissions: ['canRead', 'canWrite'],
            },
            {
              code: 'mod-c',
              label: 'Module C',
              icon: 'fa-c',
              allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
            },
          ],
        }),
      );

      expect(service.isValidModule('multi', 'mod-a')).toBe(true);
      expect(service.isValidModule('multi', 'mod-b')).toBe(true);
      expect(service.isValidModule('multi', 'mod-c')).toBe(true);
      expect(service.isValidModule('multi', 'mod-d')).toBe(false);
    });
  });
});
