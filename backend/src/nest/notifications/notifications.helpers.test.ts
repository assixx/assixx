/**
 * Unit tests for Notification Helpers
 *
 * Phase 6: Pure function tests — 1 test per function, no mocking needed.
 */
import { describe, expect, it } from 'vitest';

import {
  buildNotificationConditions,
  mapNotificationToApi,
  rowsToRecord,
} from './notifications.helpers.js';
import type { DbNotificationRow } from './notifications.types.js';

describe('notifications.helpers', () => {
  it('mapNotificationToApi should map DB row to API format with parsed metadata', () => {
    const row: DbNotificationRow = {
      id: 1,
      type: 'info',
      title: 'Test Notification',
      message: 'Something happened',
      priority: 'normal',
      recipient_type: 'user',
      recipient_id: 5,
      action_url: '/dashboard',
      action_label: 'View',
      metadata: '{"key": "value"}',
      scheduled_for: null,
      created_by: 3,
      tenant_id: 10,
      created_at: new Date('2025-01-01T00:00:00Z'),
      updated_at: new Date('2025-01-02T00:00:00Z'),
      read_at: null,
      is_read: false,
      created_by_name: 'Admin',
    };

    const result = mapNotificationToApi(row);

    expect(result.id).toBe(1);
    expect(result.recipientType).toBe('user');
    expect(result.metadata).toEqual({ key: 'value' });
    expect(result.createdAt).toBe('2025-01-01T00:00:00.000Z');
    expect(result.isRead).toBe(false);
  });

  it('rowsToRecord should convert rows to key-value record', () => {
    const rows = [
      { type: 'info', count: '5' },
      { type: 'warning', count: '3' },
    ];

    const result = rowsToRecord(rows, (r) => r.type);

    expect(result).toEqual({ info: 5, warning: 3 });
  });

  it('buildNotificationConditions should build base conditions with optional filters', () => {
    const { conditions, params } = buildNotificationConditions(5, 10, {
      type: 'info',
      priority: 'high',
    });

    expect(conditions[0]).toBe('n.tenant_id = $1');
    expect(conditions.some((c) => c.includes('n.type = $'))).toBe(true);
    expect(conditions.some((c) => c.includes('n.priority = $'))).toBe(true);
    expect(params[0]).toBe(10); // tenantId first
    expect(params).toContain('info');
    expect(params).toContain('high');
  });
});
