/**
 * Teams Controller
 *
 * HTTP endpoints for team management:
 * - GET  /teams                      - List all teams
 * - GET  /teams/:id                  - Get team by ID
 * - POST /teams                      - Create team (admin only)
 * - PUT  /teams/:id                  - Update team (admin only)
 * - DELETE /teams/:id                - Delete team (admin only)
 * - GET  /teams/:id/members          - Get team members
 * - POST /teams/:id/members          - Add team member (admin only)
 * - DELETE /teams/:id/members/:userId - Remove team member (admin only)
 * - GET  /teams/:id/assets         - Get team assets
 * - POST /teams/:id/assets         - Add team asset (admin only)
 * - DELETE /teams/:id/assets/:assetId - Remove team asset (admin only)
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import {
  AddAssetDto,
  AddMemberDto,
  CreateTeamDto,
  DeleteTeamQueryDto,
  ListTeamsQueryDto,
  TeamMembersQueryDto,
  UpdateTeamDto,
} from './dto/index.js';
import type { TeamAsset, TeamMember, TeamResponse } from './teams.service.js';
import { TeamsService } from './teams.service.js';

/**
 * Response type for message-only responses
 */
interface MessageResponse {
  message: string;
}

/**
 * Response type for add asset
 */
interface AddAssetResponse {
  id: number;
  message: string;
}

/** Permission constants */
const FEAT = 'teams';
const MOD = 'teams-manage';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  /**
   * GET /teams
   * List all teams with optional filters
   */
  @Get()
  async listTeams(
    @Query() query: ListTeamsQueryDto,
    @TenantId() tenantId: number,
  ): Promise<TeamResponse[]> {
    return await this.teamsService.listTeams(tenantId, {
      departmentId: query.departmentId,
      search: query.search,
      includeMembers: query.includeMembers,
    });
  }

  /**
   * GET /teams/:id
   * Get team by ID
   */
  @Get(':id')
  async getTeamById(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ): Promise<TeamResponse> {
    return await this.teamsService.getTeamById(id, tenantId);
  }

  /**
   * POST /teams
   * Create new team (admin only)
   */
  @Post()
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD, 'canWrite')
  @HttpCode(HttpStatus.CREATED)
  async createTeam(
    @Body() dto: CreateTeamDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TeamResponse> {
    return await this.teamsService.createTeam(dto, user.id, tenantId);
  }

  /**
   * PUT /teams/:id
   * Update team (admin only)
   */
  @Put(':id')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD, 'canWrite')
  async updateTeam(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TeamResponse> {
    return await this.teamsService.updateTeam(id, dto, user.id, tenantId);
  }

  /**
   * DELETE /teams/:id
   * Delete team (admin only)
   * Query param ?force=true to remove members and delete
   */
  @Delete(':id')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD, 'canDelete')
  async deleteTeam(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: DeleteTeamQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.teamsService.deleteTeam(
      id,
      user.id,
      tenantId,
      query.force ?? false,
    );
  }

  /**
   * GET /teams/:id/members
   * Get team members with optional date range for availability filtering
   * Query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
   */
  @Get(':id/members')
  async getTeamMembers(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: TeamMembersQueryDto,
    @TenantId() tenantId: number,
  ): Promise<TeamMember[]> {
    return await this.teamsService.getTeamMembers(
      id,
      tenantId,
      query.startDate,
      query.endDate,
    );
  }

  /**
   * POST /teams/:id/members
   * Add team member (admin only)
   */
  @Post(':id/members')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD, 'canWrite')
  @HttpCode(HttpStatus.CREATED)
  async addTeamMember(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddMemberDto,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.teamsService.addTeamMember(id, dto.userId, tenantId);
  }

  /**
   * DELETE /teams/:id/members/:userId
   * Remove team member (admin only)
   */
  @Delete(':id/members/:userId')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD, 'canDelete')
  async removeTeamMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.teamsService.removeTeamMember(id, userId, tenantId);
  }

  /**
   * GET /teams/:id/assets
   * Get team assets
   */
  @Get(':id/assets')
  async getTeamAssets(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ): Promise<TeamAsset[]> {
    return await this.teamsService.getTeamAssets(id, tenantId);
  }

  /**
   * POST /teams/:id/assets
   * Add asset to team (admin only)
   */
  @Post(':id/assets')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD, 'canWrite')
  @HttpCode(HttpStatus.CREATED)
  async addTeamAsset(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddAssetDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
  ): Promise<AddAssetResponse> {
    return await this.teamsService.addTeamAsset(
      id,
      dto.assetId,
      tenantId,
      user.id,
    );
  }

  /**
   * DELETE /teams/:id/assets/:assetId
   * Remove asset from team (admin only)
   */
  @Delete(':id/assets/:assetId')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD, 'canDelete')
  async removeTeamAsset(
    @Param('id', ParseIntPipe) id: number,
    @Param('assetId', ParseIntPipe) assetId: number,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.teamsService.removeTeamAsset(id, assetId, tenantId);
  }
}
