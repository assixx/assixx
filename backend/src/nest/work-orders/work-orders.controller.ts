/**
 * Work Orders Controller
 *
 * REST endpoints for the Arbeitsauftrag-System:
 * - CRUD + archive/restore operations (admin: manage)
 * - Employee view (execute: my orders)
 * - Status transitions, comments, photos, assignees
 *
 * 17 endpoints total. All require @RequireAddon('work_orders').
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
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@webundsoehne/nest-fastify-file-upload';
import type { FastifyReply } from 'fastify';
import multer from 'fastify-multer';
import { createReadStream } from 'node:fs';

import { inlineHeader } from '../../utils/content-disposition.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequireAddon } from '../common/decorators/require-addon.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import type { MulterFile } from '../common/interfaces/multer.interface.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { ReadTrackingConfig } from '../common/services/read-tracking.service.js';
import { ReadTrackingService } from '../common/services/read-tracking.service.js';
import { AssignUsersDto } from './dto/assign-users.dto.js';
import { CalendarWorkOrdersQueryDto } from './dto/calendar-work-orders-query.dto.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { CreateWorkOrderDto } from './dto/create-work-order.dto.js';
import { ListWorkOrdersQueryDto } from './dto/list-work-orders-query.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto.js';
import { WorkOrderAssigneesService } from './work-orders-assignees.service.js';
import { WorkOrderCommentsService } from './work-orders-comments.service.js';
import { WorkOrderNotificationService } from './work-orders-notification.service.js';
import { WorkOrderPhotosService } from './work-orders-photos.service.js';
import { WorkOrderStatusService } from './work-orders-status.service.js';
import { WorkOrdersService } from './work-orders.service.js';
import type {
  CalendarWorkOrder,
  EligibleUser,
  SourcePhoto,
  WorkOrder,
  WorkOrderAssignee,
  WorkOrderComment,
  WorkOrderPhoto,
  WorkOrderStats,
} from './work-orders.types.js';
import { MAX_PHOTO_FILE_SIZE } from './work-orders.types.js';

const { memoryStorage } = multer;

/** Permission constants */
const FEAT = 'work_orders';
const MOD_MANAGE = 'work-orders-manage';
const MOD_EXEC = 'work-orders-execute';

/** Read-tracking config for work orders */
const WORK_ORDER_READ_CONFIG: ReadTrackingConfig = {
  tableName: 'work_order_read_status',
  entityColumn: 'work_order_id',
  entityTable: 'work_orders',
  entityUuidColumn: 'uuid',
};

/** Multer options for work order attachments (max 10 MB, single file) */
const photoUploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_PHOTO_FILE_SIZE, files: 1 },
};

@Controller('work-orders')
@RequireAddon('work_orders')
export class WorkOrdersController {
  constructor(
    private readonly service: WorkOrdersService,
    private readonly assigneesService: WorkOrderAssigneesService,
    private readonly statusService: WorkOrderStatusService,
    private readonly commentsService: WorkOrderCommentsService,
    private readonly photosService: WorkOrderPhotosService,
    private readonly notifications: WorkOrderNotificationService,
    private readonly readTracking: ReadTrackingService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ==========================================================================
  // Core CRUD (admin: manage)
  // ==========================================================================

  @Get()
  @RequirePermission(FEAT, MOD_MANAGE, 'canRead')
  async listAll(
    @Query() query: ListWorkOrdersQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<ReturnType<WorkOrdersService['listWorkOrders']>> {
    return await this.service.listWorkOrders(tenantId, user.id, query);
  }

  @Get('my')
  @RequirePermission(FEAT, MOD_EXEC, 'canRead')
  async listMine(
    @Query() query: ListWorkOrdersQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<ReturnType<WorkOrdersService['listMyWorkOrders']>> {
    return await this.service.listMyWorkOrders(tenantId, user.id, query);
  }

  @Get('my/stats')
  @RequirePermission(FEAT, MOD_EXEC, 'canRead')
  async getMyStats(
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<WorkOrderStats> {
    return await this.service.getMyStats(tenantId, user.id);
  }

  @Get('eligible-users')
  @RequirePermission(FEAT, MOD_MANAGE, 'canWrite')
  async getEligibleUsers(
    @TenantId() tenantId: number,
    @Query('assetId') assetId?: string,
  ): Promise<EligibleUser[]> {
    const parsed = assetId !== undefined ? Number(assetId) : undefined;
    return await this.assigneesService.getEligibleUsers(tenantId, parsed);
  }

  @Get('stats')
  @RequirePermission(FEAT, MOD_MANAGE, 'canRead')
  async getStats(@TenantId() tenantId: number): Promise<WorkOrderStats> {
    return await this.service.getStats(tenantId);
  }

  @Get('calendar')
  @RequirePermission(FEAT, MOD_EXEC, 'canRead')
  async getCalendarWorkOrders(
    @Query() query: CalendarWorkOrdersQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<CalendarWorkOrder[]> {
    const isAdmin = user.role === 'admin' || user.role === 'root';
    return await this.service.getCalendarWorkOrders(
      tenantId,
      user.id,
      isAdmin,
      query.startDate,
      query.endDate,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(FEAT, MOD_MANAGE, 'canWrite')
  async create(
    @Body() dto: CreateWorkOrderDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<WorkOrder> {
    const result = await this.service.createWorkOrder(tenantId, user.id, dto);

    // Fire-and-forget: SSE + persistent notification for assignees
    const assigneeUserIds = result.assignees.map(
      (a: WorkOrder['assignees'][number]): number => a.userId,
    );
    if (assigneeUserIds.length > 0) {
      void this.notifications.notifyAssigned(tenantId, result.uuid, assigneeUserIds);
      void this.notifications.persistAssignedNotification(
        tenantId,
        result.uuid,
        assigneeUserIds,
        user.id,
      );
    }

    return result;
  }

  @Post(':uuid/read')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(FEAT, MOD_EXEC, 'canRead')
  async markAsRead(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ success: boolean }> {
    await this.readTracking.markAsReadByUuid(WORK_ORDER_READ_CONFIG, uuid, user.id, tenantId);

    void this.activityLogger.logCreate(
      tenantId,
      user.id,
      'work_order',
      0,
      `Arbeitsauftrag gelesen: ${uuid}`,
    );

    return { success: true };
  }

  @Get(':uuid')
  @RequirePermission(FEAT, MOD_EXEC, 'canRead')
  async getOne(@Param('uuid') uuid: string, @TenantId() tenantId: number): Promise<WorkOrder> {
    return await this.service.getWorkOrder(tenantId, uuid);
  }

  @Patch(':uuid')
  @RequirePermission(FEAT, MOD_MANAGE, 'canWrite')
  async update(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateWorkOrderDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<WorkOrder> {
    return await this.service.updateWorkOrder(tenantId, user.id, uuid, dto);
  }

  @Patch(':uuid/archive')
  @RequirePermission(FEAT, MOD_MANAGE, 'canDelete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<void> {
    await this.service.archiveWorkOrder(tenantId, user.id, uuid);
  }

  @Patch(':uuid/restore')
  @RequirePermission(FEAT, MOD_MANAGE, 'canDelete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async restore(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<void> {
    await this.service.restoreWorkOrder(tenantId, user.id, uuid);
  }

  // ==========================================================================
  // Status transitions
  // ==========================================================================

  @Patch(':uuid/status')
  @RequirePermission(FEAT, MOD_EXEC, 'canWrite')
  async updateStatus(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<void> {
    await this.statusService.updateStatus(tenantId, user.id, uuid, dto.status);

    // Fire-and-forget: SSE + persistent notification
    if (dto.status === 'verified') {
      void this.notifications.notifyVerified(tenantId, uuid, user.id);
      void this.notifications.persistVerifiedNotification(tenantId, uuid, user.id);
    } else {
      void this.notifications.notifyStatusChanged(tenantId, uuid, dto.status, user.id);
    }
  }

  // ==========================================================================
  // Assignees
  // ==========================================================================

  @Post(':uuid/assignees')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(FEAT, MOD_MANAGE, 'canWrite')
  async assignUsers(
    @Param('uuid') uuid: string,
    @Body() dto: AssignUsersDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<WorkOrderAssignee[]> {
    const result = await this.assigneesService.assignUsers(tenantId, uuid, dto.userUuids, user.id);

    // Fire-and-forget: SSE + persistent notification for new assignees
    const assigneeUserIds = result.map((a: WorkOrderAssignee): number => a.userId);
    void this.notifications.notifyAssigned(tenantId, uuid, assigneeUserIds);
    void this.notifications.persistAssignedNotification(tenantId, uuid, assigneeUserIds, user.id);

    return result;
  }

  @Delete(':uuid/assignees/:userUuid')
  @RequirePermission(FEAT, MOD_MANAGE, 'canWrite')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAssignee(
    @Param('uuid') uuid: string,
    @Param('userUuid') userUuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<void> {
    await this.assigneesService.removeAssignee(tenantId, uuid, userUuid, user.id);
  }

  // ==========================================================================
  // Comments
  // ==========================================================================

  @Get(':uuid/comments')
  @RequirePermission(FEAT, MOD_EXEC, 'canRead')
  async listComments(
    @Param('uuid') uuid: string,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @TenantId() tenantId: number,
  ): Promise<ReturnType<WorkOrderCommentsService['listComments']>> {
    return await this.commentsService.listComments(
      tenantId,
      uuid,
      page !== undefined ? Number(page) : 1,
      limit !== undefined ? Number(limit) : 20,
    );
  }

  @Post(':uuid/comments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(FEAT, MOD_EXEC, 'canWrite')
  async addComment(
    @Param('uuid') uuid: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<WorkOrderComment> {
    return await this.commentsService.addComment(
      tenantId,
      user.id,
      uuid,
      dto.content,
      dto.parentId,
    );
  }

  @Get(':uuid/comments/:commentId/replies')
  @RequirePermission(FEAT, MOD_EXEC, 'canRead')
  async listReplies(
    @Param('uuid') uuid: string,
    @Param('commentId') commentId: string,
    @TenantId() tenantId: number,
  ): Promise<WorkOrderComment[]> {
    return await this.commentsService.listReplies(tenantId, uuid, Number(commentId));
  }

  // ==========================================================================
  // Photos
  // ==========================================================================

  @Get(':uuid/source-photos')
  @RequirePermission(FEAT, MOD_EXEC, 'canRead')
  async listSourcePhotos(
    @Param('uuid') uuid: string,
    @TenantId() tenantId: number,
  ): Promise<SourcePhoto[]> {
    return await this.photosService.getSourcePhotos(tenantId, uuid);
  }

  @Get(':uuid/photos')
  @RequirePermission(FEAT, MOD_EXEC, 'canRead')
  async listPhotos(
    @Param('uuid') uuid: string,
    @TenantId() tenantId: number,
  ): Promise<WorkOrderPhoto[]> {
    return await this.photosService.getPhotos(tenantId, uuid);
  }

  @Post(':uuid/photos')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', photoUploadOptions))
  @RequirePermission(FEAT, MOD_EXEC, 'canWrite')
  async uploadPhoto(
    @Param('uuid') uuid: string,
    @UploadedFile() file: MulterFile | undefined,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<WorkOrderPhoto> {
    if (file === undefined) {
      throw new BadRequestException('Keine Datei hochgeladen');
    }
    return await this.photosService.addPhoto(tenantId, user.id, uuid, file);
  }

  @Get(':uuid/photos/:photoUuid/file')
  @RequirePermission(FEAT, MOD_EXEC, 'canRead')
  async servePhoto(
    @Param('uuid') uuid: string,
    @Param('photoUuid') photoUuid: string,
    @TenantId() tenantId: number,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const photo = await this.photosService.getPhotoFile(tenantId, uuid, photoUuid);
    const headers = reply
      .header('Content-Type', photo.mimeType)
      .header('Cache-Control', 'private, max-age=3600');

    if (photo.mimeType === 'application/pdf') {
      headers.header('Content-Disposition', inlineHeader(photo.fileName));
    }

    await headers.send(createReadStream(photo.filePath));
  }

  @Delete(':uuid/photos/:photoUuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(FEAT, MOD_EXEC, 'canWrite')
  async deletePhoto(
    @Param('photoUuid') photoUuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<void> {
    await this.photosService.deletePhoto(tenantId, user.id, user.role, photoUuid);
  }
}
