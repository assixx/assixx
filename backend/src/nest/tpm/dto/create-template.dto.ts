/**
 * Create Card Template DTO
 *
 * Zod schema for creating a new TPM card template.
 * Templates define default fields for card creation.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name ist erforderlich')
    .max(255, 'Name darf maximal 255 Zeichen lang sein'),
  description: z
    .string()
    .trim()
    .max(2000, 'Beschreibung darf maximal 2000 Zeichen lang sein')
    .nullish(),
  defaultFields: z.record(z.string(), z.unknown()).default({}),
  isDefault: z.boolean().default(false),
});

export class CreateTemplateDto extends createZodDto(CreateTemplateSchema) {}
