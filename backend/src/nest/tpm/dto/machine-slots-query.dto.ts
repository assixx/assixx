/**
 * TPM Machine Slots Query DTO
 *
 * Query parameters for GET /tpm/plans/available-slots (machine-based, no plan UUID).
 * Used during plan creation before a plan exists.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const MachineSlotsQuerySchema = z.object({
  machineUuid: z.uuid(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate muss im Format YYYY-MM-DD sein'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate muss im Format YYYY-MM-DD sein'),
  shiftPlanRequired: z
    .enum(['true', 'false'])
    .default('true')
    .transform((val: string) => val === 'true'),
});

export class MachineSlotsQueryDto extends createZodDto(
  MachineSlotsQuerySchema,
) {}
