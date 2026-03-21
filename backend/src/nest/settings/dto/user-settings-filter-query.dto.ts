/**
 * User Settings Filter Query DTO
 *
 * Query parameters for filtering user settings.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { SettingsFilterQuerySchema } from './settings-filter-query.dto.js';

export const UserSettingsFilterQuerySchema = SettingsFilterQuerySchema.extend({
  team_id: z.coerce.number().int().positive().optional(),
});

export class UserSettingsFilterQueryDto extends createZodDto(UserSettingsFilterQuerySchema) {}
