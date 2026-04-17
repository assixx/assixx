/**
 * FeedbackController — user-facing bug report endpoint.
 *
 * `POST /api/v2/feedback/bug-report` (multipart/form-data):
 *   - body fields: title, category, url, description (validated by BugReportDto)
 *   - optional files: screenshots (up to 3 images, 5 MB each, PNG/JPEG/WEBP/GIF)
 *     kept in-memory → attached directly to email, never persisted to disk.
 *
 * Auth: plain JwtAuthGuard. No `@RequireAddon` / `@RequirePermission` —
 * feedback is open to every authenticated user (root/admin/employee)
 * independent of addon subscriptions or per-module permissions
 * (ADR-045 Layer 0-2 deliberately bypassed: reporting bugs is not a tenant
 * feature, it's a platform-level affordance).
 *
 * Rate limit: `@FeedbackThrottle()` → 5 reports per hour per authenticated
 * user. Each submission dispatches an email; flooding would hurt SMTP
 * deliverability AND drown real bug reports in the ops inbox. 5/h is
 * generous for genuine users and restrictive enough that a compromised
 * session can't spam the inbox meaningfully.
 */
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@webundsoehne/nest-fastify-file-upload';
import type { FastifyRequest } from 'fastify';
import multer from 'fastify-multer';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { FeedbackThrottle } from '../common/decorators/throttle.decorators.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CustomThrottlerGuard } from '../common/guards/throttler.guard.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import type { MailerAttachment } from '../common/services/mailer.service.js';
import { BugReportDto } from './dto/bug-report.dto.js';
import { FeedbackService } from './feedback.service.js';

const { memoryStorage } = multer;

/** Multer file type (matches chat.controller MulterFile shape). */
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size?: number;
  buffer?: Buffer;
}

const ALLOWED_SCREENSHOT_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
/**
 * Hard cap on screenshot count per report. Three is enough for a
 * before/after/console-log triptych; more would bloat the email and encourage
 * lazy "dump everything" reports over focused bug descriptions.
 */
const MAX_SCREENSHOTS = 3;

/**
 * Multer fileFilter — rejects non-image uploads with a German error message
 * so the frontend can surface it verbatim without a translation table.
 */
const screenshotFileFilter = (
  _req: unknown,
  file: MulterFile,
  cb: (error: Error | null, acceptFile: boolean) => void,
): void => {
  if (!ALLOWED_SCREENSHOT_TYPES.includes(file.mimetype)) {
    cb(
      new BadRequestException(
        'Ungültiges Dateiformat — nur PNG, JPEG, WEBP oder GIF sind erlaubt.',
      ),
      false,
    );
    return;
  }
  cb(null, true);
};

@Controller('feedback')
@UseGuards(JwtAuthGuard, CustomThrottlerGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post('bug-report')
  @FeedbackThrottle()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FilesInterceptor('screenshots', MAX_SCREENSHOTS, {
      // memoryStorage → keep buffers in RAM, attach to email, never touch disk.
      // Screenshots are one-off payloads; disk storage would pollute /uploads
      // and require cleanup logic. 3 × 5 MB = max ~15 MB RAM per request,
      // bounded by the outer UserThrottle window (5 reports/h).
      storage: memoryStorage(),
      limits: { fileSize: MAX_SCREENSHOT_BYTES, files: MAX_SCREENSHOTS },
      fileFilter: screenshotFileFilter,
    }),
  )
  async submitBugReport(
    @Body() dto: BugReportDto,
    @CurrentUser() user: NestAuthUser,
    @Req() req: FastifyRequest,
    @UploadedFiles() files?: MulterFile[],
  ): Promise<{ message: string }> {
    const userAgent = req.headers['user-agent'];

    const screenshots: MailerAttachment[] = (files ?? [])
      .filter((f: MulterFile): f is MulterFile & { buffer: Buffer } => f.buffer !== undefined)
      .map(
        (f: MulterFile & { buffer: Buffer }): MailerAttachment => ({
          filename: f.originalname,
          content: f.buffer,
          contentType: f.mimetype,
        }),
      );

    await this.feedbackService.submitBugReport({
      dto,
      user,
      userAgent: typeof userAgent === 'string' ? userAgent : undefined,
      screenshots,
    });

    return { message: 'Danke für deine Rückmeldung — wir kümmern uns darum.' };
  }
}
