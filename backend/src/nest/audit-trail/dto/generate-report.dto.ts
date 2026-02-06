/**
 * Generate Report DTO
 *
 * Request body for generating compliance reports.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DateSchema } from '../../../schemas/common.schema.js';
import type { AuditEntryResponse } from './get-entries.dto.js';

/**
 * Report type enum for compliance reports
 */
const ReportTypeSchema = z.enum(
  ['gdpr', 'data_access', 'data_changes', 'user_activity'],
  {
    message: 'Invalid report type',
  },
);

/**
 * Generate compliance report request body schema
 */
export const GenerateReportBodySchema = z
  .object({
    reportType: ReportTypeSchema,
    dateFrom: DateSchema,
    dateTo: DateSchema,
  })
  .refine(
    (data: { reportType: string; dateFrom: string; dateTo: string }) => {
      const dateFrom = new Date(data.dateFrom);
      const dateTo = new Date(data.dateTo);
      return dateTo >= dateFrom;
    },
    {
      message: 'Date to must be after date from',
      path: ['dateTo'],
    },
  )
  .refine(
    (data: { reportType: string; dateFrom: string; dateTo: string }) => {
      const dateFrom = new Date(data.dateFrom);
      const dateTo = new Date(data.dateTo);
      const maxDate = new Date(dateFrom);
      maxDate.setFullYear(maxDate.getFullYear() + 1);
      return dateTo <= maxDate;
    },
    {
      message: 'Date range cannot exceed 1 year',
      path: ['dateTo'],
    },
  );

/**
 * DTO for generate report request body
 */
export class GenerateReportBodyDto extends createZodDto(
  GenerateReportBodySchema,
) {}

/**
 * Compliance report response type
 */
export interface ComplianceReportResponseData {
  tenantId: number;
  reportType: 'gdpr' | 'data_access' | 'data_changes' | 'user_activity';
  dateFrom: string;
  dateTo: string;
  entries: AuditEntryResponse[];
  summary: {
    totalActions: number;
    uniqueUsers: number;
    dataAccessCount: number;
    dataModificationCount: number;
    dataDeletionCount: number;
  };
  generatedAt: string;
  generatedBy: number;
}
