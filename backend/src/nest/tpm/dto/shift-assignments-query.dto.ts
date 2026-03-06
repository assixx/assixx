/**
 * Shift Assignments Query DTO
 *
 * Query parameters for GET /tpm/plans/shift-assignments.
 * Fetches employees assigned to TPM maintenance via shift plans
 * where is_tpm_mode = true.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const ShiftAssignmentsQuerySchema = z
  .object({
    startDate: z
      .string()
      .regex(DATE_REGEX, 'startDate muss im Format YYYY-MM-DD sein'),
    endDate: z
      .string()
      .regex(DATE_REGEX, 'endDate muss im Format YYYY-MM-DD sein'),
  })
  .refine(
    (data: { startDate: string; endDate: string }) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const diffDays =
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 3650;
    },
    {
      message: 'Datumsbereich muss 0–3650 Tage umfassen (endDate >= startDate)',
      path: ['endDate'],
    },
  );

export class ShiftAssignmentsQueryDto extends createZodDto(
  ShiftAssignmentsQuerySchema,
) {}
