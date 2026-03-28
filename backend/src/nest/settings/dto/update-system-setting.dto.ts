/**
 * Update System Setting DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CategoryEnum, SettingValueSchema, ValueTypeEnum } from './setting-schemas.js';

export const UpdateSystemSettingSchema = z.object({
  setting_value: SettingValueSchema,
  value_type: ValueTypeEnum.optional(),
  category: CategoryEnum.optional(),
  description: z.string().optional(),
  is_public: z.boolean().optional(),
});

export class UpdateSystemSettingDto extends createZodDto(UpdateSystemSettingSchema) {}
