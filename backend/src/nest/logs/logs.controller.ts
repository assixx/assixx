/**
 * Logs Controller
 *
 * HTTP endpoints for system audit logs (Root only):
 * - GET    /logs       - Get system logs with filters
 * - GET    /logs/stats - Get log statistics
 * - DELETE /logs       - Delete logs (requires password confirmation)
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import {
  DeleteLogsBodyDto,
  ListLogsQueryDto,
} from './dto/index.js';
import type {
  DeleteLogsResponseData,
  LogsListResponseData,
  LogsStatsResponseData,
} from './dto/index.js';
import { LogsService } from './logs.service.js';

@Controller('logs')
@Roles('root') // All endpoints require root role
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  /**
   * GET /logs
   * Get system logs with filters
   * Filtered by the current user's tenant
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getLogs(
    @CurrentUser() user: NestAuthUser,
    @Query() query: ListLogsQueryDto,
  ): Promise<LogsListResponseData> {
    return await this.logsService.getLogs(user, query);
  }

  /**
   * GET /logs/stats
   * Get log statistics for the current tenant
   */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getStats(@CurrentUser() user: NestAuthUser): Promise<LogsStatsResponseData> {
    return await this.logsService.getStats(user);
  }

  /**
   * DELETE /logs
   * Delete logs with filters
   * Requires password confirmation for security
   */
  @Delete()
  @HttpCode(HttpStatus.OK)
  async deleteLogs(
    @CurrentUser() user: NestAuthUser,
    @Body() dto: DeleteLogsBodyDto,
  ): Promise<DeleteLogsResponseData> {
    return await this.logsService.deleteLogs(user, dto);
  }
}
