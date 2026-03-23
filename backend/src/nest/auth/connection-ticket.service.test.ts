/**
 * Unit tests for ConnectionTicketService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Ticket create/consume/exists, UUID validation,
 *        atomic Lua script consumption, error handling.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectionTicketService } from './connection-ticket.service.js';
import type { ConnectionTicketData } from './connection-ticket.service.js';

// =============================================================
// Module mocks
// =============================================================

const { mockRedisInstance, mockRedisConstructor } = vi.hoisted(() => {
  const instance = {
    setex: vi.fn().mockResolvedValue('OK'),
    eval: vi.fn().mockResolvedValue(null),
    exists: vi.fn().mockResolvedValue(0),
    quit: vi.fn().mockResolvedValue('OK'),
    on: vi.fn(),
  };

  const ctor = vi.fn(function FakeRedis() {
    return instance;
  });
  return { mockRedisInstance: instance, mockRedisConstructor: ctor };
});

vi.mock('ioredis', () => ({
  Redis: mockRedisConstructor,
}));

// =============================================================
// Mock factories
// =============================================================

function createMockConfigService() {
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      if (key === 'REDIS_HOST') return 'localhost';
      if (key === 'REDIS_PORT') return 6379;
      if (key === 'REDIS_PASSWORD') return undefined;
      return defaultValue;
    }),
  };
}

function makeTicketData(): ConnectionTicketData {
  return {
    userId: 5,
    tenantId: 10,
    role: 'admin',
    activeRole: 'admin',
    purpose: 'websocket',
    createdAt: Date.now(),
  };
}

const VALID_UUID = '12345678-1234-1234-1234-123456789abc';

// =============================================================
// ConnectionTicketService
// =============================================================

describe('ConnectionTicketService', () => {
  let service: ConnectionTicketService;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockConfig = createMockConfigService();
    service = new ConnectionTicketService(mockConfig as never);
  });

  // =============================================================
  // constructor – Redis password
  // =============================================================

  describe('constructor', () => {
    it('passes password to Redis when REDIS_PASSWORD is set', () => {
      mockRedisConstructor.mockClear();
      const mockConfig = {
        get: vi.fn((key: string, defaultValue?: unknown) => {
          if (key === 'REDIS_HOST') return 'localhost';
          if (key === 'REDIS_PORT') return 6379;
          if (key === 'REDIS_PASSWORD') return 'my-secret-pw';
          return defaultValue;
        }),
      };

      new ConnectionTicketService(mockConfig as never);

      expect(mockRedisConstructor).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'my-secret-pw' }),
      );
    });
  });

  // =============================================================
  // createTicket
  // =============================================================

  describe('createTicket', () => {
    it('should create ticket with TTL', async () => {
      const data = makeTicketData();

      const result = await service.createTicket(data);

      expect(result.ticket).toBeDefined();
      expect(result.expiresIn).toBe(30);
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        expect.stringContaining('connection_ticket:'),
        30,
        expect.any(String),
      );
    });
  });

  // =============================================================
  // consumeTicket
  // =============================================================

  describe('consumeTicket', () => {
    it('should return null for invalid UUID format', async () => {
      const result = await service.consumeTicket('not-a-uuid');

      expect(result).toBeNull();
      expect(mockRedisInstance.eval).not.toHaveBeenCalled();
    });

    it('should return null when ticket not found', async () => {
      mockRedisInstance.eval.mockResolvedValueOnce(null);

      const result = await service.consumeTicket(VALID_UUID);

      expect(result).toBeNull();
    });

    it('should return ticket data and consume it', async () => {
      const data = makeTicketData();
      mockRedisInstance.eval.mockResolvedValueOnce(JSON.stringify(data));

      const result = await service.consumeTicket(VALID_UUID);

      expect(result?.userId).toBe(5);
      expect(result?.tenantId).toBe(10);
      expect(result?.purpose).toBe('websocket');
    });

    it('should return null on Redis error', async () => {
      mockRedisInstance.eval.mockRejectedValueOnce(new Error('Redis down'));

      const result = await service.consumeTicket(VALID_UUID);

      expect(result).toBeNull();
    });
  });

  // =============================================================
  // ticketExists
  // =============================================================

  describe('ticketExists', () => {
    it('should return false for invalid UUID', async () => {
      const result = await service.ticketExists('bad-format');

      expect(result).toBe(false);
    });

    it('should return false when ticket not found', async () => {
      mockRedisInstance.exists.mockResolvedValueOnce(0);

      const result = await service.ticketExists(VALID_UUID);

      expect(result).toBe(false);
    });

    it('should return true when ticket exists', async () => {
      mockRedisInstance.exists.mockResolvedValueOnce(1);

      const result = await service.ticketExists(VALID_UUID);

      expect(result).toBe(true);
    });
  });

  // =============================================================
  // onModuleDestroy
  // =============================================================

  describe('onModuleDestroy', () => {
    it('should close Redis connection', async () => {
      await service.onModuleDestroy();

      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });
  });
});
