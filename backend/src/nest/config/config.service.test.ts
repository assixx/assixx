/**
 * Unit tests for AppConfigService
 *
 * Phase 9: Service tests — mocked ConfigService, Zod validation in constructor.
 * Tests focus on: constructor validation, computed getters, edge cases.
 * Simple passthrough getters (dbHost, dbPort, etc.) are implicitly tested.
 */
import { describe, expect, it, vi } from 'vitest';

import { AppConfigService } from './config.service.js';

// =============================================================
// Mock ConfigService Factory
// =============================================================

interface MockEnvVars {
  NODE_ENV?: string;
  PORT?: string;
  DB_HOST?: string;
  DB_PORT?: string;
  DB_NAME?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;
  DB_SYSTEM_USER?: string;
  DB_SYSTEM_PASSWORD?: string;
  JWT_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  JWT_ACCESS_EXPIRY?: string;
  JWT_REFRESH_EXPIRY?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  REDIS_PASSWORD?: string;
  ALLOWED_ORIGINS?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
}

/** Minimal valid env vars — only required fields */
const VALID_ENV: MockEnvVars = {
  DB_PASSWORD: 'test-db-password',
  DB_SYSTEM_PASSWORD: 'test-sys-password',
  JWT_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

function createMockConfigService(env: MockEnvVars = VALID_ENV) {
  return {
    get: vi.fn((key: string) => env[key as keyof MockEnvVars]),
  };
}

function createService(env: MockEnvVars = VALID_ENV): AppConfigService {
  const mockConfig = createMockConfigService(env);
  return new AppConfigService(mockConfig as never);
}

// =============================================================
// AppConfigService
// =============================================================

describe('AppConfigService', () => {
  // =============================================================
  // Constructor validation
  // =============================================================

  describe('constructor', () => {
    it('should create service with valid minimal config', () => {
      const service = createService();

      expect(service.nodeEnv).toBe('development');
      expect(service.port).toBe(3000);
    });

    it('should throw when DB_PASSWORD is missing', () => {
      expect(() =>
        createService({
          DB_SYSTEM_PASSWORD: 'test-sys-password',
          JWT_SECRET: 'a'.repeat(32),
          JWT_REFRESH_SECRET: 'b'.repeat(32),
        }),
      ).toThrow('Invalid environment configuration');
    });

    it('should throw when JWT_SECRET is too short', () => {
      expect(() =>
        createService({
          DB_PASSWORD: 'pw',
          DB_SYSTEM_PASSWORD: 'test-sys-password',
          JWT_SECRET: 'short',
          JWT_REFRESH_SECRET: 'b'.repeat(32),
        }),
      ).toThrow('Invalid environment configuration');
    });

    it('should throw when JWT_REFRESH_SECRET is too short', () => {
      expect(() =>
        createService({
          DB_PASSWORD: 'pw',
          DB_SYSTEM_PASSWORD: 'test-sys-password',
          JWT_SECRET: 'a'.repeat(32),
          JWT_REFRESH_SECRET: 'short',
        }),
      ).toThrow('Invalid environment configuration');
    });
  });

  // =============================================================
  // Computed getters
  // =============================================================

  describe('isProduction', () => {
    it('should return true when NODE_ENV is production', () => {
      const service = createService({ ...VALID_ENV, NODE_ENV: 'production' });

      expect(service.isProduction).toBe(true);
      expect(service.isDevelopment).toBe(false);
    });
  });

  describe('isDevelopment', () => {
    it('should return true when NODE_ENV defaults to development', () => {
      const service = createService();

      expect(service.isDevelopment).toBe(true);
      expect(service.isProduction).toBe(false);
    });
  });

  describe('hasRedis', () => {
    it('should return true when both REDIS_HOST and REDIS_PORT are set', () => {
      const service = createService({
        ...VALID_ENV,
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      expect(service.hasRedis).toBe(true);
    });

    it('should return false when REDIS_HOST is missing', () => {
      const service = createService();

      expect(service.hasRedis).toBe(false);
    });
  });

  describe('hasSmtp', () => {
    it('should return true when both SMTP_HOST and SMTP_PORT are set', () => {
      const service = createService({
        ...VALID_ENV,
        SMTP_HOST: 'mail.test.de',
        SMTP_PORT: '587',
      });

      expect(service.hasSmtp).toBe(true);
    });

    it('should return false when SMTP config is missing', () => {
      const service = createService();

      expect(service.hasSmtp).toBe(false);
    });
  });

  describe('allowedOriginsArray', () => {
    it('should split comma-separated origins into array', () => {
      const service = createService({
        ...VALID_ENV,
        ALLOWED_ORIGINS: 'http://a.com, http://b.com',
      });

      expect(service.allowedOriginsArray).toEqual(['http://a.com', 'http://b.com']);
    });

    it('should use default origins when not configured', () => {
      const service = createService();

      expect(service.allowedOriginsArray).toContain('http://localhost:3000');
      expect(service.allowedOriginsArray).toContain('http://localhost:5173');
    });
  });

  describe('databaseConfig', () => {
    it('should return object with all DB connection fields', () => {
      const service = createService({
        ...VALID_ENV,
        DB_HOST: 'myhost',
        DB_PORT: '5433',
      });

      const dbConfig = service.databaseConfig;

      expect(dbConfig).toEqual({
        host: 'myhost',
        port: 5433,
        database: 'assixx',
        user: 'assixx_user',
        password: 'test-db-password',
      });
    });
  });

  describe('jwtRefreshSecret', () => {
    it('should return separate secret from jwtSecret', () => {
      const service = createService();

      expect(service.jwtSecret).not.toBe(service.jwtRefreshSecret);
      expect(service.jwtSecret).toBe('a'.repeat(32));
      expect(service.jwtRefreshSecret).toBe('b'.repeat(32));
    });
  });
});
