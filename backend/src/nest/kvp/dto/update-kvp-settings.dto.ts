/**
 * Update KVP Settings DTO
 *
 * Validation schema for updating KVP addon settings (e.g. daily limit).
 * Root-only / admin with has_full_access.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateKvpSettingsSchema = z.object({
  dailyLimit: z
    .number()
    .int('Tageslimit muss eine ganze Zahl sein')
    .min(0, 'Tageslimit darf nicht negativ sein')
    .max(100, 'Tageslimit darf maximal 100 betragen'),
});

export class UpdateKvpSettingsDto extends createZodDto(UpdateKvpSettingsSchema) {}
