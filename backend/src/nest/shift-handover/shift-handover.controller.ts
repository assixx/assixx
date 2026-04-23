/**
 * Shift Handover Controller (Plan §2.6).
 *
 * Owns the 13 REST endpoints + `/my-permissions` self-check for the
 * shift-handover feature. Addon gate `shift_planning` applies to every
 * endpoint via the class-level `@RequireAddon` decorator (ADR-033 +
 * globally-registered `TenantAddonGuard`); per-endpoint Layer-2 access
 * uses `@RequirePermission(SHIFT_PLANNING_ADDON, ..., 'canX')` (ADR-020).
 * Zero `@Roles('admin','root')` on mutations per ADR-045's hard rule.
 *
 * Layer-1 (ADR-045 `canManage`) guards — upsert/delete template, reopen
 * entry — are enforced inline via `assertCanManage()` using the already
 * global `ScopeService`; keeps the single-source-of-truth rule intact
 * (`role === 'root' || (admin && hasFullAccess) || orgScope.isAnyLead`).
 *
 * Same-team read scope (plan Product Decision #12) is enforced by
 * `assertCanReadTeam()`: full-access / root bypass, else scope.teamIds
 * covers the management path and `EntriesService.isTeamMember()` covers
 * plain `user_teams` membership for rank-and-file employees.
 *
 * Multipart upload pipeline follows ADR-042 verbatim: the global
 * `@fastify/multipart` plugin (registered at `main.ts:175`) parses the
 * stream; `FileInterceptor('file', …)` from
 * `@webundsoehne/nest-fastify-file-upload` binds it to the route; the
 * file reaches the service already in memory as `MulterFile.buffer`. The
 * service (`ShiftHandoverAttachmentsService.uploadForEntry`) owns the
 * full validation + disk-write + INSERT lifecycle (plan §2.4 Pattern B),
 * so the controller stays thin.
 *
 * Audit-log writes for template upsert / delete are issued here and
 * close the Phase-2 DoD gap flagged in Session 5's changelog entry
 * (§2.2 service intentionally left logging to the controller layer so
 * the same path covers future CLI callers via direct-service access).
 * Entry submit / reopen audit logs live in `ShiftHandoverEntriesService`
 * where the state transition is owned.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.6
 * @see docs/infrastructure/adr/ADR-007-api-response-standardization.md
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md
 * @see docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md
 * @see docs/infrastructure/adr/ADR-033-addon-based-saas-model.md
 * @see docs/infrastructure/adr/ADR-042-multipart-file-upload-pipeline.md
 * @see docs/infrastructure/adr/ADR-045-permission-visibility-design.md
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { promises as fs } from 'node:fs';

import { inlineHeader } from '../../utils/content-disposition.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequireAddon } from '../common/decorators/require-addon.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import type { MulterFile } from '../common/interfaces/multer.interface.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { ScopeService } from '../hierarchy-permission/scope.service.js';
import { ActiveShiftResolverService } from './active-shift-resolver.service.js';
import {
  CreateEntryDto,
  CreateTemplateDto,
  ListEntriesQueryDto,
  ReopenEntryDto,
  UpdateEntryDto,
  UpdateTemplateDto,
} from './dto/index.js';
import { ShiftHandoverAttachmentsService } from './shift-handover-attachments.service.js';
import { ShiftHandoverEntriesService } from './shift-handover-entries.service.js';
import { ShiftHandoverTemplatesService } from './shift-handover-templates.service.js';
import {
  SHIFT_HANDOVER_ENTRIES_MODULE,
  SHIFT_HANDOVER_TEMPLATES_MODULE,
  SHIFT_PLANNING_ADDON,
} from './shift-handover.permissions.js';
import {
  SHIFT_HANDOVER_MAX_ATTACHMENT_SIZE,
  type ShiftHandoverAttachmentRow,
  type ShiftHandoverEntryRow,
  type ShiftHandoverMyPermissions,
  type ShiftHandoverTemplateRow,
} from './shift-handover.types.js';

const { memoryStorage } = multer;

/**
 * Multer options for the attachment upload endpoint. Engine is
 * `memoryStorage()` so the buffer reaches the service intact — the
 * service picks the disk destination (plan §2.4 §0.7 ADAPT decision)
 * and writes with a deterministic UUIDv7 filename. `files: 1` caps
 * accidental multi-part submissions at the transport layer; the 5-per-
 * entry cap is enforced inside the service.
 */
const shiftHandoverFileOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: SHIFT_HANDOVER_MAX_ATTACHMENT_SIZE,
    files: 1,
  },
};

@Controller('shift-handover')
@RequireAddon(SHIFT_PLANNING_ADDON)
export class ShiftHandoverController {
  constructor(
    private readonly templatesService: ShiftHandoverTemplatesService,
    private readonly entriesService: ShiftHandoverEntriesService,
    private readonly attachmentsService: ShiftHandoverAttachmentsService,
    private readonly resolver: ActiveShiftResolverService,
    private readonly scope: ScopeService,
    private readonly activityLogger: ActivityLoggerService,
  ) {
    // resolver is wired here so Phase-5 UI can reach getShiftEndClock via
    // a small future endpoint without reshaping DI. Currently unused at
    // this level — intentional placeholder that avoids a DI refactor in
    // Session 7+ when the frontend needs shift-window metadata.
    void this.resolver;
  }

  // ──────────────────────────────────────────────────────────────────
  // Templates — plan §2.6 rows 1–3
  // ──────────────────────────────────────────────────────────────────

  /**
   * Returns the team's active template. Synthesises an empty-fields
   * default when no row exists so the caller always gets a usable shape
   * (matches the plan §2.2 "default-empty" note, keeps the service honest
   * by returning `null` and the controller adapts for the HTTP caller).
   */
  @Get('templates/:teamId')
  @RequirePermission(SHIFT_PLANNING_ADDON, SHIFT_HANDOVER_TEMPLATES_MODULE, 'canRead')
  async getTemplate(
    @Param('teamId', ParseIntPipe) teamId: number,
  ): Promise<ShiftHandoverTemplateRow | { team_id: number; fields: [] }> {
    const row = await this.templatesService.getTemplateForTeam(teamId);
    return row ?? { team_id: teamId, fields: [] };
  }

  @Put('templates/:teamId')
  @RequirePermission(SHIFT_PLANNING_ADDON, SHIFT_HANDOVER_TEMPLATES_MODULE, 'canWrite')
  async upsertTemplate(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() dto: CreateTemplateDto | UpdateTemplateDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<ShiftHandoverTemplateRow> {
    await this.assertCanManage(user);
    const row = await this.templatesService.upsertTemplate(teamId, dto.fields, user.id);
    void this.activityLogger.log({
      tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'shift',
      details: `Übergabe-Template aktualisiert (team=${teamId}, fields=${dto.fields.length})`,
      newValues: { templateId: row.id, teamId, fieldCount: dto.fields.length },
    });
    return row;
  }

  @Delete('templates/:teamId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(SHIFT_PLANNING_ADDON, SHIFT_HANDOVER_TEMPLATES_MODULE, 'canDelete')
  async deleteTemplate(
    @Param('teamId', ParseIntPipe) teamId: number,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<void> {
    await this.assertCanManage(user);
    await this.templatesService.deleteTemplate(teamId, user.id);
    void this.activityLogger.log({
      tenantId,
      userId: user.id,
      action: 'delete',
      entityType: 'shift',
      details: `Übergabe-Template gelöscht (team=${teamId})`,
      oldValues: { teamId },
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // Entries — plan §2.6 rows 4–9
  // ──────────────────────────────────────────────────────────────────

  @Post('entries')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(SHIFT_PLANNING_ADDON, SHIFT_HANDOVER_ENTRIES_MODULE, 'canWrite')
  async createEntry(
    @Body() dto: CreateEntryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<ShiftHandoverEntryRow> {
    // UTC midnight — resolver + service consume the `Date` as a UTC-date
    // sentinel; conversion to Europe/Berlin happens in SQL (ADR-014).
    const shiftDate = new Date(`${dto.shiftDate}T00:00:00Z`);
    return await this.entriesService.getOrCreateDraft(
      tenantId,
      dto.teamId,
      shiftDate,
      dto.shiftKey,
      user.id,
    );
  }

  /**
   * Paginated list. `teamId` is required (plan Product Decision #12 —
   * same-team scope). Callers wanting cross-team aggregation must invoke
   * per team; Root / has_full_access bypasses the member check and may
   * query any team.
   */
  @Get('entries')
  @RequirePermission(SHIFT_PLANNING_ADDON, SHIFT_HANDOVER_ENTRIES_MODULE, 'canRead')
  async listEntries(
    @Query() query: ListEntriesQueryDto,
    @CurrentUser() user: NestAuthUser,
  ): Promise<{
    items: ShiftHandoverEntryRow[];
    total: number;
    page: number;
    limit: number;
  }> {
    if (query.teamId === undefined) {
      throw new BadRequestException('teamId query parameter is required');
    }
    await this.assertCanReadTeam(query.teamId, user);
    // `page`/`limit` have Zod `.default()`s so they are always defined.
    // `status`/`dateFrom`/`dateTo` are conditional-spread because
    // `exactOptionalPropertyTypes` (tsconfig.base) treats
    // `{ status: undefined }` as a type error versus the service's
    // `status?: ShiftHandoverEntryStatus` signature.
    return await this.entriesService.listEntriesForTeam(query.teamId, {
      page: query.page,
      limit: query.limit,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.dateFrom !== undefined ? { from: query.dateFrom } : {}),
      ...(query.dateTo !== undefined ? { to: query.dateTo } : {}),
    });
  }

  @Get('entries/:id')
  @RequirePermission(SHIFT_PLANNING_ADDON, SHIFT_HANDOVER_ENTRIES_MODULE, 'canRead')
  async getEntry(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
  ): Promise<ShiftHandoverEntryRow> {
    const entry = await this.entriesService.getEntry(id);
    await this.assertCanReadTeam(entry.team_id, user);
    return entry;
  }

  @Patch('entries/:id')
  @RequirePermission(SHIFT_PLANNING_ADDON, SHIFT_HANDOVER_ENTRIES_MODULE, 'canWrite')
  async updateEntry(
    @Param('id') id: string,
    @Body() dto: UpdateEntryDto,
    @CurrentUser() user: NestAuthUser,
  ): Promise<ShiftHandoverEntryRow> {
    // Conditional-spread — see `listEntries` for the rationale
    // (`exactOptionalPropertyTypes` + `UpdateDraftInput` shape).
    return await this.entriesService.updateDraft(
      id,
      {
        ...(dto.protocolText !== undefined ? { protocolText: dto.protocolText } : {}),
        ...(dto.customValues !== undefined ? { customValues: dto.customValues } : {}),
      },
      user.id,
    );
  }

  @Post('entries/:id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(SHIFT_PLANNING_ADDON, SHIFT_HANDOVER_ENTRIES_MODULE, 'canWrite')
  async submitEntry(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
  ): Promise<ShiftHandoverEntryRow> {
    return await this.entriesService.submitEntry(id, user.id);
  }

  /**
   * Team-Lead only. Permission gate: `canWrite` on the module (Layer-2)
   * plus `canManage` (Layer-1) — ADR-045 hard rule. Service then enforces
   * the `submitted → reopened` transition with a FOR UPDATE row lock.
   */
  @Post('entries/:id/reopen')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(SHIFT_PLANNING_ADDON, SHIFT_HANDOVER_ENTRIES_MODULE, 'canWrite')
  async reopenEntry(
    @Param('id') id: string,
    @Body() dto: ReopenEntryDto,
    @CurrentUser() user: NestAuthUser,
  ): Promise<ShiftHandoverEntryRow> {
    await this.assertCanManage(user);
    return await this.entriesService.reopenEntry(id, user.id, dto.reason);
  }

  // ──────────────────────────────────────────────────────────────────
  // Attachments — plan §2.6 rows 10–12
  // ──────────────────────────────────────────────────────────────────

  @Post('entries/:id/attachments')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', shiftHandoverFileOptions))
  @RequirePermission(SHIFT_PLANNING_ADDON, SHIFT_HANDOVER_ENTRIES_MODULE, 'canWrite')
  async uploadAttachment(
    @Param('id') entryId: string,
    @UploadedFile() file: MulterFile | undefined,
    @CurrentUser() user: NestAuthUser,
  ): Promise<ShiftHandoverAttachmentRow> {
    if (file === undefined) {
      throw new BadRequestException('Keine Datei hochgeladen');
    }
    return await this.attachmentsService.uploadForEntry(entryId, file, user.id);
  }

  /**
   * Streams the attachment bytes inline so the frontend `<img>` tag can
   * load it directly. Same-team scope enforced via the parent entry's
   * `team_id` (RLS has already ensured same-tenant). `inlineHeader` comes
   * from the shared `content-disposition` helper — RFC-5987 compliant.
   */
  @Get('entries/:id/attachments/:attId')
  @RequirePermission(SHIFT_PLANNING_ADDON, SHIFT_HANDOVER_ENTRIES_MODULE, 'canRead')
  async streamAttachment(
    @Param('id') entryId: string,
    @Param('attId') attachmentId: string,
    @CurrentUser() user: NestAuthUser,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const entry = await this.entriesService.getEntry(entryId);
    await this.assertCanReadTeam(entry.team_id, user);
    const meta = await this.attachmentsService.streamAttachment(attachmentId);
    const buffer = await fs.readFile(meta.filePath);
    await reply
      .header('Content-Type', meta.mimeType)
      .header('Content-Disposition', inlineHeader(meta.fileName))
      .header('Content-Length', buffer.length.toString())
      .header('Cache-Control', 'private, max-age=3600')
      .send(buffer);
  }

  /**
   * Permission = `canDelete` per plan §2.7 registrar scope note. Service
   * layer enforces the creator-or-canManage branch (ADR-045 creator
   * bypass for own-uploaded attachments).
   */
  @Delete('entries/:id/attachments/:attId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(SHIFT_PLANNING_ADDON, SHIFT_HANDOVER_ENTRIES_MODULE, 'canDelete')
  async deleteAttachment(
    @Param('id') entryId: string,
    @Param('attId') attachmentId: string,
    @CurrentUser() user: NestAuthUser,
  ): Promise<void> {
    const canManage = await this.computeCanManage(user);
    await this.attachmentsService.deleteAttachment(entryId, attachmentId, {
      userId: user.id,
      canManage,
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // My Permissions — plan §2.6 row 13 (TPM-style)
  // ──────────────────────────────────────────────────────────────────

  @Get('my-permissions')
  async getMyPermissions(@CurrentUser() user: NestAuthUser): Promise<ShiftHandoverMyPermissions> {
    return await this.templatesService.getMyPermissions(user.id, user.hasFullAccess);
  }

  // ──────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────

  /**
   * ADR-045 Layer-1 `canManage` computation — single source of truth
   * for the mutation gates that require a management role. Throws
   * `ForbiddenException` so the gate surfaces as 403 consistently with
   * the other layers (Permission / Addon / Scope).
   */
  private async assertCanManage(user: NestAuthUser): Promise<void> {
    if (await this.computeCanManage(user)) {
      return;
    }
    throw new ForbiddenException('Team-Lead rights required to manage shift handover');
  }

  /**
   * Boolean `canManage` for reuse in non-throwing call sites (e.g. the
   * `deleteAttachment` path passes the flag into the service so the
   * service can decide creator-vs-manager at the row level).
   */
  private async computeCanManage(user: NestAuthUser): Promise<boolean> {
    if (user.role === 'root') {
      return true;
    }
    if (user.role === 'admin' && user.hasFullAccess) {
      return true;
    }
    const scope = await this.scope.getScope();
    return scope.isAnyLead;
  }

  /**
   * Same-team read scope enforcement (plan Product Decision #12).
   * Resolution order (cheapest first):
   *  1. `hasFullAccess` / `root` → bypass.
   *  2. `scope.teamIds` covers lead + hierarchy-permission teams.
   *  3. Direct `user_teams` membership check for rank-and-file employees.
   */
  private async assertCanReadTeam(teamId: number, user: NestAuthUser): Promise<void> {
    if (user.role === 'root' || user.hasFullAccess) {
      return;
    }
    const scope = await this.scope.getScope();
    if (scope.teamIds.includes(teamId)) {
      return;
    }
    const isMember = await this.entriesService.isTeamMember(user.id, teamId);
    if (isMember) {
      return;
    }
    throw new ForbiddenException(`Access to team ${teamId} denied`);
  }
}
