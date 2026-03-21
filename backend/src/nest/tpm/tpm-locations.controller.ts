/**
 * TPM Locations Controller
 *
 * REST endpoints for structured location descriptions per maintenance plan:
 * - GET    /tpm/locations?planUuid=xxx   — List locations for a plan
 * - POST   /tpm/locations                — Create location
 * - GET    /tpm/locations/:uuid          — Get single location
 * - PATCH  /tpm/locations/:uuid          — Update location
 * - DELETE /tpm/locations/:uuid          — Soft-delete location
 * - POST   /tpm/locations/:uuid/photo    — Upload location photo
 * - DELETE /tpm/locations/:uuid/photo    — Remove location photo
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
import { CreateLocationDto } from './dto/create-location.dto.js';
import { UpdateLocationDto } from './dto/update-location.dto.js';
import { TpmLocationsService } from './tpm-locations.service.js';
import type { TpmLocation } from './tpm.types.js';
import { MAX_PHOTO_FILE_SIZE } from './tpm.types.js';

const { memoryStorage } = multer;

/** Permission constants */
const FEAT = 'tpm';
const MOD_LOCATIONS = 'tpm-locations';

/** Multer options for location photos (max 5MB, single file) */
const locationPhotoOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_PHOTO_FILE_SIZE,
    files: 1,
  },
};

@Controller('tpm/locations')
@RequireAddon('tpm')
export class TpmLocationsController {
  constructor(private readonly locationsService: TpmLocationsService) {}

  // ============================================================================
  // CRUD
  // ============================================================================

  /** GET /tpm/locations?planUuid=xxx — List all active locations for a plan */
  @Get()
  @RequirePermission(FEAT, MOD_LOCATIONS, 'canRead')
  async listLocations(
    @Query('planUuid') planUuid: string | undefined,
    @TenantId() tenantId: number,
  ): Promise<TpmLocation[]> {
    if (planUuid === undefined || planUuid === '') {
      throw new BadRequestException('planUuid Query-Parameter ist erforderlich');
    }
    return await this.locationsService.listLocations(tenantId, planUuid);
  }

  /** POST /tpm/locations — Create a new location */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(FEAT, MOD_LOCATIONS, 'canWrite')
  async createLocation(
    @Body() dto: CreateLocationDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmLocation> {
    return await this.locationsService.createLocation(tenantId, user.id, dto);
  }

  /** GET /tpm/locations/:uuid — Get a single location */
  @Get(':uuid')
  @RequirePermission(FEAT, MOD_LOCATIONS, 'canRead')
  async getLocation(
    @Param('uuid') uuid: string,
    @TenantId() tenantId: number,
  ): Promise<TpmLocation> {
    return await this.locationsService.getLocation(tenantId, uuid);
  }

  /** PATCH /tpm/locations/:uuid — Update a location */
  @Patch(':uuid')
  @RequirePermission(FEAT, MOD_LOCATIONS, 'canWrite')
  async updateLocation(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateLocationDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmLocation> {
    return await this.locationsService.updateLocation(tenantId, user.id, uuid, dto);
  }

  /** DELETE /tpm/locations/:uuid — Soft-delete a location */
  @Delete(':uuid')
  @RequirePermission(FEAT, MOD_LOCATIONS, 'canDelete')
  async deleteLocation(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ message: string }> {
    await this.locationsService.deleteLocation(tenantId, user.id, uuid);
    return { message: 'Standort gelöscht' };
  }

  // ============================================================================
  // PHOTO
  // ============================================================================

  /** POST /tpm/locations/:uuid/photo — Upload a location photo */
  @Post(':uuid/photo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', locationPhotoOptions))
  @RequirePermission(FEAT, MOD_LOCATIONS, 'canWrite')
  async uploadPhoto(
    @Param('uuid') locationUuid: string,
    @UploadedFile() file: MulterFile | undefined,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmLocation> {
    if (file === undefined) {
      throw new BadRequestException('Keine Datei hochgeladen');
    }

    const storagePath = await writeLocationPhotoToDisk(tenantId, locationUuid, file);

    return await this.locationsService.setPhoto(tenantId, user.id, locationUuid, {
      filePath: storagePath,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    });
  }

  /** DELETE /tpm/locations/:uuid/photo — Remove a location photo */
  @Delete(':uuid/photo')
  @RequirePermission(FEAT, MOD_LOCATIONS, 'canWrite')
  async removePhoto(
    @Param('uuid') locationUuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmLocation> {
    return await this.locationsService.removePhoto(tenantId, user.id, locationUuid);
  }
}

// ============================================================================
// Helpers (module-level pure functions)
// ============================================================================

/** Write uploaded location photo to disk and return the relative storage path */
async function writeLocationPhotoToDisk(
  tenantId: number,
  locationUuid: string,
  file: MulterFile,
): Promise<string> {
  const fileUuid = uuidv7();
  const extension = path.extname(file.originalname).toLowerCase();
  const relativePath = path.join(
    'uploads',
    'tpm',
    'locations',
    tenantId.toString(),
    locationUuid,
    `${fileUuid}${extension}`,
  );
  const absolutePath = path.join(process.cwd(), relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, file.buffer);

  return relativePath;
}
