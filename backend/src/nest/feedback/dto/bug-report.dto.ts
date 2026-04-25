/**
 * Bug Report DTO — Zod schema + nestjs-zod class for validation.
 *
 * Surface: `POST /api/v2/feedback/bug-report` (multipart/form-data).
 * Form fields are validated by this DTO; the optional `screenshot` file is
 * handled by the controller's FileInterceptor (see feedback.controller.ts).
 *
 * @see docs/how-to/ADR-045-permission-visibility-design.md — authenticated endpoint
 * @see backend/docs/ZOD-INTEGRATION-GUIDE.md
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Bug-report categories exposed to end users. Keep this list tight — a large
 * open-ended taxonomy adds triage work without helping users pick correctly.
 * Mirror any change in the frontend form AND in CATEGORY_LABELS of
 * FeedbackService.
 */
export const BUG_REPORT_CATEGORIES = [
  'ui',
  'backend',
  'performance',
  'permission',
  'data',
  'feature-request',
  'other',
] as const;

export type BugReportCategory = (typeof BUG_REPORT_CATEGORIES)[number];

export const BugReportSchema = z.object({
  /** Short one-line summary, shown in the email subject. */
  title: z.string().trim().min(3).max(120),

  /** Category enum — drives email subject prefix and triage routing. */
  category: z.enum(BUG_REPORT_CATEGORIES),

  /**
   * URL where the issue occurred, pre-filled by the frontend form.
   * Kept as plain string (not .url()) because SPA hash-routes and relative
   * paths also happen during report flow. Length cap is the real safeguard.
   */
  url: z.string().trim().min(1).max(500),

  /** Free-form description — must be useful enough to triage. */
  description: z.string().trim().min(10).max(5000),
});

export class BugReportDto extends createZodDto(BugReportSchema) {}
