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
 * - GET  /teams/:id/machines         - Get team machines
 * - POST /teams/:id/machines         - Add team machine (admin only)
 * - DELETE /teams/:id/machines/:machineId - Remove team machine (admin only)
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
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import {
  AddMachineDto,
  AddMemberDto,
  CreateTeamDto,
  DeleteTeamQueryDto,
  ListTeamsQueryDto,
  TeamMembersQueryDto,
  UpdateTeamDto,
} from './dto/index.js';
import type { TeamMachine, TeamMember, TeamResponse } from './teams.service.js';
import { TeamsService } from './teams.service.js';

/**
 * Response type for message-only responses
 */
interface MessageResponse {
  message: string;
}

/**
 * Response type for add machine
 */
interface AddMachineResponse {
  id: number;
  message: string;
}

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
  async deleteTeam(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: DeleteTeamQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.teamsService.deleteTeam(id, user.id, tenantId, query.force ?? false);
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
    return await this.teamsService.getTeamMembers(id, tenantId, query.startDate, query.endDate);
  }

  /**
   * POST /teams/:id/members
   * Add team member (admin only)
   */
  @Post(':id/members')
  @Roles('admin', 'root')
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
  async removeTeamMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.teamsService.removeTeamMember(id, userId, tenantId);
  }

  /**
   * GET /teams/:id/machines
   * Get team machines
   */
  @Get(':id/machines')
  async getTeamMachines(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ): Promise<TeamMachine[]> {
    return await this.teamsService.getTeamMachines(id, tenantId);
  }

  /**
   * POST /teams/:id/machines
   * Add machine to team (admin only)
   */
  @Post(':id/machines')
  @Roles('admin', 'root')
  @HttpCode(HttpStatus.CREATED)
  async addTeamMachine(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddMachineDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
  ): Promise<AddMachineResponse> {
    return await this.teamsService.addTeamMachine(id, dto.machineId, tenantId, user.id);
  }

  /**
   * DELETE /teams/:id/machines/:machineId
   * Remove machine from team (admin only)
   */
  @Delete(':id/machines/:machineId')
  @Roles('admin', 'root')
  async removeTeamMachine(
    @Param('id', ParseIntPipe) id: number,
    @Param('machineId', ParseIntPipe) machineId: number,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.teamsService.removeTeamMachine(id, machineId, tenantId);
  }
}
