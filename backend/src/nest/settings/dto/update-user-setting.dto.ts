/**
 * Update User Setting DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  CategoryEnum,
  SettingValueSchema,
  ValueTypeEnum,
} from './setting-schemas.js';

export const UpdateUserSettingSchema = z.object({
  setting_value: SettingValueSchema,
  value_type: ValueTypeEnum.optional(),
  category: CategoryEnum.optional(),
  team_id: z.number().int().positive().nullable().optional(),
});

export class UpdateUserSettingDto extends createZodDto(
  UpdateUserSettingSchema,
) {}
