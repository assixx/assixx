/**
 * Audit Trail DTOs - Barrel Export
 */
export {
  DeleteOldEntriesBodyDto,
  DeleteOldEntriesBodySchema,
} from './delete-entries.dto.js';
export type { DeleteOldEntriesResponseData } from './delete-entries.dto.js';
export { EntryIdParamDto, EntryIdParamSchema } from './entry-id-param.dto.js';
export {
  ExportEntriesQueryDto,
  ExportEntriesQuerySchema,
} from './export-entries.dto.js';
export {
  GenerateReportBodyDto,
  GenerateReportBodySchema,
} from './generate-report.dto.js';
export type { ComplianceReportResponseData } from './generate-report.dto.js';
export {
  GetEntriesQueryDto,
  GetEntriesQuerySchema,
} from './get-entries.dto.js';
export type {
  AuditEntryResponse,
  AuditPaginationResponse,
  GetEntriesResponseData,
} from './get-entries.dto.js';
export { GetStatsQueryDto, GetStatsQuerySchema } from './get-stats.dto.js';
export type { AuditStatsResponseData } from './get-stats.dto.js';
