/**
 * Connection Ticket Service
 *
 * Provides short-lived, single-use tickets for WebSocket authentication.
 * Uses Redis for distributed storage with atomic GET+DELETE operations.
 *
 * SECURITY:
 * - Tickets expire after 30 seconds (TICKET_TTL_SECONDS)
 * - Tickets are single-use (deleted after validation)
 * - Tickets contain no sensitive data (just random UUID)
 * - User data is stored server-side in Redis
 *
 * @see docs/TOKEN-SECURITY-REFACTORING-PLAN.md
 */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';

/** Data stored with each connection ticket */
export interface ConnectionTicketData {
  userId: number;
  tenantId: number;
  role: string;
  activeRole: string;
  purpose: 'websocket' | 'sse';
  createdAt: number;
}

/** Ticket creation response */
export interface CreateTicketResponse {
  ticket: string;
  expiresIn: number;
}

/** Redis key prefix for connection tickets - MUST be used everywhere! */
export const CONNECTION_TICKET_PREFIX = 'connection_ticket:';

/** TTL in seconds for connection tickets */
export const CONNECTION_TICKET_TTL_SECONDS = 30;

@Injectable()
export class ConnectionTicketService implements OnModuleDestroy {
  private readonly logger = new Logger(ConnectionTicketService.name);
  private readonly redis: Redis;

  /**
   * Lua script for atomic GET + DELETE operation
   * Ensures ticket can only be consumed once even under race conditions
   */
  private readonly CONSUME_SCRIPT = `
    local value = redis.call('GET', KEYS[1])
    if value then
      redis.call('DEL', KEYS[1])
    end
    return value
  `;

  constructor(private readonly configService: ConfigService) {
    const redisHost = this.configService.get<string>('REDIS_HOST', 'redis');

    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      ...(redisPassword !== undefined && redisPassword !== '' && { password: redisPassword }),
      keyPrefix: '', // No prefix - we handle it ourselves
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis for connection tickets');
    });

    this.redis.on('error', (err: Error) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
    this.logger.log('Redis connection closed');
  }

  /** Create a new connection ticket */
  async createTicket(data: ConnectionTicketData): Promise<CreateTicketResponse> {
    const ticketId = randomUUID();
    const key = `${CONNECTION_TICKET_PREFIX}${ticketId}`;

    await this.redis.setex(key, CONNECTION_TICKET_TTL_SECONDS, JSON.stringify(data));

    this.logger.debug(
      `Created connection ticket for user ${data.userId} (purpose: ${data.purpose})`,
    );

    return {
      ticket: ticketId,
      expiresIn: CONNECTION_TICKET_TTL_SECONDS,
    };
  }

  /**
   * Validate and consume a connection ticket (single-use)
   *
   * Uses atomic Lua script to prevent race conditions:
   * - GET returns the value
   * - DEL removes it immediately
   * - Both happen in single atomic operation
   */
  async consumeTicket(ticketId: string): Promise<ConnectionTicketData | null> {
    // Validate ticketId format (must be UUID)
    if (!this.isValidUuid(ticketId)) {
      this.logger.warn(`Invalid ticket format: ${ticketId.substring(0, 8)}...`);
      return null;
    }

    const key = `${CONNECTION_TICKET_PREFIX}${ticketId}`;

    try {
      // Atomic GET + DELETE using Lua script
      const result = (await this.redis.eval(this.CONSUME_SCRIPT, 1, key)) as string | null;

      if (result === null) {
        this.logger.debug(`Ticket not found or expired: ${ticketId.substring(0, 8)}...`);
        return null;
      }

      const data = JSON.parse(result) as ConnectionTicketData;
      this.logger.debug(`Consumed ticket for user ${data.userId} (purpose: ${data.purpose})`);

      return data;
    } catch (error: unknown) {
      this.logger.error(`Failed to consume ticket: ${String(error)}`);
      return null;
    }
  }

  /** Check if a ticket exists without consuming it (for debugging/monitoring) */
  async ticketExists(ticketId: string): Promise<boolean> {
    if (!this.isValidUuid(ticketId)) {
      return false;
    }

    const key = `${CONNECTION_TICKET_PREFIX}${ticketId}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  private isValidUuid(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }
}
