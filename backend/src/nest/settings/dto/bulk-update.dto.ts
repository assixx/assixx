/**
 * Bulk Update Settings DTO
 *
 * DTO for bulk updating settings.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ValueTypeEnum = z.enum(['string', 'number', 'boolean', 'json']);
const CategoryEnum = z.enum([
  'general',
  'appearance',
  'notifications',
  'security',
  'workflow',
  'integration',
  'other',
]);
const SettingTypeEnum = z.enum(['system', 'tenant', 'user']);

/**
 * Base setting value schema (accepts any JSON value)
 */
const SettingValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.record(z.string(), z.unknown()),
]);

const BulkSettingItemSchema = z.object({
  setting_key: z.string().min(1, 'Setting key is required'),
  setting_value: SettingValueSchema,
  value_type: ValueTypeEnum.optional(),
  category: CategoryEnum.optional(),
  description: z.string().optional(),
  is_public: z.boolean().optional(),
});

/** Inferred type for bulk setting item array element */
export type BulkSettingItem = z.infer<typeof BulkSettingItemSchema>;

export const BulkUpdateSettingsSchema = z.object({
  type: SettingTypeEnum,
  settings: z.array(BulkSettingItemSchema).min(1, 'At least one setting is required'),
});

export class BulkUpdateSettingsDto extends createZodDto(BulkUpdateSettingsSchema) {}
