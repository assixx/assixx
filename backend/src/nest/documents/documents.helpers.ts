/**
 * Documents Helpers
 *
 * Pure functions for document mapping, filtering, and query building.
 * No dependency injection — stateless utility functions.
 * DB helpers accept DatabaseService as an explicit parameter.
 */
import { BadRequestException } from '@nestjs/common';

import type { DatabaseService } from '../database/database.service.js';
import type {
  DbDocument,
  DocumentCreateInput,
  DocumentFilters,
  DocumentResponse,
} from './documents.service.js';
import type { ListDocumentsQueryDto } from './dto/query-documents.dto.js';
import type { UpdateDocumentDto } from './dto/update-document.dto.js';

// ============================================
// Constants
// ============================================

const ALLOWED_CATEGORIES = [
  'general',
  'contract',
  'certificate',
  'payroll',
  'training',
  'other',
  'blackboard',
  'chat',
];

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

// ============================================
// Pure Functions
// ============================================

/**
 * Parse tags from JSONB field.
 * Handles both already-parsed arrays and string fallback.
 */
export function parseTags(tags: unknown): string[] {
  if (tags === null || tags === undefined) {
    return [];
  }

  // PostgreSQL JSONB returns already-parsed objects
  if (Array.isArray(tags)) {
    return tags.filter((t: unknown): t is string => typeof t === 'string');
  }

  // Fallback: if somehow it's a string, try to parse
  if (typeof tags === 'string') {
    try {
      const parsed: unknown = JSON.parse(tags);
      if (Array.isArray(parsed)) {
        return parsed.filter((t: unknown): t is string => typeof t === 'string');
      }
      return [];
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Enrich a database document row into an API response.
 * Pure transform — caller must provide isRead status.
 */
export function enrichDocument(doc: DbDocument, isRead: boolean): DocumentResponse {
  const tags = parseTags(doc.tags);

  // Get extension from original_name for storedFilename construction
  const extension =
    doc.original_name !== null && doc.original_name !== '' ?
      doc.original_name.substring(doc.original_name.lastIndexOf('.'))
    : '';

  return {
    id: doc.id,
    tenantId: doc.tenant_id,
    filename: doc.filename, // Display name (custom or original)
    storedFilename:
      doc.file_uuid !== null && doc.file_uuid !== '' ?
        `${doc.file_uuid}${extension}`
      : doc.filename,
    originalName: doc.original_name,
    fileSize: doc.file_size,
    mimeType: doc.mime_type,
    category: doc.category,
    accessScope: doc.access_scope,
    ownerUserId: doc.owner_user_id,
    targetTeamId: doc.target_team_id,
    targetDepartmentId: doc.target_department_id,
    description: doc.description,
    salaryYear: doc.salary_year,
    salaryMonth: doc.salary_month,
    blackboardEntryId: doc.blackboard_entry_id,
    conversationId: doc.conversation_id,
    tags,
    isActive: doc.is_active,
    createdBy: doc.created_by,
    uploaderName: doc.uploaded_by_name ?? 'Unknown',
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
    fileUuid: doc.file_uuid,
    downloadCount: doc.download_count,
    isRead,
    downloadUrl: `/api/v2/documents/${doc.id}/download`,
    previewUrl: `/api/v2/documents/${doc.id}/preview`,
  };
}

/** Build document filters from query parameters */
export function buildDocumentFilters(
  query: ListDocumentsQueryDto,
  isActive: number,
): DocumentFilters {
  return {
    isActive,
    category: query.category,
    accessScope: query.accessScope,
    ownerUserId: query.ownerUserId,
    targetTeamId: query.targetTeamId,
    targetDepartmentId: query.targetDepartmentId,
    salaryYear: query.salaryYear,
    salaryMonth: query.salaryMonth,
    blackboardEntryId: query.blackboardEntryId,
    conversationId: query.conversationId,
    search: query.search,
  };
}

/** Build document update clause from DTO */
export function buildDocumentUpdateClause(dto: UpdateDocumentDto): {
  updates: string[];
  params: unknown[];
  paramIndex: number;
} {
  const updates: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (dto.filename !== undefined) {
    updates.push(`filename = $${paramIndex++}`);
    params.push(dto.filename);
  }
  if (dto.category !== undefined) {
    updates.push(`category = $${paramIndex++}`);
    params.push(dto.category);
  }
  if (dto.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    params.push(dto.description);
  }
  if (dto.tags !== undefined) {
    updates.push(`tags = $${paramIndex++}`);
    params.push(JSON.stringify(dto.tags));
  }

  return { updates, params, paramIndex };
}

/** Validate document input data */
export function validateDocumentInput(data: DocumentCreateInput): void {
  if (!ALLOWED_CATEGORIES.includes(data.category)) {
    throw new BadRequestException('Invalid document category');
  }
  if (!ALLOWED_MIME_TYPES.includes(data.mimeType)) {
    throw new BadRequestException('File type not allowed');
  }
}

// ============================================
// DB Helpers (accept DatabaseService as param)
// ============================================

/** Get document row by ID */
export async function getDocumentRow(
  db: DatabaseService,
  documentId: number,
  tenantId: number,
): Promise<DbDocument | null> {
  const rows = await db.query<DbDocument>(
    `SELECT * FROM documents WHERE id = $1 AND tenant_id = $2`,
    [documentId, tenantId],
  );
  return rows[0] ?? null;
}

/** Insert document record and return its ID */
export async function insertDocumentRecord(
  db: DatabaseService,
  data: DocumentCreateInput,
  userId: number,
  tenantId: number,
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO documents (
      uuid, tenant_id, filename, original_name, file_size, mime_type, category,
      access_scope, owner_user_id, target_team_id, target_department_id,
      description, salary_year, salary_month, blackboard_entry_id, conversation_id,
      tags, created_by, file_uuid, file_checksum, file_path, storage_type, is_active
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
      $17, $18, $19, $20, $21, $22, 1
    ) RETURNING id`,
    [
      data.fileUuid,
      tenantId,
      data.filename,
      data.originalName,
      data.fileSize,
      data.mimeType,
      data.category,
      data.accessScope,
      data.ownerUserId ??
        (data.accessScope === 'personal' || data.accessScope === 'payroll' ? userId : null),
      data.targetTeamId ?? null,
      data.targetDepartmentId ?? null,
      data.description ?? null,
      data.salaryYear ?? null,
      data.salaryMonth ?? null,
      data.blackboardEntryId ?? null,
      data.conversationId ?? null,
      data.tags !== undefined ? JSON.stringify(data.tags) : null,
      userId,
      data.fileUuid ?? null,
      data.fileChecksum ?? null,
      data.filePath ?? null,
      data.storageType ?? 'filesystem',
    ],
  );

  const documentId = result[0]?.id;
  if (documentId === undefined) {
    throw new Error('Failed to create document');
  }
  return documentId;
}

/** Get total count of documents matching query */
export async function getDocumentsCount(
  db: DatabaseService,
  baseQuery: string,
  params: unknown[],
): Promise<number> {
  const countQuery = baseQuery.replace(
    /SELECT d\.\*.*?as uploaded_by_name/,
    'SELECT COUNT(*) as count',
  );
  const countResult = await db.query<{ count: string }>(countQuery, params);
  return Number.parseInt(countResult[0]?.count ?? '0', 10);
}
