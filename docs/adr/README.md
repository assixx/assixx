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

| ADR                                   | Titel                        | Status   | Datum      |
| ------------------------------------- | ---------------------------- | -------- | ---------- |
| [ADR-001](./ADR-001-rate-limiting.md) | Rate Limiting Implementation | Accepted | 2026-01-06 |

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
