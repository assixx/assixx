# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the Assixx project.

## What are ADRs?

ADRs document important architectural decisions:

- **Why** was a particular technology/approach chosen?
- **What alternatives** were considered?
- **What consequences** does the decision have?

## ADR Status

| Status         | Meaning                                  |
| -------------- | ---------------------------------------- |
| **Proposed**   | Proposed, not yet decided                |
| **Accepted**   | Accepted and implemented                 |
| **Deprecated** | Outdated, superseded by a newer decision |
| **Superseded** | Replaced by ADR-XXX                      |

## Index

| ADR                                                                          | Title                                                        | Status     | Date       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------- | ---------- |
| [ADR-001](./ADR-001-rate-limiting.md)                                        | Rate Limiting Implementation                                 | Accepted   | 2026-01-06 |
| [ADR-002](./ADR-002-alerting-monitoring.md)                                  | Alerting & Monitoring                                        | Accepted   | 2026-01-07 |
| [ADR-003](./ADR-003-notification-system.md)                                  | Real-Time Notification System                                | Accepted   | 2026-01-11 |
| [ADR-004](./ADR-004-persistent-notification-counts.md)                       | Persistent Notification Counts                               | Accepted   | 2026-01-14 |
| [ADR-005](./ADR-005-authentication-strategy.md)                              | Authentication Strategy                                      | Accepted   | 2026-01-14 |
| [ADR-006](./ADR-006-multi-tenant-context-isolation.md)                       | Multi-Tenant Context Isolation                               | Accepted   | 2026-01-14 |
| [ADR-007](./ADR-007-api-response-standardization.md)                         | API Response Standardization                                 | Accepted   | 2026-01-14 |
| [ADR-008](./ADR-008-dependency-version-management.md)                        | Dependency Version Management                                | Accepted   | 2026-01-15 |
| [ADR-009](./ADR-009-central-audit-logging.md)                                | Central Audit Logging Architecture                           | Accepted   | 2026-01-15 |
| [ADR-010](./ADR-010-user-role-assignment-permissions.md)                     | User Role Assignment & Permissions                           | Accepted   | 2026-01-22 |
| [ADR-011](./ADR-011-shift-data-architecture.md)                              | Shift Data Architecture & Sync                               | Accepted   | 2026-01-25 |
| [ADR-012](./ADR-012-frontend-route-security-groups.md)                       | Frontend Route Security Groups                               | Accepted   | 2026-01-26 |
| [ADR-013](./ADR-013-ci-cd-pipeline-hardening.md)                             | CI/CD Pipeline Hardening                                     | Accepted   | 2026-01-26 |
| [ADR-014](./ADR-014-database-migration-architecture.md)                      | Database & Migration Architecture                            | Accepted   | 2026-01-27 |
| [ADR-015](./ADR-015-shared-package-architecture.md)                          | Shared Package Architecture & Plan                           | Accepted   | 2026-01-30 |
| [ADR-016](./ADR-016-tenant-customizable-seed-data.md)                        | Tenant-Customizable Seed Data                                | Accepted   | 2026-02-02 |
| [ADR-017](./ADR-017-design-system-theming-architecture.md)                   | Design System Theming Architecture                           | Accepted   | 2026-02-02 |
| [ADR-017 Plan](./ADR-017-IMPLEMENTATION-PLAN.md)                             | ADR-017 Implementation Plan                                  | Active     | 2026-02-02 |
| [ADR-018](./ADR-018-testing-strategy.md)                                     | Testing Strategy (Unit + API)                                | Accepted   | 2026-02-04 |
| [ADR-019](./ADR-019-multi-tenant-rls-isolation.md)                           | Multi-Tenant RLS Data Isolation                              | Accepted   | 2026-02-07 |
| [ADR-020](./ADR-020-per-user-feature-permissions.md)                         | Per-User Feature Permission Control                          | Accepted   | 2026-02-07 |
| [ADR-021](./ADR-021-e2e-encryption.md)                                       | E2E Encryption for 1:1 Chat                                  | Accepted   | 2026-02-10 |
| [ADR-022](./ADR-022-e2e-key-escrow.md)                                       | E2E Key Escrow (Zero-Knowledge)                              | Accepted   | 2026-02-11 |
| [ADR-023](./ADR-023-vacation-request-architecture.md)                        | Vacation Request System Architecture                         | Accepted   | 2026-02-13 |
| [ADR-024](./ADR-024-frontend-feature-guards.md)                              | Frontend Feature Guards                                      | Accepted   | 2026-02-15 |
| [ADR-025](./ADR-025-pg-stat-statements-query-monitoring.md)                  | pg_stat_statements Query Monitoring                          | Accepted   | 2026-02-16 |
| [ADR-026](./ADR-026-tpm-architecture.md)                                     | TPM Architecture                                             | Accepted   | 2026-02-19 |
| [ADR-027](./ADR-027-dockerfile-hardening.md)                                 | Dockerfile Hardening                                         | Accepted   | 2026-02-28 |
| [ADR-028](./ADR-028-work-orders-architecture.md)                             | Work Orders Architecture                                     | Accepted   | 2026-03-03 |
| [ADR-029](./ADR-029-pg-partman-partition-management.md)                      | pg_partman Partition Management                              | Accepted   | 2026-03-06 |
| [ADR-030](./ADR-030-zod-validation-architecture.md)                          | Zod Validation Architecture                                  | Accepted   | 2026-03-07 |
| [ADR-031](./ADR-031-centralized-read-tracking.md)                            | Centralized Read-Tracking                                    | Accepted   | 2026-03-07 |
| [ADR-032](./ADR-032-feature-catalog-and-plan-tiers.md)                       | Feature-Katalog und Plan-Tiers                               | Superseded | 2026-03-10 |
| [ADR-033](./ADR-033-addon-based-saas-model.md)                               | Addon-basiertes SaaS-Modell                                  | Accepted   | 2026-03-10 |
| [ADR-034](./ADR-034-hierarchy-labels-propagation.md)                         | Hierarchy Labels Propagation                                 | Accepted   | 2026-03-11 |
| [ADR-035](./ADR-035-organizational-hierarchy-and-assignment-architecture.md) | Organizational Hierarchy & Assignment Architecture           | Accepted   | 2026-03-13 |
| [ADR-036](./ADR-036-organizational-scope-access-control.md)                  | Organizational Scope Access Control                          | Accepted   | 2026-03-14 |
| [ADR-037](./ADR-037-approvals-architecture.md)                               | Approvals (Freigabe-System) Architecture                     | Accepted   | 2026-03-17 |
| [ADR-038](./ADR-038-position-catalog-architecture.md)                        | Position Catalog Architecture                                | Accepted   | 2026-03-17 |
| [ADR-039](./ADR-039-per-tenant-deputy-scope-toggle.md)                       | Per-Tenant Deputy Scope Toggle                               | Accepted   | 2026-03-21 |
| [ADR-040](./ADR-040-inventory-addon-architecture.md)                         | Inventory Addon Architecture                                 | Accepted   | 2026-04-06 |
| [ADR-041](./ADR-041-typescript-compiler-configuration.md)                    | TypeScript Compiler Configuration & Strict-Everywhere Policy | Accepted   | 2026-04-07 |
| [ADR-042](./ADR-042-multipart-file-upload-pipeline.md)                       | Multipart File Upload Pipeline (Fastify + Multer Bridge)     | Accepted   | 2026-04-08 |
| [ADR-043](./ADR-043-postgresql-18-upgrade.md)                                | PostgreSQL 17 → 18 Major Upgrade                             | Accepted   | 2026-04-10 |
| [ADR-044](./ADR-044-seo-and-security-headers.md)                             | SEO Infrastructure & Security Headers                        | Accepted   | 2026-04-11 |

## Template

Use the following template for new ADRs:

```markdown
# ADR-XXX: [Title]

| Metadata                | Value                            |
| ----------------------- | -------------------------------- |
| **Status**              | Proposed / Accepted / Deprecated |
| **Date**                | YYYY-MM-DD                       |
| **Decision Makers**     | Names                            |
| **Affected Components** | Components                       |

---

## Context

[Describe the problem and context]

## Decision

[Describe the decision made]

## Alternatives Considered

[List of alternatives considered with pros/cons]

## Consequences

### Positive

[Positive impacts]

### Negative

[Negative impacts]

## References

[Links to relevant documents]
```

## Naming Convention

```
ADR-XXX-short-title.md
```

- `XXX`: Sequential number (001, 002, ...)
- `short-title`: Kebab-case short title
