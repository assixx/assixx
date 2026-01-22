/**
 * KVP Controller
 *
 * HTTP endpoints for Continuous Improvement Process (KVP) management:
 * - GET    /kvp/categories        - Get categories
 * - GET    /kvp/dashboard/stats   - Get dashboard statistics
 * - GET    /kvp                   - List suggestions with filters
 * - GET    /kvp/:id               - Get suggestion by ID
 * - POST   /kvp                   - Create suggestion
 * - PUT    /kvp/:id               - Update suggestion
 * - DELETE /kvp/:id               - Delete suggestion
 * - PUT    /kvp/:id/share         - Share suggestion
 * - POST   /kvp/:id/unshare       - Unshare suggestion
 * - GET    /kvp/:id/comments      - Get comments
 * - POST   /kvp/:id/comments      - Add comment
 * - GET    /kvp/:id/attachments   - Get attachments
 * - POST   /kvp/:id/attachments   - Upload attachments
 * - GET    /kvp/attachments/:fileUuid/download - Download attachment
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
  Post,
  Put,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@webundsoehne/nest-fastify-file-upload';
import type { FastifyReply } from 'fastify';
import multer from 'fastify-multer';
import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { v7 as uuidv7 } from 'uuid';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import type { MulterFile } from '../common/interfaces/multer.interface.js';
import {
  AddCommentDto,
  CreateSuggestionDto,
  ListSuggestionsQueryDto,
  ShareSuggestionDto,
  UpdateSuggestionDto,
} from './dto/index.js';
import type {
  Category,
  DashboardStats,
  KVPAttachment,
  KVPComment,
  KVPSuggestionResponse,
  PaginatedSuggestionsResult,
} from './kvp.service.js';
import { KvpService } from './kvp.service.js';

const { memoryStorage } = multer;

/**
 * Multer options for KVP attachments
 */
const kvpAttachmentOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5, // Max 5 files
  },
};

/**
 * Response type for message-only responses
 */
interface MessageResponse {
  message: string;
}

@Controller('kvp')
export class KvpController {
  constructor(private readonly kvpService: KvpService) {}

  /**
   * GET /kvp/categories
   * Get KVP categories for the tenant
   */
  @Get('categories')
  async getCategories(@TenantId() tenantId: number): Promise<Category[]> {
    return await this.kvpService.getCategories(tenantId);
  }

  /**
   * GET /kvp/dashboard/stats
   * Get dashboard statistics
   */
  @Get('dashboard/stats')
  async getDashboardStats(@TenantId() tenantId: number): Promise<DashboardStats> {
    return await this.kvpService.getDashboardStats(tenantId);
  }

  /**
   * GET /kvp
   * List suggestions with filters and pagination
   */
  @Get()
  async listSuggestions(
    @Query() query: ListSuggestionsQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<PaginatedSuggestionsResult> {
    return await this.kvpService.listSuggestions(tenantId, user.id, user.role, {
      status: query.status,
      categoryId: query.categoryId,
      priority: query.priority,
      orgLevel: query.orgLevel,
      search: query.search,
      page: query.page,
      limit: query.limit,
      mineOnly: query.mineOnly,
    });
  }

  /**
   * GET /kvp/:id
   * Get suggestion by ID (numeric or UUID)
   */
  @Get(':id')
  async getSuggestionById(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<KVPSuggestionResponse> {
    const suggestionId = this.parseIdParam(id);
    return await this.kvpService.getSuggestionById(suggestionId, tenantId, user.id, user.role);
  }

  /**
   * POST /kvp
   * Create a new suggestion
   * Rate limit: Employees can create max 1 KVP per day
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSuggestion(
    @Body() dto: CreateSuggestionDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<KVPSuggestionResponse> {
    return await this.kvpService.createSuggestion(dto, tenantId, user.id, user.role);
  }

  /**
   * PUT /kvp/:id
   * Update a suggestion
   */
  @Put(':id')
  async updateSuggestion(
    @Param('id') id: string,
    @Body() dto: UpdateSuggestionDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<KVPSuggestionResponse> {
    const suggestionId = this.parseIdParam(id);
    return await this.kvpService.updateSuggestion(suggestionId, dto, tenantId, user.id, user.role);
  }

  /**
   * DELETE /kvp/:id
   * Delete a suggestion
   */
  @Delete(':id')
  async deleteSuggestion(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    const suggestionId = this.parseIdParam(id);
    return await this.kvpService.deleteSuggestion(suggestionId, tenantId, user.id, user.role);
  }

  /**
   * PUT /kvp/:id/share
   * Share a suggestion at organization level (admin/root only)
   */
  @Put(':id/share')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  async shareSuggestion(
    @Param('id') id: string,
    @Body() dto: ShareSuggestionDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    const suggestionId = this.parseIdParam(id);
    return await this.kvpService.shareSuggestion(suggestionId, dto, tenantId, user.id, user.role);
  }

  /**
   * POST /kvp/:id/unshare
   * Unshare a suggestion (admin/root only)
   */
  @Post(':id/unshare')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  async unshareSuggestion(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    const suggestionId = this.parseIdParam(id);
    return await this.kvpService.unshareSuggestion(suggestionId, tenantId, user.id, user.role);
  }

  /**
   * GET /kvp/:id/comments
   * Get comments for a suggestion
   */
  @Get(':id/comments')
  async getComments(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<KVPComment[]> {
    const suggestionId = this.parseIdParam(id);
    return await this.kvpService.getComments(suggestionId, tenantId, user.id, user.role);
  }

  /**
   * POST /kvp/:id/comments
   * Add a comment to a suggestion
   * Only admin and root users can add comments
   */
  @Post(':id/comments')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  @HttpCode(HttpStatus.CREATED)
  async addComment(
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<KVPComment> {
    const suggestionId = this.parseIdParam(id);
    return await this.kvpService.addComment(
      suggestionId,
      user.id,
      tenantId,
      dto.comment,
      dto.isInternal,
      user.role,
    );
  }

  /**
   * GET /kvp/:id/attachments
   * Get attachments for a suggestion
   */
  @Get(':id/attachments')
  async getAttachments(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<KVPAttachment[]> {
    const suggestionId = this.parseIdParam(id);
    return await this.kvpService.getAttachments(suggestionId, tenantId, user.id, user.role);
  }

  /**
   * POST /kvp/:id/attachments
   * Upload attachments to a suggestion (max 5 files)
   */
  @Post(':id/attachments')
  @UseInterceptors(FilesInterceptor('files', 5, kvpAttachmentOptions))
  @HttpCode(HttpStatus.CREATED)
  async uploadAttachments(
    @Param('id') id: string,
    @UploadedFiles() files: MulterFile[] | undefined,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<KVPAttachment[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const suggestionId = this.parseIdParam(id);

    // Process each file
    const attachments: KVPAttachment[] = [];
    for (const file of files) {
      const fileUuid = uuidv7();
      const extension = path.extname(file.originalname).toLowerCase();
      const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

      // Build storage path
      const storagePath = path.join(
        process.cwd(),
        'uploads',
        'kvp',
        tenantId.toString(),
        String(suggestionId),
        `${fileUuid}${extension}`,
      );

      // Create directory and write file
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path built from validated inputs: tenantId (auth), suggestionId (ParseIntPipe), fileUuid (generated)
      await fs.mkdir(path.dirname(storagePath), { recursive: true });
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path built from validated inputs: tenantId (auth), suggestionId (ParseIntPipe), fileUuid (generated)
      await fs.writeFile(storagePath, file.buffer);

      // Add to database
      const attachment = await this.kvpService.addAttachment(
        suggestionId,
        {
          fileName: file.originalname,
          filePath: storagePath,
          fileType: file.mimetype,
          fileSize: file.size,
          uploadedBy: user.id,
          fileUuid,
          fileChecksum: checksum,
        },
        tenantId,
        user.id,
        user.role,
      );
      attachments.push(attachment);
    }

    return attachments;
  }

  /**
   * GET /kvp/attachments/:fileUuid/download
   * Download attachment by file UUID (secure, non-guessable)
   */
  @Get('attachments/:fileUuid/download')
  async downloadAttachment(
    @Param('fileUuid') fileUuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const attachment = await this.kvpService.getAttachment(fileUuid, tenantId, user.id, user.role);
    await reply
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Disposition', `attachment; filename="${attachment.fileName}"`)
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- filePath from DB, validated at upload time
      .send(createReadStream(attachment.filePath));
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Parse ID parameter - supports both numeric and UUID
   * UUIDs are returned as strings, numeric IDs as numbers
   */
  private parseIdParam(id: string): number | string {
    // Check UUID pattern first
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(id)) {
      return id;
    }

    // Parse as numeric ID
    const numericId = Number.parseInt(id, 10);
    if (Number.isNaN(numericId) || numericId <= 0) {
      throw new Error('ID must be a positive integer or valid UUID');
    }
    return numericId;
  }
}
