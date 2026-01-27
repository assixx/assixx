/**
 * Update Tenant Setting DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  CategoryEnum,
  SettingValueSchema,
  ValueTypeEnum,
} from './setting-schemas.js';

export const UpdateTenantSettingSchema = z.object({
  setting_value: SettingValueSchema,
  value_type: ValueTypeEnum.optional(),
  category: CategoryEnum.optional(),
});

export class UpdateTenantSettingDto extends createZodDto(
  UpdateTenantSettingSchema,
) {}
