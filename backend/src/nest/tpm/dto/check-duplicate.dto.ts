/**
 * TPM Check Duplicate DTO
 *
 * Request body for POST /tpm/cards/check-duplicate.
 * Uses planUuid to resolve asset context for duplicate detection.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { TpmIntervalTypeSchema } from './common.dto.js';

export const CheckDuplicateSchema = z.object({
  planUuid: z.uuid({ message: 'Plan-UUID erforderlich' }),
  title: z.string().trim().min(1, 'Titel erforderlich').max(255),
  intervalType: TpmIntervalTypeSchema,
});

export class CheckDuplicateDto extends createZodDto(CheckDuplicateSchema) {}
