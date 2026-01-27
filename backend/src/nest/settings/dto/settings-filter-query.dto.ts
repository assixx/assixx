/**
 * Settings Filter Query DTO
 *
 * Base query parameters for filtering settings.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CategoryEnum } from './setting-schemas.js';

export const SettingsFilterQuerySchema = z.object({
  category: CategoryEnum.optional(),
  search: z.string().optional(),
});

export class SettingsFilterQueryDto extends createZodDto(
  SettingsFilterQuerySchema,
) {}
