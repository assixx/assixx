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
  /** Unread vacation notifications (new requests for approvers, responses for requesters) */
  vacation: CountItemSchema,
  /** Unread TPM notifications (maintenance due, overdue, approval required) */
  tpm: CountItemSchema,
  /** Unread work order notifications (assignments, verifications) */
  workOrders: CountItemSchema,
  /** Pending shift swap consents (requests where user is target + pending_partner) */
  shiftSwap: CountItemSchema,
  /**
   * Pending approvals count for the current user.
   *
   * Currently aggregates **root-only** peer-approval requests from
   * `root_self_termination_requests` (FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN
   * Phase 7 / Sidebar-Badge wiring): rows with status='pending', requester_id
   * != $userId, expires_at > NOW(). Drives the red sidebar badge for
   * `/manage-approvals` (badgeType=approvals).
   *
   * Future extension: tenant_deletion_pending_approvals + addon-approvals.
   */
  approvals: CountItemSchema,
  /** Timestamp when counts were fetched */
  fetchedAt: z.string(),
});

/** TypeScript types inferred from schemas */
export type CountItem = z.infer<typeof CountItemSchema>;
export type ChatCounts = z.infer<typeof ChatCountsSchema>;
export type NotificationStats = z.infer<typeof NotificationStatsSchema>;
export type DashboardCounts = z.infer<typeof DashboardCountsSchema>;
