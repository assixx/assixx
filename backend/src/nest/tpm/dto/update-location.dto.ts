/**
 * Update Location DTO
 *
 * Zod schema for updating an existing TPM location.
 * All fields optional.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateLocationSchema = z.object({
  positionNumber: z
    .number()
    .int('Position muss eine ganze Zahl sein')
    .min(1, 'Position muss mindestens 1 sein')
    .max(200, 'Position darf maximal 200 sein')
    .optional(),
  title: z
    .string()
    .trim()
    .min(1, 'Titel ist erforderlich')
    .max(255, 'Titel darf maximal 255 Zeichen lang sein')
    .optional(),
  description: z
    .string()
    .trim()
    .max(5000, 'Beschreibung darf maximal 5000 Zeichen lang sein')
    .nullish(),
});

export class UpdateLocationDto extends createZodDto(UpdateLocationSchema) {}
