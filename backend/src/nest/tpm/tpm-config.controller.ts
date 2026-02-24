/**
 * TPM Config Controller
 *
 * REST endpoints for TPM configuration management:
 * - GET    /tpm/config/escalation       — Get escalation config
 * - PATCH  /tpm/config/escalation       — Update escalation config
 * - GET    /tpm/config/colors                — Get card status colors
 * - PATCH  /tpm/config/colors                — Update single status color
 * - POST   /tpm/config/colors/reset          — Reset status colors to defaults
 * - GET    /tpm/config/interval-colors       — Get interval type colors
 * - PATCH  /tpm/config/interval-colors       — Update single interval color
 * - POST   /tpm/config/interval-colors/reset — Reset interval colors to defaults
 * - GET    /tpm/config/templates        — List card templates
 * - POST   /tpm/config/templates        — Create template
 * - PATCH  /tpm/config/templates/:uuid  — Update template
 * - DELETE /tpm/config/templates/:uuid  — Delete template
 */
import {
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

import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { TenantFeature } from '../common/decorators/tenant-feature.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import { CreateTemplateDto } from './dto/create-template.dto.js';
import { UpdateColorConfigDto } from './dto/update-color-config.dto.js';
import { UpdateEscalationConfigDto } from './dto/update-escalation-config.dto.js';
import { UpdateIntervalColorConfigDto } from './dto/update-interval-color-config.dto.js';
import { UpdateTemplateDto } from './dto/update-template.dto.js';
import { TpmColorConfigService } from './tpm-color-config.service.js';
import { TpmEscalationService } from './tpm-escalation.service.js';
import { TpmTemplatesService } from './tpm-templates.service.js';
import type {
  TpmCardTemplate,
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
    @TenantId() tenantId: number,
  ): Promise<TpmEscalationConfig> {
    return await this.escalationService.updateConfig(tenantId, dto);
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
    @TenantId() tenantId: number,
  ): Promise<TpmColorConfigEntry> {
    return await this.colorConfigService.updateColor(tenantId, dto);
  }

  /** POST /tpm/config/colors/reset — Reset card status colors to defaults */
  @Post('colors/reset')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(FEAT, MOD_CARDS, 'canWrite')
  async resetColors(
    @TenantId() tenantId: number,
  ): Promise<TpmColorConfigEntry[]> {
    return await this.colorConfigService.resetToDefaults(tenantId);
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
    @TenantId() tenantId: number,
  ): Promise<TpmColorConfigEntry> {
    return await this.colorConfigService.updateIntervalColor(tenantId, dto);
  }

  /** POST /tpm/config/interval-colors/reset — Reset interval colors to defaults */
  @Post('interval-colors/reset')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(FEAT, MOD_CARDS, 'canWrite')
  async resetIntervalColors(
    @TenantId() tenantId: number,
  ): Promise<TpmColorConfigEntry[]> {
    return await this.colorConfigService.resetIntervalColorsToDefaults(
      tenantId,
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
    @TenantId() tenantId: number,
  ): Promise<TpmCardTemplate> {
    return await this.templatesService.createTemplate(tenantId, dto);
  }

  /** PATCH /tpm/config/templates/:uuid — Update a card template */
  @Patch('templates/:uuid')
  @RequirePermission(FEAT, MOD_CARDS, 'canWrite')
  async updateTemplate(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateTemplateDto,
    @TenantId() tenantId: number,
  ): Promise<TpmCardTemplate> {
    return await this.templatesService.updateTemplate(tenantId, uuid, dto);
  }

  /** DELETE /tpm/config/templates/:uuid — Soft-delete a card template */
  @Delete('templates/:uuid')
  @RequirePermission(FEAT, MOD_CARDS, 'canDelete')
  async deleteTemplate(
    @Param('uuid') uuid: string,
    @TenantId() tenantId: number,
  ): Promise<{ message: string }> {
    await this.templatesService.deleteTemplate(tenantId, uuid);
    return { message: 'Kartenvorlage gelöscht' };
  }
}
