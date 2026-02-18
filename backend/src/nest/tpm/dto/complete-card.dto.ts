/**
 * Complete Card DTO
 *
 * Zod schema for marking a TPM card as completed (execution record).
 * Documentation is optional at DTO level — the service enforces
 * mandatory documentation when the card has requires_approval=true.
 *
 * Photo uploads are handled via multipart at the controller level,
 * not through this body DTO.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CompleteCardSchema = z.object({
  documentation: z
    .string()
    .trim()
    .max(10_000, 'Dokumentation darf maximal 10.000 Zeichen lang sein')
    .nullish(),
  customData: z.record(z.string(), z.unknown()).default({}),
});

export class CompleteCardDto extends createZodDto(CompleteCardSchema) {}
