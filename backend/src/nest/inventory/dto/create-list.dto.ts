/**
 * Create Inventory List DTO
 *
 * Zod schema for creating a new inventory list (e.g., "Kräne", "Hubtische").
 * code_prefix must be unique per tenant (DB constraint).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateListSchema = z.object({
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
  category: z.string().trim().max(100, 'Kategorie darf maximal 100 Zeichen lang sein').nullish(),
  codePrefix: z
    .string()
    .trim()
    .min(2, 'Kürzel muss mindestens 2 Zeichen lang sein')
    .max(5, 'Kürzel darf maximal 5 Zeichen lang sein')
    .regex(/^[A-Z]+$/, 'Kürzel darf nur Großbuchstaben (A-Z) enthalten'),
  codeSeparator: z.string().max(3, 'Trennzeichen darf maximal 3 Zeichen lang sein').default('-'),
  codeDigits: z
    .number()
    .int()
    .min(2, 'Mindestens 2 Stellen')
    .max(6, 'Maximal 6 Stellen')
    .default(3),
  icon: z.string().trim().max(50, 'Icon darf maximal 50 Zeichen lang sein').nullish(),
});

export class CreateListDto extends createZodDto(CreateListSchema) {}
