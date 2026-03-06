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

| Ruleset            | ~Rules | Was es findet                                                       |
| ------------------ | ------ | ------------------------------------------------------------------- |
| `p/typescript`     | 74     | SQL Injection (pg, knex, sequelize), JWT Secrets, XSS, SSRF, eval   |
| `p/nestjs`         | 3      | CORS Misconfiguration, XSS Header disabled, Open Redirect           |
| `p/owasp-top-ten`  | 45     | OWASP Top 10 inkl. Nginx Rules, Crypto Failures                     |
| `p/security-audit` | ~200   | Breiter Security-Audit: child_process, crypto, TLS, deserialization |
| `p/nodejs`         | ~50    | Node.js-spezifisch: eval, child_process, fs, http patterns          |
| `p/dockerfile`     | 44     | Root User, Package Manager, Dockerfile Best Practices               |

> **Hinweis:** `p/javascript` ist **identisch** mit `p/typescript` (gleiche 74 Rules). Wird daher nicht gebraucht.

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
    --config p/security-audit \
    --config p/nodejs \
    --config p/dockerfile \
    --exclude-rule=generic.nginx.security.possible-h2c-smuggling.possible-nginx-h2c-smuggling \
    --exclude-rule=generic.nginx.security.request-host-used.request-host-used \
    --exclude-rule=generic.nginx.security.header-redefinition.header-redefinition \
    --exclude-rule=generic.html-templates.security.var-in-href.var-in-href \
    --metrics=off \
    --error \
    backend/ shared/ docker/
```

### Option 2: pip install

```bash
pip3 install semgrep
semgrep scan \
  --config p/typescript \
  --config p/nestjs \
  --config p/owasp-top-ten \
  --config p/security-audit \
  --config p/nodejs \
  --config p/dockerfile \
  --exclude-rule=generic.nginx.security.possible-h2c-smuggling.possible-nginx-h2c-smuggling \
  --exclude-rule=generic.nginx.security.request-host-used.request-host-used \
  --exclude-rule=generic.nginx.security.header-redefinition.header-redefinition \
  --exclude-rule=generic.html-templates.security.var-in-href.var-in-href \
  --metrics=off \
  --error \
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
| JSON     | `semgrep-results.json`  | Anlagenlesbar, für Scripting             |
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

### `--exclude-rule` für False Positives mit Mitigations

4 Rules sind False Positives **mit Mitigations in place** und werden per CLI ausgeschlossen:

```bash
--exclude-rule=generic.nginx.security.possible-h2c-smuggling.possible-nginx-h2c-smuggling
--exclude-rule=generic.nginx.security.request-host-used.request-host-used
--exclude-rule=generic.nginx.security.header-redefinition.header-redefinition
--exclude-rule=generic.html-templates.security.var-in-href.var-in-href
```

**Warum FP:**

| Rule                    | Warum False Positive                                      | Mitigation                                                                                       |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **H2C Smuggling**       | Nginx erlaubt nur WebSocket Upgrades                      | `map` Block: `$allowed_upgrade` auf `"websocket"` beschränkt                                     |
| **$host Usage**         | Host Header Injection unmöglich                           | `default_server` Block: unbekannte Hosts → `return 444`                                          |
| **Header Redefinition** | Location-Block wiederholt Server-Headers absichtlich      | Nginx-Verhalten: `add_header` in Location überschreibt Parent — Headers MÜSSEN wiederholt werden |
| **var-in-href**         | Template-URLs sind server-seitig generiert oder validiert | `dashboardUrl`/`loginUrl`/`unsubscribeUrl`: hardcoded. `actionUrl`: Protokoll-Whitelist im DTO   |

> **Wichtig:** `nosemgrep` Inline-Kommentare funktionieren **NICHT** für `generic` Language Rules (Nginx, YAML, HTML). Deshalb `--exclude-rule` statt Inline-Ignore.

### Regel: Kein blindes Ignorieren

Gleiche Policy wie bei ESLint-Disables: **Nur mit Kommentar der erklärt WARUM.**

---

## Blocking Mode

Der Scan ist **blocking** — `--error` ist aktiviert. Exit Code 1 bei Findings → PR wird blockiert.

Findings müssen vor dem Merge gefixt oder dokumentiert ausgeschlossen werden.

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
- **Blocking (`--error`)** — Baseline ist clean, PRs mit Findings werden blockiert
- **Kuratierte Rulesets** — `p/default` (1064 Rules) war zu noisy (Alert Fatigue). 6 gezielte Rulesets decken unseren Stack ab ohne FP-Flut

### Risiko-Bewusstsein

Semgrep hat im Dezember 2024 Community-Rules unter eine restriktive Lizenz gestellt. Für uns als End-User kein Problem (wir redistribuieren keine Rules). Falls sich das ändert: **Opengrep** (LGPL Fork) beobachten als Exit-Strategy.

---

## Canary-Tests: Semgrep-Erkennung verifizieren

Beim Setup oder nach Ruleset-Änderungen sollte man prüfen, dass lokal und CI die gleichen Findings liefern. Dafür erstellt man eine absichtlich verwundbare Test-Datei (Canary).

### Wie ein guter Canary aussieht

```typescript
// backend/src/semgrep-test-canary.ts
// ⚠️ DELIBERATE VULNERABILITY — Semgrep Canary Test
// DELETE after verification.
import jwt from 'jsonwebtoken';

// Hardcoded JWT secret — triggers: hardcoded-jwt-secret
const token = jwt.sign({ user: 'admin' }, 'my-super-secret-key-12345');
const decoded = jwt.verify(token, 'my-super-secret-key-12345');
```

### Worauf es ankommt

**1. Semgrep ist semantisch, nicht regex-basiert**

Semgrep versteht Code-Struktur. Es sucht nicht nach dem String `eval` — es sucht nach dem Pattern `jwt.sign(PAYLOAD, "HARDCODED_STRING")`. Das bedeutet:

| Pattern                        | Erkannt? | Warum                                                        |
| ------------------------------ | -------- | ------------------------------------------------------------ |
| `jwt.sign(payload, 'secret')`  | Ja       | Exakt das Pattern das die Rule sucht                         |
| `jwt.verify(token, 'secret')`  | Ja       | Gleiche Library, hardcoded Secret                            |
| `eval(userInput)`              | Nein     | Community-Rule nur im AWS Lambda Kontext                     |
| `exec(\`ls ${input}\`)`        | Nein     | `detect-child-process` matcht nur `require('child_process')` |
| SQL Template Literals mit `pg` | Nein     | `pg-sqli` nur im AWS Lambda Kontext                          |

**2. Nicht jede "offensichtliche" Vulnerability wird erkannt**

Semgrep Community-Rules haben Einschränkungen:

- Manche Rules sind kontext-spezifisch (z.B. nur AWS Lambda, nur Express)
- Wir nutzen NestJS + Fastify, nicht Express → Express-Rules greifen nicht
- `eval()` und `child_process` werden nur von bestimmten Rulesets erkannt und nur in bestimmten Kontexten
- **Verlässlich erkannt** werden: Hardcoded Secrets (JWT, Passport), CORS Misconfiguration, Crypto-Fehler, Dockerfile-Probleme

**3. Lokaler Scan MUSS identisch mit CI sein**

Die Canary-Datei mit exakt der gleichen Config wie im Workflow scannen:

```bash
# EXAKT die gleichen Flags wie in .github/workflows/semgrep.yml
docker run --rm -v "$(pwd):/src" semgrep/semgrep \
  semgrep scan \
    --config p/typescript \
    --config p/nestjs \
    --config p/owasp-top-ten \
    --config p/security-audit \
    --config p/nodejs \
    --config p/dockerfile \
    --exclude-rule=generic.nginx.security.possible-h2c-smuggling.possible-nginx-h2c-smuggling \
    --exclude-rule=generic.nginx.security.request-host-used.request-host-used \
    --exclude-rule=generic.nginx.security.header-redefinition.header-redefinition \
    --exclude-rule=generic.html-templates.security.var-in-href.var-in-href \
    --metrics=off \
    --error \
    backend/src/semgrep-test-canary.ts
```

Erwartetes Ergebnis: **2 Findings** (`hardcoded-jwt-secret` auf Zeile 8 und 11), **Exit Code 1**.

**4. Canary-Workflow**

1. Test-Datei erstellen mit bekanntem Pattern (JWT hardcoded secret ist am zuverlässigsten)
2. Lokal scannen → Findings notieren (Rule-ID, Zeile, Anzahl)
3. Committen + Pushen → GitHub Workflow abwarten
4. CI-Ergebnis mit lokalem Ergebnis vergleichen — muss identisch sein
5. **Canary-Datei sofort wieder löschen** — niemals auf `main` mergen

**5. Wenn der Canary keine Findings liefert**

- Prüfen ob `.semgrepignore` die Datei ausschließt (z.B. `*.test.ts` Pattern)
- Prüfen ob das Pattern zur Rule passt → Rule-Details auf `https://semgrep.dev/r/RULE_ID` nachschlagen
- `--verbose` Flag hinzufügen um zu sehen welche Rules tatsächlich laufen
- Von 678 geladenen Rules laufen nur ~94 auf `.ts` Dateien — der Rest ist für andere Sprachen

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
# → https://semgrep.dev/p/security-audit
# → https://semgrep.dev/p/nodejs
# → https://semgrep.dev/p/dockerfile
```

---

## Quick Reference

```bash
# Lokal: Ganzer Scan (Docker) — identisch mit CI
docker run --rm -v "$(pwd):/src" semgrep/semgrep \
  semgrep scan \
    --config p/typescript --config p/nestjs \
    --config p/owasp-top-ten --config p/security-audit \
    --config p/nodejs --config p/dockerfile \
    --exclude-rule=generic.nginx.security.possible-h2c-smuggling.possible-nginx-h2c-smuggling \
    --exclude-rule=generic.nginx.security.request-host-used.request-host-used \
    --exclude-rule=generic.nginx.security.header-redefinition.header-redefinition \
    --exclude-rule=generic.html-templates.security.var-in-href.var-in-href \
    --metrics=off --error \
    backend/ shared/ docker/

# Lokal: Einzelne Datei
docker run --rm -v "$(pwd):/src" semgrep/semgrep \
  semgrep scan --config p/typescript --metrics=off \
  backend/src/nest/users/users.controller.ts

# Lokal: Nur SQL Injection Rules
docker run --rm -v "$(pwd):/src" semgrep/semgrep \
  semgrep scan --config p/typescript --metrics=off \
  --include="*.ts" backend/
```
