/**
 * Documents Controller
 *
 * HTTP endpoints for document management:
 * - GET  /documents           - List documents with filters
 * - GET  /documents/stats     - Get document statistics
 * - GET  /documents/chat-folders - Get chat folders
 * - GET  /documents/:id       - Get document by ID
 * - POST /documents           - Upload/create document
 * - PUT  /documents/:id       - Update document metadata
 * - DELETE /documents/:id     - Delete document (soft delete)
 * - POST /documents/:id/archive - Archive document
 * - POST /documents/:id/unarchive - Unarchive document
 * - GET  /documents/:id/download - Download document
 * - GET  /documents/:id/preview - Preview document inline
 * - POST /documents/:id/read  - Mark document as read
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@webundsoehne/nest-fastify-file-upload';
import type { FastifyReply } from 'fastify';
import multer from 'fastify-multer';
import crypto from 'node:crypto';
import * as path from 'node:path';
import { v7 as uuidv7 } from 'uuid';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequireAddon } from '../common/decorators/require-addon.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import type { MulterFile } from '../common/interfaces/multer.interface.js';
import { DocumentsService } from './documents.service.js';
import type {
  ChatFolderResponse,
  DocumentContentResponse,
  DocumentCreateInput,
  DocumentResponse,
  DocumentStatsResponse,
  PaginatedDocumentsResult,
  UnreadCountResponse,
} from './documents.service.js';
import { ListDocumentsQueryDto } from './dto/query-documents.dto.js';
import { UpdateDocumentDto } from './dto/update-document.dto.js';

const { memoryStorage } = multer;

/**
 * Multer options for document uploads
 */
const documentUploadOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
};

/** Valid document categories */
const VALID_CATEGORIES = ['general', 'personal', 'work', 'training', 'hr', 'salary', 'blackboard'];

/** Valid access scopes */
type AccessScope =
  | 'personal'
  | 'company'
  | 'department'
  | 'team'
  | 'payroll'
  | 'blackboard'
  | 'chat';

/** Build storage path for document */
function buildStoragePath(tenantId: number, fileUuid: string, extension: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return path.join(
    'uploads',
    'documents',
    tenantId.toString(),
    year.toString(),
    month,
    `${fileUuid}${extension}`,
  );
}

/** Parse tags JSON array from request body */
function parseTags(tagsJson: string): string[] {
  const parsed: unknown = JSON.parse(tagsJson);
  return Array.isArray(parsed) ?
      parsed.filter((t: unknown): t is string => typeof t === 'string')
    : [];
}

/** Build document create input from file and body */
function buildDocumentCreateInput(
  file: MulterFile,
  body: Record<string, string>,
  tenantId: number,
): DocumentCreateInput {
  const fileUuid = uuidv7();
  const extension = path.extname(file.originalname).toLowerCase();
  const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

  const category = body['category'] ?? 'general';
  const finalCategory = VALID_CATEGORIES.includes(category) ? category : 'general';

  const trimmedDocName = body['documentName']?.trim();
  const displayName =
    trimmedDocName !== undefined && trimmedDocName !== '' ? trimmedDocName : file.originalname;

  return {
    filename: displayName,
    originalName: file.originalname,
    fileSize: file.size,
    fileContent: file.buffer,
    mimeType: file.mimetype,
    category: finalCategory,
    description: body['description'] ?? '',
    accessScope: (body['accessScope'] ?? 'personal') as AccessScope,
    fileUuid,
    fileChecksum: checksum,
    filePath: buildStoragePath(tenantId, fileUuid, extension),
    storageType: 'filesystem',
    ...(body['tags'] !== undefined && { tags: parseTags(body['tags']) }),
    ...(body['ownerUserId'] !== undefined && {
      ownerUserId: Number.parseInt(body['ownerUserId'], 10),
    }),
    ...(body['targetTeamId'] !== undefined && {
      targetTeamId: Number.parseInt(body['targetTeamId'], 10),
    }),
    ...(body['targetDepartmentId'] !== undefined && {
      targetDepartmentId: Number.parseInt(body['targetDepartmentId'], 10),
    }),
    ...(body['salaryYear'] !== undefined && {
      salaryYear: Number.parseInt(body['salaryYear'], 10),
    }),
    ...(body['salaryMonth'] !== undefined && {
      salaryMonth: Number.parseInt(body['salaryMonth'], 10),
    }),
  };
}

/**
 * Response type for message-only responses
 */
interface MessageResponse {
  message: string;
}

/**
 * Response type for success-only responses
 */
interface SuccessResponse {
  success: boolean;
}

/**
 * Response type for chat folders
 */
interface ChatFoldersResponse {
  folders: ChatFolderResponse[];
  total: number;
}

/** Permission constants for \@RequirePermission decorator */
const DOC_FEATURE = 'documents';
const DOC_FILES = 'documents-files';
const DOC_ARCHIVE = 'documents-archive';

@Controller('documents')
@RequireAddon('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /** GET /documents */
  @Get()
  @RequirePermission(DOC_FEATURE, DOC_FILES, 'canRead')
  async listDocuments(
    @Query() query: ListDocumentsQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<PaginatedDocumentsResult> {
    return await this.documentsService.listDocuments(tenantId, user.id, query);
  }

  /** GET /documents/stats */
  @Get('stats')
  @RequirePermission(DOC_FEATURE, DOC_FILES, 'canRead')
  async getDocumentStats(
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<DocumentStatsResponse> {
    return await this.documentsService.getDocumentStats(tenantId, user.id);
  }

  /** GET /documents/unread-count */
  @Get('unread-count')
  @RequirePermission(DOC_FEATURE, DOC_FILES, 'canRead')
  async getUnreadCount(
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<UnreadCountResponse> {
    return await this.documentsService.getUnreadCount(tenantId, user.id, user.activeRole);
  }

  /** GET /documents/chat-folders */
  @Get('chat-folders')
  @RequirePermission(DOC_FEATURE, DOC_FILES, 'canRead')
  async getChatFolders(
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<ChatFoldersResponse> {
    return await this.documentsService.getChatFolders(tenantId, user.id);
  }

  /**
   * GET /documents/uuid/:uuid
   * Get document by UUID (preferred)
   */
  @Get('uuid/:uuid')
  @RequirePermission(DOC_FEATURE, DOC_FILES, 'canRead')
  async getDocumentByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<DocumentResponse> {
    return await this.documentsService.getDocumentByUuid(uuid, tenantId, user.id);
  }

  /**
   * GET /documents/:id
   * Get document by ID
   * @deprecated Use GET /documents/uuid/:uuid instead
   */
  @Get(':id')
  @RequirePermission(DOC_FEATURE, DOC_FILES, 'canRead')
  async getDocumentById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<DocumentResponse> {
    return await this.documentsService.getDocumentById(id, tenantId, user.id);
  }

  /**
   * POST /documents
   * Upload/create a new document
   */
  @Post()
  @RequirePermission(DOC_FEATURE, DOC_FILES, 'canWrite')
  @UseInterceptors(FileInterceptor('document', documentUploadOptions))
  @HttpCode(HttpStatus.CREATED)
  async createDocument(
    @UploadedFile() file: MulterFile | undefined,
    @Body() body: Record<string, string>,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<DocumentResponse> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const documentData = buildDocumentCreateInput(file, body, tenantId);

    return await this.documentsService.createDocument(documentData, user.id, tenantId);
  }

  /**
   * PUT /documents/uuid/:uuid
   * Update document by UUID (preferred)
   */
  @Put('uuid/:uuid')
  @RequirePermission(DOC_FEATURE, DOC_FILES, 'canWrite')
  async updateDocumentByUuid(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.documentsService.updateDocumentByUuid(uuid, dto, tenantId, user.id);
  }

  /**
   * PUT /documents/:id
   * Update document metadata
   * @deprecated Use PUT /documents/uuid/:uuid instead
   */
  @Put(':id')
  @RequirePermission(DOC_FEATURE, DOC_FILES, 'canWrite')
  async updateDocument(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.documentsService.updateDocument(id, dto, tenantId, user.id);
  }

  /**
   * DELETE /documents/uuid/:uuid
   * Delete document by UUID (preferred)
   */
  @Delete('uuid/:uuid')
  @RequirePermission(DOC_FEATURE, DOC_FILES, 'canDelete')
  async deleteDocumentByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.documentsService.deleteDocumentByUuid(uuid, tenantId, user.id);
  }

  /**
   * DELETE /documents/:id
   * Delete document (soft delete)
   * @deprecated Use DELETE /documents/uuid/:uuid instead
   */
  @Delete(':id')
  @RequirePermission(DOC_FEATURE, DOC_FILES, 'canDelete')
  async deleteDocument(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.documentsService.deleteDocument(id, tenantId, user.id);
  }

  /**
   * POST /documents/uuid/:uuid/archive
   * Archive document by UUID (preferred)
   */
  @Post('uuid/:uuid/archive')
  @RequirePermission(DOC_FEATURE, DOC_ARCHIVE, 'canWrite')
  async archiveDocumentByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.documentsService.archiveDocumentByUuid(uuid, tenantId, user.id);
  }

  /**
   * POST /documents/:id/archive
   * Archive a document
   * @deprecated Use POST /documents/uuid/:uuid/archive instead
   */
  @Post(':id/archive')
  @RequirePermission(DOC_FEATURE, DOC_ARCHIVE, 'canWrite')
  async archiveDocument(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.documentsService.archiveDocument(id, tenantId, user.id);
  }

  /**
   * POST /documents/uuid/:uuid/unarchive
   * Unarchive document by UUID (preferred)
   */
  @Post('uuid/:uuid/unarchive')
  @RequirePermission(DOC_FEATURE, DOC_ARCHIVE, 'canWrite')
  async unarchiveDocumentByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.documentsService.unarchiveDocumentByUuid(uuid, tenantId, user.id);
  }

  /**
   * POST /documents/:id/unarchive
   * Unarchive a document
   * @deprecated Use POST /documents/uuid/:uuid/unarchive instead
   */
  @Post(':id/unarchive')
  @RequirePermission(DOC_FEATURE, DOC_ARCHIVE, 'canWrite')
  async unarchiveDocument(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.documentsService.unarchiveDocument(id, tenantId, user.id);
  }

  /**
   * GET /documents/uuid/:uuid/download
   * Download document by UUID (preferred)
   */
  @Get('uuid/:uuid/download')
  @RequirePermission(DOC_FEATURE, DOC_FILES, 'canRead')
  async downloadDocumentByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const content: DocumentContentResponse = await this.documentsService.getDocumentContentByUuid(
      uuid,
      tenantId,
      user.id,
    );

    await reply
      .header('Content-Type', content.mimeType)
      .header('Content-Disposition', `attachment; filename="${content.originalName}"`)
      .header('Content-Length', content.fileSize.toString())
      .header('Cache-Control', 'private, max-age=3600')
      .send(content.content);
  }

  /**
   * GET /documents/:id/download
   * Download document as attachment
   * @deprecated Use GET /documents/uuid/:uuid/download instead
   */
  @Get(':id/download')
  @RequirePermission(DOC_FEATURE, DOC_FILES, 'canRead')
  async downloadDocument(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const content = await this.documentsService.getDocumentContent(id, tenantId, user.id);

    await reply
      .header('Content-Type', content.mimeType)
      .header('Content-Disposition', `attachment; filename="${content.originalName}"`)
      .header('Content-Length', content.fileSize.toString())
      .header('Cache-Control', 'private, max-age=3600')
      .send(content.content);
  }

  /**
   * GET /documents/uuid/:uuid/preview
   * Preview document by UUID (preferred)
   */
  @Get('uuid/:uuid/preview')
  @RequirePermission(DOC_FEATURE, DOC_FILES, 'canRead')
  async previewDocumentByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const content: DocumentContentResponse = await this.documentsService.getDocumentContentByUuid(
      uuid,
      tenantId,
      user.id,
    );

    // Mark as read (non-blocking)
    void this.documentsService.markDocumentAsReadByUuid(uuid, tenantId, user.id);

    await reply
      .header('Content-Type', content.mimeType)
      .header('Content-Disposition', `inline; filename="${content.originalName}"`)
      .header('Content-Length', content.fileSize.toString())
      .header('Accept-Ranges', 'bytes')
      .header('Cache-Control', 'private, max-age=3600')
      .send(content.content);
  }

  /**
   * GET /documents/:id/preview
   * Preview document inline
   * @deprecated Use GET /documents/uuid/:uuid/preview instead
   */
  @Get(':id/preview')
  @RequirePermission(DOC_FEATURE, DOC_FILES, 'canRead')
  async previewDocument(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const content = await this.documentsService.getDocumentContent(id, tenantId, user.id);

    // Mark as read (non-blocking)
    void this.documentsService.markDocumentAsRead(id, tenantId, user.id);

    await reply
      .header('Content-Type', content.mimeType)
      .header('Content-Disposition', `inline; filename="${content.originalName}"`)
      .header('Content-Length', content.fileSize.toString())
      .header('Accept-Ranges', 'bytes')
      .header('Cache-Control', 'private, max-age=3600')
      .send(content.content);
  }

  /**
   * POST /documents/uuid/:uuid/read
   * Mark document as read by UUID (preferred)
   */
  @Post('uuid/:uuid/read')
  @RequirePermission(DOC_FEATURE, DOC_FILES, 'canRead')
  async markDocumentAsReadByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<SuccessResponse> {
    return await this.documentsService.markDocumentAsReadByUuid(uuid, tenantId, user.id);
  }

  /**
   * POST /documents/:id/read
   * Mark document as read
   * @deprecated Use POST /documents/uuid/:uuid/read instead
   */
  @Post(':id/read')
  @RequirePermission(DOC_FEATURE, DOC_FILES, 'canRead')
  async markDocumentAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<SuccessResponse> {
    return await this.documentsService.markDocumentAsRead(id, tenantId, user.id);
  }
}
