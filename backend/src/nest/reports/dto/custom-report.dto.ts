/**
 * Custom Report DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');
const IdSchema = z.coerce.number().int().positive();

const MetricSchema = z.enum(
  ['employees', 'departments', 'shifts', 'kvp', 'attendance', 'compliance'],
  { message: 'Invalid metric selected' },
);

const GroupBySchema = z.enum(['department', 'team', 'week', 'month'], {
  message: 'Invalid groupBy value',
});

const CustomReportBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must not exceed 100 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters')
    .optional(),
  metrics: z.array(MetricSchema).min(1, 'At least one metric must be selected'),
  dateFrom: DateSchema,
  dateTo: DateSchema,
  filters: z
    .object({
      departmentIds: z.array(IdSchema).optional(),
      teamIds: z.array(IdSchema).optional(),
    })
    .optional(),
  groupBy: GroupBySchema.optional(),
});

export const CustomReportBodySchema = CustomReportBaseSchema.refine(
  (data: z.infer<typeof CustomReportBaseSchema>) => {
    const dateFrom = new Date(data.dateFrom);
    const dateTo = new Date(data.dateTo);
    return dateTo >= dateFrom;
  },
  {
    message: 'dateTo must be after dateFrom',
    path: ['dateTo'],
  },
);

export class CustomReportDto extends createZodDto(CustomReportBodySchema) {}
