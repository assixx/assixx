/**
 * Update Card Template DTO
 *
 * Zod schema for updating an existing TPM card template.
 * All fields optional — only provided fields are updated.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name ist erforderlich')
    .max(255, 'Name darf maximal 255 Zeichen lang sein')
    .optional(),
  description: z
    .string()
    .trim()
    .max(2000, 'Beschreibung darf maximal 2000 Zeichen lang sein')
    .nullish(),
  defaultFields: z.record(z.string(), z.unknown()).optional(),
  isDefault: z.boolean().optional(),
});

export class UpdateTemplateDto extends createZodDto(UpdateTemplateSchema) {}
