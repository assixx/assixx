/**
 * Param Factory – Unit Tests
 *
 * Tests the shared ID/UUID param validation factories used by 29+ DTOs.
 * Validates both the raw Zod schemas and the factory functions.
 */
import { describe, expect, it } from 'vitest';

import {
  IdParamSchema,
  UuidIdParamSchema,
  createIdParamSchema,
  createUuidParamSchema,
  idField,
  uuidField,
} from './param.factory.js';

// =============================================================
// idField (shared numeric coercion)
// =============================================================

describe('idField', () => {
  it('should accept positive integer', () => {
    expect(idField.safeParse(1).success).toBe(true);
    expect(idField.safeParse(999).success).toBe(true);
  });

  it('should coerce string to number', () => {
    expect(idField.parse('42')).toBe(42);
  });

  it('should reject zero', () => {
    expect(idField.safeParse(0).success).toBe(false);
  });

  it('should reject negative numbers', () => {
    expect(idField.safeParse(-1).success).toBe(false);
  });

  it('should reject floats', () => {
    expect(idField.safeParse(1.5).success).toBe(false);
  });

  it('should reject non-numeric strings', () => {
    expect(idField.safeParse('abc').success).toBe(false);
  });

  it('should reject empty string', () => {
    expect(idField.safeParse('').success).toBe(false);
  });
});

// =============================================================
// uuidField
// =============================================================

describe('uuidField', () => {
  it('should accept valid UUID v4', () => {
    expect(uuidField.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
  });

  it('should accept valid UUID v7', () => {
    expect(uuidField.safeParse('019539a0-0000-7000-8000-000000000001').success).toBe(true);
  });

  it('should reject invalid UUID', () => {
    expect(uuidField.safeParse('not-a-uuid').success).toBe(false);
  });

  it('should reject empty string', () => {
    expect(uuidField.safeParse('').success).toBe(false);
  });

  it('should reject numeric ID', () => {
    expect(uuidField.safeParse(42).success).toBe(false);
  });
});

// =============================================================
// IdParamSchema (pre-built :id numeric)
// =============================================================

describe('IdParamSchema', () => {
  it('should accept { id: "5" } and coerce to number', () => {
    expect(IdParamSchema.parse({ id: '5' }).id).toBe(5);
  });

  it('should reject missing id', () => {
    expect(IdParamSchema.safeParse({}).success).toBe(false);
  });

  it('should reject id = 0', () => {
    expect(IdParamSchema.safeParse({ id: '0' }).success).toBe(false);
  });
});

// =============================================================
// UuidIdParamSchema (pre-built :id UUID)
// =============================================================

describe('UuidIdParamSchema', () => {
  it('should accept { id: "<valid-uuid>" }', () => {
    const result = UuidIdParamSchema.safeParse({
      id: '019539a0-0000-7000-8000-000000000001',
    });
    expect(result.success).toBe(true);
  });

  it('should reject { id: "123" }', () => {
    expect(UuidIdParamSchema.safeParse({ id: '123' }).success).toBe(false);
  });
});

// =============================================================
// createIdParamSchema (factory)
// =============================================================

describe('createIdParamSchema()', () => {
  it('should create schema with custom param name', () => {
    const schema = createIdParamSchema('userId');
    expect(schema.parse({ userId: '7' }).userId).toBe(7);
  });

  it('should reject wrong param name', () => {
    const schema = createIdParamSchema('userId');
    expect(schema.safeParse({ id: '7' }).success).toBe(false);
  });

  it('should reject non-positive ID', () => {
    const schema = createIdParamSchema('teamId');
    expect(schema.safeParse({ teamId: '0' }).success).toBe(false);
    expect(schema.safeParse({ teamId: '-1' }).success).toBe(false);
  });

  it('should coerce string route param to number', () => {
    const schema = createIdParamSchema('adminId');
    expect(typeof schema.parse({ adminId: '123' }).adminId).toBe('number');
  });
});

// =============================================================
// createUuidParamSchema (factory)
// =============================================================

describe('createUuidParamSchema()', () => {
  it('should create schema with custom param name', () => {
    const schema = createUuidParamSchema('fileUuid');
    const result = schema.safeParse({
      fileUuid: '019539a0-0000-7000-8000-000000000001',
    });
    expect(result.success).toBe(true);
  });

  it('should reject wrong param name', () => {
    const schema = createUuidParamSchema('fileUuid');
    expect(schema.safeParse({ id: '019539a0-0000-7000-8000-000000000001' }).success).toBe(false);
  });

  it('should reject invalid UUID value', () => {
    const schema = createUuidParamSchema('chatUuid');
    expect(schema.safeParse({ chatUuid: 'not-valid' }).success).toBe(false);
  });
});
