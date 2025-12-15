# Claude Code – Assixx Project Complete Guide

## 🔴🔴🔴 STOPP! PFLICHTLEKTÜRE VOR ALLEM ANDEREN! 🔴🔴🔴

## → LIES ZUERST: [CLAUDE-KAIZEN-MANIFEST.md](./CLAUDE-KAIZEN-MANIFEST.md)

## → OHNE MANIFEST GELESEN = KEINE ARBEIT

## → Das Manifest dokumentiert ALLE meine Fehler und wie ich sie vermeide

Multi-Tenant-Isolation--> tenant_id = Eine Firma-> vergesse das nicht ! Es darf nicht gemischt werden. !!!! Stetige abfrage!!!! Kritisch

Problem → Daten sammeln → Hypothesen → Testen → Validieren

## QUICK REFERENCE

- Projekt: Multi-Tenant SaaS für Industriefirmen
- GitHub: <https://github.com/SCS-Technik/Assixx>
- Aktueller Branch: debugging/v0.1.0--R2Stable
- Tech Stack: TypeScript, Express, MySQL, Docker, Redis, Vite
- Dev URL: <http://localhost:3000>
- Docker Dir: /home/scs/projects/Assixx/docker
- Package Manager: pnpm
- Datenbank: MySQL (Port 3307), Redis (Port 6379)
- Projektstruktur: docs/PROJEKTSTRUKTUR.md

## KRITISCHE REGELN

- **NIEMALS committen oder pushen ohne Erlaubnis vom User** immer um Freigabe bitten
- **NIEMALS checkout ohne Erlaubnis vom User** immer um Freigabe bitten
- **NIEMALS Fast-Forward merge durchführen**
- **NIEMALS disable eslint kommentare benutzen, immer den besten Weg gehen um den bestmöglichen und sicheren strengen Code zu schreiben**
- **IMMER existierende Dateien bearbeiten statt neue erstellen**
- **IMMER Docker aus /home/scs/projects/Assixx/docker starten**
- **IMMER langfristig denken - keine Quick-Fixes die später Probleme machen**
- **BEI UNSICHERHEIT nachfragen - besonders bei kritischen Änderungen**
- **BEHUTSAM vorgehen - lieber zweimal prüfen als einmal bereuen**
- **VERMEIDE error "Unexpected any. Specify a different type" @typescript-eslint/no-explicit-any**
- **TUE genau was ich sage und frag immer erst wenn du mehr machen sollst als verlangt**
- **Use sub-agents liberally to parallelize work and save on context — but think carefully about when it's most effective. Think step-by-step**
- **Always use best-practice methods**
- **Always make todowrite list**

## 🎨 UX/UI DESIGN STANDARDS (NEU - 16.08.2025)

### KEINE MODALS MEHR FÜR DATENEINGABE

**Ab sofort gilt:** Alle Formulare für Dateneingabe werden als **Inline-Formulare** implementiert, KEINE Modals mehr!

#### Warum diese Änderung?

- **Mobile-First:** Modals funktionieren schlecht auf Smartphones
- **Better UX:** User bleibt im Kontext, kein Workflow-Unterbruch
- **Accessibility:** Screen-Reader und Keyboard-Navigation freundlicher
- **Modern Standards:** Inline-Forms sind 2025 Best Practice
- **Performance:** Weniger JavaScript, keine Z-Index Probleme

#### Neue UI-Patterns für Formulare

1. **Split-View Pattern (Bevorzugt für Desktop)**
   - Links: Liste/Tabelle der Einträge
   - Rechts: Permanentes Formular für Add/Edit
   - Beispiel: Mitarbeiter-Verwaltung, Areas, Departments

2. **Inline-Expansion Pattern**
   - "Add New" Button öffnet Formular direkt über/unter der Liste
   - Edit-Form klappt direkt in der Zeile auf
   - Beispiel: KVP-Vorschläge, Blackboard-Einträge

3. **Slide-in Panel Pattern**
   - Von rechts einfahrendes Panel (nicht modal!)
   - Overlay nur partial, Liste bleibt sichtbar
   - Beispiel: Chat, Notifications

4. **Top-Form Pattern**
   - Formular permanent über der Tabelle
   - Collapsible für mehr Platz
   - Beispiel: Quick-Add für häufige Aktionen

#### Was ist noch erlaubt für Modals?

Modals NUR noch für:

- ❌ Lösch-Bestätigungen ("Wirklich löschen?")
- ⚠️ Kritische Warnungen (Datenverlust-Warnung)
- ℹ️ Info-Dialoge (Hilfe, About)
- 🔒 Session-Timeouts
- NIEMALS für Dateneingabe!

#### Migration bestehender Modals

Alle existierenden Modals für Dateneingabe müssen schrittweise umgebaut werden:

- Priority 1: Häufig genutzte Features (Mitarbeiter, Shifts, Calendar)
- Priority 2: Admin-Features (Areas, Departments, Teams)
- Priority 3: Seltene Features (Settings, Profile)

## **Use MCP Tools Before Everything:**

– Before modifying files (understand history)
– When tests fail (check recent changes)
– Finding related code (git grep)
– Understanding features (follow evolution)
– Checking workflows (CI/CD issues)

## The Twelve Universal Commandments

1. **Thou shalt ALWAYS use MCP tools before coding**
2. **Thou shalt NEVER assume; always question**
3. **Thou shalt write code that's clear and obvious**
4. **Thou shalt be BRUTALLY HONEST in assessments**
5. **Thou shalt PRESERVE CONTEXT, not delete it**
6. **Thou shalt make atomic, descriptive commits**
7. **Thou shalt document the WHY, not just the WHAT**
8. **Thou shalt test before declaring done**
9. **Thou shalt handle errors explicitly**
10. **Thou shalt treat user data as sacred**
11. **Thou shalt consider performance implications early**
12. **Thou shalt embrace code reviews and pair programming**

## START-TRIGGER

### Trigger 1: "continue with Assixx" (Normal-Modus)

- **Aktion:** Vollständige Pflicht-Checkliste durchführen MIT dev-status.sh
- **Prozess:** Alle Starttasks, TodoWrite mit 10+ Punkten, komplette Checks inklusive dev-status.sh
- **Ziel:** Sicherstellen, dass alles korrekt läuft

### Trigger 2: "continue with Assixx without dev-status.sh" (Skip-Modus)

- **Aktion:** Vollständige Pflicht-Checkliste durchführen OHNE dev-status.sh
- **Prozess:** Alle Starttasks, TodoWrite mit 10+ Punkten, komplette Checks aber dev-status.sh wird übersprungen
- **Ziel:** Schnellerer Start ohne System-Status-Check
- **UNTERSCHIED:** Einziger Unterschied zu Trigger 1 ist das Überspringen von dev-status.sh

## DOCKER QUICK-CHECK

**Bei "continue with Assixx" (Normal-Modus) IMMER ausführen:**
**Bei "continue with Assixx without dev-status.sh" (Skip-Modus) ÜBERSPRINGEN!**

```bash
# Working Directory ist WICHTIG!
cd /home/scs/projects/Assixx/docker

# Alles in einem Befehl:
docker-compose ps && curl -s http://localhost:3000/health | jq '.'

# ODER nutze das neue Status-Script (empfohlen):
# ACHTUNG: Bei "without dev-status.sh" wird dev-status.sh NICHT ausgeführt!
/home/scs/projects/Assixx/scripts/dev-status.sh
```

## HÄUFIGE TASKS

### Frontend-Änderung

1. docker exec assixx-backend pnpm run build
2. Browser Cache leeren (Ctrl+Shift+R)
3. Testen auf <http://localhost:3000>

### Backend API-Änderung

1. docker exec assixx-backend pnpm run type-check
2. docker-compose restart backend
3. Logs prüfen: docker logs -f assixx-backend

### Datenbank-Migration

1. Backup: bash scripts/quick-backup.sh "before_migration"
2. Migration kopieren: docker cp migration.sql assixx-mysql:/tmp/
3. docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pYOUR_PASSWORD main < /tmp/'$(basename $MIGRATION_FILE) ?? siehe database-migration-guide.md

### TypeScript Fehler beheben

1. docker exec assixx-backend pnpm run lint:fix
2. docker exec assixx-backend pnpm run format
3. docker exec assixx-backend pnpm run type-check

**Workflow-Struktur:**

1. Discover Tests (findet alle Test-Dateien)
2. Matrix Tests (jeder Test als eigener Job)
3. Coverage Aggregation
4. Code Analysis (TypeScript, ESLint)
5. Docker Build Tests
6. Code Quality Checks

**WICHTIG - Test-Datenbank Schema:**

- Tests nutzen ECHTE MySQL-Datenbank (keine Mocks)
- Schema aus `database/current-schema-*.sql` (neueste Datei)
- Bei DB-Änderungen: `./scripts/export-current-schema.sh` ausführen
- Schema-Vergleich: `./scripts/compare-db-schema.sh`
- Migrations in `/database/migrations/` können VERALTET sein!
- Test-DB hat immer das aktuelle Produktions-Schema

## WENN-DANN ANWEISUNGEN

**WENN User fragt nach Feature-Status**

- TODO.md prüfen, dann FEATURES.md

**WENN TypeScript Error bei Route Handler**

- typed.auth oder typed.body wrapper verwenden
- Siehe docs/TYPESCRIPT-STANDARDS.md

**WENN User will committen/pushen**

- IMMER nachfragen: "Soll ich die Änderungen committen?"
- NIE automatisch committen

**WENN Neue Datei erstellen**

- STOPP! Erst prüfen ob existierende Datei bearbeitet werden kann

**WENN Database Error**

- Foreign Key Constraints prüfen
- Siehe DATABASE-MIGRATION-GUIDE.md

**WENN Docker Container nicht startet**

- docker-compose down && docker-compose up -d
- Logs prüfen: docker-compose logs

## BEKANNTE ISSUES

- TypeScript Test-Fehler (56 errors) - ignorieren, betrifft nur Tests
- SMTP Warnings beim Start - optional, ignorieren
- Port 3000 belegt - lsof -i :3000 && kill -9 PID

## PFLICHT-CHECKLISTE (TodoWrite mit 10+ Punkten)

1. Docker-Check (bei "without dev-status.sh": OHNE dev-status.sh)
2. TODO.md (AKTUELLE PHASE + FORTSCHRITTS-TRACKING!)
3. CLAUDE.md
4. TypeScript-Standards
5. Design Standards
6. TypeScript Standards
7. README.md
8. Database Migration Guide
9. BEFORE-STARTING-DEV befolgen (Anleitung lesen und Befehle durchführen)!!!!
10. DAILY-PROGRESS.md lesen
11. Lies API-V2-MIGRATION-MASTERPLAN.md
12. Lies API-V2-MASTERPLAN-CHECKLIST.md
13. Lies API-V2-MIGRATION-EXECUTIVE-SUMMARY.md
14. Lies API-V2-FRONTEND-MIGRATION-DETAILS.md
15. Lies workshop-decisions.md
16. Lies API-DESIGN-WORKSHOP-PLAN.md
17. Entwicklung beginnen

## 📊 FORTSCHRITTS-DOKUMENTATION (NEU! WICHTIG!)

**TÄGLICH AKTUALISIEREN:**

- `/docs/DAILY-PROGRESS.md` - Täglicher Fortschritt mit Metriken
- `/docs/api/API-V2-PROGRESS-LOG.md` - API v2 spezifische Details
- `TODO.md` - Fortschritts-Tracking Section ganz oben!

**Bei jedem Arbeitstag:**

1. DAILY-PROGRESS.md mit Tagesübersicht updaten
2. Bei API-Arbeit: API-V2-PROGRESS-LOG.md erweitern
3. TODO.md Fortschritts-Section aktualisieren
4. Erfolge und Probleme dokumentieren
5. Metriken erfassen (Zeit, TODOs, Commits)

**Warum wichtig:**

- Zeigt kontinuierlichen Fortschritt
- Hilft bei Retrospektiven
- Dokumentiert Lösungen für wiederkehrende Probleme
- Motiviert durch sichtbare Erfolge

## ZENTRALE DOKUMENTATION

**KERN-DOKUMENTE (Täglich relevant):**

- docs/PROJEKTSTRUKTUR.md - Vollständige Verzeichnisstruktur
- docs/TYPESCRIPT-STANDARDS.md - TypeScript Patterns (PFLICHT bei Backend)
- docs/DATABASE-MIGRATION-GUIDE.md - DB Änderungen (PFLICHT bei Migrationen)
- docs/DESIGN-STANDARDS.md - Glassmorphismus UI/UX

**ARBEITS-DOKUMENTE:**

- TODO.md - Aktuelle Aufgaben und Status
- docs/BEFORE-STARTING-DEV.md - Tägliche Dev Checks
- docs/FEATURES.md - Feature-Liste mit Preisen
- docs/DATABASE-SETUP-README.md - DB Schema Referenz

**REFERENZ (Bei Bedarf):**

- docs/ARCHITECTURE.md - System-Übersicht
- docs/ROADMAP.md - Zukünftige Features
- CLAUDE.local.md - Lokale Notizen

## CODE-STANDARDS

- Kommentiere WARUM, nicht WAS
- Jede Funktion braucht JSDoc
- Komplexe Logik erklären
- TypeScript statt any verwenden
- Siehe TYPESCRIPT-STANDARDS.md für Details

## WORKFLOW

### Bei "continue with Assixx" (Normal-Modus)

1. TodoWrite mit 10+ Punkten erstellen (siehe PFLICHT-CHECKLISTE)
2. Alle Checks durchführen INKLUSIVE dev-status.sh
3. Zusammenfassung erstellen

### Bei "continue with Assixx without dev-status.sh" (Skip-Modus)

1. TodoWrite mit 10+ Punkten erstellen (siehe PFLICHT-CHECKLISTE)
2. Alle Checks durchführen OHNE dev-status.sh
3. Zusammenfassung erstellen

**MERKE:** Der einzige Unterschied ist das Überspringen von dev-status.sh bei "without dev-status.sh"

### Dokumentation aktualisieren bei

- DB-Änderungen: DATABASE-SETUP-README.md
- Neue Features: FEATURES.md
- UI-Änderungen: DESIGN-STANDARDS.md
- Struktur-Änderungen: PROJEKTSTRUKTUR.md

## MERGE-STRATEGIE FÜR MASTER BRANCH

**WICHTIG: Keine Fast-Forward Merges in master!**

Wenn ein Branch in master gemerged werden soll:

1. **IMMER mit --no-ff mergen:**

   ```bash
   git merge --no-ff <branch-name>
   ```

2. **VOR dem Merge alle Änderungen prüfen:**

   ```bash
   # Alle geänderten Dateien anzeigen
   git diff master..<branch-name> --name-status

   # Wichtige Dateien einzeln prüfen
   git diff master..<branch-name> -- CLAUDE.md
   git diff master..<branch-name> -- TODO.md
   git diff master..<branch-name> -- README.md
   ```

3. **Bei Unsicherheiten nachfragen:**
   - "Soll ich einen Merge-Commit erstellen?"
   - "Hast du die Änderungen in [Dateiname] gesehen?"

**Warum kein Fast-Forward:**

- Merge-Historie bleibt sichtbar
- Einfacheres Rollback bei Problemen
- Verhindert versehentliche Änderungen

## QUICK COMMANDS

### Docker

```bash
cd /home/scs/projects/Assixx/docker
docker-compose ps
docker-compose up -d
docker-compose down
docker-compose restart backend
docker logs -f assixx-backend
```

### TypeScript

```bash
docker exec assixx-backend pnpm run type-check
docker exec assixx-backend pnpm run lint:fix
docker exec assixx-backend pnpm run format
docker exec assixx-backend pnpm run build
```

### Git

```bash
git status
git log --oneline -5
git diff --stat
git merge --no-ff branch-name
```

## GOLDENE REGELN

**DO WHAT'S ASKED** - Nicht mehr, nicht weniger
**EDIT > CREATE** - Vorhandene Dateien bearbeiten statt neue erstellen
**ASK BEFORE COMMIT** - Niemals automatisch committen/pushen
**THINK LONG-TERM** - Keine Hacks die später Probleme machen
**BE CAREFUL** - Behutsam vorgehen, besonders bei kritischen Änderungen

**NIEMALS:**

- Unnötige Dateien erstellen
- Proaktiv Dokumentation schreiben
- Mehr tun als angefragt
- Committen ohne Erlaubnis
- Fast-Forward merge (immer --no-ff)
- Redundanten Code/Dateien erstellen

**IMMER:**

- Existierende Dateien nutzen
- Bei DB-Änderungen DATABASE-SETUP-README.md und DATABASE-MIGRATION-GUIDE.md updaten
- Temporäre Dateien aufräumen
- TypeScript types verwenden (kein any)
- Im Zweifel nachfragen
- Langfristige Wartbarkeit bedenken

## Truth Hierarchy

1. **Codebase** (ultimate source of truth)
2. **Documentation** (current state)
3. **Training data** (historical reference)

## Core Philosophy

**Write code as if the person maintaining it is a violent psychopath who knows where you live. Make it that clear.**

**Remember:** Future you, debugging at 3 AM, will thank present you for that extra comment explaining the non-obvious business logic.

weitere Notes:

## 🎯 START-TRIGGER QUICK REFERENCE (23.08.2025)

- **"continue with Assixx"** → Normal-Modus mit allen Checks INKLUSIVE dev-status.sh
- **"continue with Assixx without dev-status.sh"** → Skip-Modus mit allen Checks OHNE dev-status.sh
- **EINZIGER UNTERSCHIED:** Bei "without dev-status.sh" wird dev-status.sh übersprungen!

## Aktuelle Notizen (26.06.2025)

- **WICHTIG:** TypeScript-Standards.md PFLICHTLEKTÜRE für Backend-Entwicklung
- **NEU:** docs/TYPESCRIPT-STANDARDS.md muss IMMER beachtet werden
- TypeScript Migration abgeschlossen: 426 → 0 Errors
- Shift Planning Design wurde in FEATURES.md integriert
- Reminder für Sub-Features wurde in TODO.md aufgenommen
- **NEU:** Version 0.1.0 Strategie - Stabilität vor Features
- **NEU:** Docker ist jetzt Standard-Entwicklungsumgebung
- **NEU:** Automatisches Backup-System läuft täglich um 02:00 Uhr
- **NEU:** Multi-Tenant Isolation Bug wurde behoben
- Nach compact oder auto-compact immer deutsch sprechen
- donnt commit oder push without permission from user

## TypeScript Architecture (26.06.2025)

**PFLICHT bei Backend-Entwicklung:**

```bash
cat /home/scs/projects/Assixx/docs/TYPESCRIPT-STANDARDS.md
``
Diese Dokumentation enthält:

- Typed Route Handlers Pattern
- Security Middleware Stacks
- Request/Response Types
- Migration Guidelines
- Common Patterns und Troubleshooting

## MySQL Password
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pYOUR_PASSWORD main -e "SHOW TABLES;"'
```

siehe DATABASE-MIGRATION-GUIDE.md

### wichtige dokumente und prüfen ob schon vorher eine doc gibt

in Assixx/docs

Für aktuelle Aufgaben siehe [TODO.md](./TODO.md)
