/**
 * Dashboard Counts DTO
 *
 * Response structure for the combined counts endpoint.
 * Aggregates all notification-related counts into a single response.
 */
import { z } from 'zod';

/**
 * Individual count item schema
 */
export const CountItemSchema = z.object({
  count: z.number().int().nonnegative(),
});

/**
 * Chat unread counts schema
 */
export const ChatCountsSchema = z.object({
  totalUnread: z.number().int().nonnegative(),
  conversations: z
    .array(
      z.object({
        conversationId: z.number().int().positive(),
        conversationName: z.string(),
        unreadCount: z.number().int().nonnegative(),
      }),
    )
    .optional(),
});

/**
 * Notification stats schema (from /notifications/stats/me)
 */
export const NotificationStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  unread: z.number().int().nonnegative(),
  byType: z.record(z.string(), z.number().int().nonnegative()),
});

/**
 * Combined dashboard counts response schema
 */
export const DashboardCountsSchema = z.object({
  chat: ChatCountsSchema,
  notifications: NotificationStatsSchema,
  blackboard: CountItemSchema,
  calendar: CountItemSchema,
  documents: CountItemSchema,
  /** KVP unconfirmed count (Pattern 2: Individual read tracking) */
  kvp: CountItemSchema,
  /** Pending surveys count (active surveys not yet responded to by user) */
  surveys: CountItemSchema,
  /** Timestamp when counts were fetched */
  fetchedAt: z.string(),
});

/** TypeScript types inferred from schemas */
export type CountItem = z.infer<typeof CountItemSchema>;
export type ChatCounts = z.infer<typeof ChatCountsSchema>;
export type NotificationStats = z.infer<typeof NotificationStatsSchema>;
export type DashboardCounts = z.infer<typeof DashboardCountsSchema>;

/**
 * API Response wrapper for dashboard counts
 */
export interface DashboardCountsResponse {
  success: true;
  data: DashboardCounts;
}
