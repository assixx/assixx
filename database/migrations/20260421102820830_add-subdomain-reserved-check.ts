/**
 * Migration: Add reserved-slug CHECK constraint on tenants.subdomain
 *
 * Purpose: Enforce ADR-050 §"Reserved Slug List" at the database layer as
 * the last line of defense. The signup DTO rejects these slugs at the
 * application layer (defense in depth), but a direct SQL insert, admin
 * script, or future migration back-door would still pass the DTO. The
 * CHECK constraint catches those bypasses and fails loudly.
 *
 * WHY these specific slugs: any label we might plausibly want for our own
 * infra in the next 24 months — apex collisions (`www`), future
 * infra-subdomains (`api`, `cdn`, `static`, `mail`, `status`, `support`),
 * observability-tool slugs (`admin`, `app`, `docs`, `blog`, `grafana`,
 * `health`, `auth`, `assets`, `tempo`), and protocol-reserved literals
 * (`localhost`, `test` per RFC 6761). Conservative by design — cheaper
 * to un-reserve later than to reclaim a slug from a paying customer.
 *
 * GREENFIELD NOTE (2026-04-21): pre-flight `SELECT id, subdomain FROM
 * tenants WHERE subdomain IN (...reserved set...)` returned 0 rows, so
 * ADD CONSTRAINT cannot fail on existing data.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §"Reserved Slug List"
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Session 2 / Step 1.0
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_subdomain_reserved_check
      CHECK (subdomain NOT IN (
        'www','api','admin','app','assets','auth','cdn','docs','blog',
        'grafana','health','localhost','mail','static','status','support',
        'tempo','test'
      ));
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE tenants
      DROP CONSTRAINT IF EXISTS tenants_subdomain_reserved_check;
  `);
}
