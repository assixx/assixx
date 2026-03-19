import { describe, expect, it } from 'vitest';

import { CreateApprovalSchema } from './create-approval.dto.js';

describe('CreateApprovalSchema', () => {
  const validInput = {
    addonCode: 'kvp',
    sourceEntityType: 'kvp_suggestion',
    sourceUuid: '01234567-89ab-cdef-0123-456789abcdef',
    title: 'Test Approval',
  };

  it('should accept valid minimal input', () => {
    const result = CreateApprovalSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept valid input with all optional fields', () => {
    const result = CreateApprovalSchema.safeParse({
      ...validInput,
      description: 'Detailed description',
      priority: 'high',
      assignedTo: 42,
    });
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> })
      .data;
    expect(data.priority).toBe('high');
    expect(data.assignedTo).toBe(42);
  });

  it('should default priority to medium', () => {
    const result = CreateApprovalSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> })
      .data;
    expect(data.priority).toBe('medium');
  });

  // --- addonCode ---

  it('should reject missing addonCode', () => {
    const { addonCode: _, ...input } = validInput;
    const result = CreateApprovalSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject empty addonCode', () => {
    const result = CreateApprovalSchema.safeParse({
      ...validInput,
      addonCode: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject addonCode exceeding 50 chars', () => {
    const result = CreateApprovalSchema.safeParse({
      ...validInput,
      addonCode: 'x'.repeat(51),
    });
    expect(result.success).toBe(false);
  });

  // --- sourceEntityType ---

  it('should reject missing sourceEntityType', () => {
    const { sourceEntityType: _, ...input } = validInput;
    const result = CreateApprovalSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject empty sourceEntityType', () => {
    const result = CreateApprovalSchema.safeParse({
      ...validInput,
      sourceEntityType: '',
    });
    expect(result.success).toBe(false);
  });

  // --- sourceUuid ---

  it('should reject sourceUuid shorter than 36 chars', () => {
    const result = CreateApprovalSchema.safeParse({
      ...validInput,
      sourceUuid: 'too-short',
    });
    expect(result.success).toBe(false);
  });

  it('should reject sourceUuid longer than 36 chars', () => {
    const result = CreateApprovalSchema.safeParse({
      ...validInput,
      sourceUuid: '01234567-89ab-cdef-0123-456789abcdef-extra',
    });
    expect(result.success).toBe(false);
  });

  // --- title ---

  it('should reject missing title', () => {
    const { title: _, ...input } = validInput;
    const result = CreateApprovalSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject empty title', () => {
    const result = CreateApprovalSchema.safeParse({ ...validInput, title: '' });
    expect(result.success).toBe(false);
  });

  it('should reject title exceeding 500 chars', () => {
    const result = CreateApprovalSchema.safeParse({
      ...validInput,
      title: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  // --- description ---

  it('should accept null description', () => {
    const result = CreateApprovalSchema.safeParse({
      ...validInput,
      description: null,
    });
    expect(result.success).toBe(true);
  });

  it('should accept omitted description', () => {
    const result = CreateApprovalSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> })
      .data;
    expect(data.description).toBeUndefined();
  });

  // --- priority ---

  it('should reject invalid priority value', () => {
    const result = CreateApprovalSchema.safeParse({
      ...validInput,
      priority: 'urgent',
    });
    expect(result.success).toBe(false);
  });

  // --- assignedTo ---

  it('should reject non-positive assignedTo', () => {
    const result = CreateApprovalSchema.safeParse({
      ...validInput,
      assignedTo: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer assignedTo', () => {
    const result = CreateApprovalSchema.safeParse({
      ...validInput,
      assignedTo: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('should accept null assignedTo', () => {
    const result = CreateApprovalSchema.safeParse({
      ...validInput,
      assignedTo: null,
    });
    expect(result.success).toBe(true);
  });
});
