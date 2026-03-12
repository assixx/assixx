/**
 * Unit tests for RequirePermission decorator
 *
 * Pure decorator test — no mocks needed.
 * Uses Reflect.getMetadata() to verify stored metadata.
 *
 * @see docs/USER-PERMISSIONS-UNIT-TEST-PLAN.md — Test-Datei 5
 */
import { describe, expect, it } from 'vitest';

import {
  PERMISSION_KEY,
  RequirePermission,
} from './require-permission.decorator.js';
import type { RequiredPermission } from './require-permission.decorator.js';

// =============================================================
// Tests
// =============================================================

describe('SECURITY: RequirePermission()', () => {
  it('should set metadata with correct PERMISSION_KEY', () => {
    class TestController {
      @RequirePermission('blackboard', 'blackboard-posts', 'canRead')
      testMethod(): void {
        // noop
      }
    }

    const metadata = Reflect.getMetadata(
      PERMISSION_KEY,
      TestController.prototype.testMethod,
    );

    expect(metadata).toBeDefined();
  });

  it('should store addonCode in metadata', () => {
    class TestController {
      @RequirePermission('blackboard', 'blackboard-posts', 'canRead')
      testMethod(): void {
        // noop
      }
    }

    const metadata = Reflect.getMetadata(
      PERMISSION_KEY,
      TestController.prototype.testMethod,
    ) as RequiredPermission;

    expect(metadata.addonCode).toBe('blackboard');
  });

  it('should store moduleCode in metadata', () => {
    class TestController {
      @RequirePermission('blackboard', 'blackboard-posts', 'canRead')
      testMethod(): void {
        // noop
      }
    }

    const metadata = Reflect.getMetadata(
      PERMISSION_KEY,
      TestController.prototype.testMethod,
    ) as RequiredPermission;

    expect(metadata.moduleCode).toBe('blackboard-posts');
  });

  it('should store action in metadata', () => {
    class TestController {
      @RequirePermission('blackboard', 'blackboard-posts', 'canWrite')
      testMethod(): void {
        // noop
      }
    }

    const metadata = Reflect.getMetadata(
      PERMISSION_KEY,
      TestController.prototype.testMethod,
    ) as RequiredPermission;

    expect(metadata.action).toBe('canWrite');
  });

  it("should export PERMISSION_KEY as 'requiredPermission'", () => {
    expect(PERMISSION_KEY).toBe('requiredPermission');
  });
});
