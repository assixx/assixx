# Architecture Decision Records (ADRs)

Dieses Verzeichnis enthält Architecture Decision Records (ADRs) für das Assixx-Projekt.

## Was sind ADRs?

ADRs dokumentieren wichtige architektonische Entscheidungen:

- **Warum** wurde eine bestimmte Technologie/Approach gewählt?
- **Welche Alternativen** wurden betrachtet?
- **Welche Konsequenzen** hat die Entscheidung?

## ADR Status

| Status         | Bedeutung                                   |
| -------------- | ------------------------------------------- |
| **Proposed**   | Vorgeschlagen, noch nicht entschieden       |
| **Accepted**   | Akzeptiert und implementiert                |
| **Deprecated** | Veraltet, durch neuere Entscheidung ersetzt |
| **Superseded** | Ersetzt durch ADR-XXX                       |

## Index

| ADR                                                      | Titel                              | Status   | Datum      |
| -------------------------------------------------------- | ---------------------------------- | -------- | ---------- |
| [ADR-001](./ADR-001-rate-limiting.md)                    | Rate Limiting Implementation       | Accepted | 2026-01-06 |
| [ADR-002](./ADR-002-alerting-monitoring.md)              | Alerting & Monitoring              | Accepted | 2026-01-07 |
| [ADR-003](./ADR-003-notification-system.md)              | Real-Time Notification System      | Accepted | 2026-01-11 |
| [ADR-004](./ADR-004-persistent-notification-counts.md)   | Persistent Notification Counts     | Proposed | 2026-01-14 |
| [ADR-005](./ADR-005-authentication-strategy.md)          | Authentication Strategy            | Accepted | 2026-01-14 |
| [ADR-006](./ADR-006-multi-tenant-context-isolation.md)   | Multi-Tenant Context Isolation     | Accepted | 2026-01-14 |
| [ADR-007](./ADR-007-api-response-standardization.md)     | API Response Standardization       | Accepted | 2026-01-14 |
| [ADR-008](./ADR-008-dependency-version-management.md)    | Dependency Version Management      | Accepted | 2026-01-15 |
| [ADR-009](./ADR-009-user-role-assignment-permissions.md) | User Role Assignment & Permissions | Accepted | 2026-01-22 |
| [ADR-011](./ADR-011-shift-data-architecture.md)          | Shift Data Architecture & Sync     | Accepted | 2026-01-25 |
| [ADR-012](./ADR-012-frontend-route-security-groups.md)   | Frontend Route Security Groups     | Accepted | 2026-01-26 |
| [ADR-013](./ADR-013-ci-cd-pipeline-hardening.md)         | CI/CD Pipeline Hardening           | Accepted | 2026-01-26 |
| [ADR-014](./ADR-014-database-migration-architecture.md)  | Database & Migration Architecture  | Accepted | 2026-01-27 |
| [ADR-015](./ADR-015-shared-package-architecture.md)      | Shared Package Architecture & Plan | Accepted | 2026-01-30 |
| [ADR-016](./ADR-016-tenant-customizable-seed-data.md)    | Tenant-Customizable Seed Data      | Accepted | 2026-02-02 |

## Template

Für neue ADRs verwende folgendes Template:

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

[Beschreibe das Problem und den Kontext]

## Decision

[Beschreibe die getroffene Entscheidung]

## Alternatives Considered

[Liste der betrachteten Alternativen mit Pro/Contra]

## Consequences

### Positive

[Positive Auswirkungen]

### Negative

[Negative Auswirkungen]

## References

[Links zu relevanten Dokumenten]
```

## Naming Convention

```
ADR-XXX-short-title.md
```

- `XXX`: Fortlaufende Nummer (001, 002, ...)
- `short-title`: Kebab-case Kurztitel
