# 📖 Assixx Project Instructions for Claude AI

## 🎯 START-TRIGGER (WICHTIGSTE SEKTION!)

FYI: für Datenbankzugang lies immer DATABASE-MIGRATION-GUIDE.md in /docs
wir benutzen docker und pnpm
Wichtig! niemals comitten oder pushen ohne Erlaubnis oder Nachfrage vom user
NIEMALS Fast-Forwar merge durchführen!!!!!!!

### Trigger 1: "weitermachen mit Assixx" (Normal-Modus)

- **Aktion:** Vollständige Pflicht-Checkliste durchführen
- **Prozess:** Alle Starttasks, TodoWrite mit 9 Punkten, komplette Checks
- **Ziel:** Sicherstellen, dass alles korrekt läuft

### Trigger 2: "weitermachen mit Assixx und skip" (Quick-Start-Modus)

- **Aktion:** Minimale Vorbereitung für sofortige Arbeit
- **Prozess:**
  1. TODO.md lesen (nur TL;DR Section)
  2. README.md lesen (kurz)
  3. CLAUDE.md + CLAUDE.local.md (bereits automatisch geladen)
  4. Letzten Commit lesen und zusammenfassen
  5. Direkt startbereit und auf Anweisungen warten
- **Ziel:** Schneller Start für erfahrene Entwicklung

## ⛔ KRITISCH: PFLICHT-REIHENFOLGE BEACHTEN!

> **WARNUNG:** Die folgenden 5 Schritte MÜSSEN in EXAKTER Reihenfolge ausgeführt werden!
> **Bei Missachtung:** Entwicklungsumgebung kann instabil sein, TypeScript-Fehler, API-Probleme!

## 🚀 START HIER - PFLICHTLEKTÜRE VOR ARBEITSBEGINN

## 🐳 DOCKER QUICK-CHECK (30 Sekunden)

**IMMER ZUERST ausführen:**

```bash
# Working Directory ist WICHTIG!
cd /home/scs/projects/Assixx/docker

# Alles in einem Befehl:
docker-compose ps && curl -s http://localhost:3000/health | jq '.' && echo "✅ Ready to develop!"

# ODER nutze das neue Status-Script (empfohlen):
/home/scs/projects/Assixx/scripts/dev-status.sh
```

## ⚠️ BEKANNTE STOLPERFALLEN

**Diese Fehler treten häufig auf - hier die Lösungen:**

1. **docker-compose nicht gefunden**
   → IMMER aus `/home/scs/projects/Assixx/docker` ausführen!

2. **TypeScript Test-Fehler (56 errors)**
   → Normal für v0.1.0, können ignoriert werden
   → Tests werden später aktualisiert

3. **SMTP Warnings beim Docker Start**
   → Können ignoriert werden (Email-Config optional)

4. **Port 3000 bereits belegt**
   → `lsof -i :3000` und dann `kill -9 <PID>`
   → Oder: `docker-compose down` vorher ausführen

## ⛔ STOP! PFLICHT-CHECKLISTE VOR ENTWICKLUNG

**DIESE SCHRITTE MÜSSEN IN EXAKTER REIHENFOLGE AUSGEFÜHRT WERDEN:**

- [ ] ✅ Docker Quick-Check ausgeführt
- [ ] ✅ TODO.md gelesen (nur "AKTUELLE PHASE" Section)
- [ ] ✅ CLAUDE.md gelesen
- [ ] ✅ **backend/TYPESCRIPT-ARCHITECTURE-GUIDE.md gelesen (PFLICHT bei Backend-Arbeit!)**
- [ ] ✅ docs/DESIGN-STANDARDS.md gelesen
- [ ] ✅ docs/TYPESCRIPT-STANDARDS.md gelesen
- [ ] ✅ README.md gelesen
- [ ] ✅ docs/DATABASE-MIGRATION-GUIDE.md gelesen
- [ ] ⚠️ **docs/BEFORE-STARTING-DEV.md AUSGEFÜHRT** (NICHT NUR GELESEN!)
- [ ] ✅ Erst DANN: Mit Entwicklung beginnen

**🚫 KEINE ENTWICKLUNG OHNE ABGESCHLOSSENE CHECKLISTE!**

### 1️⃣ TODO-LISTE (ERSTE PRIORITÄT!)

```bash
# IMMER als erste Aktion ausführen:
cat /home/scs/projects/Assixx/TODO.md
```

**Warum?**

- ✅ Zeigt alle aktuellen und erledigten Aufgaben
- 📊 Zeigt Prioritäten und aktuelle Arbeitsstände
- 🚫 Verhindert doppelte Arbeit
- 🗺️ Gibt Überblick über das gesamte Projekt

### 3️⃣ DESIGN-STANDARDS (DRITTE PRIORITÄT!)

```bash
# Design-Standards für konsistentes UI/UX:
cat /home/scs/projects/Assixx/docs/DESIGN-STANDARDS.md
```

**Enthält:**

- 🎨 Alle Glassmorphismus-Standards
- 🎨 Farbpalette und CSS-Variablen
- 📐 UI-Komponenten Dokumentation
- 🔽 Custom Dropdown Pattern

### 4️⃣ BEFORE-STARTING-DEV (VIERTE PRIORITÄT!) ⛔ PFLICHT-AUSFÜHRUNG!

```bash
# ⚠️ NICHT NUR LESEN - ALLE CHECKS MÜSSEN AUSGEFÜHRT WERDEN!
cat /home/scs/projects/Assixx/docs/BEFORE-STARTING-DEV.md
# DANN: Alle Befehle aus der Datei ausführen!
```

**⛔ STOP! Ohne diese Checks:**

- TypeScript Builds können fehlschlagen
- APIs könnten nicht erreichbar sein
- Sicherheitslücken bleiben unentdeckt
- Entwicklung auf fehlerhafter Basis!

**Warum?**

- ✅ TypeScript Build & Checks
- ✅ API & System Health Tests
- ✅ Dependencies & Security Updates
- ✅ Projekt-Status Review
- ⏱️ Dauert nur 5-10 Minuten
- 🚨 Verhindert Entwicklung auf fehlerhafter Basis

**WICHTIG:** Diese Checkliste MUSS bei jedem Entwicklungsstart durchgeführt werden!

### 5️⃣ WEITERE WICHTIGE DOKUMENTE

- **⚡ TypeScript Architecture (PFLICHT!)**: [TYPESCRIPT-ARCHITECTURE-GUIDE.md](./backend/TYPESCRIPT-ARCHITECTURE-GUIDE.md)
- **Entwickler-Guidelines**: [DEVELOPMENT-GUIDE.md](./docs/DEVELOPMENT-GUIDE.md)
- **Architektur**: [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Features**: [FEATURES.md](./docs/FEATURES.md)
- **Datenbank**: [DATABASE-SETUP-README.md](./docs/DATABASE-SETUP-README.md)
- **🆕 Migration Guide**: [DATABASE-MIGRATION-GUIDE.md](./docs/DATABASE-MIGRATION-GUIDE.md)
- **Setup Guides**:
  - 🪟 [Windows (WSL)](./docs/SETUP-WINDOWS-WSL.md)
  - 🐧 [Ubuntu/Linux](./docs/SETUP-UBUNTU-LINUX.md)
  - 🍎 [macOS](./docs/SETUP-MACOS.md)

---

## 📝 CODE-KOMMENTIERUNG STANDARDS

### ✅ WAS MUSS KOMMENTIERT WERDEN:

#### 1. JavaScript Funktionen

```javascript
// Validiert die Subdomain-Eingabe und zeigt Fehler an
// @param {string} value - Die eingegebene Subdomain
// @returns {boolean} - True wenn gültig, false wenn ungültig
function validateSubdomain(value) {
```

#### 2. CSS Strukturen

```css
/* ========================================
   HEADER SECTION - Glassmorphismus Design
   ======================================== */
.header {
    /* Transparenter Hintergrund mit Blur für Glaseffekt */
    background: rgba(255, 255, 255, 0.02);
```

#### 3. Komplexe Logik

```javascript
// Prüft zuerst ob Passwörter übereinstimmen
// Dann sammelt alle Features die ausgewählt wurden
// Fügt Ländervorwahl zur Telefonnummer hinzu
// Sendet alles als JSON an Backend
```

#### 4. HTML Strukturen

```html
<!-- Signup Form - 3 Spalten Layout für 16-Zoll Monitore -->
<!-- Erste Zeile: Firma, Subdomain, Email -->
<div class="form-grid"></div>
```

### 📋 KOMMENTIERUNGS-CHECKLISTE:

- ✓ JEDE Funktion (Was, Parameter, Return)
- ✓ Komplexe CSS-Eigenschaften (Warum dieser Wert?)
- ✓ Wichtige HTML-Strukturen
- ✓ API-Calls und Datenverarbeitung
- ✓ Berechnungen und Algorithmen

### ❌ VERMEIDEN:

- Offensichtliche Kommentare (`// Button Klick`)
- Jede einzelne CSS-Zeile kommentieren
- Fokus auf WAS statt WARUM

---

## 🔧 WORKFLOW-ANWEISUNGEN

### 🚀 PROJEKTSTART-PROZESS

#### Wenn Simon sagt "weiter machen mit Assixx Projekt":

0. **🤖 AUTOMATISCH:** TodoWrite mit Pflicht-Checkliste erstellen!

   ```json
   [
     {
       "id": "1",
       "content": "Docker Quick-Check ausführen",
       "status": "pending",
       "priority": "high"
     },
     {
       "id": "2",
       "content": "TODO.md lesen (nur TL;DR Section)",
       "status": "pending",
       "priority": "high"
     },
     {
       "id": "3",
       "content": "CLAUDE.md lesen",
       "status": "pending",
       "priority": "high"
     },
     {
       "id": "4",
       "content": "backend/TYPESCRIPT-ARCHITECTURE-GUIDE.md lesen (PFLICHT!)",
       "status": "pending",
       "priority": "high"
     },
     {
       "id": "5",
       "content": "docs/PROJEKTSTRUKTUR.md lesen",
       "status": "pending",
       "priority": "high"
     },
     {
       "id": "6",
       "content": "docs/DESIGN-STANDARDS.md lesen",
       "status": "pending",
       "priority": "high"
     },
     {
       "id": "7",
       "content": "README.md lesen",
       "status": "pending",
       "priority": "high"
     },
     {
       "id": "8",
       "content": "docs/DATABASE-MIGRATION-GUIDE.md lesen",
       "status": "pending",
       "priority": "high"
     },
     {
       "id": "9",
       "content": "docs/BEFORE-STARTING-DEV.md AUSFÜHREN",
       "status": "pending",
       "priority": "high"
     },
     {
       "id": "10",
       "content": "Mit Entwicklung beginnen",
       "status": "pending",
       "priority": "medium"
     }
   ]
   ```
   - TODO.md lesen
   - CLAUDE.md lesen
   - docs/PROJEKTSTRUKTUR.md lesen
   - docs/BEFORE-STARTING-DEV.md AUSFÜHREN (alle Checks!)
   - Erst nach allen Checks: Mit Entwicklung beginnen

1. **📚 PFLICHTLEKTÜRE** (IMMER in dieser Reihenfolge):

   ```bash
   # WICHTIG: Diese Reihenfolge IMMER einhalten!
   cat TODO.md           # 1. Aktuelle Aufgaben (ERSTE PRIORITÄT!)
   cat CLAUDE.md         # 2. Diese Anweisungen
   cat docs/PROJEKTSTRUKTUR.md # 3. Projekt-Struktur prüfen/aktualisieren
   cat docs/BEFORE-STARTING-DEV.md # 4. PFLICHT-AUSFÜHRUNG der Checks!
   cat README.md         # 5. Projekt-Übersicht
   cat docs/ROADMAP.md   # 6. Zukünftige Features
   cat docs/DATABASE-SETUP-README.md  # 7. DB-Struktur (optional)
   ```

2. **📊 ZUSAMMENFASSUNG ERSTELLEN**:

   ```
   ✅ Erreicht: [Was wurde fertiggestellt]
   🔴 Probleme: [Aktuelle Herausforderungen]
   🔍 Prüfen: [Was muss getestet werden]
   ```

3. **✔️ DOPPELTE BESTÄTIGUNG**:
   - Frage 1: "Sind Sie sicher, dass wir anfangen sollen?"
   - Nach Ja: Konkrete Aufgabenliste zeigen
   - Frage 2: "Welche Aufgabe möchten Sie beginnen?"

4. **🔍 CHECKUP-PROTOKOLL**:
   - **VOR Arbeitsbeginn**: "Haben Sie Backups/Tests durchgeführt?"
   - **NACH Fertigstellung**: "Haben Sie die Änderungen getestet?"

5. **📝 DOKUMENTATIONS-PFLICHT**:
   - Bei DB-Änderungen → docs/DATABASE-SETUP-README.md aktualisieren
   - **🆕 Bei DB-Migrationen → ZUERST docs/DATABASE-MIGRATION-GUIDE.md lesen!**
   - Bei neuen Features → docs/FEATURES.md ergänzen
   - Bei UI-Änderungen → docs/DESIGN-STANDARDS.md prüfen
   - Bei Struktur-Änderungen → docs/PROJEKTSTRUKTUR.md aktualisieren

### 🔀 MERGE-STRATEGIE FÜR MASTER BRANCH

**⚠️ WICHTIG: Keine Fast-Forward Merges in master!**

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
- Verhindert versehentliche Änderungen (wie bei CLAUDE.md)

### 🎯 AKTUELLE ENTWICKLUNGSSTRATEGIE (06.06.2025)

#### Version 0.1.0 - Stabilität vor Features!

- **Fokus:** Systematisches Testing & Debugging
- **Verantwortlich:** Simon testet jede Seite einzeln
- **Ziel:** Alle bestehenden Features zu 100% funktionsfähig machen
- **Zeitrahmen:** 2-3 Wochen

#### Version 1.0.0 - Beta-Features

- **Erst NACH Version 0.1.0**
- **Deal-Breaker Features:** Urlaub, Gehalt, TPM
- **Zeitrahmen:** 4-5 Wochen

#### Docker ist Standard!

- **Entwicklung:** docker-compose up
- **Keine lokale Installation mehr nötig**
- **Backup-System läuft automatisch**

### 📌 WICHTIGE UPDATES (06.06.2025)

- ✅ Docker Setup komplett (01.06.2025)
- ✅ Multi-Tenant Isolation behoben (01.06.2025)
- ✅ Automatisches Backup-System aktiv (01.06.2025)
- ✅ debugging/v0.1.0 Branch mit vielen Fixes (02-04.06.2025)
- ✅ Schwarzes Brett teilweise getestet (04.06.2025)
- ✅ DATABASE-MIGRATION-GUIDE.md erstellt (02.06.2025)
- 🔥 AKTUELL: Systematisches Testing für v0.1.0 (1/12 Bereiche)

### 📊 PROJEKT-ÜBERSICHT

| Kategorie      | Information                               |
| -------------- | ----------------------------------------- |
| **Projekt**    | Multi-Tenant SaaS für Industriefirmen     |
| **Tech Stack** | [ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| **Features**   | [FEATURES.md](./docs/FEATURES.md)         |
| **GitHub**     | https://github.com/SCS-Technik/Assixx     |
| **Lokale Dev** | http://localhost:3000                     |

### 📌 AKTUELLE SCHWERPUNKTE

1. ✅ TypeScript Backend Migration (30.05.2025 - ABGESCHLOSSEN)
2. ✅ Survey Tool komplett fertiggestellt (29.01.2025)
3. ✅ Security & Stabilität Phase (ERLEDIGT)
   - Cookie vulnerability gepatcht
   - CSRF-Protection modernisiert
   - Rate Limiting implementiert
   - Input Validation verstärkt
4. ✅ Docker Setup (01.06.2025 - ERLEDIGT)
5. 🔥 Systematisches Testing & Debugging (AKTUELL - 1/12 Bereiche)

### 🚨 KRITISCHE BETA-PRIORITÄTEN (Stand: 06.06.2025)

1. **✅ Docker Setup** - ERLEDIGT (01.06.2025)
2. **🔥 Version 0.1.0 Testing** (2-3 Wochen) - AKTUELL
3. **🌴 Urlaubsantrag-System** (Nach v0.1.0) - DEAL-BREAKER Feature
4. **💰 Gehaltsabrechnung Upload** (Nach v0.1.0) - DEAL-BREAKER Feature
5. **🔧 TPM-System** (Nach v0.1.0) - DEAL-BREAKER Feature
6. **📱 Mobile/PWA** (Parallel) - Kritisch für Industriearbeiter

---

## 🔗 WEITERE STANDARDS & DOKUMENTATION

- **💬 Chat System**: Siehe [DESIGN-STANDARDS.md](./docs/DESIGN-STANDARDS.md#-chat-system-design-standards)
- **🎨 UI/UX Design**: Siehe [DESIGN-STANDARDS.md](./docs/DESIGN-STANDARDS.md)
- **📊 Datenbank**: Siehe [DATABASE-SETUP-README.md](./docs/DATABASE-SETUP-README.md)

---

## ⚠️ WICHTIGE REGELN FÜR CLAUDE AI

### 🎯 GOLDENE REGELN:

1. **DO WHAT'S ASKED** - Nicht mehr, nicht weniger
2. **EDIT > CREATE** - Immer vorhandene Dateien bearbeiten statt neue erstellen
3. **NO PROACTIVE DOCS** - Keine Dokumentation ohne explizite Anfrage
4. **CLEAN UP** - Test-/Debug-Dateien nach Gebrauch löschen
5. **UPDATE DB README** - Bei Datenbankänderungen immer aktualisieren

### 🚫 NIEMALS:

- Dateien erstellen, die nicht absolut notwendig sind
- Proaktiv README oder .md Dateien erstellen
- Mehr tun als explizit angefragt wurde
- Fast-Forward Merges in master Branch verwenden

### ✅ IMMER:

- Existierende Dateien bevorzugen
- Nur das tun, was angefragt wurde
- Temporäre Dateien aufräumen
- docs/DATABASE-SETUP-README.md bei DB-Änderungen aktualisieren
- Bei Merges in master: `git merge --no-ff <branch>` verwenden
- Vor jedem Merge alle Dateien prüfen mit `git diff master..<branch>`
