import { describe, expect, it } from 'vitest';

import { FeatureSchema, MarkVisitedSchema } from './mark-visited.dto.js';

// =============================================================
// FeatureSchema
// =============================================================

describe('FeatureSchema', () => {
  it('should accept calendar', () => {
    expect(FeatureSchema.safeParse('calendar').success).toBe(true);
  });

  it('should accept kvp', () => {
    expect(FeatureSchema.safeParse('kvp').success).toBe(true);
  });

  it('should accept surveys', () => {
    expect(FeatureSchema.safeParse('surveys').success).toBe(true);
  });

  it('should reject invalid feature', () => {
    expect(FeatureSchema.safeParse('chat').success).toBe(false);
    expect(FeatureSchema.safeParse('documents').success).toBe(false);
  });

  it('should reject empty string', () => {
    expect(FeatureSchema.safeParse('').success).toBe(false);
  });
});

// =============================================================
// MarkVisitedSchema
// =============================================================

describe('MarkVisitedSchema', () => {
  it('should accept valid feature', () => {
    expect(MarkVisitedSchema.safeParse({ feature: 'calendar' }).success).toBe(
      true,
    );
    expect(MarkVisitedSchema.safeParse({ feature: 'kvp' }).success).toBe(true);
    expect(MarkVisitedSchema.safeParse({ feature: 'surveys' }).success).toBe(
      true,
    );
  });

  it('should reject missing feature', () => {
    expect(MarkVisitedSchema.safeParse({}).success).toBe(false);
  });

  it('should reject invalid feature value', () => {
    expect(MarkVisitedSchema.safeParse({ feature: 'blackboard' }).success).toBe(
      false,
    );
  });
});
