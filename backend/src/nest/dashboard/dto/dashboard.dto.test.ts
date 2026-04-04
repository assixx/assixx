import { describe, expect, it } from 'vitest';

import {
  ChatCountsSchema,
  CountItemSchema,
  DashboardCountsSchema,
  NotificationStatsSchema,
} from './dashboard-counts.dto.js';

// =============================================================
// CountItemSchema
// =============================================================

describe('CountItemSchema', () => {
  it('should accept zero count', () => {
    expect(CountItemSchema.safeParse({ count: 0 }).success).toBe(true);
  });

  it('should accept positive count', () => {
    expect(CountItemSchema.safeParse({ count: 42 }).success).toBe(true);
  });

  it('should reject negative count', () => {
    expect(CountItemSchema.safeParse({ count: -1 }).success).toBe(false);
  });

  it('should reject non-integer count', () => {
    expect(CountItemSchema.safeParse({ count: 1.5 }).success).toBe(false);
  });

  it('should reject missing count', () => {
    expect(CountItemSchema.safeParse({}).success).toBe(false);
  });
});

// =============================================================
// ChatCountsSchema
// =============================================================

describe('ChatCountsSchema', () => {
  it('should accept with totalUnread only', () => {
    expect(ChatCountsSchema.safeParse({ totalUnread: 5 }).success).toBe(true);
  });

  it('should accept with conversations array', () => {
    const data = {
      totalUnread: 3,
      conversations: [{ conversationId: 1, conversationName: 'Team', unreadCount: 2 }],
    };
    expect(ChatCountsSchema.safeParse(data).success).toBe(true);
  });

  it('should reject negative totalUnread', () => {
    expect(ChatCountsSchema.safeParse({ totalUnread: -1 }).success).toBe(false);
  });

  it('should reject missing totalUnread', () => {
    expect(ChatCountsSchema.safeParse({}).success).toBe(false);
  });
});

// =============================================================
// NotificationStatsSchema
// =============================================================

describe('NotificationStatsSchema', () => {
  const valid = {
    total: 10,
    unread: 3,
    byType: { info: 5, warning: 3, error: 2 },
  };

  it('should accept valid stats', () => {
    expect(NotificationStatsSchema.safeParse(valid).success).toBe(true);
  });

  it('should accept empty byType', () => {
    expect(NotificationStatsSchema.safeParse({ total: 0, unread: 0, byType: {} }).success).toBe(
      true,
    );
  });

  it('should reject negative values', () => {
    expect(NotificationStatsSchema.safeParse({ ...valid, unread: -1 }).success).toBe(false);
  });

  it('should reject missing fields', () => {
    expect(NotificationStatsSchema.safeParse({}).success).toBe(false);
  });
});

// =============================================================
// DashboardCountsSchema
// =============================================================

describe('DashboardCountsSchema', () => {
  const valid = {
    chat: { totalUnread: 0 },
    notifications: { total: 0, unread: 0, byType: {} },
    blackboard: { count: 0 },
    calendar: { count: 0 },
    documents: { count: 0 },
    kvp: { count: 0 },
    surveys: { count: 0 },
    vacation: { count: 0 },
    tpm: { count: 0 },
    workOrders: { count: 0 },
    shiftSwap: { count: 0 },
    fetchedAt: '2025-06-01T12:00:00Z',
  };

  it('should accept valid dashboard counts', () => {
    expect(DashboardCountsSchema.safeParse(valid).success).toBe(true);
  });

  it('should reject missing chat field', () => {
    const { chat: _, ...rest } = valid;
    expect(DashboardCountsSchema.safeParse(rest).success).toBe(false);
  });

  it('should reject missing fetchedAt', () => {
    const { fetchedAt: _, ...rest } = valid;
    expect(DashboardCountsSchema.safeParse(rest).success).toBe(false);
  });

  it('should reject missing notifications field', () => {
    const { notifications: _, ...rest } = valid;
    expect(DashboardCountsSchema.safeParse(rest).success).toBe(false);
  });
});
