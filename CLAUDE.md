# Assixx Project Instructions for Claude

## 📝 CODE-KOMMENTIERUNG STANDARDS (IMMER BEFOLGEN!)

### Kommentierungs-Regeln:
1. **JEDE Funktion** muss kommentiert werden:
   ```javascript
   // Validiert die Subdomain-Eingabe und zeigt Fehler an
   // @param {string} value - Die eingegebene Subdomain
   // @returns {boolean} - True wenn gültig, false wenn ungültig
   function validateSubdomain(value) {
   ```

2. **CSS-Abschnitte** klar strukturieren:
   ```css
   /* ========================================
      HEADER SECTION - Glassmorphismus Design
      ======================================== */
   .header {
       /* Transparenter Hintergrund mit Blur für Glaseffekt */
       background: rgba(255, 255, 255, 0.02);
   ```

3. **Komplexe Logik** detailliert erklären:
   ```javascript
   // Prüft zuerst ob Passwörter übereinstimmen
   // Dann sammelt alle Features die ausgewählt wurden
   // Fügt Ländervorwahl zur Telefonnummer hinzu
   // Sendet alles als JSON an Backend
   ```

4. **HTML-Bereiche** beschreiben:
   ```html
   <!-- Signup Form - 3 Spalten Layout für 16-Zoll Monitore -->
   <!-- Erste Zeile: Firma, Subdomain, Email -->
   <div class="form-grid">
   ```

### Wann kommentieren:
- Bei JEDER Funktion (was macht sie, Parameter, Return)
- Bei komplexen CSS-Eigenschaften (warum dieser Wert?)
- Bei wichtigen HTML-Strukturen
- Bei API-Calls und Datenverarbeitung
- Bei Berechnungen und Algorithmen

### NICHT übertreiben:
- Keine offensichtlichen Kommentare wie `// Button Klick`
- Nicht jede einzelne CSS-Zeile
- Fokus auf das WARUM, nicht nur WAS

## 🎨 GLASSMORPHISMUS DESIGN STANDARDS (IMMER VERWENDEN!)

### Container/Cards:
```css
background: rgba(255, 255, 255, 0.02);
backdrop-filter: blur(20px) saturate(180%);
-webkit-backdrop-filter: blur(20px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.15);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
```

### Form Controls:
```css
background: rgba(255, 255, 255, 0.04);
border: 1px solid rgba(255, 255, 255, 0.12);
backdrop-filter: blur(5px);
/* Focus */
background: rgba(255, 255, 255, 0.08);
box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.15),
            inset 0 1px 2px rgba(0, 0, 0, 0.1);
```

### Custom Dropdowns:
```css
background: rgba(18, 18, 18, 0.8);
backdrop-filter: blur(20px) saturate(180%);
/* Hover */
background: rgba(33, 150, 243, 0.2);
```

### Buttons:
```css
box-shadow: 0 1px 4px rgba(33, 150, 243, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
/* Hover */
transform: translateY(-2px);
```

### Special Elements:
- Offer Banner: `rgba(251, 191, 36, 0.02)` 
- Success: `rgba(16, 185, 129, 0.15)`
- Help Button: `rgba(255, 255, 255, 0.08)`

### WICHTIG:
- SEHR subtile Transparenzen (0.02-0.08)
- Blur: 20px für große, 5px für kleine Elemente
- IMMER inset shadow für Glaseffekt
- Animationen: fadeInUp, glow, subtle-pulse

---

## 🚨 Neue Workflow-Anweisungen von Simon

### 🚨 Hauptanweisungen (IMMER befolgen!)

1. **ALLE .md Dateien lesen** wenn Simon sagt "weiter machen mit Assixx Projekt":
   - CLAUDE.md
   - README.md 
   - ROADMAP.md
   - DATABASE-SETUP-README.md

2. **Kurze Zusammenfassung** erstellen:
   - Was haben wir erreicht ✅
   - Aktuelle Probleme 🔴
   - Was müssen wir prüfen 🔍

3. **Doppelte Genehmigung** einholen:
   - "Sind Sie sicher, dass wir anfangen sollen?"
   - Nach Bestätigung: Konkrete Aufgaben zeigen
   - "Welche Aufgabe möchten Sie beginnen?"

4. **Checkup-Fragen** (VOR und NACH jeder Aufgabe):
   - VOR: "Haben Sie die notwendigen Backups/Tests durchgeführt?"
   - NACH: "Haben Sie die Änderungen getestet? Alles funktioniert?"

5. **DATABASE-SETUP-README.md** IMMER aktualisieren bei DB-Änderungen!

### 📝 Aktuelle TODO Liste
1. ✅ Signup.html UI Design verbessern
2. Chat System Checkup
3. Survey Tool fertigstellen

### 🔧 Technische Details
- Multi-Tenant SaaS für Industriefirmen
- Node.js/Express Backend
- MySQL mit Tenant-Isolation
- Feature-Management System

### 🌐 Wichtige URLs
- GitHub: https://github.com/SCS-Technik/Assixx
- Lokale Dev: http://localhost:3000

### 📊 Aktuelle Features
- ✅ Benutzer-Management (Root/Admin/Employee)
- ✅ Dokumenten-System
- ✅ Schwarzes Brett
- ✅ Kalender
- ✅ KVP-System
- ✅ Schichtplanung
- 🔄 Chat-System (needs checkup)
- 🔄 Umfragen (in Arbeit)

---

- When new databases and structures are changed, update the database setup README accordingly
# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
Please clean up any files that you've created for testing or debugging purposes after they're no longer needed.