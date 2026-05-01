import { Writable } from 'node:stream';
import pino from 'pino';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  EXCLUDED_ROUTES,
  EXCLUDED_URL_PATHS,
  LOG_LEVELS,
  LOKI_CONFIG,
  REDACTED_VALUE,
  REDACT_PATHS,
  getGrafanaCloudAuth,
} from './logger.constants.js';

describe('REDACT_PATHS', () => {
  it('should contain auth header paths', () => {
    expect(REDACT_PATHS).toContain('req.headers.authorization');
    expect(REDACT_PATHS).toContain('req.headers.cookie');
  });

  it('should contain auth body fields', () => {
    expect(REDACT_PATHS).toContain('req.body.password');
    expect(REDACT_PATHS).toContain('req.body.newPassword');
    expect(REDACT_PATHS).toContain('req.body.currentPassword');
  });

  it('should contain token fields', () => {
    expect(REDACT_PATHS).toContain('req.body.accessToken');
    expect(REDACT_PATHS).toContain('req.body.refreshToken');
    expect(REDACT_PATHS).toContain('res.body.accessToken');
    expect(REDACT_PATHS).toContain('res.body.refreshToken');
  });

  it('should contain wildcard paths for nested sensitive data (levels 1-4)', () => {
    expect(REDACT_PATHS).toContain('password');
    expect(REDACT_PATHS).toContain('*.password');
    expect(REDACT_PATHS).toContain('*.*.password');
    expect(REDACT_PATHS).toContain('*.*.*.password');
  });

  // 2FA fields (ADR-054 / DD-18 / Masterplan §2.10).
  // Catches accidental removal of the six paths added for the email-2FA feature.
  it('should contain 2FA code + challengeToken paths (DD-18)', () => {
    expect(REDACT_PATHS).toContain('req.body.code');
    expect(REDACT_PATHS).toContain('req.body.challengeToken');
    expect(REDACT_PATHS).toContain('res.body.challengeToken');
    expect(REDACT_PATHS).toContain('res.body.data.challengeToken');
    expect(REDACT_PATHS).toContain('*.code');
    expect(REDACT_PATHS).toContain('*.challengeToken');
  });

  it('should not be empty', () => {
    expect(REDACT_PATHS.length).toBeGreaterThan(0);
  });
});

describe('REDACTED_VALUE', () => {
  it('should be [REDACTED]', () => {
    expect(REDACTED_VALUE).toBe('[REDACTED]');
  });
});

/**
 * Runtime redaction behavior (ADR-054 / DD-18 / Masterplan §2.10).
 *
 * Pino redaction fails silently on path typos: a misspelled glob means the field
 * is logged in plaintext with NO error. Structural toContain() assertions above
 * verify the entries exist; these tests verify they actually take effect against
 * a real Pino instance configured exactly like main.ts:337-340.
 *
 * Tests use raw-string assertions (`not.toContain(secret)` + `toContain('[REDACTED]')`).
 * The security property is "the secret MUST NOT appear in the output, period" —
 * raw-string anchoring matches that property directly.
 */
describe('REDACT_PATHS — runtime redaction behavior (DD-18)', () => {
  /** Build a Pino instance writing to an in-memory buffer; mirrors main.ts production config. */
  function createBufferedLogger(): { logger: pino.Logger; output: () => string } {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding: string, cb: () => void) {
        chunks.push(chunk.toString('utf8'));
        cb();
      },
    });
    const logger = pino(
      {
        level: 'info',
        redact: { paths: [...REDACT_PATHS], censor: REDACTED_VALUE },
      },
      stream,
    );
    return { logger, output: () => chunks.join('') };
  }

  // The 2FA code is the post-confidentiality boundary — leak == account takeover.
  // Use a sentinel value distinct from any plausible alphabet member so substring
  // assertions can't false-pass on incidental overlap.
  const SECRET_CODE = 'ZZ9PZ9'; // valid Crockford alphabet shape, vanishingly rare in any other context
  const SECRET_TOKEN = 'kZv-test-challenge-token-do-not-leak';

  it('redacts req.body.code (login/signup verify request body)', () => {
    const { logger, output } = createBufferedLogger();
    logger.info({ req: { body: { code: SECRET_CODE } } });
    expect(output()).toContain(REDACTED_VALUE);
    expect(output()).not.toContain(SECRET_CODE);
  });

  it('redacts req.body.challengeToken', () => {
    const { logger, output } = createBufferedLogger();
    logger.info({ req: { body: { challengeToken: SECRET_TOKEN } } });
    expect(output()).toContain(REDACTED_VALUE);
    expect(output()).not.toContain(SECRET_TOKEN);
  });

  it('redacts res.body.challengeToken (response envelope shallow)', () => {
    const { logger, output } = createBufferedLogger();
    logger.info({ res: { body: { challengeToken: SECRET_TOKEN } } });
    expect(output()).toContain(REDACTED_VALUE);
    expect(output()).not.toContain(SECRET_TOKEN);
  });

  it('redacts res.body.data.challengeToken (ResponseInterceptor envelope, ADR-007)', () => {
    const { logger, output } = createBufferedLogger();
    logger.info({ res: { body: { data: { challengeToken: SECRET_TOKEN } } } });
    expect(output()).toContain(REDACTED_VALUE);
    expect(output()).not.toContain(SECRET_TOKEN);
  });

  it('redacts code at level-2 wildcard depth (e.g. { user: { code } })', () => {
    const { logger, output } = createBufferedLogger();
    logger.info({ user: { code: SECRET_CODE } });
    expect(output()).toContain(REDACTED_VALUE);
    expect(output()).not.toContain(SECRET_CODE);
  });

  it('redacts challengeToken at level-2 wildcard depth', () => {
    const { logger, output } = createBufferedLogger();
    logger.info({ challenge: { challengeToken: SECRET_TOKEN } });
    expect(output()).toContain(REDACTED_VALUE);
    expect(output()).not.toContain(SECRET_TOKEN);
  });

  // Negative tests — lock in the deliberate scope decisions in §2.10.

  it('does NOT redact unrelated fields (email, msg) when 2FA fields are present', () => {
    const { logger, output } = createBufferedLogger();
    logger.info(
      { req: { body: { email: 'user@scs-technik.de', code: SECRET_CODE } } },
      'login attempt',
    );
    expect(output()).toContain('user@scs-technik.de');
    expect(output()).toContain('login attempt');
    expect(output()).not.toContain(SECRET_CODE);
  });

  // Plan §2.10 deliberately omits Level-1 bare `code` from REDACT_PATHS so that
  // Postgres-error.code / Node-error.code remain debuggable in logs. This test
  // locks that decision in — if a future PR adds `'code'` to the bare-level
  // wildcards block, this test fails and the author has to revisit DD-18.
  it('does NOT redact bare code at log root (PG/Node Error.code stays debuggable)', () => {
    const { logger, output } = createBufferedLogger();
    logger.info({ code: 'ECONNREFUSED', message: 'connection refused' });
    expect(output()).toContain('ECONNREFUSED');
    expect(output()).not.toContain(REDACTED_VALUE);
  });
});

describe('LOG_LEVELS', () => {
  it('should use info for production', () => {
    expect(LOG_LEVELS.production).toBe('info');
  });

  it('should use info for development (DEBUG only via env var)', () => {
    expect(LOG_LEVELS.development).toBe('info');
  });

  it('should use silent for test', () => {
    expect(LOG_LEVELS.test).toBe('silent');
  });
});

describe('EXCLUDED_ROUTES', () => {
  it('should contain health and metrics GET routes', () => {
    expect(EXCLUDED_ROUTES).toContainEqual({ method: 'GET', path: 'health' });
    expect(EXCLUDED_ROUTES).toContainEqual({ method: 'GET', path: 'metrics' });
  });

  it('should have exactly 2 excluded routes', () => {
    expect(EXCLUDED_ROUTES).toHaveLength(2);
  });
});

describe('EXCLUDED_URL_PATHS', () => {
  it('should contain full URL paths', () => {
    expect(EXCLUDED_URL_PATHS).toContain('/health');
    expect(EXCLUDED_URL_PATHS).toContain('/api/v2/health');
    expect(EXCLUDED_URL_PATHS).toContain('/api/v2/metrics');
  });
});

describe('LOKI_CONFIG', () => {
  it('should have default URL for Docker network', () => {
    expect(LOKI_CONFIG.defaultUrl).toBe('http://loki:3100');
  });

  it('should have push endpoint', () => {
    expect(LOKI_CONFIG.endpoint).toBe('/loki/api/v1/push');
  });

  it('should have batching config', () => {
    expect(LOKI_CONFIG.batching.interval).toBe(5);
    expect(LOKI_CONFIG.batching.maxBufferSize).toBe(10000);
  });

  it('should have app and service labels', () => {
    expect(LOKI_CONFIG.labels.app).toBe('assixx');
    expect(LOKI_CONFIG.labels.service).toBe('backend');
  });
});

describe('getGrafanaCloudAuth', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return undefined when env vars are not set', () => {
    vi.stubEnv('GRAFANA_CLOUD_USER', '');
    vi.stubEnv('GRAFANA_CLOUD_API_KEY', '');
    expect(getGrafanaCloudAuth()).toBeUndefined();
  });

  it('should return undefined when only user is set', () => {
    vi.stubEnv('GRAFANA_CLOUD_USER', 'user123');
    vi.stubEnv('GRAFANA_CLOUD_API_KEY', '');
    expect(getGrafanaCloudAuth()).toBeUndefined();
  });

  it('should return undefined when only API key is set', () => {
    vi.stubEnv('GRAFANA_CLOUD_USER', '');
    vi.stubEnv('GRAFANA_CLOUD_API_KEY', 'key123');
    expect(getGrafanaCloudAuth()).toBeUndefined();
  });

  it('should return auth object when both env vars are set', () => {
    vi.stubEnv('GRAFANA_CLOUD_USER', 'user123');
    vi.stubEnv('GRAFANA_CLOUD_API_KEY', 'key456');
    const auth = getGrafanaCloudAuth();
    expect(auth).toEqual({
      username: 'user123',
      password: 'key456',
    });
  });
});
