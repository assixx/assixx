/**
 * Create Location DTO
 *
 * Zod schema for creating a new TPM location per plan.
 * Position number 1-200, title, optional description.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateLocationSchema = z.object({
  planUuid: z.string().trim().min(1, 'Plan-UUID ist erforderlich'),
  positionNumber: z
    .number()
    .int('Position muss eine ganze Zahl sein')
    .min(1, 'Position muss mindestens 1 sein')
    .max(200, 'Position darf maximal 200 sein'),
  title: z
    .string()
    .trim()
    .min(1, 'Titel ist erforderlich')
    .max(255, 'Titel darf maximal 255 Zeichen lang sein'),
  description: z
    .string()
    .trim()
    .max(5000, 'Beschreibung darf maximal 5000 Zeichen lang sein')
    .nullish(),
});

export class CreateLocationDto extends createZodDto(CreateLocationSchema) {}
