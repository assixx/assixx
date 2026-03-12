import { describe, expect, it } from 'vitest';

import { MarkVisitedSchema, VisitableAddonSchema } from './mark-visited.dto.js';

// =============================================================
// VisitableAddonSchema
// =============================================================

describe('VisitableAddonSchema', () => {
  it('should accept calendar', () => {
    expect(VisitableAddonSchema.safeParse('calendar').success).toBe(true);
  });

  it('should accept kvp', () => {
    expect(VisitableAddonSchema.safeParse('kvp').success).toBe(true);
  });

  it('should accept surveys', () => {
    expect(VisitableAddonSchema.safeParse('surveys').success).toBe(true);
  });

  it('should reject invalid addon', () => {
    expect(VisitableAddonSchema.safeParse('chat').success).toBe(false);
    expect(VisitableAddonSchema.safeParse('documents').success).toBe(false);
  });

  it('should reject empty string', () => {
    expect(VisitableAddonSchema.safeParse('').success).toBe(false);
  });
});

// =============================================================
// MarkVisitedSchema
// =============================================================

describe('MarkVisitedSchema', () => {
  it('should accept valid addon', () => {
    expect(MarkVisitedSchema.safeParse({ addon: 'calendar' }).success).toBe(
      true,
    );
    expect(MarkVisitedSchema.safeParse({ addon: 'kvp' }).success).toBe(true);
    expect(MarkVisitedSchema.safeParse({ addon: 'surveys' }).success).toBe(
      true,
    );
  });

  it('should reject missing addon', () => {
    expect(MarkVisitedSchema.safeParse({}).success).toBe(false);
  });

  it('should reject invalid addon value', () => {
    expect(MarkVisitedSchema.safeParse({ addon: 'blackboard' }).success).toBe(
      false,
    );
  });
});
