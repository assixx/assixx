/**
 * Audit Request Filter Service
 *
 * Handles request filtering and throttling for audit trail.
 * Owns the recentLogs state for throttling repeated requests.
 *
 * @see ADR-009 Central Audit Logging
 */
import { Injectable } from '@nestjs/common';

import type { NestAuthUser } from '../interfaces/auth.interface.js';
import {
  type AuditAction,
  CURRENT_USER_THROTTLE_MS,
  LIST_ACTION_THROTTLE_MS,
} from './audit.constants.js';
import {
  isCurrentUserEndpoint,
  shouldSkipGetRequest,
} from './audit.helpers.js';

@Injectable()
export class AuditRequestFilterService {
  /**
   * In-memory cache to throttle repeated calls.
   * Key: `${userId}-${endpoint}`, Value: timestamp of last log
   */
  private readonly recentLogs = new Map<string, number>();

  constructor() {
    // Clean up old entries every 5 minutes to prevent memory leak
    setInterval(
      () => {
        this.cleanupRecentLogs();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Remove expired entries from recentLogs cache.
   */
  private cleanupRecentLogs(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.recentLogs) {
      if (now - timestamp > CURRENT_USER_THROTTLE_MS * 2) {
        this.recentLogs.delete(key);
      }
    }
  }

  /**
   * Check if request should be skipped from logging (early returns).
   * Combines all skip logic to reduce cognitive complexity in intercept().
   */
  shouldSkipRequest(
    method: string,
    path: string,
    isAuthEndpointFlag: boolean,
    user: NestAuthUser | undefined,
  ): boolean {
    // For non-auth endpoints: skip if unauthenticated
    if (!isAuthEndpointFlag && user === undefined) {
      return true;
    }

    // For GET requests: apply smart filtering to reduce noise
    if (method === 'GET' && !isAuthEndpointFlag && shouldSkipGetRequest(path)) {
      return true;
    }

    // Throttle "current user" endpoints (e.g., /users/me) - only log once per interval
    if (method === 'GET' && isCurrentUserEndpoint(path) && user !== undefined) {
      return this.shouldThrottleCurrentUser(user.id, path);
    }

    return false;
  }

  /**
   * Check if a "current user" endpoint should be throttled.
   * Returns true if we should SKIP logging (already logged recently).
   */
  shouldThrottleCurrentUser(userId: number, path: string): boolean {
    const key = `${userId}-${path}`;
    const now = Date.now();
    const lastLogged = this.recentLogs.get(key);

    if (
      lastLogged !== undefined &&
      now - lastLogged < CURRENT_USER_THROTTLE_MS
    ) {
      // Already logged within throttle window - skip
      return true;
    }

    // Update timestamp and allow logging
    this.recentLogs.set(key, now);
    return false;
  }

  /**
   * Check if a list/view action should be throttled.
   */
  shouldThrottleListOrView(
    action: AuditAction,
    user: NestAuthUser | undefined,
    endpoint: string,
  ): boolean {
    const isListOrView = action === 'list' || action === 'view';
    if (!isListOrView || user === undefined) {
      return false;
    }
    return this.shouldThrottleByEndpoint(user.id, endpoint);
  }

  /**
   * Check if endpoint should be throttled for this user.
   * Returns true if we should SKIP logging (already logged recently).
   *
   * PURPOSE: Ensure "User visited Blackboard" logs ONCE, not 6 times.
   * Multiple API calls from same page load within 30s = single log entry.
   */
  private shouldThrottleByEndpoint(userId: number, endpoint: string): boolean {
    // Normalize endpoint: remove query params and trailing IDs for grouping
    // e.g., /blackboard/entries?page=1 and /blackboard/entries?page=2 → same key
    const normalizedEndpoint = endpoint.split('?')[0] ?? endpoint;
    const key = `list-${userId}-${normalizedEndpoint}`;
    const now = Date.now();
    const lastLogged = this.recentLogs.get(key);

    if (
      lastLogged !== undefined &&
      now - lastLogged < LIST_ACTION_THROTTLE_MS
    ) {
      // Already logged within throttle window - skip
      return true;
    }

    // Update timestamp and allow logging
    this.recentLogs.set(key, now);
    return false;
  }
}
