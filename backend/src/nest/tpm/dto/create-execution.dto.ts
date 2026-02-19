/**
 * Create Execution DTO
 *
 * Zod schema for creating a TPM card execution (marking a card as done).
 * Combines cardUuid with completion data. Documentation is optional
 * at DTO level — the service enforces mandatory docs when requires_approval=true.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateExecutionSchema = z.object({
  cardUuid: z.uuid(),
  documentation: z
    .string()
    .trim()
    .max(10_000, 'Dokumentation darf maximal 10.000 Zeichen lang sein')
    .nullish(),
  customData: z.record(z.string(), z.unknown()).default({}),
});

export class CreateExecutionDto extends createZodDto(CreateExecutionSchema) {}
