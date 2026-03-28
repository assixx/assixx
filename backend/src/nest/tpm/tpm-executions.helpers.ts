/**
 * TPM Executions Helpers — Pure functions for mapping
 *
 * Stateless helper functions. No DI, no DB calls, no side effects.
 * Follows tpm-plans.helpers.ts / tpm-cards.helpers.ts pattern.
 */
import { toIsoString, toIsoStringOrNull } from '../../utils/db-helpers.js';
import type {
  TpmCardExecution,
  TpmCardExecutionPhotoRow,
  TpmCardExecutionRow,
  TpmDefectPhoto,
  TpmDefectPhotoRow,
  TpmExecutionDefect,
  TpmExecutionDefectRow,
  TpmExecutionParticipant,
  TpmExecutionPhoto,
} from './tpm.types.js';

/** Extended row type including JOIN columns from related tables */
export interface TpmExecutionJoinRow extends TpmCardExecutionRow {
  card_uuid?: string;
  executed_by_name?: string;
  approved_by_name?: string;
  photo_count?: number;
  defect_count?: number;
  participants?: TpmExecutionParticipant[];
}

/** Map execution DB row to API response */
export function mapExecutionRowToApi(row: TpmExecutionJoinRow): TpmCardExecution {
  const execution: TpmCardExecution = {
    uuid: row.uuid.trim(),
    executedBy: row.executed_by,
    executionDate: toIsoString(row.execution_date),
    documentation: row.documentation,
    noIssuesFound: row.no_issues_found,
    actualDurationMinutes: row.actual_duration_minutes,
    actualStaffCount: row.actual_staff_count,
    approvalStatus: row.approval_status,
    approvedBy: row.approved_by,
    approvedAt: toIsoStringOrNull(row.approved_at),
    approvalNote: row.approval_note,
    customData: row.custom_data,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };

  if (row.card_uuid !== undefined) execution.cardUuid = row.card_uuid.trim();
  if (row.executed_by_name !== undefined) execution.executedByName = row.executed_by_name;
  if (row.approved_by_name !== undefined) execution.approvedByName = row.approved_by_name;
  if (row.photo_count !== undefined) execution.photoCount = row.photo_count;
  if (row.defect_count !== undefined) execution.defectCount = row.defect_count;
  if (row.participants !== undefined && Array.isArray(row.participants)) {
    execution.participants = row.participants;
  }

  return execution;
}

/** Map defect DB row to API response */
export function mapDefectRowToApi(row: TpmExecutionDefectRow): TpmExecutionDefect {
  return {
    uuid: row.uuid.trim(),
    title: row.title,
    description: row.description,
    positionNumber: row.position_number,
    createdAt: toIsoString(row.created_at),
  };
}

/** Shared shape for all photo DB rows (execution photos + defect photos) */
interface PhotoRowShape {
  uuid: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  sort_order: number;
  created_at: string;
}

/** Shared shape for all photo API responses */
interface PhotoApiShape {
  uuid: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sortOrder: number;
  createdAt: string;
}

/** Generic photo row → API mapper (shared by execution photos + defect photos) */
function mapPhotoRow(row: PhotoRowShape): PhotoApiShape {
  return {
    uuid: row.uuid.trim(),
    filePath: row.file_path,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    sortOrder: row.sort_order,
    createdAt: toIsoString(row.created_at),
  };
}

/** Map execution photo DB row to API response */
export function mapPhotoRowToApi(row: TpmCardExecutionPhotoRow): TpmExecutionPhoto {
  return mapPhotoRow(row);
}

/** Map defect photo DB row to API response */
export function mapDefectPhotoRowToApi(row: TpmDefectPhotoRow): TpmDefectPhoto {
  return mapPhotoRow(row);
}
