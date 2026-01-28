/**
 * Attendance/Compliance Report Query DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DateSchema, IdSchema } from './report.schemas.js';

const AttendanceReportBaseSchema = z.object({
  dateFrom: DateSchema,
  dateTo: DateSchema,
  departmentId: IdSchema.optional(),
  teamId: IdSchema.optional(),
});

export const AttendanceReportQuerySchema = AttendanceReportBaseSchema.refine(
  (data: z.infer<typeof AttendanceReportBaseSchema>) => {
    const dateFrom = new Date(data.dateFrom);
    const dateTo = new Date(data.dateTo);
    return dateTo >= dateFrom;
  },
  {
    message: 'dateTo must be after dateFrom',
    path: ['dateTo'],
  },
).refine(
  (data: z.infer<typeof AttendanceReportBaseSchema>) => {
    const dateFrom = new Date(data.dateFrom);
    const dateTo = new Date(data.dateTo);
    const daysDiff =
      (dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 90;
  },
  {
    message: 'Date range cannot exceed 90 days',
    path: ['dateTo'],
  },
);

export class AttendanceReportQueryDto extends createZodDto(
  AttendanceReportQuerySchema,
) {}
