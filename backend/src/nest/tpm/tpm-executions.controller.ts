/**
 * TPM Executions Controller
 *
 * REST endpoints for card execution lifecycle:
 * - POST   /tpm/executions                           — Create execution (mark card done)
 * - GET    /tpm/executions/pending-approvals          — List pending approvals
 * - GET    /tpm/executions/eligible-participants      — List employees for participant selection
 * - POST   /tpm/executions/defects/:uuid/photos      — Upload defect photo
 * - GET    /tpm/executions/defects/:uuid/photos       — List defect photos
 * - PATCH  /tpm/executions/defects/:uuid              — Update defect title/description
 * - GET    /tpm/executions/:uuid                     — Get single execution
 * - POST   /tpm/executions/:uuid/respond             — Approve or reject
 * - POST   /tpm/executions/:uuid/photos              — Upload photo
 * - GET    /tpm/executions/:uuid/photos              — List photos
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { RequireAddon } from '../common/decorators/require-addon.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import type { MulterFile } from '../common/interfaces/multer.interface.js';
import { CreateExecutionDto } from './dto/create-execution.dto.js';
import { ListExecutionsQueryDto } from './dto/list-executions-query.dto.js';
import { RespondExecutionDto } from './dto/respond-execution.dto.js';
import { UpdateDefectDto } from './dto/update-defect.dto.js';
import { TpmApprovalService } from './tpm-approval.service.js';
import type { PaginatedExecutions } from './tpm-executions.service.js';
import { TpmExecutionsService } from './tpm-executions.service.js';
import type {
  EligibleParticipant,
  TpmCardExecution,
  TpmDefectPhoto,
  TpmExecutionDefect,
  TpmExecutionPhoto,
} from './tpm.types.js';
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
@RequireAddon('tpm')
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
    return await this.executionsService.listPendingApprovals(tenantId, query.page, query.limit);
  }

  /**
   * GET /tpm/executions/eligible-participants
   *
   * Returns active employees who can be selected as participants.
   * Must be BEFORE :uuid route to avoid NestJS matching as UUID.
   */
  @Get('eligible-participants')
  @RequirePermission(FEAT, MOD_EXEC, 'canRead')
  async getEligibleParticipants(@TenantId() tenantId: number): Promise<EligibleParticipant[]> {
    return await this.executionsService.getEligibleParticipants(tenantId);
  }

  // ============================================================================
  // DEFECT PHOTOS (must be BEFORE :uuid to avoid path collision)
  // ============================================================================

  /** POST /tpm/executions/defects/:uuid/photos — Upload a defect photo */
  @Post('defects/:uuid/photos')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', tpmPhotoOptions))
  @RequirePermission(FEAT, MOD_EXEC, 'canWrite')
  async uploadDefectPhoto(
    @Param('uuid') defectUuid: string,
    @UploadedFile() file: MulterFile | undefined,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmDefectPhoto> {
    if (file === undefined) {
      throw new BadRequestException('Keine Datei hochgeladen');
    }

    const storagePath = await writeDefectPhotoToDisk(tenantId, defectUuid, file);

    return await this.executionsService.addDefectPhoto(tenantId, defectUuid, user.id, {
      filePath: storagePath,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    });
  }

  /** GET /tpm/executions/defects/:uuid/photos — List photos for a defect */
  @Get('defects/:uuid/photos')
  @RequirePermission(FEAT, MOD_EXEC, 'canRead')
  async getDefectPhotos(
    @Param('uuid') defectUuid: string,
    @TenantId() tenantId: number,
  ): Promise<TpmDefectPhoto[]> {
    return await this.executionsService.getDefectPhotos(tenantId, defectUuid);
  }

  /** PATCH /tpm/executions/defects/:uuid — Update defect title/description */
  @Patch('defects/:uuid')
  @RequirePermission(FEAT, MOD_EXEC, 'canWrite')
  async updateDefect(
    @Param('uuid') defectUuid: string,
    @Body() dto: UpdateDefectDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmExecutionDefect> {
    return await this.executionsService.updateDefect(tenantId, defectUuid, user.id, {
      title: dto.title,
      description: dto.description,
    });
  }

  // ============================================================================
  // EXECUTION CRUD (continued)
  // ============================================================================

  /** POST /tpm/executions — Create execution (employee marks card as done) */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(FEAT, MOD_EXEC, 'canWrite')
  async createExecution(
    @Body() dto: CreateExecutionDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmCardExecution> {
    return await this.executionsService.createExecution(tenantId, dto.cardUuid, user.id, {
      executionDate: dto.executionDate,
      noIssuesFound: dto.noIssuesFound,
      actualDurationMinutes: dto.actualDurationMinutes,
      actualStaffCount: dto.actualStaffCount,
      documentation: dto.documentation,
      customData: dto.customData,
      participantUuids: dto.participantUuids,
      defects: dto.defects,
    });
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
      return await this.approvalService.approveExecution(tenantId, executionUuid, user.id, dto);
    }

    return await this.approvalService.rejectExecution(tenantId, executionUuid, user.id, dto);
  }

  // ============================================================================
  // EXECUTION PHOTOS
  // ============================================================================

  /** POST /tpm/executions/:uuid/photos — Upload a photo */
  @Post(':uuid/photos')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', tpmPhotoOptions))
  @RequirePermission(FEAT, MOD_EXEC, 'canWrite')
  async uploadPhoto(
    @Param('uuid') executionUuid: string,
    @UploadedFile() file: MulterFile | undefined,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmExecutionPhoto> {
    if (file === undefined) {
      throw new BadRequestException('Keine Datei hochgeladen');
    }

    const storagePath = await writePhotoToDisk(tenantId, executionUuid, file);

    return await this.executionsService.addPhoto(tenantId, executionUuid, user.id, {
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

/** Write uploaded execution photo to disk and return the relative storage path */
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

/** Write uploaded defect photo to disk and return the relative storage path */
async function writeDefectPhotoToDisk(
  tenantId: number,
  defectUuid: string,
  file: MulterFile,
): Promise<string> {
  const fileUuid = uuidv7();
  const extension = path.extname(file.originalname).toLowerCase();
  const relativePath = path.join(
    'uploads',
    'tpm',
    tenantId.toString(),
    'defects',
    defectUuid,
    `${fileUuid}${extension}`,
  );
  const absolutePath = path.join(process.cwd(), relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, file.buffer);

  return relativePath;
}
