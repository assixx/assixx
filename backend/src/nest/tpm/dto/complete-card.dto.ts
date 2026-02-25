/**
 * Complete Card DTO
 *
 * Zod schema for marking a TPM card as completed (execution record).
 * Documentation is optional when noIssuesFound=true. When noIssuesFound=false,
 * the service enforces mandatory documentation (something noteworthy happened).
 *
 * Photo uploads are handled via multipart at the controller level,
 * not through this body DTO.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CompleteCardSchema = z.object({
  executionDate: z.iso
    .date({
      error: 'Ausführungsdatum muss ein gültiges Datum sein (YYYY-MM-DD)',
    })
    .optional(),
  noIssuesFound: z.boolean().default(false),
  actualDurationMinutes: z
    .number()
    .int('Dauer muss eine ganze Zahl sein')
    .min(1, 'Dauer muss mindestens 1 Minute sein')
    .max(1440, 'Dauer darf maximal 1440 Minuten (24h) sein')
    .nullish(),
  actualStaffCount: z
    .number()
    .int('MA-Anzahl muss eine ganze Zahl sein')
    .min(1, 'Mindestens 1 Mitarbeiter')
    .max(50, 'Maximal 50 Mitarbeiter')
    .nullish(),
  documentation: z
    .string()
    .trim()
    .max(10_000, 'Dokumentation darf maximal 10.000 Zeichen lang sein')
    .nullish(),
  customData: z.record(z.string(), z.unknown()).default({}),
  participantUuids: z
    .array(z.uuid())
    .max(10, 'Maximal 10 Teilnehmer')
    .optional()
    .default([]),
});

export class CompleteCardDto extends createZodDto(CompleteCardSchema) {}
