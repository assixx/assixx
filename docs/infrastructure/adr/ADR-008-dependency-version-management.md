# ADR-008: Dependency Version Management (Production vs Development)

| Metadata                | Value                             |
| ----------------------- | --------------------------------- |
| **Status**              | Accepted                          |
| **Date**                | 2026-01-15                        |
| **Decision Makers**     | SCS Technik                       |
| **Affected Components** | Docker, pnpm, package.json, CI/CD |

---

## Context

Bei der Entwicklung von Assixx stellte sich die Frage, wie Dependency-Versionen zwischen Production und Development gehandhabt werden sollen:

### Fragestellung

1. **Runtime (Node.js)**: Können/sollen Prod und Dev unterschiedliche Node-Versionen nutzen?
2. **NPM Packages**: Können/sollen Prod und Dev unterschiedliche Package-Versionen nutzen?
3. **Schutz**: Wie verhindern wir, dass Dev-Dependencies in Production landen?

### Bestehendes Setup

- **Package Manager**: pnpm 10.28.0 mit Workspace
- **Lock File**: Eine `pnpm-lock.yaml` für das gesamte Projekt
- **Docker**: Multi-Stage Builds für Frontend/Backend
- **Environments**: Development (lokal), Production (Docker)

### Risiken ohne klare Strategie

| Risiko                             | Impact                            |
| ---------------------------------- | --------------------------------- |
| Dev-Dependencies in Prod           | Größere Images, Sicherheitslücken |
| Unterschiedliche Package-Versionen | "Works on my machine" Bugs        |
| Unkontrollierte Updates            | Breaking Changes in Production    |
| Version-Drift                      | Nicht reproduzierbare Builds      |

---

## Decision

### 1. Runtime-Versionen (Node.js): KÖNNEN unterschiedlich sein

**Mechanismus**: Docker Build Arguments

```dockerfile
# Dockerfile.frontend / Dockerfile.dev
ARG NODE_VERSION=24.13.0-alpine3.22
FROM node:${NODE_VERSION}
```

**Steuerung via**:

- `docker/.env` - Single Source of Truth
- `docker-compose.yml` - Build Args
- Fallback-Default im Dockerfile

**Rationale**: Node-LTS in Prod für Stabilität, neuere Version in Dev zum Testen möglich.

### 2. NPM Package-Versionen: MÜSSEN identisch sein

**Mechanismus**: Eine Lock-Datei für alle Environments

```
pnpm-lock.yaml  ← Single Source of Truth
      │
      ├── Production Build: pnpm install --frozen-lockfile
      └── Development:      pnpm install --frozen-lockfile
```

**Rationale**:

- Testing-Integrity: Was getestet wird = was deployed wird
- Reproduzierbare Builds: Identische Versionen überall
- Keine "Works on my machine" Bugs

### 3. Welche Packages installiert werden: dependencies vs devDependencies

```
package.json
├── dependencies        → Production + Development
│   ├── @nestjs/core
│   ├── fastify
│   └── pg
│
└── devDependencies     → NUR Development
    ├── typescript
    ├── eslint
    └── vitest
```

**Schutz-Mechanismus**:

```dockerfile
# Dockerfile.frontend:53
RUN pnpm deploy --filter=assixx-frontend --prod /deploy
#                                        ^^^^^^
#                    Nur dependencies, KEINE devDependencies
```

### 4. Neue Versionen testen: Git-Branches statt separate Lock-Files

```
Branch: main (stable)          Branch: testing/svelte-upgrade
┌─────────────────────┐          ┌─────────────────────┐
│ pnpm-lock.yaml      │          │ pnpm-lock.yaml      │
│ SvelteKit: 2.21.4   │          │ SvelteKit: 3.0-beta │
└─────────────────────┘          └─────────────────────┘
         │                                │
         ▼                                ▼
    PRODUCTION                    STAGING / DEV-SERVER
```

**Workflow**:

1. Feature-Branch mit neuen Versionen erstellen
2. Auf Staging/Dev testen
3. Nach erfolgreichem Test: Merge zu main
4. Production erhält Updates erst nach Merge

---

## Alternatives Considered

### 1. Separate Lock-Files pro Environment

| Pro                                | Contra                           |
| ---------------------------------- | -------------------------------- |
| Unterschiedliche Versionen möglich | Version-Drift                    |
| Flexibilität                       | Nicht reproduzierbar             |
|                                    | Maintenance-Aufwand verdoppelt   |
|                                    | "Works on my machine" garantiert |

**Entscheidung**: Abgelehnt - Verstößt gegen Reproduzierbarkeit.

### 2. npm statt pnpm

| Pro             | Contra                               |
| --------------- | ------------------------------------ |
| Breiter bekannt | Langsamer                            |
|                 | Keine Workspace-Symlinks             |
|                 | Größerer node_modules                |
|                 | `pnpm deploy --prod` nicht verfügbar |

**Entscheidung**: Abgelehnt - pnpm bietet bessere Monorepo-Unterstützung.

### 3. Keine Lock-File (immer latest)

| Pro                             | Contra                             |
| ------------------------------- | ---------------------------------- |
| Immer aktuelle Security-Patches | Nicht reproduzierbar               |
|                                 | Breaking Changes jederzeit möglich |
|                                 | CI kann anders bauen als lokal     |

**Entscheidung**: Abgelehnt - Inakzeptables Risiko.

### 4. Renovate/Dependabot für automatische Updates

| Pro                           | Contra                    |
| ----------------------------- | ------------------------- |
| Automatische Security-Updates | Zusätzliche Komplexität   |
| PRs für jedes Update          | Noise bei vielen Updates  |
| Gute für große Teams          | Overkill für kleines Team |

**Entscheidung**: Später evaluieren - Aktuell manuell Updates via `pnpm update`.

---

## Consequences

### Positive

1. **Reproduzierbare Builds**: Lock-File garantiert identische Versionen
2. **Testing-Integrity**: Dev testet exakt was Prod ausführt
3. **Klare Trennung**: `dependencies` vs `devDependencies`
4. **Sichere Prod-Images**: `pnpm deploy --prod` exkludiert Dev-Tools
5. **Flexible Runtime**: Node-Version pro Environment steuerbar
6. **Dokumentierte Entscheidung**: Diese ADR als Referenz

### Negative

1. **Kein "schnelles Testen"**: Neue Version erfordert Branch
2. **Merge-Konflikte**: Lock-File kann bei paralleler Arbeit konflikten
3. **Update-Aufwand**: Manuelle Updates statt automatisch

### Neutral

1. **Branch-Strategie erforderlich**: testing/feature-Branches für Upgrades
2. **Lock-File-Größe**: pnpm-lock.yaml kann groß werden (~1MB)

---

## Implementation Status

### Implementiert

| Schutz                    | Datei                                                    | Status |
| ------------------------- | -------------------------------------------------------- | ------ |
| `--prod` Flag             | `Dockerfile.frontend:57`                                 | ✅     |
| `--frozen-lockfile`       | `Dockerfile.frontend:38`, `Dockerfile.dev:41`            | ✅     |
| `engines` Field           | `package.json:6-11`                                      | ✅     |
| `preinstall` Hook         | `package.json:37`                                        | ✅     |
| `.npmrc` Enforcement      | `.npmrc`                                                 | ✅     |
| **Node-Version ARG**      | `Dockerfile.frontend:19`, `Dockerfile.dev:13`            | ✅     |
| **pnpm-Version ARG**      | `Dockerfile.frontend:23`, `Dockerfile.dev:26`            | ✅     |
| **Build-Args in Compose** | `docker-compose.yml:73-76`, `docker-compose.yml:308-310` | ✅     |
| **Version-Variablen**     | `docker/.env:27-29`                                      | ✅     |

### Konfiguration (Single Source of Truth)

```bash
# docker/.env
NODE_VERSION_PROD=24.13.0-alpine3.22  # Production: LTS
NODE_VERSION_DEV=24.13.0-alpine3.22   # Development: kann auf neuere Version gesetzt werden
PNPM_VERSION=10.28.0                   # Beide Environments
```

### Use Case: Dev auf Node 26 upgraden, Prod bleibt auf Node 24

**Schritt 1: Eine Zeile in `.env` ändern**

```bash
# docker/.env

# VORHER (beide gleich):
NODE_VERSION_PROD=24.13.0-alpine3.22
NODE_VERSION_DEV=24.13.0-alpine3.22

# NACHHER (nur DEV ändern):
NODE_VERSION_PROD=24.13.0-alpine3.22      # ← bleibt
NODE_VERSION_DEV=26.0.0-alpine3.22        # ← NEU
```

**Schritt 2: Backend neu bauen**

```bash
cd /home/scs/projects/Assixx/docker
docker-compose build backend
```

**Fertig.**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Production (Frontend + Nginx):  Node 24.13.0 LTS  ← unverändert│
│  Development (Backend):          Node 26.0.0 LTS   ← NEU        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Zusammenfassung:**

| Was               | Wo            | Änderung                             |
| ----------------- | ------------- | ------------------------------------ |
| **Eine Variable** | `docker/.env` | `NODE_VERSION_DEV=26.0.0-alpine3.22` |
| **Ein Befehl**    | Terminal      | `docker-compose build backend`       |

Prod wird **nicht** angefasst.

---

### Use Case: Nach erfolgreichem Test auch Prod upgraden

**Schritt 1: Prod-Variable in `.env` ändern**

```bash
# docker/.env
NODE_VERSION_PROD=26.0.0-alpine3.22       # ← jetzt auch Prod
NODE_VERSION_DEV=26.0.0-alpine3.22
```

**Schritt 2: Frontend neu bauen**

```bash
cd /home/scs/projects/Assixx/docker
docker-compose --profile production build frontend
```

---

## Version Control Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                    VERSION CONTROL MATRIX                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Komponente          │ Kontrolliert durch      │ Prod ≠ Dev?   │
│  ────────────────────┼─────────────────────────┼───────────────│
│  Node.js Version     │ Dockerfile (FROM)       │ JA (möglich)  │
│  pnpm Version        │ package.json            │ NEIN          │
│  NPM Package Version │ pnpm-lock.yaml          │ NEIN          │
│  Welche Packages     │ dependencies vs devDeps │ JA (by design)│
│  Security Overrides  │ pnpm.overrides          │ NEIN          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## References

- [pnpm deploy Documentation](https://pnpm.io/cli/deploy)
- [pnpm Workspace](https://pnpm.io/workspaces)
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Semantic Versioning](https://semver.org/)
- [Node.js LTS Schedule](https://nodejs.org/en/about/releases/)
