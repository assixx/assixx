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
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { DocumentsService } from './documents.service.js';
import type {
  ChatFolderResponse,
  DocumentResponse,
  DocumentStatsResponse,
  PaginatedDocumentsResult,
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

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * GET /documents
   * List documents with filters and pagination
   */
  @Get()
  async listDocuments(
    @Query() query: ListDocumentsQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<PaginatedDocumentsResult> {
    return await this.documentsService.listDocuments(tenantId, user.id, query);
  }

  /**
   * GET /documents/stats
   * Get document statistics
   */
  @Get('stats')
  async getDocumentStats(
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<DocumentStatsResponse> {
    return await this.documentsService.getDocumentStats(tenantId, user.id);
  }

  /**
   * GET /documents/chat-folders
   * Get chat folders for document explorer
   */
  @Get('chat-folders')
  async getChatFolders(
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<ChatFoldersResponse> {
    return await this.documentsService.getChatFolders(tenantId, user.id);
  }

  /**
   * GET /documents/:id
   * Get document by ID
   */
  @Get(':id')
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
  @UseInterceptors(FileInterceptor('document', documentUploadOptions))
  @HttpCode(HttpStatus.CREATED)
  async createDocument(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Record<string, string>,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<DocumentResponse> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const fileUuid = uuidv7();
    const extension = path.extname(file.originalname).toLowerCase();
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const category = body['category'] ?? 'general';
    const finalCategory = VALID_CATEGORIES.includes(category) ? category : 'general';

    // Use custom document name if provided, otherwise use original filename
    const displayName = body['documentName']?.trim() || file.originalname;

    const documentData = {
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
      storageType: 'filesystem' as const,
      // Parse tags if provided (JSON array)
      ...(body['tags'] !== undefined && {
        tags: JSON.parse(body['tags']),
      }),
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

    return await this.documentsService.createDocument(documentData, user.id, tenantId);
  }

  /**
   * PUT /documents/:id
   * Update document metadata
   */
  @Put(':id')
  async updateDocument(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.documentsService.updateDocument(id, dto, tenantId, user.id);
  }

  /**
   * DELETE /documents/:id
   * Delete document (soft delete)
   */
  @Delete(':id')
  async deleteDocument(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.documentsService.deleteDocument(id, tenantId, user.id);
  }

  /**
   * POST /documents/:id/archive
   * Archive a document
   */
  @Post(':id/archive')
  async archiveDocument(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.documentsService.archiveDocument(id, tenantId, user.id);
  }

  /**
   * POST /documents/:id/unarchive
   * Unarchive a document
   */
  @Post(':id/unarchive')
  async unarchiveDocument(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.documentsService.unarchiveDocument(id, tenantId, user.id);
  }

  /**
   * GET /documents/:id/download
   * Download document as attachment
   */
  @Get(':id/download')
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
   * GET /documents/:id/preview
   * Preview document inline
   */
  @Get(':id/preview')
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
   * POST /documents/:id/read
   * Mark document as read
   */
  @Post(':id/read')
  async markDocumentAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<SuccessResponse> {
    return await this.documentsService.markDocumentAsRead(id, tenantId, user.id);
  }
}
