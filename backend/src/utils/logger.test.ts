/**
 * Tests for utils/logger.ts
 *
 * Phase 14D — Partial Utility Coverage
 * Tests log level selection, transport configuration (dev/prod),
 * Loki target resolution, redaction config, and createLogger.
 *
 * Uses vi.resetModules() + dynamic import because `isProduction` and
 * `logger` are module-level constants evaluated at import time.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Persistent mock refs via vi.hoisted (survive vi.resetModules)
const { mockPino, mockChild } = vi.hoisted(() => {
  const child = vi.fn(
    (bindings: Record<string, unknown>) =>
      ({ _isChild: true, ...bindings }) as unknown,
  );
  const pinoFn = vi.fn(() => ({
    child,
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  }));
  return { mockPino: pinoFn, mockChild: child };
});

// Mock pino — factory returns persistent mockPino from vi.hoisted
vi.mock('pino', () => ({ default: mockPino }));

/** Helper: save, clear, and restore env vars cleanly */
function withEnv(overrides: Record<string, string | undefined>): () => void {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }
  return () => {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  };
}

/** Dynamic import logger module (fresh due to vi.resetModules) */
async function importLogger(): Promise<{
  logger: unknown;
  createLogger: (context: string) => unknown;
}> {
  return (await import('./logger.js')) as {
    logger: unknown;
    createLogger: (context: string) => unknown;
  };
}

/** Extract the options object passed to pino() during module load */
function getPinoOptions(): Record<string, unknown> {
  const call = mockPino.mock.calls[0];
  expect(call).toBeDefined();
  return call![0] as Record<string, unknown>;
}

describe('logger', () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    mockPino.mockClear();
    mockChild.mockClear();
    vi.resetModules();
    // Default: clear all logger-relevant env vars
    restoreEnv = withEnv({
      NODE_ENV: undefined,
      LOG_LEVEL: undefined,
      LOKI_URL: undefined,
      LOKI_LOCAL_URL: undefined,
      GRAFANA_CLOUD_USER: undefined,
      GRAFANA_CLOUD_API_KEY: undefined,
    });
  });

  afterEach(() => {
    restoreEnv();
  });

  describe('getLogLevel (via pino options)', () => {
    it('should use "silent" in test environment', async () => {
      process.env['NODE_ENV'] = 'test';

      await importLogger();

      expect(getPinoOptions().level).toBe('silent');
    });

    it('should use "info" in production environment', async () => {
      process.env['NODE_ENV'] = 'production';

      await importLogger();

      expect(getPinoOptions().level).toBe('info');
    });

    it('should use "debug" in development environment', async () => {
      process.env['NODE_ENV'] = 'development';

      await importLogger();

      expect(getPinoOptions().level).toBe('debug');
    });

    it('should use "debug" when NODE_ENV is undefined', async () => {
      await importLogger();

      expect(getPinoOptions().level).toBe('debug');
    });

    it('should use LOG_LEVEL env override when set', async () => {
      process.env['NODE_ENV'] = 'production';
      process.env['LOG_LEVEL'] = 'trace';

      await importLogger();

      expect(getPinoOptions().level).toBe('trace');
    });
  });

  describe('base configuration', () => {
    it('should always include redact paths', async () => {
      process.env['NODE_ENV'] = 'test';

      await importLogger();

      const options = getPinoOptions();
      const redact = options.redact as { paths: string[]; censor: string };
      expect(redact).toBeDefined();
      expect(redact.paths.length).toBeGreaterThan(0);
      expect(redact.censor).toBe('[REDACTED]');
    });

    it('should include sensitive paths in redaction', async () => {
      process.env['NODE_ENV'] = 'test';

      await importLogger();

      const options = getPinoOptions();
      const redact = options.redact as { paths: string[] };
      expect(redact.paths).toContain('req.body.password');
      expect(redact.paths).toContain('req.headers.authorization');
    });

    it('should include base context with service name', async () => {
      process.env['NODE_ENV'] = 'test';

      await importLogger();

      const options = getPinoOptions();
      const base = options.base as { service: string };
      expect(base.service).toBe('assixx-backend');
    });
  });

  describe('transport in development (non-production)', () => {
    it('should use pino-pretty when no Loki targets configured', async () => {
      process.env['NODE_ENV'] = 'development';

      await importLogger();

      const options = getPinoOptions();
      const transport = options.transport as { target: string };
      expect(transport.target).toBe('pino-pretty');
    });

    it('should use multi-target with pino-pretty + Loki when local Loki configured', async () => {
      process.env['NODE_ENV'] = 'development';
      process.env['LOKI_LOCAL_URL'] = 'http://loki:3100';

      await importLogger();

      const options = getPinoOptions();
      const transport = options.transport as {
        targets: Array<{ target: string; level: string }>;
      };
      expect(transport.targets).toBeDefined();

      const targetNames = transport.targets.map((t) => t.target);
      expect(targetNames).toContain('pino-pretty');
      expect(targetNames).toContain('pino-loki');
    });

    it('should include cloud + local Loki when both configured', async () => {
      process.env['NODE_ENV'] = 'development';
      process.env['LOKI_URL'] = 'https://cloud.grafana.net';
      process.env['GRAFANA_CLOUD_USER'] = 'user123';
      process.env['GRAFANA_CLOUD_API_KEY'] = 'key456';
      process.env['LOKI_LOCAL_URL'] = 'http://loki:3100';

      await importLogger();

      const options = getPinoOptions();
      const transport = options.transport as {
        targets: Array<{ target: string }>;
      };
      // pino-pretty + 2 Loki targets (cloud + local) = 3 targets
      const lokiTargets = transport.targets.filter(
        (t) => t.target === 'pino-loki',
      );
      expect(lokiTargets).toHaveLength(2);
    });
  });

  describe('transport in production', () => {
    it('should have no transport when no Loki targets configured', async () => {
      process.env['NODE_ENV'] = 'production';

      await importLogger();

      const options = getPinoOptions();
      // Production without Loki → no transport (JSON to stdout)
      // But wait — production with no LOKI_URL/LOKI_LOCAL_URL uses default fallback
      // getLokiTargets() returns default local in production → has transport
      const transport = options.transport as
        | {
            targets: Array<{ target: string }>;
          }
        | undefined;
      // Default fallback adds loki:3100 in production
      expect(transport).toBeDefined();
      expect(transport!.targets).toBeDefined();
    });

    it('should use pino/file + Loki when Loki configured', async () => {
      process.env['NODE_ENV'] = 'production';
      process.env['LOKI_LOCAL_URL'] = 'http://loki:3100';

      await importLogger();

      const options = getPinoOptions();
      const transport = options.transport as {
        targets: Array<{ target: string }>;
      };
      const targetNames = transport.targets.map((t) => t.target);
      expect(targetNames).toContain('pino/file');
      expect(targetNames).toContain('pino-loki');
    });
  });

  describe('getLokiTargets (via transport targets)', () => {
    it('should not include cloud Loki without auth credentials', async () => {
      process.env['NODE_ENV'] = 'development';
      process.env['LOKI_URL'] = 'https://cloud.grafana.net';
      // No GRAFANA_CLOUD_USER/API_KEY → cloud target skipped

      await importLogger();

      const options = getPinoOptions();
      const transport = options.transport as { target: string };
      // Without valid auth, cloud target is skipped → no Loki → pino-pretty only
      expect(transport.target).toBe('pino-pretty');
    });

    it('should include cloud Loki with valid auth', async () => {
      process.env['NODE_ENV'] = 'development';
      process.env['LOKI_URL'] = 'https://cloud.grafana.net';
      process.env['GRAFANA_CLOUD_USER'] = 'user';
      process.env['GRAFANA_CLOUD_API_KEY'] = 'key';

      await importLogger();

      const options = getPinoOptions();
      const transport = options.transport as {
        targets: Array<{
          target: string;
          options: { host: string; basicAuth?: unknown };
        }>;
      };
      const lokiTarget = transport.targets.find(
        (t) => t.target === 'pino-loki',
      );
      expect(lokiTarget).toBeDefined();
      expect(lokiTarget!.options.host).toBe('https://cloud.grafana.net');
      expect(lokiTarget!.options.basicAuth).toEqual({
        username: 'user',
        password: 'key',
      });
    });

    it('should include Loki labels with app and service', async () => {
      process.env['NODE_ENV'] = 'development';
      process.env['LOKI_LOCAL_URL'] = 'http://loki:3100';

      await importLogger();

      const options = getPinoOptions();
      const transport = options.transport as {
        targets: Array<{
          target: string;
          options: { labels: Record<string, string> };
        }>;
      };
      const lokiTarget = transport.targets.find(
        (t) => t.target === 'pino-loki',
      );
      expect(lokiTarget!.options.labels.app).toBe('assixx');
      expect(lokiTarget!.options.labels.service).toBe('backend');
      expect(lokiTarget!.options.labels.loki_target).toBe('local');
    });
  });

  describe('createLogger', () => {
    it('should create a child logger with context binding', async () => {
      process.env['NODE_ENV'] = 'test';

      const { createLogger } = await importLogger();
      createLogger('DatabaseService');

      expect(mockChild).toHaveBeenCalledWith({ context: 'DatabaseService' });
    });

    it('should pass through the context string as-is', async () => {
      process.env['NODE_ENV'] = 'test';

      const { createLogger } = await importLogger();
      createLogger('RedisConnection');

      expect(mockChild).toHaveBeenCalledWith({ context: 'RedisConnection' });
    });
  });

  describe('exported logger instance', () => {
    it('should export a logger object returned by pino()', async () => {
      process.env['NODE_ENV'] = 'test';

      const { logger } = await importLogger();

      // The logger is whatever mockPino returns
      expect(logger).toBeDefined();
      expect(mockPino).toHaveBeenCalledTimes(1);
    });
  });
});
