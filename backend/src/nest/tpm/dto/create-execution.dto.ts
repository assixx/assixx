/**
 * Create Execution DTO
 *
 * Zod schema for creating a TPM card execution (marking a card as done).
 * Combines cardUuid with completion data. Documentation is optional
 * when noIssuesFound=true — the service enforces mandatory docs when
 * requires_approval=true AND noIssuesFound=false.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateExecutionSchema = z.object({
  cardUuid: z.uuid(),
  executionDate: z
    .iso.date({ error: 'Ausführungsdatum muss ein gültiges Datum sein (YYYY-MM-DD)' })
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
});

export class CreateExecutionDto extends createZodDto(CreateExecutionSchema) {}
