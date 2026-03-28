/**
 * Report Shared Schemas
 */
import { z } from 'zod';

export const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');
export const IdSchema = z.coerce.number().int().positive();

export const ReportTypeSchema = z.enum(['overview', 'employees', 'departments', 'shifts', 'kvp'], {
  message: 'Invalid report type',
});

export const ExportFormatSchema = z.enum(['csv'], {
  message: 'Format must be csv',
});
