/**
 * Users Controller
 *
 * HTTP endpoints for user management:
 * - GET  /users       - List users (admin only)
 * - GET  /users/me    - Get current user
 * - GET  /users/:id   - Get user by ID (admin only)
 * - POST /users       - Create user (admin only)
 * - PUT  /users/:id   - Update user (admin only)
 * - PUT  /users/me/profile - Update profile (self)
 * - PATCH /users/me   - Partial update profile (self)
 * - PUT  /users/me/password - Change password (self)
 * - DELETE /users/:id - Delete user (admin only)
 * - POST /users/:id/archive - Archive user (admin only)
 * - POST /users/:id/unarchive - Unarchive user (admin only)
 * - PUT  /users/:id/availability - Update availability (admin only)
 * - GET  /users/uuid/:uuid/availability/history - Get availability history (admin only)
 * - PUT  /users/availability/:id - Update availability entry (admin only)
 * - DELETE /users/availability/:id - Delete availability entry (admin only)
 *
 * Profile picture endpoints:
 * - GET    /users/me/profile-picture - Get profile picture
 * - POST   /users/me/profile-picture - Upload profile picture
 * - DELETE /users/me/profile-picture - Delete profile picture
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
  Patch,
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
import * as fs from 'node:fs';
import * as path from 'node:path';
import { v7 as uuidv7 } from 'uuid';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import {
  AvailabilityHistoryQueryDto,
  type AvailabilityHistoryResponse,
  ChangePasswordDto,
  CreateUserDto,
  ListUsersQueryDto,
  UpdateAvailabilityDto,
  UpdateAvailabilityEntryDto,
  UpdateProfileDto,
  UpdateUserDto,
} from './dto/index.js';
import { UserAvailabilityService } from './user-availability.service.js';
import type { PaginatedResult, SafeUserResponse } from './users.service.js';
import { UsersService } from './users.service.js';

const { memoryStorage } = multer;

/** Multer file type for memory storage */
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Allowed MIME types for profile pictures */
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** Profile pictures upload directory */
const PROFILE_PICTURES_DIR = 'uploads/profile_pictures';

/**
 * Multer options for profile picture uploads (memory storage)
 * Files are saved manually in the controller for fastify-multer compatibility
 */
const profilePictureOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: (
    _req: unknown,
    file: MulterFile,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException('Only image files are allowed (JPEG, PNG, GIF, WebP)'), false);
    }
  },
};

/**
 * Response type for message-only responses
 */
interface MessageResponse {
  message: string;
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly availabilityService: UserAvailabilityService,
  ) {}

  /**
   * GET /users
   * List all users with pagination and filters (admin only)
   */
  @Get()
  @Roles('admin', 'root')
  async listUsers(
    @Query() query: ListUsersQueryDto,
    @TenantId() tenantId: number,
  ): Promise<PaginatedResult<SafeUserResponse>> {
    return await this.usersService.listUsers(tenantId, query);
  }

  /**
   * GET /users/me
   * Get current authenticated user
   */
  @Get('me')
  async getCurrentUser(@CurrentUser() user: NestAuthUser): Promise<SafeUserResponse> {
    return await this.usersService.getUserById(user.id, user.tenantId);
  }

  /**
   * GET /users/uuid/:uuid
   * Get user by UUID (admin only, preferred)
   */
  @Get('uuid/:uuid')
  @Roles('admin', 'root')
  async getUserByUuid(
    @Param('uuid') uuid: string,
    @TenantId() tenantId: number,
  ): Promise<SafeUserResponse> {
    return await this.usersService.getUserByUuid(uuid, tenantId);
  }

  /**
   * GET /users/:id
   * Get user by ID (admin only)
   * @deprecated Use GET /users/uuid/:uuid instead
   */
  @Get(':id')
  @Roles('admin', 'root')
  async getUserById(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ): Promise<SafeUserResponse> {
    return await this.usersService.getUserById(id, tenantId);
  }

  /**
   * POST /users
   * Create new user (admin only)
   */
  @Post()
  @Roles('admin', 'root')
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<SafeUserResponse> {
    return await this.usersService.createUser(dto, user.id, tenantId);
  }

  /**
   * PUT /users/uuid/:uuid
   * Update user by UUID (admin only, preferred)
   */
  @Put('uuid/:uuid')
  @Roles('admin', 'root')
  async updateUserByUuid(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<SafeUserResponse> {
    return await this.usersService.updateUserByUuid(uuid, dto, user.id, tenantId);
  }

  /**
   * PUT /users/:id
   * Update user (admin only)
   * @deprecated Use PUT /users/uuid/:uuid instead
   */
  @Put(':id')
  @Roles('admin', 'root')
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<SafeUserResponse> {
    return await this.usersService.updateUser(id, dto, user.id, tenantId);
  }

  /**
   * PUT /users/me/profile
   * Update current user's profile (limited fields)
   */
  @Put('me/profile')
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: NestAuthUser,
  ): Promise<SafeUserResponse> {
    return await this.usersService.updateProfile(user.id, dto, user.tenantId);
  }

  /**
   * PUT /users/me/password
   * Change current user's password
   */
  @Put('me/password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: NestAuthUser,
  ): Promise<MessageResponse> {
    return await this.usersService.changePassword(
      user.id,
      user.tenantId,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  /**
   * DELETE /users/uuid/:uuid
   * Delete user by UUID (soft delete, admin only, preferred)
   */
  @Delete('uuid/:uuid')
  @Roles('admin', 'root')
  async deleteUserByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.usersService.deleteUserByUuid(uuid, user.id, tenantId);
  }

  /**
   * DELETE /users/:id
   * Delete user (soft delete, admin only)
   * @deprecated Use DELETE /users/uuid/:uuid instead
   */
  @Delete(':id')
  @Roles('admin', 'root')
  async deleteUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.usersService.deleteUser(id, user.id, tenantId);
  }

  /**
   * POST /users/uuid/:uuid/archive
   * Archive user by UUID (admin only, preferred)
   */
  @Post('uuid/:uuid/archive')
  @Roles('admin', 'root')
  async archiveUserByUuid(
    @Param('uuid') uuid: string,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.usersService.archiveUserByUuid(uuid, tenantId);
  }

  /**
   * POST /users/:id/archive
   * Archive user (admin only)
   * @deprecated Use POST /users/uuid/:uuid/archive instead
   */
  @Post(':id/archive')
  @Roles('admin', 'root')
  async archiveUser(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.usersService.archiveUser(id, tenantId);
  }

  /**
   * POST /users/uuid/:uuid/unarchive
   * Unarchive user by UUID (admin only, preferred)
   */
  @Post('uuid/:uuid/unarchive')
  @Roles('admin', 'root')
  async unarchiveUserByUuid(
    @Param('uuid') uuid: string,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.usersService.unarchiveUserByUuid(uuid, tenantId);
  }

  /**
   * POST /users/:id/unarchive
   * Unarchive user (admin only)
   * @deprecated Use POST /users/uuid/:uuid/unarchive instead
   */
  @Post(':id/unarchive')
  @Roles('admin', 'root')
  async unarchiveUser(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.usersService.unarchiveUser(id, tenantId);
  }

  /**
   * PUT /users/uuid/:uuid/availability
   * Update user availability by UUID (admin only, preferred)
   */
  @Put('uuid/:uuid/availability')
  @Roles('admin', 'root')
  async updateAvailabilityByUuid(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateAvailabilityDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.availabilityService.updateAvailabilityByUuid(uuid, dto, tenantId, user.id);
  }

  /**
   * PUT /users/:id/availability
   * Update user availability (admin only)
   * @deprecated Use PUT /users/uuid/:uuid/availability instead
   */
  @Put(':id/availability')
  @Roles('admin', 'root')
  async updateAvailability(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAvailabilityDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.availabilityService.updateAvailability(id, dto, tenantId, user.id);
  }

  /**
   * GET /users/uuid/:uuid/availability/history
   * Get availability history for a user (admin only)
   * Query params: ?year=2026&month=01 (optional filters)
   */
  @Get('uuid/:uuid/availability/history')
  @Roles('admin', 'root')
  async getAvailabilityHistory(
    @Param('uuid') uuid: string,
    @Query() query: AvailabilityHistoryQueryDto,
    @TenantId() tenantId: number,
  ): Promise<AvailabilityHistoryResponse> {
    const year = query.year !== undefined ? Number.parseInt(query.year, 10) : undefined;
    const month = query.month !== undefined ? Number.parseInt(query.month, 10) : undefined;
    return await this.availabilityService.getAvailabilityHistoryByUuid(uuid, tenantId, year, month);
  }

  /**
   * PUT /users/availability/:id
   * Update a specific availability history entry (admin only)
   * Business rule: Only entries with endDate \>= today can be edited
   */
  @Put('availability/:id')
  @Roles('admin', 'root')
  async updateAvailabilityEntry(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAvailabilityEntryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.availabilityService.updateAvailabilityEntry(id, dto, tenantId, user.id);
  }

  /**
   * DELETE /users/availability/:id
   * Delete a specific availability history entry (admin only)
   */
  @Delete('availability/:id')
  @Roles('admin', 'root')
  async deleteAvailabilityEntry(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.availabilityService.deleteAvailabilityEntry(id, tenantId, user.id);
  }

  // ============================================
  // PROFILE PICTURE ENDPOINTS
  // ============================================

  /**
   * PATCH /users/me
   * Partial update current user's profile (same as PUT /me/profile)
   */
  @Patch('me')
  async patchProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: NestAuthUser,
  ): Promise<SafeUserResponse> {
    return await this.usersService.updateProfile(user.id, dto, user.tenantId);
  }

  /**
   * GET /users/me/profile-picture
   * Get current user's profile picture
   */
  @Get('me/profile-picture')
  async getProfilePicture(
    @CurrentUser() user: NestAuthUser,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const filePath = await this.usersService.getProfilePicturePath(user.id, user.tenantId);

    // Determine content type from extension
    const ext = path.extname(filePath).toLowerCase();
    const contentType = this.getImageMimeType(ext);

    await reply
      .header('Content-Type', contentType)
      .header('Cache-Control', 'private, max-age=3600')
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- filePath from DB via getProfilePicturePath()
      .send(fs.createReadStream(filePath));
  }

  /**
   * POST /users/me/profile-picture
   * Upload profile picture for current user
   * Uses memory storage + manual file write for fastify-multer compatibility
   */
  @Post('me/profile-picture')
  @UseInterceptors(FileInterceptor('profilePicture', profilePictureOptions))
  @HttpCode(HttpStatus.OK)
  async uploadProfilePicture(
    @UploadedFile() file: MulterFile | undefined,
    @CurrentUser() user: NestAuthUser,
  ): Promise<SafeUserResponse> {
    if (file?.buffer === undefined) {
      throw new BadRequestException('No file uploaded');
    }

    // Generate unique filename with UUIDv7
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuidv7()}${ext}`;
    const uploadDir = path.join(process.cwd(), PROFILE_PICTURES_DIR);
    const filePath = path.join(uploadDir, filename);
    const relativePath = path.join(PROFILE_PICTURES_DIR, filename);

    // Ensure upload directory exists

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Write file to disk
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- filePath built from constant dir + UUIDv7 + validated extension
    fs.writeFileSync(filePath, file.buffer);

    return await this.usersService.updateProfilePicture(user.id, relativePath, user.tenantId);
  }

  /**
   * DELETE /users/me/profile-picture
   * Delete profile picture for current user
   */
  @Delete('me/profile-picture')
  async deleteProfilePicture(@CurrentUser() user: NestAuthUser): Promise<MessageResponse> {
    return await this.usersService.deleteProfilePicture(user.id, user.tenantId);
  }

  /**
   * Get MIME type for image extension
   * Uses switch to avoid object injection vulnerability
   */
  private getImageMimeType(ext: string): string {
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      default:
        return 'application/octet-stream';
    }
  }
}
