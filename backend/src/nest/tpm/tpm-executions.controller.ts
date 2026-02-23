/**
 * TPM Executions Controller
 *
 * REST endpoints for card execution lifecycle:
 * - POST   /tpm/executions                    — Create execution (mark card done)
 * - GET    /tpm/executions/pending-approvals   — List pending approvals
 * - GET    /tpm/executions/:uuid              — Get single execution
 * - POST   /tpm/executions/:uuid/respond      — Approve or reject
 * - POST   /tpm/executions/:uuid/photos       — Upload photo
 * - GET    /tpm/executions/:uuid/photos       — List photos
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@webundsoehne/nest-fastify-file-upload';
import multer from 'fastify-multer';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { v7 as uuidv7 } from 'uuid';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { TenantFeature } from '../common/decorators/tenant-feature.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import type { MulterFile } from '../common/interfaces/multer.interface.js';
import { CreateExecutionDto } from './dto/create-execution.dto.js';
import { ListExecutionsQueryDto } from './dto/list-executions-query.dto.js';
import { RespondExecutionDto } from './dto/respond-execution.dto.js';
import { TpmApprovalService } from './tpm-approval.service.js';
import type { PaginatedExecutions } from './tpm-executions.service.js';
import { TpmExecutionsService } from './tpm-executions.service.js';
import type { TpmCardExecution, TpmExecutionPhoto } from './tpm.types.js';
import { MAX_PHOTO_FILE_SIZE } from './tpm.types.js';

const { memoryStorage } = multer;

/** Permission constants */
const FEAT = 'tpm';
const MOD_EXEC = 'tpm-executions';

/** Multer options for TPM execution photos (max 5MB, single file) */
const tpmPhotoOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_PHOTO_FILE_SIZE,
    files: 1,
  },
};

@Controller('tpm/executions')
@TenantFeature('tpm')
export class TpmExecutionsController {
  constructor(
    private readonly executionsService: TpmExecutionsService,
    private readonly approvalService: TpmApprovalService,
  ) {}

  // ============================================================================
  // EXECUTION CRUD
  // ============================================================================

  /**
   * GET /tpm/executions/pending-approvals
   *
   * Must be defined BEFORE :uuid routes to prevent NestJS
   * from matching "pending-approvals" as a UUID parameter.
   */
  @Get('pending-approvals')
  @RequirePermission(FEAT, MOD_EXEC, 'canRead')
  async listPendingApprovals(
    @Query() query: ListExecutionsQueryDto,
    @TenantId() tenantId: number,
  ): Promise<PaginatedExecutions> {
    return await this.executionsService.listPendingApprovals(
      tenantId,
      query.page,
      query.limit,
    );
  }

  /** POST /tpm/executions — Create execution (employee marks card as done) */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(FEAT, MOD_EXEC, 'canWrite')
  async createExecution(
    @Body() dto: CreateExecutionDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmCardExecution> {
    return await this.executionsService.createExecution(
      tenantId,
      dto.cardUuid,
      user.id,
      {
        executionDate: dto.executionDate,
        noIssuesFound: dto.noIssuesFound,
        actualDurationMinutes: dto.actualDurationMinutes,
        actualStaffCount: dto.actualStaffCount,
        documentation: dto.documentation,
        customData: dto.customData,
      },
    );
  }

  /** GET /tpm/executions/:uuid — Get single execution */
  @Get(':uuid')
  @RequirePermission(FEAT, MOD_EXEC, 'canRead')
  async getExecution(
    @Param('uuid') uuid: string,
    @TenantId() tenantId: number,
  ): Promise<TpmCardExecution> {
    return await this.executionsService.getExecution(tenantId, uuid);
  }

  // ============================================================================
  // APPROVAL
  // ============================================================================

  /** POST /tpm/executions/:uuid/respond — Approve or reject execution */
  @Post(':uuid/respond')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(FEAT, MOD_EXEC, 'canWrite')
  async respondToExecution(
    @Param('uuid') executionUuid: string,
    @Body() dto: RespondExecutionDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmCardExecution> {
    if (dto.action === 'approved') {
      return await this.approvalService.approveExecution(
        tenantId,
        executionUuid,
        user.id,
        dto,
      );
    }

    return await this.approvalService.rejectExecution(
      tenantId,
      executionUuid,
      user.id,
      dto,
    );
  }

  // ============================================================================
  // PHOTOS
  // ============================================================================

  /** POST /tpm/executions/:uuid/photos — Upload a photo */
  @Post(':uuid/photos')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', tpmPhotoOptions))
  @RequirePermission(FEAT, MOD_EXEC, 'canWrite')
  async uploadPhoto(
    @Param('uuid') executionUuid: string,
    @UploadedFile() file: MulterFile | undefined,
    @TenantId() tenantId: number,
  ): Promise<TpmExecutionPhoto> {
    if (file === undefined) {
      throw new BadRequestException('Keine Datei hochgeladen');
    }

    const storagePath = await writePhotoToDisk(tenantId, executionUuid, file);

    return await this.executionsService.addPhoto(tenantId, executionUuid, {
      filePath: storagePath,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    });
  }

  /** GET /tpm/executions/:uuid/photos — List photos for execution */
  @Get(':uuid/photos')
  @RequirePermission(FEAT, MOD_EXEC, 'canRead')
  async getPhotos(
    @Param('uuid') executionUuid: string,
    @TenantId() tenantId: number,
  ): Promise<TpmExecutionPhoto[]> {
    return await this.executionsService.getPhotos(tenantId, executionUuid);
  }
}

// ============================================================================
// Helpers (module-level pure functions)
// ============================================================================

/** Write uploaded file to disk and return the relative storage path */
async function writePhotoToDisk(
  tenantId: number,
  executionUuid: string,
  file: MulterFile,
): Promise<string> {
  const fileUuid = uuidv7();
  const extension = path.extname(file.originalname).toLowerCase();
  const relativePath = path.join(
    'uploads',
    'tpm',
    tenantId.toString(),
    executionUuid,
    `${fileUuid}${extension}`,
  );
  const absolutePath = path.join(process.cwd(), relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, file.buffer);

  return relativePath;
}
