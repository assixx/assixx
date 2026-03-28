/**
 * Connection Ticket Utility
 *
 * Fetches short-lived, single-use tickets for WebSocket/SSE connections.
 * Prevents JWT token exposure in URLs (visible in logs, browser history, etc.)
 *
 * @see docs/TOKEN-SECURITY-REFACTORING-PLAN.md
 */

import { browser } from '$app/environment';

import { logger } from './logger';

export type TicketPurpose = 'websocket' | 'sse';

interface ConnectionTicketResponse {
  ticket: string;
  expiresIn: number;
}

/**
 * Fetches a connection ticket from the auth API.
 * Tickets are:
 * - Valid for 30 seconds
 * - Single-use (deleted after first validation)
 * - Contain no sensitive data (just a random UUID)
 */
export async function getConnectionTicket(purpose: TicketPurpose): Promise<string | null> {
  if (!browser) {
    logger.error('getConnectionTicket called outside browser context');
    return null;
  }

  try {
    const response = await fetch('/api/v2/auth/connection-ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ purpose }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Failed to get connection ticket: ${response.status} - ${errorText}`);
      return null;
    }

    const data = (await response.json()) as { data: ConnectionTicketResponse };
    return data.data.ticket;
  } catch (error: unknown) {
    logger.error({ error }, 'Error fetching connection ticket');
    return null;
  }
}

/** Builds a WebSocket URL with the connection ticket as query parameter. */
export function buildWebSocketUrl(basePath: string, ticket: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}${basePath}?ticket=${encodeURIComponent(ticket)}`;
}
