/**
 * TPM Config Controller
 *
 * REST endpoints for TPM configuration management:
 * - GET    /tpm/config/escalation       — Get escalation config
 * - PATCH  /tpm/config/escalation       — Update escalation config
 * - GET    /tpm/config/colors                — Get card status colors
 * - PATCH  /tpm/config/colors                — Update single status color
 * - POST   /tpm/config/colors/reset          — Reset status colors to defaults
 * - DELETE /tpm/config/colors/:statusKey     — Reset single status color to default
 * - GET    /tpm/config/interval-colors       — Get interval type colors
 * - PATCH  /tpm/config/interval-colors       — Update single interval color
 * - POST   /tpm/config/interval-colors/reset — Reset interval colors to defaults
 * - DELETE /tpm/config/interval-colors/:intervalKey — Reset single interval color
 * - GET    /tpm/config/category-colors       — Get card category colors
 * - PATCH  /tpm/config/category-colors       — Update single category color
 * - POST   /tpm/config/category-colors/reset — Reset category colors (remove all)
 * - DELETE /tpm/config/category-colors/:categoryKey — Reset single category color
 * - GET    /tpm/config/templates        — List card templates
 * - POST   /tpm/config/templates        — Create template
 * - PATCH  /tpm/config/templates/:uuid  — Update template
 * - DELETE /tpm/config/templates/:uuid  — Delete template
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
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { TenantFeature } from '../common/decorators/tenant-feature.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import {
  TpmCardCategorySchema,
  TpmCardStatusSchema,
  TpmIntervalTypeSchema,
} from './dto/common.dto.js';
import { CreateTemplateDto } from './dto/create-template.dto.js';
import { UpdateCategoryColorConfigDto } from './dto/update-category-color-config.dto.js';
import { UpdateColorConfigDto } from './dto/update-color-config.dto.js';
import { UpdateEscalationConfigDto } from './dto/update-escalation-config.dto.js';
import { UpdateIntervalColorConfigDto } from './dto/update-interval-color-config.dto.js';
import { UpdateTemplateDto } from './dto/update-template.dto.js';
import { TpmColorConfigService } from './tpm-color-config.service.js';
import { TpmEscalationService } from './tpm-escalation.service.js';
import { TpmTemplatesService } from './tpm-templates.service.js';
import type {
  TpmCardTemplate,
  TpmCategoryColorConfigEntry,
  TpmColorConfigEntry,
  TpmEscalationConfig,
} from './tpm.types.js';

/** Permission constants */
const FEAT = 'tpm';
const MOD_PLANS = 'tpm-plans';
const MOD_CARDS = 'tpm-cards';

@Controller('tpm/config')
@TenantFeature('tpm')
export class TpmConfigController {
  constructor(
    private readonly escalationService: TpmEscalationService,
    private readonly colorConfigService: TpmColorConfigService,
    private readonly templatesService: TpmTemplatesService,
  ) {}

  // ============================================================================
  // ESCALATION CONFIG
  // ============================================================================

  /** GET /tpm/config/escalation — Get escalation config */
  @Get('escalation')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async getEscalationConfig(
    @TenantId() tenantId: number,
  ): Promise<TpmEscalationConfig> {
    return await this.escalationService.getConfig(tenantId);
  }

  /** PATCH /tpm/config/escalation — Update escalation config */
  @Patch('escalation')
  @RequirePermission(FEAT, MOD_PLANS, 'canWrite')
  async updateEscalationConfig(
    @Body() dto: UpdateEscalationConfigDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmEscalationConfig> {
    return await this.escalationService.updateConfig(tenantId, user.id, dto);
  }

  // ============================================================================
  // COLOR CONFIG
  // ============================================================================

  /** GET /tpm/config/colors — Get all status colors */
  @Get('colors')
  @RequirePermission(FEAT, MOD_CARDS, 'canRead')
  async getColors(
    @TenantId() tenantId: number,
  ): Promise<TpmColorConfigEntry[]> {
    return await this.colorConfigService.getColors(tenantId);
  }

  /** PATCH /tpm/config/colors — Update a single status color */
  @Patch('colors')
  @RequirePermission(FEAT, MOD_CARDS, 'canWrite')
  async updateColor(
    @Body() dto: UpdateColorConfigDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmColorConfigEntry> {
    return await this.colorConfigService.updateColor(tenantId, user.id, dto);
  }

  /** POST /tpm/config/colors/reset — Reset card status colors to defaults */
  @Post('colors/reset')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(FEAT, MOD_CARDS, 'canWrite')
  async resetColors(
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmColorConfigEntry[]> {
    return await this.colorConfigService.resetToDefaults(tenantId, user.id);
  }

  /** DELETE /tpm/config/colors/:statusKey — Reset single status color to default */
  @Delete('colors/:statusKey')
  @RequirePermission(FEAT, MOD_CARDS, 'canWrite')
  async resetSingleColor(
    @Param('statusKey') statusKey: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmColorConfigEntry> {
    const parsed = TpmCardStatusSchema.safeParse(statusKey);
    if (!parsed.success) {
      throw new BadRequestException('Ungültiger Status-Key');
    }
    return await this.colorConfigService.resetSingleColor(
      tenantId,
      user.id,
      parsed.data,
    );
  }

  // ============================================================================
  // INTERVAL COLOR CONFIG
  // ============================================================================

  /** GET /tpm/config/interval-colors — Get all interval type colors */
  @Get('interval-colors')
  @RequirePermission(FEAT, MOD_CARDS, 'canRead')
  async getIntervalColors(
    @TenantId() tenantId: number,
  ): Promise<TpmColorConfigEntry[]> {
    return await this.colorConfigService.getIntervalColors(tenantId);
  }

  /** PATCH /tpm/config/interval-colors — Update a single interval color */
  @Patch('interval-colors')
  @RequirePermission(FEAT, MOD_CARDS, 'canWrite')
  async updateIntervalColor(
    @Body() dto: UpdateIntervalColorConfigDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmColorConfigEntry> {
    return await this.colorConfigService.updateIntervalColor(
      tenantId,
      user.id,
      dto,
    );
  }

  /** POST /tpm/config/interval-colors/reset — Reset interval colors to defaults */
  @Post('interval-colors/reset')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(FEAT, MOD_CARDS, 'canWrite')
  async resetIntervalColors(
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmColorConfigEntry[]> {
    return await this.colorConfigService.resetIntervalColorsToDefaults(
      tenantId,
      user.id,
    );
  }

  /** DELETE /tpm/config/interval-colors/:intervalKey — Reset single interval color */
  @Delete('interval-colors/:intervalKey')
  @RequirePermission(FEAT, MOD_CARDS, 'canWrite')
  async resetSingleIntervalColor(
    @Param('intervalKey') intervalKey: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmColorConfigEntry> {
    const parsed = TpmIntervalTypeSchema.safeParse(intervalKey);
    if (!parsed.success) {
      throw new BadRequestException('Ungültiger Intervall-Key');
    }
    return await this.colorConfigService.resetSingleIntervalColor(
      tenantId,
      user.id,
      parsed.data,
    );
  }

  // ============================================================================
  // CATEGORY COLOR CONFIG
  // ============================================================================

  /** GET /tpm/config/category-colors — Get all category colors */
  @Get('category-colors')
  @RequirePermission(FEAT, MOD_CARDS, 'canRead')
  async getCategoryColors(
    @TenantId() tenantId: number,
  ): Promise<TpmCategoryColorConfigEntry[]> {
    return await this.colorConfigService.getCategoryColors(tenantId);
  }

  /** PATCH /tpm/config/category-colors — Update a single category color */
  @Patch('category-colors')
  @RequirePermission(FEAT, MOD_CARDS, 'canWrite')
  async updateCategoryColor(
    @Body() dto: UpdateCategoryColorConfigDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmCategoryColorConfigEntry> {
    return await this.colorConfigService.updateCategoryColor(
      tenantId,
      user.id,
      dto,
    );
  }

  /** POST /tpm/config/category-colors/reset — Remove all custom category colors */
  @Post('category-colors/reset')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(FEAT, MOD_CARDS, 'canWrite')
  async resetCategoryColors(
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmCategoryColorConfigEntry[]> {
    return await this.colorConfigService.resetCategoryColors(tenantId, user.id);
  }

  /** DELETE /tpm/config/category-colors/:categoryKey — Reset single category color */
  @Delete('category-colors/:categoryKey')
  @RequirePermission(FEAT, MOD_CARDS, 'canWrite')
  async resetSingleCategoryColor(
    @Param('categoryKey') categoryKey: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmCategoryColorConfigEntry> {
    const parsed = TpmCardCategorySchema.safeParse(categoryKey);
    if (!parsed.success) {
      throw new BadRequestException('Ungültiger Kategorie-Key');
    }
    return await this.colorConfigService.resetSingleCategoryColor(
      tenantId,
      user.id,
      parsed.data,
    );
  }

  // ============================================================================
  // TEMPLATES
  // ============================================================================

  /** GET /tpm/config/templates — List all card templates */
  @Get('templates')
  @RequirePermission(FEAT, MOD_CARDS, 'canRead')
  async listTemplates(
    @TenantId() tenantId: number,
  ): Promise<TpmCardTemplate[]> {
    return await this.templatesService.listTemplates(tenantId);
  }

  /** POST /tpm/config/templates — Create a card template */
  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(FEAT, MOD_CARDS, 'canWrite')
  async createTemplate(
    @Body() dto: CreateTemplateDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmCardTemplate> {
    return await this.templatesService.createTemplate(tenantId, user.id, dto);
  }

  /** PATCH /tpm/config/templates/:uuid — Update a card template */
  @Patch('templates/:uuid')
  @RequirePermission(FEAT, MOD_CARDS, 'canWrite')
  async updateTemplate(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmCardTemplate> {
    return await this.templatesService.updateTemplate(
      tenantId,
      user.id,
      uuid,
      dto,
    );
  }

  /** DELETE /tpm/config/templates/:uuid — Soft-delete a card template */
  @Delete('templates/:uuid')
  @RequirePermission(FEAT, MOD_CARDS, 'canDelete')
  async deleteTemplate(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ message: string }> {
    await this.templatesService.deleteTemplate(tenantId, user.id, uuid);
    return { message: 'Kartenvorlage gelöscht' };
  }
}
