/**
 * TPM Defect Stats Query DTO
 *
 * Query parameters for GET /tpm/plans/:uuid/defect-stats.
 * Accepts optional year (defaults to current year).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const DefectStatsQuerySchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(2020, 'Jahr muss mindestens 2020 sein')
    .max(2099, 'Jahr darf maximal 2099 sein')
    .default(new Date().getFullYear()),
});

export class DefectStatsQueryDto extends createZodDto(DefectStatsQuerySchema) {}
