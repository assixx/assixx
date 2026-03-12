/**
 * TPM Cards Controller
 *
 * REST endpoints for maintenance card (Kamishibai card) management:
 * - POST   /tpm/cards                      — Create card
 * - GET    /tpm/cards                      — List cards (filter by asset/plan/status)
 * - GET    /tpm/cards/:uuid                — Get single card
 * - GET    /tpm/cards/:uuid/executions     — Execution history for card
 * - PATCH  /tpm/cards/:uuid                — Update card
 * - DELETE /tpm/cards/:uuid                — Soft-delete card
 * - POST   /tpm/cards/check-duplicate      — Check for potential duplicates
 *
 * Route note: check-duplicate uses planUuid in body (not :uuid path param)
 * because the duplicate check runs against a plan's asset before card creation.
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
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequireAddon } from '../common/decorators/require-addon.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { CheckDuplicateDto } from './dto/check-duplicate.dto.js';
import { CreateCardDto } from './dto/create-card.dto.js';
import { ListCardsQueryDto } from './dto/list-cards-query.dto.js';
import { ListExecutionsQueryDto } from './dto/list-executions-query.dto.js';
import { UpdateCardDto } from './dto/update-card.dto.js';
import type { DuplicateCheckResult } from './tpm-card-duplicate.service.js';
import { TpmCardDuplicateService } from './tpm-card-duplicate.service.js';
import type { CardListFilter, PaginatedCards } from './tpm-cards.service.js';
import { TpmCardsService } from './tpm-cards.service.js';
import type {
  PaginatedDefects,
  PaginatedExecutions,
} from './tpm-executions.service.js';
import { TpmExecutionsService } from './tpm-executions.service.js';
import { TpmPlansService } from './tpm-plans.service.js';
import type {
  TpmCard,
  TpmCardCategory,
  TpmCardRole,
  TpmCardStatus,
  TpmIntervalType,
} from './tpm.types.js';

/** Permission constants */
const FEAT = 'tpm';
const MOD_CARDS = 'tpm-cards';

@Controller('tpm/cards')
@RequireAddon('tpm')
export class TpmCardsController {
  constructor(
    private readonly cardsService: TpmCardsService,
    private readonly duplicateService: TpmCardDuplicateService,
    private readonly executionsService: TpmExecutionsService,
    private readonly plansService: TpmPlansService,
  ) {}

  // ============================================================================
  // CARD CRUD
  // ============================================================================

  /**
   * POST /tpm/cards/check-duplicate — Check for potential duplicates
   *
   * Must be defined BEFORE :uuid routes to prevent NestJS
   * from matching "check-duplicate" as a UUID parameter.
   */
  @Post('check-duplicate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(FEAT, MOD_CARDS, 'canRead')
  async checkDuplicate(
    @Body() dto: CheckDuplicateDto,
    @TenantId() tenantId: number,
  ): Promise<DuplicateCheckResult> {
    const plan = await this.plansService.getPlan(tenantId, dto.planUuid);
    return await this.duplicateService.checkDuplicate(
      tenantId,
      plan.assetId,
      dto.title,
      dto.intervalType,
    );
  }

  /** POST /tpm/cards — Create a maintenance card */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(FEAT, MOD_CARDS, 'canWrite')
  async createCard(
    @Body() dto: CreateCardDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmCard> {
    return await this.cardsService.createCard(tenantId, dto, user.id);
  }

  /** GET /tpm/cards — List cards with filters (assetUuid, planUuid, or status required) */
  @Get()
  @RequirePermission(FEAT, MOD_CARDS, 'canRead')
  async listCards(
    @Query() query: ListCardsQueryDto,
    @TenantId() tenantId: number,
  ): Promise<PaginatedCards> {
    const filters = buildFilters(query);

    if (query.assetUuid !== undefined) {
      return await this.cardsService.listCardsForAsset(
        tenantId,
        query.assetUuid,
        query.page,
        query.limit,
        filters,
      );
    }

    if (query.planUuid !== undefined) {
      return await this.cardsService.listCardsForPlan(
        tenantId,
        query.planUuid,
        query.page,
        query.limit,
        filters,
      );
    }

    if (query.status !== undefined) {
      return await this.cardsService.getCardsByStatus(
        tenantId,
        query.status,
        query.page,
        query.limit,
      );
    }

    throw new BadRequestException(
      'assetUuid, planUuid oder status muss angegeben werden',
    );
  }

  /** GET /tpm/cards/:uuid/executions — Execution history for a card */
  @Get(':uuid/executions')
  @RequirePermission(FEAT, MOD_CARDS, 'canRead')
  async listCardExecutions(
    @Param('uuid') cardUuid: string,
    @Query() query: ListExecutionsQueryDto,
    @TenantId() tenantId: number,
  ): Promise<PaginatedExecutions> {
    return await this.executionsService.listExecutionsForCard(
      tenantId,
      cardUuid,
      query.page,
      query.limit,
    );
  }

  /** GET /tpm/cards/:uuid/defects — Mängelliste for a card */
  @Get(':uuid/defects')
  @RequirePermission(FEAT, MOD_CARDS, 'canRead')
  async listCardDefects(
    @Param('uuid') cardUuid: string,
    @Query() query: ListExecutionsQueryDto,
    @TenantId() tenantId: number,
  ): Promise<PaginatedDefects> {
    return await this.executionsService.listDefectsForCard(
      tenantId,
      cardUuid,
      query.page,
      query.limit,
    );
  }

  /** GET /tpm/cards/:uuid — Get single card by UUID */
  @Get(':uuid')
  @RequirePermission(FEAT, MOD_CARDS, 'canRead')
  async getCard(
    @Param('uuid') uuid: string,
    @TenantId() tenantId: number,
  ): Promise<TpmCard> {
    return await this.cardsService.getCard(tenantId, uuid);
  }

  /** PATCH /tpm/cards/:uuid — Update card */
  @Patch(':uuid')
  @RequirePermission(FEAT, MOD_CARDS, 'canWrite')
  async updateCard(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateCardDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmCard> {
    return await this.cardsService.updateCard(tenantId, user.id, uuid, dto);
  }

  /** DELETE /tpm/cards/:uuid — Soft-delete card (is_active=4) */
  @Delete(':uuid')
  @RequirePermission(FEAT, MOD_CARDS, 'canDelete')
  async deleteCard(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ message: string }> {
    await this.cardsService.deleteCard(tenantId, user.id, uuid);
    return { message: 'TPM-Karte gelöscht' };
  }
}

// ============================================================================
// Helpers (module-level pure functions)
// ============================================================================

/** Extract defined filter properties (avoids undefined with exactOptionalPropertyTypes) */
function buildFilters(source: {
  status?: TpmCardStatus | undefined;
  intervalType?: TpmIntervalType | undefined;
  cardRole?: TpmCardRole | undefined;
  cardCategory?: TpmCardCategory | undefined;
}): CardListFilter {
  const filters: CardListFilter = {};
  if (source.status !== undefined) filters.status = source.status;
  if (source.intervalType !== undefined)
    filters.intervalType = source.intervalType;
  if (source.cardRole !== undefined) filters.cardRole = source.cardRole;
  if (source.cardCategory !== undefined)
    filters.cardCategory = source.cardCategory;
  return filters;
}
