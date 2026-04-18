/**
 * Domain Verification Service
 *
 * Owns three primitives for the DNS TXT ownership challenge (§0.2.5 #9):
 *   1. `generateToken()` — 32-byte cryptographic random, emitted as 64 hex chars.
 *   2. `txtHostFor(domain)` — builds `_assixx-verify.<domain>` (subdomain pattern,
 *      no collision with SPF/DMARC/DKIM at the apex per §0.2.5 #9).
 *   3. `txtValueFor(token)` — builds `assixx-verify=<token>` (AWS SES / Resend
 *      idiom so DNS tooling and support engineers recognize the shape).
 *
 * Plus one async: `verify(row)` resolves the TXT record and matches against the
 * row's stored token. Fails closed on DNS error, NXDOMAIN, timeout, and token
 * mismatch — returns `false` without surfacing the technical reason to the caller
 * (the service tier maps `false` to a user-friendly UX message per R4).
 *
 * @see docs/infrastructure/adr/ADR-049-tenant-domain-verification.md (Verification Mechanism: DNS-TXT Subdomain Challenge)
 *
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §2.4
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §0.2 R2 (3 s timeout),
 *      §0.2 R4 (typo discrimination), §0.2 R11 (outbound-DNS capability).
 */
import { Injectable, Logger } from '@nestjs/common';
import crypto from 'node:crypto';
import { Resolver } from 'node:dns/promises';

import { getErrorMessage } from '../common/index.js';
import type { TenantDomainRow } from './domains.types.js';

/**
 * Hard DNS timeout in milliseconds. Matches R2 mitigation (§0.2 risk register).
 * Node's default per-nameserver timeout is 10 s × up to 4 retries — unacceptable
 * for a user-facing "Verify now" button. v0.3.0 S1: enforce via `Promise.race`
 * so an unresponsive nameserver cannot stall the Fastify worker past 3 seconds.
 */
const DNS_TIMEOUT_MS = 3000;

@Injectable()
export class DomainVerificationService {
  private readonly logger = new Logger(DomainVerificationService.name);

  generateToken(): string {
    // 32 bytes → 64 hex chars. §0.2.5 #9 + §1.1 `verification_token VARCHAR(64)`.
    return crypto.randomBytes(32).toString('hex');
  }

  txtHostFor(domain: string): string {
    return `_assixx-verify.${domain}`;
  }

  txtValueFor(token: string): string {
    return `assixx-verify=${token}`;
  }

  /**
   * Returns true if the domain has a TXT record matching the expected value.
   * Fails closed on DNS errors AND on timeout.
   *
   * Timeout implementation (v0.3.0 S1): per-call `Resolver` with its own
   * `setTimeout(ms)` plus a `Promise.race` wrapper. `Resolver.setTimeout` alone
   * doesn't fully bound NXDOMAIN edge cases on some libresolv variants, so the
   * race is the authoritative clock. `resolver.cancel()` in `finally` releases
   * any in-flight socket even if the race rejected first.
   *
   * A zone may publish multiple TXT records at the same host (SPF, DKIM, our
   * verify token, …). Node's `resolveTxt` returns `string[][]` — outer array
   * is one entry per record, inner array is the ≤255-byte chunks of that
   * record (RFC 7208 §3.3). We `.join('')` each record and `.some()`-match.
   */
  async verify(row: TenantDomainRow): Promise<boolean> {
    const host = this.txtHostFor(row.domain);
    const expected = this.txtValueFor(row.verification_token);

    const resolver = new Resolver({ timeout: DNS_TIMEOUT_MS, tries: 1 });
    const query = resolver.resolveTxt(host); // [[string,…], …]
    // Braced bodies (not expression shorthand) on both arrows — the inner
    // `reject()` returns void, and returning a void expression from an arrow
    // shorthand trips `@typescript-eslint/no-confusing-void-expression`. The
    // outer arrow is braced for symmetry / readability.
    const timeout = new Promise<never>(
      (_resolve: (value: never) => void, reject: (reason?: unknown) => void) => {
        setTimeout(() => {
          reject(new Error(`DNS_TIMEOUT after ${DNS_TIMEOUT_MS}ms`));
        }, DNS_TIMEOUT_MS);
      },
    );

    try {
      const records = await Promise.race([query, timeout]);
      const flat = records.map((rec: string[]) => rec.join(''));
      const match = flat.some((value: string) => value.trim() === expected);

      if (!match) {
        this.logger.warn(
          `Domain-verify MISMATCH for tenant=${row.tenant_id} domain=${row.domain}: expected="${expected}", found=${JSON.stringify(flat)}`,
        );
      }
      return match;
    } catch (error: unknown) {
      this.logger.warn(
        `Domain-verify DNS error for tenant=${row.tenant_id} domain=${row.domain}: ${getErrorMessage(error)}`,
      );
      return false;
    } finally {
      resolver.cancel();
    }
  }
}
