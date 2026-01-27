/**
 * System Settings Filter Query DTO
 *
 * Query parameters for filtering system settings.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { SettingsFilterQuerySchema } from './settings-filter-query.dto.js';

export const SystemSettingsFilterQuerySchema = SettingsFilterQuerySchema.extend(
  {
    is_public: z
      .string()
      .transform((val: string) => val === 'true')
      .optional(),
  },
);

export class SystemSettingsFilterQueryDto extends createZodDto(
  SystemSettingsFilterQuerySchema,
) {}
