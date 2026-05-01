/**
 * DTO validation tests for ListApprovalsQuerySchema
 *
 * Phase 1.2b — replaces the inline `ListApprovalsQuery` interface in
 * approvals.controller.ts with a Zod schema extending PaginationSchema.
 *
 * Pattern: ADR-018 Phase 8 — Zod .safeParse() / .parse() assertions on schema
 * boundaries (defaults, coercion, length caps, enum membership, trim semantics,
 * D3 search-field convention).
 */
import { describe, expect, it } from 'vitest';

import { ListApprovalsQuerySchema } from './list-approvals-query.dto.js';

// =============================================================
// Defaults + happy path
// =============================================================

describe('ListApprovalsQuerySchema — defaults', () => {
  it('should accept empty query and apply defaults', () => {
    const result = ListApprovalsQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.search).toBeUndefined();
    expect(result.status).toBeUndefined();
    expect(result.addonCode).toBeUndefined();
    expect(result.priority).toBeUndefined();
  });

  it('should accept full query with all filters', () => {
    const result = ListApprovalsQuerySchema.parse({
      page: '3',
      limit: '50',
      search: 'urgent',
      status: 'pending',
      addonCode: 'kvp',
      priority: 'high',
    });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
    expect(result.search).toBe('urgent');
    expect(result.status).toBe('pending');
    expect(result.addonCode).toBe('kvp');
    expect(result.priority).toBe('high');
  });
});

// =============================================================
// Pagination
// =============================================================

describe('ListApprovalsQuerySchema — pagination', () => {
  it('should coerce page from string to number', () => {
    const result = ListApprovalsQuerySchema.parse({ page: '5' });
    expect(result.page).toBe(5);
  });

  it('should coerce limit from string to number', () => {
    const result = ListApprovalsQuerySchema.parse({ limit: '30' });
    expect(result.limit).toBe(30);
  });

  it('should reject page=0', () => {
    expect(ListApprovalsQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });

  it('should reject negative page', () => {
    expect(ListApprovalsQuerySchema.safeParse({ page: '-1' }).success).toBe(false);
  });

  it('should reject non-integer page', () => {
    expect(ListApprovalsQuerySchema.safeParse({ page: '1.5' }).success).toBe(false);
  });

  it('should default limit to 20 (override of PaginationSchema=10)', () => {
    const result = ListApprovalsQuerySchema.parse({});
    expect(result.limit).toBe(20);
  });

  it('should accept limit=100 (boundary, inherited max)', () => {
    const result = ListApprovalsQuerySchema.parse({ limit: '100' });
    expect(result.limit).toBe(100);
  });

  it('should reject limit=101', () => {
    expect(ListApprovalsQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('should reject limit=0', () => {
    expect(ListApprovalsQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });
});

// =============================================================
// status filter (enum)
// =============================================================

describe('ListApprovalsQuerySchema — status', () => {
  it.each(['pending', 'approved', 'rejected'] as const)('should accept status=%s', (status) => {
    expect(ListApprovalsQuerySchema.safeParse({ status }).success).toBe(true);
  });

  it('should reject invalid status', () => {
    expect(ListApprovalsQuerySchema.safeParse({ status: 'cancelled' }).success).toBe(false);
  });

  it('should reject empty status string', () => {
    expect(ListApprovalsQuerySchema.safeParse({ status: '' }).success).toBe(false);
  });

  it('should reject uppercase variant', () => {
    expect(ListApprovalsQuerySchema.safeParse({ status: 'Pending' }).success).toBe(false);
  });
});

// =============================================================
// priority filter (enum)
// =============================================================

describe('ListApprovalsQuerySchema — priority', () => {
  it.each(['low', 'medium', 'high'] as const)('should accept priority=%s', (priority) => {
    expect(ListApprovalsQuerySchema.safeParse({ priority }).success).toBe(true);
  });

  it('should reject invalid priority', () => {
    expect(ListApprovalsQuerySchema.safeParse({ priority: 'critical' }).success).toBe(false);
  });

  it('should reject empty priority string', () => {
    expect(ListApprovalsQuerySchema.safeParse({ priority: '' }).success).toBe(false);
  });
});

// =============================================================
// addonCode filter
// =============================================================

describe('ListApprovalsQuerySchema — addonCode', () => {
  it('should accept addonCode within length bounds', () => {
    const result = ListApprovalsQuerySchema.parse({ addonCode: 'kvp' });
    expect(result.addonCode).toBe('kvp');
  });

  it('should trim whitespace from addonCode', () => {
    const result = ListApprovalsQuerySchema.parse({ addonCode: '  tpm  ' });
    expect(result.addonCode).toBe('tpm');
  });

  it('should accept addonCode at exactly 50 chars (boundary)', () => {
    expect(ListApprovalsQuerySchema.safeParse({ addonCode: 'a'.repeat(50) }).success).toBe(true);
  });

  it('should reject addonCode longer than 50 chars', () => {
    expect(ListApprovalsQuerySchema.safeParse({ addonCode: 'a'.repeat(51) }).success).toBe(false);
  });

  it('should reject empty addonCode after trim', () => {
    // .trim().min(1): empty string and whitespace-only both fail.
    expect(ListApprovalsQuerySchema.safeParse({ addonCode: '' }).success).toBe(false);
    expect(ListApprovalsQuerySchema.safeParse({ addonCode: '   ' }).success).toBe(false);
  });
});

// =============================================================
// search filter (D3 convention — Phase 1.2b)
// =============================================================

describe('ListApprovalsQuerySchema — search (D3)', () => {
  it('should accept search string', () => {
    const result = ListApprovalsQuerySchema.parse({ search: 'urgent' });
    expect(result.search).toBe('urgent');
  });

  it('should trim whitespace from search', () => {
    const result = ListApprovalsQuerySchema.parse({ search: '  trimmed  ' });
    expect(result.search).toBe('trimmed');
  });

  it('should accept search at exactly 100 chars (boundary)', () => {
    expect(ListApprovalsQuerySchema.safeParse({ search: 'A'.repeat(100) }).success).toBe(true);
  });

  it('should reject search longer than 100 chars', () => {
    expect(ListApprovalsQuerySchema.safeParse({ search: 'A'.repeat(101) }).success).toBe(false);
  });

  it('should accept empty search string (service treats as no filter)', () => {
    // Backwards-compat invariant: schema accepts '', service drops the WHERE clause.
    expect(ListApprovalsQuerySchema.safeParse({ search: '' }).success).toBe(true);
  });

  it('should accept search with special characters (will be %wrapped% in service)', () => {
    const result = ListApprovalsQuerySchema.parse({ search: "Müller's repair" });
    expect(result.search).toBe("Müller's repair");
  });
});
