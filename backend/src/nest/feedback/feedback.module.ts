/**
 * FeedbackModule — user-submitted bug reports.
 *
 * Scope (today): `POST /api/v2/feedback/bug-report`.
 * Future (no module rewrite needed): feature requests, UX polls, NPS surveys.
 *
 * Dependencies:
 *   - MailerService (common) → SMTP transport via legacy email-service.ts
 *
 * Registered in AppModule. No addon/permission guards — feedback is a
 * platform-level feature available to every authenticated user.
 */
import { Module } from '@nestjs/common';

import { MailerService } from '../common/services/mailer.service.js';
import { FeedbackController } from './feedback.controller.js';
import { FeedbackService } from './feedback.service.js';

@Module({
  controllers: [FeedbackController],
  providers: [FeedbackService, MailerService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class FeedbackModule {}
