# ADR-013: CI/CD Pipeline Hardening

| Metadata                | Value                                                     |
| ----------------------- | --------------------------------------------------------- |
| **Status**              | Amended                                                   |
| **Date**                | 2026-01-26 (amended 2026-02-05)                           |
| **Decision Makers**     | SCS Technik                                               |
| **Affected Components** | GitHub Actions, code-quality-checks.yml, docker-build.yml |

---

## Context

Ein Audit der CI/CD-Pipeline ergab fünf Schwachstellen:

### 1. Frontend wird nie in CI geprüft

`code-quality-checks.yml` führte nur Backend-Checks aus (`cd backend && pnpm run typecheck/lint/prettier`). Die Root-ESLint-Config ignoriert `frontend/**` explizit. Weder Svelte Check, noch Frontend ESLint, noch Stylelint liefen in CI. Ein komplett kaputter Frontend-Build konnte den PR passieren.

Lokal existierte `pnpm run validate:all` mit vollständiger Abdeckung -- aber das nutzt nichts als Gatekeeper.

### 2. Trivy Security Scanner war dekorativ

Der Trivy-Scan hatte `continue-on-error: true` auf allen Steps. Gefundene Schwachstellen (CRITICAL, HIGH, MEDIUM) wurden zwar gescannt, blockierten aber keinen PR. Der Scanner war effektiv ein No-Op.

### 3. GitHub Actions Cache deaktiviert

Docker Build Cache (`cache-from: type=gha`) war seit 2026-01-13 auskommentiert wegen temporärer GitHub-502/504-Errors. Nach 13 Tagen war der Workaround zum Dauerzustand geworden.

### 4. Bruno API-Tests nur lokal

96 Bruno API-Requests mit 169 Tests existieren nur lokal. Kein Workflow führt sie aus. **Bewusst nicht adressiert** -- Entscheidung ob Bruno, OpenAPI, Swagger oder Postman steht noch aus.

### 5. Veraltete Dokumentation "56 TypeScript Test-Errors"

`CLAUDE.md` und `BEFORE-STARTING-DEV.md` dokumentierten 56 bekannte TypeScript-Fehler in Test-Dateien. Tatsächlich existieren keine Test-Dateien (`*.test.ts`, `*.spec.ts`) im Backend. Die Dokumentation war veraltet.

---

## Decision

### Fix 1: Frontend-Quality-Job in CI

Neuer paralleler Job `frontend-quality` in `code-quality-checks.yml`:

| Check        | Command                                | Was wird geprüft    |
| ------------ | -------------------------------------- | ------------------- |
| Svelte Check | `cd frontend && pnpm run check`        | TypeScript + Svelte |
| ESLint       | `cd frontend && pnpm run lint`         | Code-Qualität       |
| Prettier     | `cd frontend && pnpm run format:check` | Formatierung        |
| Stylelint    | `pnpm run stylelint`                   | CSS/SCSS            |

Der bestehende Backend-Job wurde zu `backend-quality` umbenannt. Beide Jobs laufen parallel.

### Fix 2: Trivy als echtes Gate

Trivy wurde in zwei Steps aufgeteilt:

| Step                                                   | Format | Severity     | exit-code | Blockiert PR? |
| ------------------------------------------------------ | ------ | ------------ | --------- | ------------- |
| Check for critical vulnerabilities (blocks PR)         | table  | CRITICAL     | 1         | **Ja**        |
| Report HIGH and MEDIUM vulnerabilities (informational) | table  | HIGH, MEDIUM | 0         | Nein          |

- CRITICAL blockiert den PR
- HIGH/MEDIUM sind informativ in den CI-Logs sichtbar, blockieren aber nicht (Docker-Base-Images haben fast immer HIGH-Findings die nicht actionable sind)
- Beide Steps nutzen `scanners: "vuln"` -- Secret-Scanning ist deaktiviert (ESLint `no-secrets` Plugin deckt das bereits ab)
- GHCR-Login ist erforderlich, da der Trivy-Job auf einem eigenen Runner läuft und das private Image pullen muss

**Amendment 2026-02-05:** SARIF-Upload und GitHub Security Tab Integration entfernt. GitHub Code Security / Advanced Security ist für das Repository nicht aktiviert (kostenpflichtiges Feature für private Repos). Table-Format in CI-Logs ist ausreichend für die Sichtbarkeit von HIGH/MEDIUM-Findings. Außerdem `sleep 30` Workaround entfernt -- `needs: build-and-push-image` garantiert bereits die Image-Verfügbarkeit.

### Fix 5: CodeQL-Workflow entfernt (Amendment 2026-02-05)

`codeql-analysis.yml` und `codeql-config.yml` wurden gelöscht:

- CodeQL SARIF-Upload erfordert GitHub Code Security / Advanced Security -- nicht aktiviert für dieses Repository
- ESLint Security-Plugins (`eslint-plugin-security`, `eslint-plugin-no-secrets`, `eslint-plugin-no-unsanitized`) decken die relevanten Findings bereits ab
- CodeQL-Scan lief erfolgreich (731/731 TS-Dateien), aber das Ergebnis konnte nicht hochgeladen werden → CI schlug fehl

### Fix 3: Cache re-aktiviert

`cache-from: type=gha` und `cache-to: type=gha,mode=max` wieder einkommentiert. GitHub-Cache-Probleme von 2026-01-13 sind längst behoben.

### Fix 4: Veraltete Dokumentation bereinigt

Drei Stellen entfernt:

- `CLAUDE.md:245` -- "TypeScript Test Errors (56 errors)" Zeile gelöscht
- `BEFORE-STARTING-DEV.md:26` -- "außer den 56 Test-Errors" entfernt
- `BEFORE-STARTING-DEV.md:48` -- "außer den 56 bekannten Test-Errors" entfernt

---

## Alternatives Considered

### Frontend-Checks: Ein Job vs. zwei Jobs

| Option                            | Pro                              | Contra                   |
| --------------------------------- | -------------------------------- | ------------------------ |
| **Ein Job (Backend + Frontend)**  | Weniger `pnpm install` Runs      | Sequentiell, langsamer   |
| **Zwei parallele Jobs (gewählt)** | Schneller, klare Fehlerzuordnung | Doppeltes `pnpm install` |

Gewählt: Zwei Jobs. pnpm-Cache via `actions/setup-node` macht das Install schnell. Parallele Ausführung reduziert die Gesamt-CI-Zeit.

### Trivy: CRITICAL-only vs. CRITICAL+HIGH als Gate

| Option                      | Pro                   | Contra                                        |
| --------------------------- | --------------------- | --------------------------------------------- |
| **CRITICAL only (gewählt)** | Wenig False Positives | HIGH-Vulns blockieren nicht                   |
| CRITICAL + HIGH             | Strengere Sicherheit  | Base-Image-Findings blockieren oft fälschlich |

Gewählt: CRITICAL only als Gate. HIGH ist informativ in den CI-Logs sichtbar, blockiert aber nicht. Kann bei Bedarf auf CRITICAL+HIGH verschärft werden.

### Trivy: SARIF-Upload vs. Table-Output (Amendment 2026-02-05)

| Option                         | Pro                               | Contra                                    |
| ------------------------------ | --------------------------------- | ----------------------------------------- |
| SARIF + Security Tab           | GitHub-native Darstellung         | Erfordert Code Security (kostenpflichtig) |
| **Table in CI-Logs (gewählt)** | Keine Zusatzkosten, direkt lesbar | Kein zentrales Dashboard, nur in Run-Logs |

Gewählt: Table-Format. Code Security ist nicht aktiviert und für den aktuellen Bedarf nicht gerechtfertigt. Bei Aktivierung von Code Security kann SARIF wieder hinzugefügt werden.

### API-Tests in CI: Bruno vs. Alternativen

Bewusst nicht umgesetzt. Die Entscheidung ob Bruno, OpenAPI/Swagger, oder Postman als API-Test-Tool langfristig genutzt wird, steht noch aus. Sobald entschieden, sollte das gewählte Tool in CI integriert werden.

---

## Consequences

### Positive

- Frontend-Fehler blockieren jetzt PRs -- kein kaputter Build mehr auf main
- CRITICAL-Schwachstellen in Docker-Images werden tatsächlich blockiert
- Docker-Builds sind wieder schneller durch Cache
- Dokumentation spiegelt den tatsächlichen Zustand wider
- CI-Pipeline entspricht dem lokalen `pnpm run validate:all`

### Negative

- Zwei parallele Jobs bedeuten doppeltes `pnpm install` (durch Cache mitigiert)
- CRITICAL-only Gate könnte zu permissiv sein (bewusste Trade-off-Entscheidung)
- CI-Laufzeit steigt leicht durch zweiten Trivy-Scan (~30s)
- Kein GitHub Security Tab für Trivy-Findings (Code Security nicht aktiviert) -- Findings nur in CI-Logs sichtbar
- Kein CodeQL -- ESLint-Plugins sind weniger umfassend, aber für unseren Stack ausreichend

---

## References

- [GitHub Actions Cache Documentation](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [Trivy Action](https://github.com/aquasecurity/trivy-action)
- [adr.github.io](https://adr.github.io/)
- Audit-Ergebnis vom 2026-01-26
