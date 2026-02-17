# Semgrep Security Scanning — Guide

> **Erstellt:** 2026-02-17
> **Status:** Aktiv
> **ADR:** Keins (leichtgewichtiges Tool, kein Architektur-Impact)

---

## Was ist Semgrep?

Statischer Security-Scanner (SAST) der Code auf Sicherheitslücken analysiert — SQL Injection, XSS, Path Traversal, OWASP Top 10, Dockerfile-Hygiene. Versteht Code-Semantik, nicht nur Regex.

**Semgrep ersetzt ESLint NICHT.** Die Tools sind komplementär:

| Tool    | Aufgabe                                          |
| ------- | ------------------------------------------------ |
| ESLint  | Code-Qualität, Style, Type-Safety, Svelte-Regeln |
| Semgrep | Security-Scanning, Taint-Tracking, OWASP Top 10  |

---

## Setup

### Dateien

```
.semgrepignore                      ← Was Semgrep ignoriert
.github/workflows/semgrep.yml      ← CI Workflow
```

### Kein Account, kein Token, keine Dependency

- Kein Signup bei Semgrep
- Kein `SEMGREP_APP_TOKEN`
- Kein Eintrag in `package.json`
- Kein neuer Docker-Container lokal
- `--metrics=off` — keine Telemetrie an Semgrep Inc.

---

## Wann läuft Semgrep?

| Trigger                     | Wann                                      |
| --------------------------- | ----------------------------------------- |
| **Pull Request** auf `main` | Bei jedem PR-Open/Update                  |
| **Push** auf `main`         | Nach Merge                                |
| **Schedule**                | Jeden Montag 06:00 UTC (Weekly Full Scan) |
| **Manuell**                 | GitHub Actions → "Run workflow"           |

**Path-Filter:** Nur bei Änderungen in `backend/`, `shared/`, `docker/`.
Frontend-Änderungen triggern keinen Scan (Semgrep hat keinen Svelte-Support).

---

## Rulesets

| Ruleset           | ~Rules | Was es findet                                                           |
| ----------------- | ------ | ----------------------------------------------------------------------- |
| `p/typescript`    | 32     | `pg-sqli` (SQL Injection in pg), JWT Secrets, XSS, SSRF, Path Traversal |
| `p/nestjs`        | 3      | CORS Misconfiguration, XSS Header disabled, Open Redirect               |
| `p/owasp-top-ten` | 45     | OWASP Top 10 inkl. Nginx Rules, Crypto Failures                         |
| `p/dockerfile`    | 44     | Root User, Package Manager, Dockerfile Best Practices                   |

### Relevanteste Rules für unseren Stack

| Rule                                  | Was                           | Warum relevant              |
| ------------------------------------- | ----------------------------- | --------------------------- |
| `pg-sqli`                             | SQL Injection in `pg` Library | Wir nutzen raw `pg` Queries |
| `nestjs-header-cors-any`              | Permissive CORS `*`           | NestJS CORS Config          |
| `hardcoded-jwt-secret`                | JWT Secret im Code            | JWT Auth System             |
| `detect-child-process`                | Command Injection             | Node.js child_process       |
| `express-path-join-resolve-traversal` | Path Traversal                | File Upload/Download        |

---

## Lokal testen

Semgrep muss nicht lokal laufen — CI macht es automatisch. Aber zum Testen vor einem Push:

### Option 1: Docker (empfohlen, kein Install)

```bash
# Aus dem Projekt-Root:
docker run --rm -v "$(pwd):/src" semgrep/semgrep \
  semgrep scan \
    --config p/typescript \
    --config p/nestjs \
    --config p/owasp-top-ten \
    --config p/dockerfile \
    --metrics=off \
    backend/ shared/ docker/
```

### Option 2: pip install

```bash
pip3 install semgrep
semgrep scan \
  --config p/typescript \
  --config p/nestjs \
  --config p/owasp-top-ten \
  --config p/dockerfile \
  --metrics=off \
  backend/ shared/ docker/
```

### Einzelne Datei scannen

```bash
docker run --rm -v "$(pwd):/src" semgrep/semgrep \
  semgrep scan --config p/typescript --metrics=off \
  backend/src/nest/chat/chat.controller.ts
```

---

## Ergebnisse lesen

### In GitHub Actions

1. PR öffnen → Semgrep Job läuft
2. Actions Tab → "Semgrep Security Scan" → Log ansehen
3. Artifacts → `semgrep-results` runterladen (SARIF + JSON)

### Lokal (Terminal Output)

```
backend/src/nest/chat/chat.service.ts
  severity:warning rule:typescript.pg.pg-sqli
    SQL injection risk: user input in query
    Details: https://semgrep.dev/r/typescript.pg.pg-sqli

  42┆ const result = await this.db.query(`SELECT * FROM messages WHERE id = ${id}`);
```

### Output-Formate

| Format   | Datei                   | Verwendung                               |
| -------- | ----------------------- | ---------------------------------------- |
| SARIF    | `semgrep-results.sarif` | Standard Security Format, IDE-kompatibel |
| JSON     | `semgrep-results.json`  | Maschinenlesbar, für Scripting           |
| Terminal | stdout                  | Menschenlesbar                           |

---

## False Positives behandeln

### In-Code Ignore (sparsam verwenden!)

```typescript
// nosemgrep: typescript.pg.pg-sqli — False positive: id comes from validated Zod schema
const result = await this.db.query(`SELECT * FROM messages WHERE id = $1`, [id]);
```

### In .semgrepignore

```
# Bestimmte Datei ignorieren
backend/src/legacy/old-controller.ts
```

### Regel: Kein blindes Ignorieren

Gleiche Policy wie bei ESLint-Disables: **Nur mit Kommentar der erklärt WARUM.**

---

## Blocking Mode (Zukunft)

Aktuell ist der Scan **informational** — er blockiert keine PRs. Sobald die False-Positive-Rate bekannt ist:

```yaml
# In .github/workflows/semgrep.yml hinzufügen:
semgrep scan \
  --config p/typescript \
  --config p/nestjs \
  --config p/owasp-top-ten \
  --config p/dockerfile \
  --metrics=off \
  --error \                          # ← Diese Zeile macht den Scan blocking
  backend/ shared/ docker/
```

`--error` → Exit Code 1 bei Findings → PR wird blockiert.

---

## Architektur-Entscheidung

### Warum Semgrep und nicht...

| Alternative         | Warum nicht                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| **CodeQL** (GitHub) | Kein NestJS-Support, kostet $30/Committer/Monat für Private Repos          |
| **SonarQube**       | 94.6% False Positive Rate in Benchmarks, wir haben ESLint für Code Quality |
| **Snyk**            | SAST mittelmäßig, SCA gut aber Dependabot reicht                           |
| **GHAS**            | $49/Committer/Monat — überteuert für kleines Team                          |

### Warum diese Konfiguration

- **Kein Cloud-Login** — `semgrep scan` statt `semgrep ci`, kein Vendor Lock-in
- **`--metrics=off`** — Zero Telemetrie
- **Nur backend/ + shared/ + docker/** — Frontend hat keinen Svelte-Support
- **Informational zuerst** — Baseline verstehen bevor PRs blockiert werden

### Risiko-Bewusstsein

Semgrep hat im Dezember 2024 Community-Rules unter eine restriktive Lizenz gestellt. Für uns als End-User kein Problem (wir redistribuieren keine Rules). Falls sich das ändert: **Opengrep** (LGPL Fork) beobachten als Exit-Strategy.

---

## Troubleshooting

### Scan findet nichts

```bash
# Prüfen ob .semgrepignore zu viel ignoriert
semgrep scan --config p/typescript --metrics=off --verbose backend/
```

### Scan dauert zu lange

```bash
# Parallelität erhöhen
semgrep scan --config p/typescript --metrics=off -j 4 backend/
```

### Rule-Details nachschlagen

```bash
# Alle Rules eines Rulesets anzeigen
# → https://semgrep.dev/p/typescript
# → https://semgrep.dev/p/nestjs
# → https://semgrep.dev/p/owasp-top-ten
# → https://semgrep.dev/p/dockerfile
```

---

## Quick Reference

```bash
# Lokal: Ganzer Scan (Docker)
docker run --rm -v "$(pwd):/src" semgrep/semgrep \
  semgrep scan --config p/typescript --config p/nestjs \
  --config p/owasp-top-ten --config p/dockerfile \
  --metrics=off backend/ shared/ docker/

# Lokal: Einzelne Datei
docker run --rm -v "$(pwd):/src" semgrep/semgrep \
  semgrep scan --config p/typescript --metrics=off \
  backend/src/nest/users/users.controller.ts

# Lokal: Nur SQL Injection Rules
docker run --rm -v "$(pwd):/src" semgrep/semgrep \
  semgrep scan --config p/typescript --metrics=off \
  --include="*.ts" backend/
```
