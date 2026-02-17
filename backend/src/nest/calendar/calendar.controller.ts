/**
 * Calendar Controller
 *
 * HTTP endpoints for calendar event management:
 * - GET  /calendar/events        - List events with filters
 * - GET  /calendar/events/:id    - Get event by ID
 * - POST /calendar/events        - Create event
 * - PUT  /calendar/events/:id    - Update event
 * - DELETE /calendar/events/:id  - Delete event
 * - GET  /calendar/export        - Export events (ICS/CSV)
 * - GET  /calendar/dashboard     - Get upcoming events
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
  Res,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { TenantFeature } from '../common/decorators/tenant-feature.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import type {
  CalendarEventResponse,
  PaginatedEventsResult,
} from './calendar.service.js';
import { CalendarService } from './calendar.service.js';
import {
  CreateEventDto,
  DashboardEventsQueryDto,
  ExportEventsQueryDto,
  ListEventsQueryDto,
  UpdateEventDto,
} from './dto/index.js';

/**
 * Response type for message-only responses
 */
interface MessageResponse {
  message: string;
}

/** Permission constants for \@RequirePermission decorator */
const CAL_FEATURE = 'calendar';
const CAL_EVENTS = 'calendar-events';

@Controller('calendar')
@TenantFeature('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  /** GET /calendar/events */
  @Get('events')
  @RequirePermission(CAL_FEATURE, CAL_EVENTS, 'canRead')
  async listEvents(
    @Query() query: ListEventsQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<PaginatedEventsResult> {
    return await this.calendarService.listEvents(
      tenantId,
      user.id,
      user.departmentId ?? null,
      user.teamId ?? null,
      {
        status: query.status,
        filter: query.filter,
        search: query.search,
        startDate: query.startDate,
        endDate: query.endDate,
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
    );
  }

  /** GET /calendar/dashboard */
  @Get('dashboard')
  @RequirePermission(CAL_FEATURE, CAL_EVENTS, 'canRead')
  async getDashboardEvents(
    @Query() query: DashboardEventsQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<CalendarEventResponse[]> {
    return await this.calendarService.getDashboardEvents(
      tenantId,
      user.id,
      query.limit ?? 10,
    );
  }

  /** GET /calendar/recently-added */
  @Get('recently-added')
  @RequirePermission(CAL_FEATURE, CAL_EVENTS, 'canRead')
  async getRecentlyAddedEvents(
    @Query() query: DashboardEventsQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<CalendarEventResponse[]> {
    return await this.calendarService.getRecentlyAddedEvents(
      tenantId,
      user.id,
      query.limit ?? 3,
    );
  }

  /** GET /calendar/upcoming-count */
  @Get('upcoming-count')
  @RequirePermission(CAL_FEATURE, CAL_EVENTS, 'canRead')
  async getUpcomingCount(
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ count: number }> {
    return await this.calendarService.getUpcomingCount(
      tenantId,
      user.id,
      user.departmentId ?? null,
      user.teamId ?? null,
    );
  }

  /** GET /calendar/export */
  @Get('export')
  @RequirePermission(CAL_FEATURE, CAL_EVENTS, 'canRead')
  async exportEvents(
    @Query() query: ExportEventsQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const data = await this.calendarService.exportEvents(
      tenantId,
      user.id,
      user.departmentId ?? null,
      query.format,
    );

    const contentType = query.format === 'ics' ? 'text/calendar' : 'text/csv';
    const filename = query.format === 'ics' ? 'calendar.ics' : 'calendar.csv';

    await reply
      .header('Content-Type', contentType)
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(data);
  }

  /** GET /calendar/events/uuid/:uuid */
  @Get('events/uuid/:uuid')
  @RequirePermission(CAL_FEATURE, CAL_EVENTS, 'canRead')
  async getEventByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<CalendarEventResponse> {
    return await this.calendarService.getEventByUuid(uuid, tenantId, user.id);
  }

  /**
   * GET /calendar/events/:id
   * @deprecated Use GET /calendar/events/uuid/:uuid instead
   */
  @Get('events/:id')
  @RequirePermission(CAL_FEATURE, CAL_EVENTS, 'canRead')
  async getEventById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<CalendarEventResponse> {
    return await this.calendarService.getEventById(id, tenantId, user.id);
  }

  /** POST /calendar/events */
  @Post('events')
  @RequirePermission(CAL_FEATURE, CAL_EVENTS, 'canWrite')
  @HttpCode(HttpStatus.CREATED)
  async createEvent(
    @Body() dto: CreateEventDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<CalendarEventResponse> {
    return await this.calendarService.createEvent(dto, tenantId, user.id);
  }

  /** PUT /calendar/events/uuid/:uuid */
  @Put('events/uuid/:uuid')
  @RequirePermission(CAL_FEATURE, CAL_EVENTS, 'canWrite')
  async updateEventByUuid(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<CalendarEventResponse> {
    return await this.calendarService.updateEventByUuid(
      uuid,
      dto,
      tenantId,
      user.id,
      user.role,
    );
  }

  /**
   * PUT /calendar/events/:id
   * @deprecated Use PUT /calendar/events/uuid/:uuid instead
   */
  @Put('events/:id')
  @RequirePermission(CAL_FEATURE, CAL_EVENTS, 'canWrite')
  async updateEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<CalendarEventResponse> {
    return await this.calendarService.updateEvent(
      id,
      dto,
      tenantId,
      user.id,
      user.role,
    );
  }

  /** DELETE /calendar/events/uuid/:uuid */
  @Delete('events/uuid/:uuid')
  @RequirePermission(CAL_FEATURE, CAL_EVENTS, 'canDelete')
  async deleteEventByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.calendarService.deleteEventByUuid(
      uuid,
      tenantId,
      user.id,
      user.role,
    );
  }

  /**
   * DELETE /calendar/events/:id
   * @deprecated Use DELETE /calendar/events/uuid/:uuid instead
   */
  @Delete('events/:id')
  @RequirePermission(CAL_FEATURE, CAL_EVENTS, 'canDelete')
  async deleteEvent(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.calendarService.deleteEvent(
      id,
      tenantId,
      user.id,
      user.role,
    );
  }
}
