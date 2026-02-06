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

  it('should not be empty', () => {
    expect(REDACT_PATHS.length).toBeGreaterThan(0);
  });
});

describe('REDACTED_VALUE', () => {
  it('should be [REDACTED]', () => {
    expect(REDACTED_VALUE).toBe('[REDACTED]');
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
