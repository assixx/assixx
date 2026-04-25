/**
 * FeedbackService — orchestrates user-submitted bug reports.
 *
 * The heavy lifting (HTML rendering, attachment wiring, SMTP) lives in
 * `MailerService.sendBugReport`. This service only maps DTO input + auth
 * context into the MailerService payload and translates errors for the HTTP
 * caller. Kept deliberately thin so the feedback surface stays easy to extend
 * (future: feature requests, UX polls) without service bloat.
 *
 * @see backend/src/nest/common/services/mailer.service.ts
 */
import { Injectable, Logger } from '@nestjs/common';

import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import {
  type BugReportPayload,
  type MailerAttachment,
  MailerService,
} from '../common/services/mailer.service.js';
import { getErrorMessage } from '../common/utils/error.utils.js';
import { type BugReportCategory, type BugReportDto } from './dto/bug-report.dto.js';

/**
 * German UI labels keyed by category code. The code is stored/transmitted;
 * the label shows in the email subject + body so triagers get human-readable
 * context. Must stay in sync with BUG_REPORT_CATEGORIES.
 */
const CATEGORY_LABELS: Readonly<Record<BugReportCategory, string>> = {
  ui: 'UI-Fehler',
  backend: 'Backend-Fehler',
  performance: 'Performance',
  permission: 'Berechtigung',
  data: 'Daten-Fehler',
  'feature-request': 'Feature-Wunsch',
  other: 'Sonstiges',
};

export interface SubmitBugReportContext {
  dto: BugReportDto;
  user: NestAuthUser;
  userAgent: string | undefined;
  screenshots: MailerAttachment[];
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(private readonly mailer: MailerService) {}

  async submitBugReport(ctx: SubmitBugReportContext): Promise<void> {
    const payload: BugReportPayload = {
      title: ctx.dto.title,
      categoryLabel: CATEGORY_LABELS[ctx.dto.category],
      description: ctx.dto.description,
      originUrl: ctx.dto.url,
      userAgent: ctx.userAgent,
      reporterEmail: ctx.user.email,
      reporterName: this.buildReporterName(ctx.user),
      reporterUserId: ctx.user.id,
      reporterTenantId: ctx.user.tenantId,
      reporterRole: ctx.user.role,
      screenshots: ctx.screenshots,
    };

    try {
      await this.mailer.sendBugReport(payload);
      this.logger.log(
        `Bug report submitted by user=${String(ctx.user.id)} tenant=${String(ctx.user.tenantId)} category=${ctx.dto.category}`,
      );
    } catch (error: unknown) {
      // Log + rethrow — controller translates to 500 with generic message.
      this.logger.error(`Bug report dispatch failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private buildReporterName(user: NestAuthUser): string {
    const first = user.firstName?.trim() ?? '';
    const last = user.lastName?.trim() ?? '';
    const full = `${first} ${last}`.trim();
    return full !== '' ? full : user.email;
  }
}
