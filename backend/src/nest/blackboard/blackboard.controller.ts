/**
 * Blackboard Controller
 *
 * HTTP endpoints for blackboard entry management:
 * - GET    /blackboard/entries           - List entries with filters
 * - GET    /blackboard/entries/:id       - Get entry by ID
 * - GET    /blackboard/entries/:id/full  - Get full entry with comments
 * - POST   /blackboard/entries           - Create entry (admin/root)
 * - PUT    /blackboard/entries/:id       - Update entry (admin/root)
 * - DELETE /blackboard/entries/:id       - Delete entry (admin/root)
 * - POST   /blackboard/entries/:id/archive   - Archive entry
 * - POST   /blackboard/entries/:id/unarchive - Unarchive entry
 * - POST   /blackboard/entries/:id/confirm   - Confirm reading
 * - DELETE /blackboard/entries/:id/confirm   - Remove confirmation
 * - GET    /blackboard/entries/:id/confirmations - Get confirmation status
 * - GET    /blackboard/dashboard         - Get dashboard entries
 * - GET    /blackboard/entries/:id/comments  - Get comments
 * - POST   /blackboard/entries/:id/comments  - Add comment
 * - DELETE /blackboard/comments/:commentId   - Delete comment
 *
 * Attachment endpoints:
 * - POST   /blackboard/entries/:id/attachments       - Upload attachment
 * - GET    /blackboard/entries/:id/attachments       - Get attachments
 * - GET    /blackboard/attachments/:attachmentId     - Download attachment
 * - GET    /blackboard/attachments/:attachmentId/preview - Preview attachment
 * - GET    /blackboard/attachments/:fileUuid/download - Download by UUID
 * - DELETE /blackboard/attachments/:attachmentId     - Delete attachment
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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@webundsoehne/nest-fastify-file-upload';
import type { FastifyReply } from 'fastify';
import multer from 'fastify-multer';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import type { MulterFile } from '../common/interfaces/multer.interface.js';
import type {
  BlackboardComment,
  BlackboardEntryResponse,
  PaginatedEntriesResult,
} from './blackboard.service.js';
import { BlackboardService } from './blackboard.service.js';
import {
  AddCommentDto,
  AttachmentIdParamDto,
  CreateEntryDto,
  DashboardQueryDto,
  FileUuidParamDto,
  ListEntriesQueryDto,
  UpdateEntryDto,
} from './dto/index.js';

/** Permission constants for \@RequirePermission decorator */
const BB_FEATURE = 'blackboard';
const BB_MODULE = 'blackboard-posts';

const { memoryStorage } = multer;

/**
 * Multer storage configuration for memory storage
 */
const multerOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
};

/**
 * Response type for message-only responses
 */
interface MessageResponse {
  message: string;
}

/**
 * Response type for entry with message
 */
interface EntryWithMessageResponse {
  message: string;
  entry: BlackboardEntryResponse;
}

/**
 * Response type for full entry with comments and attachments
 */
interface FullEntryResponse {
  entry: BlackboardEntryResponse;
  comments: BlackboardComment[];
  attachments: Record<string, unknown>[];
}

/**
 * Response type for comment creation
 */
interface CommentCreatedResponse {
  id: number;
  message: string;
}

@Controller('blackboard')
export class BlackboardController {
  constructor(private readonly blackboardService: BlackboardService) {}

  /**
   * GET /blackboard/entries
   * List entries with filters and pagination
   */
  @Get('entries')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canRead')
  async listEntries(
    @Query() query: ListEntriesQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<PaginatedEntriesResult> {
    return await this.blackboardService.listEntries(tenantId, user.id, {
      isActive: query.isActive,
      filter: query.filter,
      search: query.search,
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      priority: query.priority,
    });
  }

  /**
   * GET /blackboard/dashboard
   * Get dashboard entries for current user
   */
  @Get('dashboard')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canRead')
  async getDashboardEntries(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<BlackboardEntryResponse[]> {
    return await this.blackboardService.getDashboardEntries(
      tenantId,
      user.id,
      query.limit ?? 3,
    );
  }

  /**
   * GET /blackboard/unconfirmed-count
   * Get count of unconfirmed entries for notification badge
   */
  @Get('unconfirmed-count')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canRead')
  async getUnconfirmedCount(
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ count: number }> {
    return await this.blackboardService.getUnconfirmedCount(user.id, tenantId);
  }

  /**
   * GET /blackboard/entries/:id
   * Get entry by ID (numeric or UUID)
   */
  @Get('entries/:id')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canRead')
  async getEntryById(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<BlackboardEntryResponse> {
    const entryId = this.parseIdParam(id);
    return await this.blackboardService.getEntryById(
      entryId,
      tenantId,
      user.id,
    );
  }

  /**
   * GET /blackboard/entries/:id/full
   * Get full entry with comments (optimized single request)
   */
  @Get('entries/:id/full')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canRead')
  async getEntryFull(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<FullEntryResponse> {
    const entryId = this.parseIdParam(id);
    return await this.blackboardService.getEntryFull(
      entryId,
      tenantId,
      user.id,
    );
  }

  /**
   * POST /blackboard/entries
   * Create a new entry (admin/root only)
   */
  @Post('entries')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canWrite')
  @HttpCode(HttpStatus.CREATED)
  async createEntry(
    @Body() dto: CreateEntryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<BlackboardEntryResponse> {
    return await this.blackboardService.createEntry(dto, tenantId, user.id);
  }

  /**
   * PUT /blackboard/entries/:id
   * Update an entry (admin/root only)
   */
  @Put('entries/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canWrite')
  async updateEntry(
    @Param('id') id: string,
    @Body() dto: UpdateEntryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<BlackboardEntryResponse> {
    const entryId = this.parseIdParam(id);
    return await this.blackboardService.updateEntry(
      entryId,
      dto,
      tenantId,
      user.id,
    );
  }

  /**
   * DELETE /blackboard/entries/:id
   * Delete an entry (admin/root only)
   */
  @Delete('entries/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canDelete')
  async deleteEntry(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    const entryId = this.parseIdParam(id);
    return await this.blackboardService.deleteEntry(
      entryId,
      tenantId,
      user.id,
      user.role,
    );
  }

  /**
   * POST /blackboard/entries/:id/archive
   * Archive an entry (admin/root only)
   */
  @Post('entries/:id/archive')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canWrite')
  @HttpCode(HttpStatus.OK)
  async archiveEntry(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<EntryWithMessageResponse> {
    const entryId = this.parseIdParam(id);
    const entry = await this.blackboardService.archiveEntry(
      entryId,
      tenantId,
      user.id,
    );
    return { message: 'Entry archived successfully', entry };
  }

  /**
   * POST /blackboard/entries/:id/unarchive
   * Unarchive an entry (admin/root only)
   */
  @Post('entries/:id/unarchive')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canWrite')
  async unarchiveEntry(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<EntryWithMessageResponse> {
    const entryId = this.parseIdParam(id);
    const entry = await this.blackboardService.unarchiveEntry(
      entryId,
      tenantId,
      user.id,
    );
    return { message: 'Entry unarchived successfully', entry };
  }

  /**
   * POST /blackboard/entries/:id/confirm
   * Confirm reading an entry
   */
  @Post('entries/:id/confirm')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canRead')
  @HttpCode(HttpStatus.OK)
  async confirmEntry(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
  ): Promise<MessageResponse> {
    const entryId = this.parseIdParam(id);
    return await this.blackboardService.confirmEntry(entryId, user.id);
  }

  /**
   * DELETE /blackboard/entries/:id/confirm
   * Remove confirmation (mark as unread)
   */
  @Delete('entries/:id/confirm')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canRead')
  async unconfirmEntry(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
  ): Promise<MessageResponse> {
    const entryId = this.parseIdParam(id);
    return await this.blackboardService.unconfirmEntry(entryId, user.id);
  }

  /**
   * GET /blackboard/entries/:id/confirmations
   * Get confirmation status for an entry (admin/root only)
   */
  @Get('entries/:id/confirmations')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canRead')
  async getConfirmationStatus(
    @Param('id') id: string,
    @TenantId() tenantId: number,
  ): Promise<Record<string, unknown>[]> {
    const entryId = this.parseIdParam(id);
    return await this.blackboardService.getConfirmationStatus(
      entryId,
      tenantId,
    );
  }

  /**
   * GET /blackboard/entries/:id/comments
   * Get comments for an entry
   */
  @Get('entries/:id/comments')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canRead')
  async getComments(
    @Param('id') id: string,
    @TenantId() tenantId: number,
  ): Promise<BlackboardComment[]> {
    const entryId = this.parseIdParam(id);
    return await this.blackboardService.getComments(entryId, tenantId);
  }

  /**
   * POST /blackboard/entries/:id/comments
   * Add a comment to an entry
   */
  @Post('entries/:id/comments')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canWrite')
  @HttpCode(HttpStatus.CREATED)
  async addComment(
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<CommentCreatedResponse> {
    const entryId = this.parseIdParam(id);
    // Only admins/root can create internal comments
    const isInternal =
      dto.isInternal && (user.role === 'admin' || user.role === 'root');
    return await this.blackboardService.addComment(
      entryId,
      user.id,
      tenantId,
      dto.comment,
      isInternal,
    );
  }

  /**
   * DELETE /blackboard/comments/:commentId
   * Delete a comment (admin/root only)
   */
  @Delete('comments/:commentId')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canDelete')
  async deleteComment(
    @Param('commentId', ParseIntPipe) commentId: number,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.blackboardService.deleteComment(commentId, tenantId);
  }

  // ============================================
  // ATTACHMENT ENDPOINTS
  // ============================================

  /**
   * POST /blackboard/entries/:id/attachments
   * Upload attachment to an entry (admin/root only)
   */
  @Post('entries/:id/attachments')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canWrite')
  @UseInterceptors(FileInterceptor('attachment', multerOptions))
  @HttpCode(HttpStatus.CREATED)
  async uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: MulterFile | undefined,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<Record<string, unknown>> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const entryId = this.parseIdParam(id);
    return await this.blackboardService.uploadAttachment(
      entryId,
      file,
      tenantId,
      user.id,
    );
  }

  /**
   * GET /blackboard/entries/:id/attachments
   * Get attachments for an entry
   */
  @Get('entries/:id/attachments')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canRead')
  async getAttachments(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<Record<string, unknown>[]> {
    const entryId = this.parseIdParam(id);
    return await this.blackboardService.getAttachments(
      entryId,
      tenantId,
      user.id,
    );
  }

  /**
   * GET /blackboard/attachments/:attachmentId
   * Download attachment
   */
  @Get('attachments/:attachmentId')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canRead')
  async downloadAttachment(
    @Param() params: AttachmentIdParamDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const result = await this.blackboardService.downloadAttachment(
      params.attachmentId,
      user.id,
      tenantId,
    );

    await reply
      .header('Content-Type', result.mimeType)
      .header(
        'Content-Disposition',
        `attachment; filename="${result.originalName}"`,
      )
      .header('Content-Length', result.fileSize.toString())
      .header('Cache-Control', 'private, max-age=3600')
      .send(result.content);
  }

  /**
   * GET /blackboard/attachments/:attachmentId/preview
   * Preview attachment inline
   */
  @Get('attachments/:attachmentId/preview')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canRead')
  async previewAttachment(
    @Param() params: AttachmentIdParamDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const result = await this.blackboardService.previewAttachment(
      params.attachmentId,
      user.id,
      tenantId,
    );

    await reply
      .header('Content-Type', result.mimeType)
      .header(
        'Content-Disposition',
        `inline; filename="${result.originalName}"`,
      )
      .header('Content-Length', result.fileSize.toString())
      .header('Cache-Control', 'private, max-age=3600')
      .send(result.content);
  }

  /**
   * GET /blackboard/attachments/:fileUuid/download
   * Download attachment by file UUID (secure URL)
   */
  @Get('attachments/:fileUuid/download')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canRead')
  async downloadByFileUuid(
    @Param() params: FileUuidParamDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const result = await this.blackboardService.downloadByFileUuid(
      params.fileUuid,
      user.id,
      tenantId,
    );

    await reply
      .header('Content-Type', result.mimeType)
      .header(
        'Content-Disposition',
        `attachment; filename="${result.originalName}"`,
      )
      .header('Content-Length', result.fileSize.toString())
      .header('Cache-Control', 'private, max-age=3600')
      .send(result.content);
  }

  /**
   * DELETE /blackboard/attachments/:attachmentId
   * Delete attachment (admin/root only)
   */
  @Delete('attachments/:attachmentId')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  @RequirePermission(BB_FEATURE, BB_MODULE, 'canDelete')
  async deleteAttachment(
    @Param() params: AttachmentIdParamDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.blackboardService.deleteAttachment(
      params.attachmentId,
      user.id,
      tenantId,
    );
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
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
