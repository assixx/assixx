/**
 * Schedule Projection Query DTO
 *
 * Query parameters for GET /tpm/plans/schedule-projection.
 * Projects all active plans' maintenance dates into the future
 * for cross-plan conflict detection.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const ScheduleProjectionQuerySchema = z
  .object({
    startDate: z
      .string()
      .regex(DATE_REGEX, 'startDate muss im Format YYYY-MM-DD sein'),
    endDate: z
      .string()
      .regex(DATE_REGEX, 'endDate muss im Format YYYY-MM-DD sein'),
    excludePlanUuid: z.uuid('Ungültige Plan-UUID').optional(),
  })
  .refine(
    (data: { startDate: string; endDate: string }) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const diffDays =
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 365;
    },
    {
      message: 'Datumsbereich muss 0–365 Tage umfassen (endDate >= startDate)',
      path: ['endDate'],
    },
  );

export class ScheduleProjectionQueryDto extends createZodDto(
  ScheduleProjectionQuerySchema,
) {}
