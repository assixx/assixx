/**
 * Update Card DTO
 *
 * Zod schema for updating an existing TPM maintenance card.
 * All fields optional — only provided fields are updated.
 *
 * Cross-field validation:
 *   - If intervalType is changed to 'custom', customIntervalDays must be provided
 *   - If intervalType is changed away from 'custom', customIntervalDays must be null/omitted
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { TpmCardRoleSchema, TpmIntervalTypeSchema } from './common.dto.js';

const BaseSchema = z.object({
  cardRole: TpmCardRoleSchema.optional(),
  intervalType: TpmIntervalTypeSchema.optional(),
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
  locationDescription: z
    .string()
    .trim()
    .max(1000, 'Standortbeschreibung darf maximal 1000 Zeichen lang sein')
    .nullish(),
  requiresApproval: z.boolean().optional(),
  customIntervalDays: z
    .number()
    .int()
    .min(1, 'Benutzerdefiniertes Intervall muss mindestens 1 Tag sein')
    .max(3650, 'Benutzerdefiniertes Intervall darf maximal 3650 Tage sein')
    .nullish(),
});

type BaseInput = z.infer<typeof BaseSchema>;

export const UpdateCardSchema = BaseSchema.refine(
  (data: BaseInput) => {
    if (data.intervalType === 'custom') {
      return data.customIntervalDays != null && data.customIntervalDays >= 1;
    }
    return true;
  },
  {
    message:
      'customIntervalDays ist erforderlich wenn intervalType "custom" ist',
    path: ['customIntervalDays'],
  },
).refine(
  (data: BaseInput) =>
    !(
      data.intervalType !== undefined &&
      data.intervalType !== 'custom' &&
      data.customIntervalDays != null
    ),
  {
    message:
      'customIntervalDays darf nur bei intervalType "custom" gesetzt werden',
    path: ['customIntervalDays'],
  },
);

export class UpdateCardDto extends createZodDto(UpdateCardSchema) {}
