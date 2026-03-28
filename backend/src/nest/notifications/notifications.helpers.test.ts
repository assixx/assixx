/**
 * Unit tests for Notification Helpers
 *
 * Phase 6: Pure function tests — 1 test per function, no mocking needed.
 * Phase 13 Batch D: Deepened — metadata parsing branches, edge cases.
 */
import { describe, expect, it } from 'vitest';

import {
  buildNotificationConditions,
  mapNotificationToApi,
  rowsToRecord,
} from './notifications.helpers.js';
import type { DbNotificationRow } from './notifications.types.js';

// ============================================
// Mock Factory
// ============================================

function createMockNotificationRow(overrides?: Partial<DbNotificationRow>): DbNotificationRow {
  return {
    id: 1,
    type: 'info',
    title: 'Test Notification',
    message: 'Something happened',
    priority: 'normal',
    recipient_type: 'user',
    recipient_id: 5,
    action_url: '/dashboard',
    action_label: 'View',
    metadata: null,
    scheduled_for: null,
    created_by: 3,
    tenant_id: 10,
    created_at: new Date('2025-01-01T00:00:00Z'),
    updated_at: new Date('2025-01-02T00:00:00Z'),
    read_at: null,
    is_read: false,
    created_by_name: 'Admin',
    ...overrides,
  };
}

// ============================================
// mapNotificationToApi
// ============================================

describe('mapNotificationToApi', () => {
  it('should map DB row to API format with string metadata', () => {
    const row = createMockNotificationRow({
      metadata: '{"key": "value"}',
    });

    const result = mapNotificationToApi(row);

    expect(result.id).toBe(1);
    expect(result.recipientType).toBe('user');
    expect(result.metadata).toEqual({ key: 'value' });
    expect(result.createdAt).toBe('2025-01-01T00:00:00.000Z');
    expect(result.isRead).toBe(false);
  });

  it('should handle null metadata', () => {
    const row = createMockNotificationRow();

    const result = mapNotificationToApi(row);

    expect(result.metadata).toBeNull();
  });

  it('should handle already-parsed object metadata', () => {
    const row = createMockNotificationRow({
      metadata: { action: 'click' } as unknown as string,
    });

    const result = mapNotificationToApi(row);

    expect(result.metadata).toEqual({ action: 'click' });
  });

  it('should return null for invalid JSON metadata', () => {
    const row = createMockNotificationRow({
      metadata: 'not-valid-json{',
    });

    const result = mapNotificationToApi(row);

    expect(result.metadata).toBeNull();
  });

  it('should format readAt when present', () => {
    const row = createMockNotificationRow({
      read_at: new Date('2025-01-05T15:30:00Z'),
      is_read: true,
    });

    const result = mapNotificationToApi(row);

    expect(result.readAt).toBe('2025-01-05T15:30:00.000Z');
    expect(result.isRead).toBe(true);
  });

  it('should return readAt null when read_at is null', () => {
    const row = createMockNotificationRow();

    const result = mapNotificationToApi(row);

    expect(result.readAt).toBeNull();
  });
});

// ============================================
// rowsToRecord
// ============================================

describe('rowsToRecord', () => {
  it('should convert rows to key-value record', () => {
    const rows = [
      { type: 'info', count: '5' },
      { type: 'warning', count: '3' },
    ];

    const result = rowsToRecord(rows, (r) => r.type);

    expect(result).toEqual({ info: 5, warning: 3 });
  });

  it('should return empty object for empty array', () => {
    const result = rowsToRecord([], () => '');

    expect(result).toEqual({});
  });

  it('should parse string count to integer', () => {
    const rows = [{ key: 'total', count: '42' }];

    const result = rowsToRecord(rows, (r) => r.key);

    expect(result['total']).toBe(42);
    expect(typeof result['total']).toBe('number');
  });
});

// ============================================
// buildNotificationConditions
// ============================================

describe('buildNotificationConditions', () => {
  it('should build base conditions with type and priority filters', () => {
    const { conditions, params } = buildNotificationConditions(5, 10, {
      type: 'info',
      priority: 'high',
    });

    expect(conditions[0]).toBe('n.tenant_id = $1');
    expect(conditions.some((c) => c.includes('n.type = $'))).toBe(true);
    expect(conditions.some((c) => c.includes('n.priority = $'))).toBe(true);
    expect(params[0]).toBe(10);
    expect(params).toContain('info');
    expect(params).toContain('high');
  });

  it('should build base conditions without optional filters', () => {
    const { conditions, params } = buildNotificationConditions(5, 10, {});

    expect(conditions).toHaveLength(2); // tenant_id + recipient condition
    expect(params[0]).toBe(10);
    expect(params).not.toContain('info');
  });

  it('should include complex recipient condition with user ID references', () => {
    const { conditions, params } = buildNotificationConditions(7, 20, {});

    const recipientCondition = conditions[1];
    expect(recipientCondition).toContain("recipient_type = 'all'");
    expect(recipientCondition).toContain("recipient_type = 'user'");
    expect(recipientCondition).toContain("recipient_type = 'department'");
    expect(recipientCondition).toContain("recipient_type = 'team'");
    // userId (7) appears 3 times in params for recipient condition
    expect(params.filter((p) => p === 7)).toHaveLength(3);
    // tenantId (20) appears 3 times in params for recipient condition (plus $1)
    expect(params.filter((p) => p === 20)).toHaveLength(3);
  });

  it('should handle only type filter', () => {
    const { conditions } = buildNotificationConditions(5, 10, {
      type: 'warning',
    });

    expect(conditions.some((c) => c.includes('n.type = $'))).toBe(true);
    expect(conditions.some((c) => c.includes('n.priority = $'))).toBe(false);
  });

  it('should skip empty string filters', () => {
    const { conditions } = buildNotificationConditions(5, 10, {
      type: '',
      priority: '',
    });

    expect(conditions.some((c) => c.includes('n.type = $'))).toBe(false);
    expect(conditions.some((c) => c.includes('n.priority = $'))).toBe(false);
  });
});
