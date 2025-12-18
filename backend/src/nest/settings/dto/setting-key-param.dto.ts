/**
 * Setting Key Param DTO
 *
 * Validates setting_key path parameter.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SettingKeyParamSchema = z.object({
  key: z.string().min(1, 'Setting key is required'),
});

export class SettingKeyParamDto extends createZodDto(SettingKeyParamSchema) {}
