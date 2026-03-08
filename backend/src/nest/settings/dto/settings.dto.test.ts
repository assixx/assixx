import { describe, expect, it } from 'vitest';

import { BulkUpdateSettingsSchema } from './bulk-update.dto.js';
import { CreateSystemSettingSchema } from './create-system-setting.dto.js';
import { SettingKeyParamSchema } from './setting-key-param.dto.js';
import {
  CategoryEnum,
  SettingValueSchema,
  ValueTypeEnum,
} from './setting-schemas.js';
import { SettingsFilterQuerySchema } from './settings-filter-query.dto.js';
import { UserIdParamSchema } from './user-id-param.dto.js';

// =============================================================
// Setting Schemas (shared)
// =============================================================

describe('ValueTypeEnum', () => {
  it.each(['string', 'number', 'boolean', 'json'] as const)(
    'should accept valueType=%s',
    (type) => {
      expect(ValueTypeEnum.safeParse(type).success).toBe(true);
    },
  );

  it('should reject invalid value type', () => {
    expect(ValueTypeEnum.safeParse('array').success).toBe(false);
  });
});

describe('CategoryEnum', () => {
  it.each([
    'general',
    'appearance',
    'notifications',
    'security',
    'workflow',
    'integration',
    'other',
  ] as const)('should accept category=%s', (cat) => {
    expect(CategoryEnum.safeParse(cat).success).toBe(true);
  });

  it('should reject invalid category', () => {
    expect(CategoryEnum.safeParse('admin').success).toBe(false);
  });
});

describe('SettingValueSchema', () => {
  it('should accept string value', () => {
    expect(SettingValueSchema.safeParse('hello').success).toBe(true);
  });

  it('should accept number value', () => {
    expect(SettingValueSchema.safeParse(42).success).toBe(true);
  });

  it('should accept boolean value', () => {
    expect(SettingValueSchema.safeParse(true).success).toBe(true);
  });

  it('should accept JSON object value', () => {
    expect(
      SettingValueSchema.safeParse({ theme: 'dark', fontSize: 14 }).success,
    ).toBe(true);
  });
});

// =============================================================
// SettingKeyParamSchema
// =============================================================

describe('SettingKeyParamSchema', () => {
  it('should accept valid key', () => {
    expect(SettingKeyParamSchema.safeParse({ key: 'theme.mode' }).success).toBe(
      true,
    );
  });

  it('should reject empty key', () => {
    expect(SettingKeyParamSchema.safeParse({ key: '' }).success).toBe(false);
  });
});

// =============================================================
// CreateSystemSettingSchema
// =============================================================

describe('CreateSystemSettingSchema', () => {
  const valid = {
    setting_key: 'app.maintenance_mode',
    setting_value: false,
  };

  it('should accept valid system setting', () => {
    expect(CreateSystemSettingSchema.safeParse(valid).success).toBe(true);
  });

  it('should accept setting with all optional fields', () => {
    expect(
      CreateSystemSettingSchema.safeParse({
        ...valid,
        value_type: 'boolean',
        category: 'general',
        description: 'Enable maintenance mode',
        is_public: true,
      }).success,
    ).toBe(true);
  });

  it('should reject missing setting_key', () => {
    expect(
      CreateSystemSettingSchema.safeParse({ setting_value: 'test' }).success,
    ).toBe(false);
  });

  it('should reject empty setting_key', () => {
    expect(
      CreateSystemSettingSchema.safeParse({
        setting_key: '',
        setting_value: 'test',
      }).success,
    ).toBe(false);
  });
});

// =============================================================
// SettingsFilterQuerySchema
// =============================================================

describe('SettingsFilterQuerySchema', () => {
  it('should accept empty query', () => {
    expect(SettingsFilterQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should accept category filter', () => {
    expect(
      SettingsFilterQuerySchema.safeParse({ category: 'security' }).success,
    ).toBe(true);
  });

  it('should accept search filter', () => {
    expect(
      SettingsFilterQuerySchema.safeParse({ search: 'theme' }).success,
    ).toBe(true);
  });
});

// =============================================================
// UserIdParamSchema
// =============================================================

describe('UserIdParamSchema', () => {
  it('should accept { userId: "5" } and coerce to number', () => {
    expect(UserIdParamSchema.parse({ userId: '5' }).userId).toBe(5);
  });

  it('should reject { id: "5" } (wrong param name)', () => {
    expect(UserIdParamSchema.safeParse({ id: '5' }).success).toBe(false);
  });

  it('should reject userId = 0', () => {
    expect(UserIdParamSchema.safeParse({ userId: '0' }).success).toBe(false);
  });

  it('should reject missing userId', () => {
    expect(UserIdParamSchema.safeParse({}).success).toBe(false);
  });
});

// =============================================================
// BulkUpdateSettingsSchema
// =============================================================

describe('BulkUpdateSettingsSchema', () => {
  const valid = {
    type: 'system' as const,
    settings: [{ setting_key: 'app.theme', setting_value: 'dark' }],
  };

  it('should accept valid bulk update', () => {
    expect(BulkUpdateSettingsSchema.safeParse(valid).success).toBe(true);
  });

  it.each(['system', 'tenant', 'user'] as const)(
    'should accept type=%s',
    (type) => {
      expect(
        BulkUpdateSettingsSchema.safeParse({ ...valid, type }).success,
      ).toBe(true);
    },
  );

  it('should reject empty settings array', () => {
    expect(
      BulkUpdateSettingsSchema.safeParse({
        type: 'system',
        settings: [],
      }).success,
    ).toBe(false);
  });

  it('should reject missing type', () => {
    expect(
      BulkUpdateSettingsSchema.safeParse({
        settings: [{ setting_key: 'key', setting_value: 'val' }],
      }).success,
    ).toBe(false);
  });

  it('should reject invalid type', () => {
    expect(
      BulkUpdateSettingsSchema.safeParse({ ...valid, type: 'global' }).success,
    ).toBe(false);
  });
});
