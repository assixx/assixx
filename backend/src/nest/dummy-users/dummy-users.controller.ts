/**
 * Dummy Users Controller
 *
 * REST endpoints for managing anonymous display accounts.
 * 5 endpoints total. All require admin or root role.
 * No feature gate — always available for admins.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { CreateDummyUserDto } from './dto/create-dummy-user.dto.js';
import { ListDummyUsersQueryDto } from './dto/list-dummy-users-query.dto.js';
import { UpdateDummyUserDto } from './dto/update-dummy-user.dto.js';
import { DummyUsersService } from './dummy-users.service.js';
import type { DummyUser, PaginatedDummyUsers } from './dummy-users.types.js';

@Controller('dummy-users')
@UseGuards(RolesGuard)
@Roles('admin', 'root')
export class DummyUsersController {
  constructor(private readonly service: DummyUsersService) {}

  /** GET /dummy-users — Paginated list */
  @Get()
  async list(
    @Query() query: ListDummyUsersQueryDto,
    @TenantId() tenantId: number,
  ): Promise<PaginatedDummyUsers> {
    return await this.service.list(tenantId, query);
  }

  /** POST /dummy-users — Create a new dummy user */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateDummyUserDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<DummyUser> {
    return await this.service.create(tenantId, dto, user.id);
  }

  /** GET /dummy-users/:uuid — Get single dummy user */
  @Get(':uuid')
  async getOne(
    @Param('uuid') uuid: string,
    @TenantId() tenantId: number,
  ): Promise<DummyUser> {
    return await this.service.getByUuid(tenantId, uuid);
  }

  /** PUT /dummy-users/:uuid — Update dummy user */
  @Put(':uuid')
  async update(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateDummyUserDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<DummyUser> {
    return await this.service.update(tenantId, uuid, dto, user.id);
  }

  /** DELETE /dummy-users/:uuid — Soft-delete dummy user */
  @Delete(':uuid')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ message: string }> {
    await this.service.delete(tenantId, uuid, user.id);
    return { message: 'Dummy-Benutzer gelöscht' };
  }
}
