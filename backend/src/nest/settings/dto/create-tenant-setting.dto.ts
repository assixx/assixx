/**
 * Create Tenant Setting DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CategoryEnum, SettingValueSchema, ValueTypeEnum } from './setting-schemas.js';

export const CreateTenantSettingSchema = z.object({
  setting_key: z.string().min(1, 'Setting key is required'),
  setting_value: SettingValueSchema,
  value_type: ValueTypeEnum.optional(),
  category: CategoryEnum.optional(),
});

export class CreateTenantSettingDto extends createZodDto(CreateTenantSettingSchema) {}
