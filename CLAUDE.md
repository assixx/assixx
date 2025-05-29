# 📖 Assixx Project Instructions for Claude AI

## 🚀 START HIER - PFLICHTLEKTÜRE VOR ARBEITSBEGINN

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

### 2️⃣ PROJEKTSTRUKTUR (ZWEITE PRIORITÄT!)

```bash
# Projektstruktur überprüfen und bei Bedarf aktualisieren:
cat /home/scs/projects/Assixx/PROJEKTSTRUKTUR.md
```

**Warum?**

- 📁 Zeigt die aktuelle Ordnerstruktur
- 🔍 Hilft beim Finden von Dateien
- ⚠️ Zeigt was fehlt oder migriert werden muss
- 📝 Muss bei Strukturänderungen aktualisiert werden

### 3️⃣ DESIGN-STANDARDS (DRITTE PRIORITÄT!)

```bash
# Design-Standards für konsistentes UI/UX:
cat /home/scs/projects/Assixx/DESIGN-STANDARDS.md
```

**Enthält:**

- 🎨 Alle Glassmorphismus-Standards
- 🎨 Farbpalette und CSS-Variablen
- 📐 UI-Komponenten Dokumentation
- 🔽 Custom Dropdown Pattern

### 4️⃣ WEITERE WICHTIGE DOKUMENTE

- **Entwickler-Guidelines**: [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md)
- **Architektur**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Features**: [FEATURES.md](./FEATURES.md)
- **Datenbank**: [DATABASE-SETUP-README.md](./DATABASE-SETUP-README.md)
- **Setup Guides**:
  - 🪟 [Windows (WSL)](./SETUP-WINDOWS-WSL.md)
  - 🐧 [Ubuntu/Linux](./SETUP-UBUNTU-LINUX.md)
  - 🍎 [macOS](./SETUP-MACOS.md)

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

1. **📚 PFLICHTLEKTÜRE** (IMMER in dieser Reihenfolge):

   ```bash
   # WICHTIG: Diese Reihenfolge IMMER einhalten!
   cat TODO.md           # 1. Aktuelle Aufgaben (ERSTE PRIORITÄT!)
   cat CLAUDE.md         # 2. Diese Anweisungen
   cat PROJEKTSTRUKTUR.md # 3. Projekt-Struktur prüfen/aktualisieren
   cat README.md         # 4. Projekt-Übersicht
   cat ROADMAP.md        # 5. Zukünftige Features
   cat DATABASE-SETUP-README.md  # 6. DB-Struktur (optional)
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
   - Bei DB-Änderungen → DATABASE-SETUP-README.md aktualisieren
   - Bei neuen Features → FEATURES.md ergänzen
   - Bei UI-Änderungen → DESIGN-STANDARDS.md prüfen
   - Bei Struktur-Änderungen → PROJEKTSTRUKTUR.md aktualisieren

### 📊 PROJEKT-ÜBERSICHT

| Kategorie      | Information                           |
| -------------- | ------------------------------------- |
| **Projekt**    | Multi-Tenant SaaS für Industriefirmen |
| **Tech Stack** | [ARCHITECTURE.md](./ARCHITECTURE.md)  |
| **Features**   | [FEATURES.md](./FEATURES.md)          |
| **GitHub**     | https://github.com/SCS-Technik/Assixx |
| **Lokale Dev** | http://localhost:3000                 |

### 📌 AKTUELLE SCHWERPUNKTE

1. ✅ Root Features Management Page (27.05.2025)
2. 📝 Survey Tool Checkup - MORGEN WEITER (28.05.2025)
   - API Response Format Issue
   - Survey.getStatistics Implementation
   - Excel Export Fixes
   - Navigation Fixes
3. 🔄 Chat System weitere Verbesserungen

---

## 🔗 WEITERE STANDARDS & DOKUMENTATION

- **💬 Chat System**: Siehe [DESIGN-STANDARDS.md](./DESIGN-STANDARDS.md#-chat-system-design-standards)
- **🎨 UI/UX Design**: Siehe [DESIGN-STANDARDS.md](./DESIGN-STANDARDS.md)
- **📊 Datenbank**: Siehe [DATABASE-SETUP-README.md](./DATABASE-SETUP-README.md)

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

### ✅ IMMER:

- Existierende Dateien bevorzugen
- Nur das tun, was angefragt wurde
- Temporäre Dateien aufräumen
- DATABASE-SETUP-README.md bei DB-Änderungen aktualisieren
