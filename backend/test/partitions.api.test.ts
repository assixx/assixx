/**
 * Partition Health API Integration Tests
 *
 * Verifies pg_partman partition management via /health/partitions endpoint.
 * No auth required (public health check, same as /health).
 *
 * Checks:
 * - pg_partman extension installed
 * - audit_trail + root_logs registered in partman config
 * - Current month + 12 future months partitions exist
 * - Default partitions empty
 * - Background worker running
 *
 * Runs against REAL backend (Docker must be running).
 */
import type { JsonBody } from './helpers.js';

const HEALTH_URL = 'http://localhost:3000/health/partitions';

describe('Partition Health: Full Check', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(HEALTH_URL);
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should report healthy', () => {
    expect(body.healthy).toBe(true);
  });

  it('should have pg_partman extension installed', () => {
    expect(body.extension.installed).toBe(true);
    expect(body.extension.version).toBeDefined();
  });

  it('should have audit_trail registered with premake 12', () => {
    expect(body.tables.audit_trail.registered).toBe(true);
    expect(body.tables.audit_trail.premake).toBe(12);
  });

  it('should have root_logs registered with premake 12', () => {
    expect(body.tables.root_logs.registered).toBe(true);
    expect(body.tables.root_logs.premake).toBe(12);
  });

  it('should have current month partition for both tables', () => {
    expect(body.tables.audit_trail.currentMonthExists).toBe(true);
    expect(body.tables.root_logs.currentMonthExists).toBe(true);
  });

  it('should have 12 future months covered for both tables', () => {
    expect(body.tables.audit_trail.futureMonthsCovered).toBe(12);
    expect(body.tables.audit_trail.expectedFutureMonths).toBe(12);
    expect(body.tables.root_logs.futureMonthsCovered).toBe(12);
    expect(body.tables.root_logs.expectedFutureMonths).toBe(12);
  });

  it('should have empty default partitions', () => {
    expect(body.tables.audit_trail.defaultEmpty).toBe(true);
    expect(body.tables.root_logs.defaultEmpty).toBe(true);
  });

  it('should have background worker configured', () => {
    expect(body.bgw.configured).toBe(true);
  });
});
