/**
 * Settings Controller
 *
 * HTTP endpoints for settings management:
 *
 * SYSTEM SETTINGS:
 * - GET    /settings/system           - List all system settings (root only)
 * - GET    /settings/system/:key      - Get system setting by key
 * - POST   /settings/system           - Create system setting (root only)
 * - PUT    /settings/system/:key      - Update system setting (root only)
 * - DELETE /settings/system/:key      - Delete system setting (root only)
 *
 * TENANT SETTINGS:
 * - GET    /settings/tenant           - List all tenant settings
 * - GET    /settings/tenant/:key      - Get tenant setting by key
 * - POST   /settings/tenant           - Create tenant setting (admin only)
 * - PUT    /settings/tenant/:key      - Update tenant setting (admin only)
 * - DELETE /settings/tenant/:key      - Delete tenant setting (admin only)
 *
 * USER SETTINGS:
 * - GET    /settings/user             - List all user settings
 * - GET    /settings/user/:key        - Get user setting by key
 * - POST   /settings/user             - Create user setting
 * - PUT    /settings/user/:key        - Update user setting
 * - DELETE /settings/user/:key        - Delete user setting
 *
 * ADMIN USER SETTINGS:
 * - GET    /settings/admin/users/:userId - Get another user's settings (admin only)
 *
 * COMMON:
 * - GET    /settings/categories       - Get all settings categories
 * - PUT    /settings/bulk             - Bulk update settings
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { JwtPayload } from '../common/interfaces/auth.interface.js';
import {
  type BulkSettingItem,
  BulkUpdateSettingsDto,
  CreateSystemSettingDto,
  CreateTenantSettingDto,
  CreateUserSettingDto,
  SettingsFilterQueryDto,
  SystemSettingsFilterQueryDto,
  UpdateSystemSettingDto,
  UpdateTenantSettingDto,
  UpdateUserSettingDto,
  UserSettingsFilterQueryDto,
} from './dto/index.js';
import type {
  BulkUpdateResult,
  ParsedSetting,
  SettingCategoryDefinition,
  SettingData,
} from './settings.service.js';
import { SettingsService } from './settings.service.js';

/** Header name constant to avoid duplication */
const USER_AGENT_HEADER = 'user-agent';

/**
 * Response type for success operations
 */
interface SuccessResponse {
  success: boolean;
}

/**
 * Response type for settings list
 */
interface SettingsListResponse {
  settings: ParsedSetting[];
}

/**
 * Response type for categories
 */
interface CategoriesResponse {
  categories: SettingCategoryDefinition[];
}

/**
 * Response type for bulk update
 */
interface BulkUpdateResponse {
  results: BulkUpdateResult[];
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ==================== SYSTEM SETTINGS ====================

  /**
   * GET /settings/system
   * List all system settings (root only)
   */
  @Get('system')
  @Roles('root')
  async getSystemSettings(
    @Query() query: SystemSettingsFilterQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<SettingsListResponse> {
    const settings = await this.settingsService.getSystemSettings(
      {
        category: query.category,
        is_public: query.is_public,
        search: query.search,
      },
      user.role,
    );
    return { settings };
  }

  /**
   * GET /settings/system/:key
   * Get system setting by key
   */
  @Get('system/:key')
  async getSystemSetting(
    @Param('key') key: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ParsedSetting> {
    return await this.settingsService.getSystemSetting(key, user.role);
  }

  /**
   * POST /settings/system
   * Create system setting (root only)
   */
  @Post('system')
  @Roles('root')
  async createSystemSetting(
    @Body() dto: CreateSystemSettingDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(USER_AGENT_HEADER) userAgent: string,
  ): Promise<SuccessResponse> {
    const data: SettingData = {
      setting_key: dto.setting_key,
      setting_value: dto.setting_value,
      value_type: dto.value_type,
      category: dto.category,
      description: dto.description,
      is_public: dto.is_public,
    };
    return await this.settingsService.upsertSystemSetting(
      data,
      user.id,
      tenantId,
      user.role,
      ip,
      userAgent,
    );
  }

  /**
   * PUT /settings/system/:key
   * Update system setting (root only)
   */
  @Put('system/:key')
  @Roles('root')
  async updateSystemSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSystemSettingDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(USER_AGENT_HEADER) userAgent: string,
  ): Promise<SuccessResponse> {
    const data: SettingData = {
      setting_key: key,
      setting_value: dto.setting_value,
      value_type: dto.value_type,
      category: dto.category,
      description: dto.description,
      is_public: dto.is_public,
    };
    return await this.settingsService.upsertSystemSetting(
      data,
      user.id,
      tenantId,
      user.role,
      ip,
      userAgent,
    );
  }

  /**
   * DELETE /settings/system/:key
   * Delete system setting (root only)
   */
  @Delete('system/:key')
  @Roles('root')
  async deleteSystemSetting(
    @Param('key') key: string,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(USER_AGENT_HEADER) userAgent: string,
  ): Promise<SuccessResponse> {
    return await this.settingsService.deleteSystemSetting(
      key,
      user.id,
      tenantId,
      user.role,
      ip,
      userAgent,
    );
  }

  // ==================== TENANT SETTINGS ====================

  /**
   * GET /settings/tenant
   * List all tenant settings
   */
  @Get('tenant')
  async getTenantSettings(
    @Query() query: SettingsFilterQueryDto,
    @TenantId() tenantId: number,
  ): Promise<SettingsListResponse> {
    const settings = await this.settingsService.getTenantSettings(tenantId, {
      category: query.category,
      search: query.search,
    });
    return { settings };
  }

  /**
   * GET /settings/tenant/:key
   * Get tenant setting by key
   */
  @Get('tenant/:key')
  async getTenantSetting(
    @Param('key') key: string,
    @TenantId() tenantId: number,
  ): Promise<ParsedSetting> {
    return await this.settingsService.getTenantSetting(key, tenantId);
  }

  /**
   * POST /settings/tenant
   * Create tenant setting (admin only)
   */
  @Post('tenant')
  @Roles('admin', 'root')
  async createTenantSetting(
    @Body() dto: CreateTenantSettingDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(USER_AGENT_HEADER) userAgent: string,
  ): Promise<SuccessResponse> {
    const data: SettingData = {
      setting_key: dto.setting_key,
      setting_value: dto.setting_value,
      value_type: dto.value_type,
      category: dto.category,
    };
    return await this.settingsService.upsertTenantSetting(
      data,
      tenantId,
      user.id,
      user.role,
      ip,
      userAgent,
    );
  }

  /**
   * PUT /settings/tenant/:key
   * Update tenant setting (admin only)
   */
  @Put('tenant/:key')
  @Roles('admin', 'root')
  async updateTenantSetting(
    @Param('key') key: string,
    @Body() dto: UpdateTenantSettingDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(USER_AGENT_HEADER) userAgent: string,
  ): Promise<SuccessResponse> {
    const data: SettingData = {
      setting_key: key,
      setting_value: dto.setting_value,
      value_type: dto.value_type,
      category: dto.category,
    };
    return await this.settingsService.upsertTenantSetting(
      data,
      tenantId,
      user.id,
      user.role,
      ip,
      userAgent,
    );
  }

  /**
   * DELETE /settings/tenant/:key
   * Delete tenant setting (admin only)
   */
  @Delete('tenant/:key')
  @Roles('admin', 'root')
  async deleteTenantSetting(
    @Param('key') key: string,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(USER_AGENT_HEADER) userAgent: string,
  ): Promise<SuccessResponse> {
    return await this.settingsService.deleteTenantSetting(
      key,
      tenantId,
      user.id,
      user.role,
      ip,
      userAgent,
    );
  }

  // ==================== USER SETTINGS ====================

  /**
   * GET /settings/user
   * List all user settings
   */
  @Get('user')
  async getUserSettings(
    @Query() query: UserSettingsFilterQueryDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
  ): Promise<SettingsListResponse> {
    const settings = await this.settingsService.getUserSettings(
      user.id,
      { category: query.category, search: query.search },
      tenantId,
      query.team_id,
    );
    return { settings };
  }

  /**
   * GET /settings/user/:key
   * Get user setting by key
   */
  @Get('user/:key')
  async getUserSetting(
    @Param('key') key: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ParsedSetting> {
    return await this.settingsService.getUserSetting(key, user.id);
  }

  /**
   * POST /settings/user
   * Create user setting
   */
  @Post('user')
  async createUserSetting(
    @Body() dto: CreateUserSettingDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(USER_AGENT_HEADER) userAgent: string,
  ): Promise<SuccessResponse> {
    const data: SettingData & { team_id?: number | null | undefined } = {
      setting_key: dto.setting_key,
      setting_value: dto.setting_value,
      value_type: dto.value_type,
      category: dto.category,
      team_id: dto.team_id,
    };
    return await this.settingsService.upsertUserSetting(
      data,
      user.id,
      tenantId,
      dto.team_id,
      ip,
      userAgent,
    );
  }

  /**
   * PUT /settings/user/:key
   * Update user setting
   */
  @Put('user/:key')
  async updateUserSetting(
    @Param('key') key: string,
    @Body() dto: UpdateUserSettingDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(USER_AGENT_HEADER) userAgent: string,
  ): Promise<SuccessResponse> {
    const data: SettingData & { team_id?: number | null | undefined } = {
      setting_key: key,
      setting_value: dto.setting_value,
      value_type: dto.value_type,
      category: dto.category,
      team_id: dto.team_id,
    };
    return await this.settingsService.upsertUserSetting(
      data,
      user.id,
      tenantId,
      dto.team_id,
      ip,
      userAgent,
    );
  }

  /**
   * DELETE /settings/user/:key
   * Delete user setting
   */
  @Delete('user/:key')
  async deleteUserSetting(
    @Param('key') key: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SuccessResponse> {
    return await this.settingsService.deleteUserSetting(key, user.id);
  }

  // ==================== ADMIN USER SETTINGS ====================

  /**
   * GET /settings/admin/users/:userId
   * Get another user's settings (admin only)
   */
  @Get('admin/users/:userId')
  @Roles('admin', 'root')
  async getAdminUserSettings(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
  ): Promise<SettingsListResponse> {
    const settings = await this.settingsService.getAdminUserSettings(
      userId,
      tenantId,
      user.role,
    );
    return { settings };
  }

  // ==================== COMMON ====================

  /**
   * GET /settings/categories
   * Get all settings categories
   */
  @Get('categories')
  getCategories(): CategoriesResponse {
    const categories = this.settingsService.getCategories();
    return { categories };
  }

  /**
   * PUT /settings/bulk
   * Bulk update settings
   */
  @Put('bulk')
  async bulkUpdate(
    @Body() dto: BulkUpdateSettingsDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(USER_AGENT_HEADER) userAgent: string,
  ): Promise<BulkUpdateResponse> {
    const contextId = dto.type === 'user' ? user.id : tenantId;
    const settingsData: SettingData[] = dto.settings.map(
      (s: BulkSettingItem) => ({
        setting_key: s.setting_key,
        setting_value: s.setting_value,
        value_type: s.value_type,
        category: s.category,
        description: s.description,
        is_public: s.is_public,
      }),
    );

    const results = await this.settingsService.bulkUpdate(
      dto.type,
      settingsData,
      contextId,
      user.id,
      tenantId,
      user.role,
      ip,
      userAgent,
    );
    return { results };
  }
}
