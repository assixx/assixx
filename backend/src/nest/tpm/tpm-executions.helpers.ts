/**
 * TPM Executions Helpers — Pure functions for mapping
 *
 * Stateless helper functions. No DI, no DB calls, no side effects.
 * Follows tpm-plans.helpers.ts / tpm-cards.helpers.ts pattern.
 */
import type {
  TpmCardExecution,
  TpmCardExecutionPhotoRow,
  TpmCardExecutionRow,
  TpmExecutionPhoto,
} from './tpm.types.js';

/** Extended row type including JOIN columns from related tables */
export interface TpmExecutionJoinRow extends TpmCardExecutionRow {
  card_uuid?: string;
  executed_by_name?: string;
  approved_by_name?: string;
  photo_count?: number;
}

/** Map execution DB row to API response */
export function mapExecutionRowToApi(
  row: TpmExecutionJoinRow,
): TpmCardExecution {
  const execution: TpmCardExecution = {
    uuid: row.uuid.trim(),
    executedBy: row.executed_by,
    executionDate:
      typeof row.execution_date === 'string' ?
        row.execution_date
      : new Date(row.execution_date).toISOString(),
    documentation: row.documentation,
    noIssuesFound: row.no_issues_found,
    actualDurationMinutes: row.actual_duration_minutes,
    actualStaffCount: row.actual_staff_count,
    approvalStatus: row.approval_status,
    approvedBy: row.approved_by,
    approvedAt:
      row.approved_at === null ? null
      : typeof row.approved_at === 'string' ? row.approved_at
      : new Date(row.approved_at).toISOString(),
    approvalNote: row.approval_note,
    customData: row.custom_data,
    createdAt:
      typeof row.created_at === 'string' ?
        row.created_at
      : new Date(row.created_at).toISOString(),
    updatedAt:
      typeof row.updated_at === 'string' ?
        row.updated_at
      : new Date(row.updated_at).toISOString(),
  };

  if (row.card_uuid !== undefined) execution.cardUuid = row.card_uuid.trim();
  if (row.executed_by_name !== undefined)
    execution.executedByName = row.executed_by_name;
  if (row.approved_by_name !== undefined)
    execution.approvedByName = row.approved_by_name;
  if (row.photo_count !== undefined) execution.photoCount = row.photo_count;

  return execution;
}

/** Map photo DB row to API response */
export function mapPhotoRowToApi(
  row: TpmCardExecutionPhotoRow,
): TpmExecutionPhoto {
  return {
    uuid: row.uuid.trim(),
    filePath: row.file_path,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    sortOrder: row.sort_order,
    createdAt:
      typeof row.created_at === 'string' ?
        row.created_at
      : new Date(row.created_at).toISOString(),
  };
}
