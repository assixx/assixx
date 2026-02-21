/**
 * Create Card DTO
 *
 * Zod schema for creating a new TPM maintenance card.
 * Cards belong to a plan and have interval-based scheduling.
 *
 * Cross-field validation:
 *   - customIntervalDays required when intervalType='custom'
 *   - customIntervalDays forbidden for other interval types
 *   - weekdayOverride only allowed when intervalType='weekly'
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  TpmCardRoleSchema,
  TpmIntervalTypeSchema,
  WeekdaySchema,
} from './common.dto.js';

const BaseSchema = z.object({
  planUuid: z.uuid('Ungültige Plan-UUID'),
  cardRole: TpmCardRoleSchema,
  intervalType: TpmIntervalTypeSchema,
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
  locationDescription: z
    .string()
    .trim()
    .max(1000, 'Standortbeschreibung darf maximal 1000 Zeichen lang sein')
    .nullish(),
  requiresApproval: z.boolean().default(false),
  customIntervalDays: z
    .number()
    .int()
    .min(1, 'Benutzerdefiniertes Intervall muss mindestens 1 Tag sein')
    .max(3650, 'Benutzerdefiniertes Intervall darf maximal 3650 Tage sein')
    .nullish(),
  weekdayOverride: WeekdaySchema.nullish(),
});

type BaseInput = z.infer<typeof BaseSchema>;

export const CreateCardSchema = BaseSchema.refine(
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
  (data: BaseInput) => {
    if (data.intervalType !== 'custom') {
      return data.customIntervalDays == null;
    }
    return true;
  },
  {
    message:
      'customIntervalDays darf nur bei intervalType "custom" gesetzt werden',
    path: ['customIntervalDays'],
  },
).refine(
  (data: BaseInput) => {
    if (data.intervalType !== 'weekly') {
      return data.weekdayOverride == null;
    }
    return true;
  },
  {
    message:
      'weekdayOverride darf nur bei intervalType "weekly" gesetzt werden',
    path: ['weekdayOverride'],
  },
);

export class CreateCardDto extends createZodDto(CreateCardSchema) {}
