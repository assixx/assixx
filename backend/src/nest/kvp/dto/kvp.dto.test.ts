import { describe, expect, it } from 'vitest';

import { AddCommentSchema } from './comment.dto.js';
import { CreateCustomCategorySchema } from './create-custom-category.dto.js';
import { CreateSuggestionSchema } from './create-suggestion.dto.js';
import { OverrideCategoryNameSchema } from './override-category-name.dto.js';
import { ListSuggestionsQuerySchema } from './query-suggestion.dto.js';
import { ShareSuggestionSchema } from './share-suggestion.dto.js';
import { UpdateKvpSettingsSchema } from './update-kvp-settings.dto.js';
import { UpdateSuggestionSchema } from './update-suggestion.dto.js';

// =============================================================
// CreateSuggestionSchema
// =============================================================

describe('CreateSuggestionSchema', () => {
  const valid = {
    title: 'Improve Workflow',
    description: 'We should automate the manual sorting process to save time.',
    categoryId: '1',
    orgLevel: 'company' as const,
    orgId: 0,
  };

  it('should accept valid suggestion with categoryId', () => {
    expect(CreateSuggestionSchema.safeParse(valid).success).toBe(true);
  });

  it('should accept suggestion with customCategoryId instead', () => {
    const { categoryId: _cid, ...rest } = valid;

    expect(
      CreateSuggestionSchema.safeParse({ ...rest, customCategoryId: '5' })
        .success,
    ).toBe(true);
  });

  it('should reject when neither categoryId nor customCategoryId provided', () => {
    const { categoryId: _cid, ...noCategory } = valid;

    expect(CreateSuggestionSchema.safeParse(noCategory).success).toBe(false);
  });

  it('should reject title shorter than 3 characters', () => {
    expect(
      CreateSuggestionSchema.safeParse({ ...valid, title: 'AB' }).success,
    ).toBe(false);
  });

  it('should reject description shorter than 10 characters', () => {
    expect(
      CreateSuggestionSchema.safeParse({ ...valid, description: 'Short' })
        .success,
    ).toBe(false);
  });

  it('should reject description longer than 5000 characters', () => {
    expect(
      CreateSuggestionSchema.safeParse({
        ...valid,
        description: 'D'.repeat(5001),
      }).success,
    ).toBe(false);
  });

  it.each(['company', 'department', 'area', 'team'] as const)(
    'should accept orgLevel=%s',
    (orgLevel) => {
      expect(
        CreateSuggestionSchema.safeParse({ ...valid, orgLevel }).success,
      ).toBe(true);
    },
  );

  it.each(['low', 'normal', 'high', 'urgent'] as const)(
    'should accept priority=%s',
    (priority) => {
      expect(
        CreateSuggestionSchema.safeParse({ ...valid, priority }).success,
      ).toBe(true);
    },
  );
});

// =============================================================
// UpdateSuggestionSchema
// =============================================================

describe('UpdateSuggestionSchema', () => {
  it('should accept empty object (all optional)', () => {
    expect(UpdateSuggestionSchema.safeParse({}).success).toBe(true);
  });

  it('should coerce actualSavings from string', () => {
    const data = UpdateSuggestionSchema.parse({
      actualSavings: '1500.50',
    });

    expect(data.actualSavings).toBe(1500.5);
  });

  it('should reject negative actualSavings', () => {
    expect(
      UpdateSuggestionSchema.safeParse({ actualSavings: '-100' }).success,
    ).toBe(false);
  });

  it.each([
    'new',
    'in_review',
    'approved',
    'implemented',
    'rejected',
    'archived',
  ] as const)('should accept status=%s', (status) => {
    expect(UpdateSuggestionSchema.safeParse({ status }).success).toBe(true);
  });
});

// =============================================================
// AddCommentSchema (KVP)
// =============================================================

describe('AddCommentSchema (KVP)', () => {
  it('should accept valid comment with default isInternal', () => {
    const data = AddCommentSchema.parse({ comment: 'Good idea!' });

    expect(data.isInternal).toBe(false);
  });

  it('should reject empty comment', () => {
    expect(AddCommentSchema.safeParse({ comment: '' }).success).toBe(false);
  });

  it('should reject comment longer than 2000 characters', () => {
    expect(
      AddCommentSchema.safeParse({ comment: 'C'.repeat(2001) }).success,
    ).toBe(false);
  });
});

// =============================================================
// ShareSuggestionSchema
// =============================================================

describe('ShareSuggestionSchema', () => {
  it('should accept valid share data', () => {
    expect(
      ShareSuggestionSchema.safeParse({ orgLevel: 'company', orgId: 0 })
        .success,
    ).toBe(true);
  });

  it('should reject negative orgId', () => {
    expect(
      ShareSuggestionSchema.safeParse({ orgLevel: 'company', orgId: -1 })
        .success,
    ).toBe(false);
  });

  it('should reject invalid orgLevel', () => {
    expect(
      ShareSuggestionSchema.safeParse({ orgLevel: 'personal', orgId: 0 })
        .success,
    ).toBe(false);
  });
});

// =============================================================
// CreateCustomCategorySchema
// =============================================================

describe('CreateCustomCategorySchema', () => {
  const valid = {
    name: 'Safety',
    color: '#ff0000',
    icon: 'shield',
  };

  it('should accept valid category', () => {
    expect(CreateCustomCategorySchema.safeParse(valid).success).toBe(true);
  });

  it('should reject invalid hex color', () => {
    expect(
      CreateCustomCategorySchema.safeParse({ ...valid, color: 'red' }).success,
    ).toBe(false);
  });

  it('should accept lowercase hex color', () => {
    expect(
      CreateCustomCategorySchema.safeParse({ ...valid, color: '#abcdef' })
        .success,
    ).toBe(true);
  });

  it('should reject hex color without #', () => {
    expect(
      CreateCustomCategorySchema.safeParse({ ...valid, color: 'ff0000' })
        .success,
    ).toBe(false);
  });

  it('should reject empty icon', () => {
    expect(
      CreateCustomCategorySchema.safeParse({ ...valid, icon: '' }).success,
    ).toBe(false);
  });

  it('should reject name longer than 50 characters', () => {
    expect(
      CreateCustomCategorySchema.safeParse({ ...valid, name: 'N'.repeat(51) })
        .success,
    ).toBe(false);
  });
});

// =============================================================
// ListSuggestionsQuerySchema
// =============================================================

describe('ListSuggestionsQuerySchema', () => {
  it('should accept empty query', () => {
    expect(ListSuggestionsQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should reject search longer than 100 characters', () => {
    expect(
      ListSuggestionsQuerySchema.safeParse({ search: 'X'.repeat(101) }).success,
    ).toBe(false);
  });

  it('should accept valid status filter', () => {
    expect(
      ListSuggestionsQuerySchema.safeParse({ status: 'approved' }).success,
    ).toBe(true);
  });

  it('should reject invalid status', () => {
    expect(
      ListSuggestionsQuerySchema.safeParse({ status: 'pending' }).success,
    ).toBe(false);
  });
});

// =============================================================
// OverrideCategoryNameSchema
// =============================================================

describe('OverrideCategoryNameSchema', () => {
  it('should accept valid custom name', () => {
    expect(
      OverrideCategoryNameSchema.safeParse({ customName: 'My Category' })
        .success,
    ).toBe(true);
  });

  it('should reject empty custom name', () => {
    expect(
      OverrideCategoryNameSchema.safeParse({ customName: '' }).success,
    ).toBe(false);
  });

  it('should reject name longer than 50 characters', () => {
    expect(
      OverrideCategoryNameSchema.safeParse({
        customName: 'N'.repeat(51),
      }).success,
    ).toBe(false);
  });
});

// =============================================================
// UpdateKvpSettingsSchema
// =============================================================

describe('UpdateKvpSettingsSchema', () => {
  it('should accept dailyLimit = 1 (default)', () => {
    expect(UpdateKvpSettingsSchema.safeParse({ dailyLimit: 1 }).success).toBe(
      true,
    );
  });

  it('should accept dailyLimit = 0 (unlimited)', () => {
    expect(UpdateKvpSettingsSchema.safeParse({ dailyLimit: 0 }).success).toBe(
      true,
    );
  });

  it('should accept dailyLimit = 100 (max)', () => {
    expect(UpdateKvpSettingsSchema.safeParse({ dailyLimit: 100 }).success).toBe(
      true,
    );
  });

  it('should reject dailyLimit > 100', () => {
    expect(UpdateKvpSettingsSchema.safeParse({ dailyLimit: 101 }).success).toBe(
      false,
    );
  });

  it('should reject negative dailyLimit', () => {
    expect(UpdateKvpSettingsSchema.safeParse({ dailyLimit: -1 }).success).toBe(
      false,
    );
  });

  it('should reject non-integer dailyLimit', () => {
    expect(UpdateKvpSettingsSchema.safeParse({ dailyLimit: 2.5 }).success).toBe(
      false,
    );
  });

  it('should reject missing dailyLimit', () => {
    expect(UpdateKvpSettingsSchema.safeParse({}).success).toBe(false);
  });

  it('should reject string dailyLimit', () => {
    expect(UpdateKvpSettingsSchema.safeParse({ dailyLimit: '5' }).success).toBe(
      false,
    );
  });
});
