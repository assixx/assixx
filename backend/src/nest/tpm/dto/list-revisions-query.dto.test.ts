/**
 * DTO validation tests for ListRevisionsQuerySchema
 *
 * Tests: page/limit coercion, defaults, boundary validation.
 * Pattern: ADR-018 Phase 8 — Zod .safeParse() assertions.
 */
import { describe, expect, it } from 'vitest';

import { ListRevisionsQuerySchema } from './list-revisions-query.dto.js';

describe('ListRevisionsQuerySchema', () => {
  it('should apply defaults when no params provided', () => {
    const result = ListRevisionsQuerySchema.parse({});

    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('should coerce string values from query params', () => {
    const result = ListRevisionsQuerySchema.parse({ page: '3', limit: '50' });

    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it('should reject page = 0', () => {
    const result = ListRevisionsQuerySchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject negative page', () => {
    const result = ListRevisionsQuerySchema.safeParse({ page: -1 });
    expect(result.success).toBe(false);
  });

  it('should reject limit > 500', () => {
    const result = ListRevisionsQuerySchema.safeParse({ limit: 501 });
    expect(result.success).toBe(false);
  });

  it('should reject limit = 0', () => {
    const result = ListRevisionsQuerySchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it('should accept limit = 500 (boundary)', () => {
    const result = ListRevisionsQuerySchema.parse({ limit: 500 });

    expect(result.limit).toBe(500);
  });
});
