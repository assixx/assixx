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
  ChangePasswordDto,
  CreateUserDto,
  ListUsersQueryDto,
  UpdateAvailabilityDto,
  UpdateProfileDto,
  UpdateUserDto,
} from './dto/index.js';
import type { PaginatedResult, SafeUserResponse } from './users.service.js';
import { UsersService } from './users.service.js';

const { diskStorage } = multer;

/** Multer file type for callbacks */
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size?: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer?: Buffer;
}

/**
 * Multer disk storage for profile pictures
 */
const profilePictureStorage = diskStorage({
  destination: (
    _req: unknown,
    _file: MulterFile,
    cb: (error: Error | null, destination: string) => void,
  ) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'profile-pictures');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (
    _req: unknown,
    file: MulterFile,
    cb: (error: Error | null, filename: string) => void,
  ) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv7()}${ext}`);
  },
});

/**
 * Multer options for profile picture uploads
 */
const profilePictureOptions = {
  storage: profilePictureStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: (
    _req: unknown,
    file: MulterFile,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
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
  constructor(private readonly usersService: UsersService) {}

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
   * GET /users/:id
   * Get user by ID (admin only)
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
    @TenantId() tenantId: number,
  ): Promise<SafeUserResponse> {
    return await this.usersService.createUser(dto, tenantId);
  }

  /**
   * PUT /users/:id
   * Update user (admin only)
   */
  @Put(':id')
  @Roles('admin', 'root')
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @TenantId() tenantId: number,
  ): Promise<SafeUserResponse> {
    return await this.usersService.updateUser(id, dto, tenantId);
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
   * DELETE /users/:id
   * Delete user (soft delete, admin only)
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
   * POST /users/:id/archive
   * Archive user (admin only)
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
   * POST /users/:id/unarchive
   * Unarchive user (admin only)
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
   * PUT /users/:id/availability
   * Update user availability (admin only)
   */
  @Put(':id/availability')
  @Roles('admin', 'root')
  async updateAvailability(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAvailabilityDto,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.usersService.updateAvailability(id, dto, tenantId);
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
   */
  @Post('me/profile-picture')
  @UseInterceptors(FileInterceptor('profilePicture', profilePictureOptions))
  @HttpCode(HttpStatus.OK)
  async uploadProfilePicture(
    @UploadedFile() file: MulterFile | undefined,
    @CurrentUser() user: NestAuthUser,
  ): Promise<SafeUserResponse> {
    if (file?.path === undefined) {
      throw new BadRequestException('No file uploaded');
    }
    return await this.usersService.updateProfilePicture(user.id, file.path, user.tenantId);
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
