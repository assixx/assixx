# 🐛 Gefundene Bugs während Funktionstest

**Testdatum:** 31.05.2025  
**Tester:** Simon (interaktiv) + Claude AI  
**Version:** v0.0.2 (TypeScript)

## 🔴 Kritische Bugs

### 1. **showSection is not defined** ❌
- **Wo:** root-dashboard.html beim Klick auf "Administratoren"
- **Problem:** `show-section.ts` wird nicht importiert
- **Fehler:** `Uncaught ReferenceError: showSection is not defined`
- **Lösung:** Script-Import hinzufügen oder Navigation anpassen

### 2. **__dirname is not defined** ❌ (BEHOBEN)
- **Wo:** html.routes.ts
- **Problem:** ES Module Kompatibilität
- **Lösung:** ✅ Bereits behoben mit fileURLToPath

### 3. **KRITISCH: Falsche Dokumente im Admin Dashboard** ❌❌❌
- **Wo:** Admin Dashboard - Dokumenten-Anzeige
- **Problem:** Zeigt 6 Dokumente an, obwohl keine hochgeladen wurden
- **Auswirkung:** Admin sieht möglicherweise Dokumente anderer Tenants!
- **Sicherheitsproblem:** Multi-Tenant Isolation verletzt
- **Vermutliche Ursache:** Fehlende tenant_id Filter in der API
- **SOFORT BEHEBEN:** Datenschutz-Verletzung möglich!

### 4. **KRITISCH: Mitarbeiter-Erstellung API fehlt** ❌❌
- **Wo:** Admin Dashboard - Neuer Mitarbeiter Modal
- **Problem:** POST /api/admin/employees returns 404
- **Auswirkung:** Admins können keine Mitarbeiter erstellen
- **Fehler:** API-Endpoint existiert nicht
- **Lösung:** Route in backend implementieren

### 5. **KRITISCH: TypeScript Files werden direkt geladen** ❌❌❌
- **Wo:** Admin Dashboard - Nach Logo-Klick
- **Problem:** Browser versucht .ts Dateien direkt zu laden
- **Fehler:** "unerlaubter MIME-Typ (video/mp2t)" - Browser interpretiert .ts als Video
- **Auswirkung:** Seite wird komplett unbrauchbar, muss neu geladen werden
- **Betroffene Dateien:**
  - confirm-once.ts
  - unified-navigation.ts
  - show-section.ts
  - admin-dashboard.ts
  - employee-deletion.ts
- **Lösung:** Frontend Build ausführen (`npm run build`) oder Imports auf .js ändern

## 🟡 Mittlere Bugs

### 6. **Invalid Date bei Sitzungsinformationen**
- **Wo:** Root Dashboard - Sitzungsinformationen Box
- **Anzeige:** 
  - "Angemeldet seit: Invalid Date"
  - "Sitzung gültig bis: Invalid Date"
  - "Verbleibende Zeit: NaN Minuten"
- **Vermutliche Ursache:** JWT Token Zeitstempel werden falsch geparst

### 7. **Chat-Polling zu häufig**
- **Wo:** Alle Seiten mit Chat-Integration
- **Problem:** `/api/chat/unread-count` wird mehrfach pro Sekunde aufgerufen
- **Auswirkung:** Unnötige Serverlast
- **Lösung:** Polling-Intervall erhöhen (z.B. alle 10-30 Sekunden)

### 8. **Navigation "Administratoren" funktioniert nicht**
- **Wo:** Root Dashboard Sidebar
- **Problem:** Klick auf "Administratoren" löst Fehler aus (siehe Bug #1)
- **Erwartung:** Section mit Admin-Verwaltung sollte angezeigt werden
- **Tatsächlich:** Nichts passiert, nur Fehler in Konsole

### 9. **Falsche Mitarbeiter-Statistik**
- **Wo:** Admin Dashboard - Statistiken
- **Problem:** Zeigt falsche Anzahl von Mitarbeitern
- **Vermutliche Ursache:** API zählt möglicherweise alle User statt nur Mitarbeiter des Tenants

## 🟢 Kleinere Bugs / Verbesserungen

### 10. **UI/UX: Fehlende Section-Struktur**
- **Wo:** root-dashboard.html
- **Problem:** Admin-Formular und Liste sind immer sichtbar
- **Besser:** Tab-System oder Sections implementieren
- **Vorschlag:** Konsistenz mit anderen Dashboards (admin-dashboard.html)

### 11. **Benutzer-ID zu prüfen**
- **Wo:** Root Dashboard - Nutzerinformationen
- **Anzeige:** "Benutzer-ID: 53"
- **Zu prüfen:** Ist diese ID korrekt für neu erstellten Root User?

### 12. **Admin-Formular verbesserungswürdig**
- **Wo:** Root Dashboard - Admin-Erstellung
- **Fehlende Felder:**
  - ❌ Vorname & Nachname (statt nur Benutzername)
  - ❌ Passwort-Wiederholung zur Bestätigung
  - ❌ E-Mail-Wiederholung zur Bestätigung
  - ❌ Rolle/Position (Bereichsleiter/Teamleiter)
  - ❌ Bereich-Auswahl (für welchen Bereich zuständig)
  - ❌ Berechtigungen (nicht alle Admins sollen alles können)
- **Unnötige Felder:**
  - ❌ Firma-Feld (ist bereits klar durch Tenant-Kontext)
- **Verbesserung:** Formular professioneller gestalten mit Rollen & Berechtigungen

### 13. **Feature-Beschreibung zeigt [object Object]**
- **Wo:** Feature-Management Seite
- **Problem:** Beschreibungsfeld zeigt "[object Object]" statt Text
- **Vermutliche Ursache:** JSON-Objekt wird nicht korrekt in String konvertiert
- **Lösung:** .description Property korrekt auslesen

### 14. **Feature-Management UI verbesserungswürdig**
- **Wo:** Feature-Management Seite
- **Fehlende Bereiche:**
  - ❌ "Tenant-Paket" Bereich (was ist im aktuellen Paket enthalten)
  - ❌ "Zusätzliche Features" Bereich (zum Nachbuchen)
  - ❌ Klare Trennung zwischen inkludierten und zusätzlichen Features
- **Verbesserung:** UI in Bereiche aufteilen für bessere Übersicht

### 15. **Font Awesome Glyph Warnung**
- **Wo:** Konsole auf allen Seiten
- **Problem:** "Glyph bbox was incorrect" für viele Font Awesome Icons
- **Auswirkung:** Nur kosmetisch, Icons funktionieren trotzdem
- **Lösung:** Font Awesome Version aktualisieren oder lokale Kopie verwenden

### 16. **KRITISCH: Schwarzes Brett API fehlt** ❌❌
- **Wo:** Schwarzes Brett Seite
- **Problem:** POST /api/blackboard returns 404
- **Auswirkung:** Keine Einträge können erstellt werden
- **Fehler:** API-Endpoint existiert nicht oder falsche Route
- **Lösung:** Blackboard Routes in backend prüfen/implementieren

## 🟡 Mittlere Bugs

### 17. **openEntryForm is not defined** ❌
- **Wo:** blackboard.html - Button für neuen Eintrag
- **Problem:** Funktion wird aufgerufen aber ist nicht definiert
- **Fehler:** `Uncaught ReferenceError: openEntryForm is not defined`
- **Lösung:** Funktion in blackboard.ts implementieren oder Import fixen

## 🟢 Kleinere Bugs / Verbesserungen

### 18. **Schwarzes Brett Design anpassen** 🎨
- **Wo:** blackboard.html
- **Problem:** Design passt nicht zum Glassmorphismus-Standard
- **Lösung:** Design-Standards aus DESIGN-STANDARDS.md anwenden

### 19. **Kalender Event-Erstellung fehlerhaft** ⚠️
- **Wo:** Kalender - Event erstellen
- **Problem:** "Error creating calendar event" beim Speichern
- **Vermutliche Ursache:** API-Fehler oder Validierung
- **Notiz:** Design sieht ok aus, muss später angepasst werden
- **Lösung:** Backend-Endpoint prüfen, Fehlerdetails analysieren

### 20. **Chat-Test blockiert durch fehlende Mitarbeiter** 🔄
- **Wo:** Chat-System
- **Problem:** Kann nicht getestet werden, da keine Mitarbeiter erstellt werden können
- **Abhängigkeit:** Bug #4 (Mitarbeiter-Erstellung API fehlt) muss zuerst behoben werden
- **Notiz:** Chat braucht mindestens 2 User zum Testen
- **TODO:** Nach Mitarbeiter-API Fix erneut testen

### 21. **KVP getElementById Error** ⚠️
- **Wo:** kvp.html:390 - initializeButtons Funktion
- **Problem:** `document.getElementById(...) is null`
- **Fehler:** Element wird nicht gefunden beim Initialisieren
- **Lösung:** HTML-Elemente und Script-Reihenfolge prüfen

### 22. **KVP Berechtigungen überdenken** 💡
- **Wo:** KVP-System
- **Problem:** Nur Mitarbeiter können KVP erstellen
- **Verbesserung:** Auch Admins sollten KVP-Vorschläge erstellen können
- **Notiz:** Macht Sinn für Führungskräfte die auch Verbesserungen vorschlagen

### 23. **KVP .stat-item Design anpassen** 🎨
- **Wo:** KVP-Seite - Statistik-Bereich
- **Problem:** .stat-item folgt nicht dem Glassmorphismus-Standard
- **Lösung:** Design-Standards aus DESIGN-STANDARDS.md anwenden

### 24. **Schichtplan-Test blockiert durch fehlende Mitarbeiter** 🔄
- **Wo:** Schichtplanung
- **Problem:** Kann nicht vollständig getestet werden, da keine Mitarbeiter vorhanden
- **Abhängigkeit:** Bug #4 (Mitarbeiter-Erstellung API fehlt) muss zuerst behoben werden
- **Notiz:** UI sieht gut aus, Wochenansicht funktioniert
- **TODO:** Nach Mitarbeiter-API Fix erneut testen

### 25. **Schichtplan Navigation inkonsistent** 🎨
- **Wo:** shifts.html - Seitennavigation
- **Problem:** Navigation sieht ganz anders aus als bei anderen Seiten
- **Details:** Menüpunkte haben andere Struktur/Design
- **Lösung:** Unified Navigation implementieren wie bei anderen Seiten

### 26. **Survey-Feature nicht für Admin verfügbar** ⚠️
- **Wo:** Survey-System
- **Problem:** "Diese Funktion (surveys) ist für Ihren Tarif nicht verfügbar"
- **Vermutliche Ursache:** Feature ist nicht für den Tenant aktiviert
- **Lösung:** Feature-Management prüfen oder Feature automatisch aktivieren
- **Notiz:** Survey-System ist fertig implementiert (29.01.2025) aber nicht freigeschaltet

### 27. **Viele Features fehlen in Feature-Management** ❌
- **Wo:** root-features.html - Feature Management Seite
- **Problem:** Sehr viele Features werden nicht angezeigt
- **Erwartete Features:** Survey, KVP, Schichtplan, Kalender, Chat, etc.
- **Tatsächlich:** Nur wenige Features sichtbar
- **Vermutliche Ursache:** Features nicht in DB oder API gibt nicht alle zurück
- **TODO:** Backend prüfen welche Features registriert sind

### 28. **KRITISCH: Dokumenten-Upload komplett fehlerhaft** ❌❌❌
- **Wo:** document-upload Seite
- **Probleme:**
  1. TypeScript MIME-Type Error (header-user-info.ts)
  2. CSP blockiert blob URLs: "frame-src 'none'"
  3. Upload API fehlt: POST /documents/upload returns 404
  4. "Route not found" Fehler
- **Auswirkung:** Dokumenten-Upload funktioniert gar nicht
- **Lösung:** 
  - Upload Route implementieren
  - CSP Policy anpassen für blob: URLs
  - TypeScript Build fixen
- **Notiz:** Seite braucht sehr viele Korrekturen

### 29. **Mobile Optimierung fehlt komplett** 📱❌
- **Wo:** Gesamte Anwendung
- **Problem:** Keine Mobile-Optimierung vorhanden
- **Auswirkung:** App ist auf Smartphones/Tablets nicht nutzbar
- **TODO:** 
  - Responsive Design implementieren
  - Hamburger-Menü für Mobile
  - Touch-optimierte Buttons
  - Mobile-first CSS
- **Priorität:** Hoch (für Beta-Test mit Industriearbeitern)

## 📊 Bug-Statistik

| Priorität | Anzahl | Status |
|-----------|--------|---------|
| Kritisch | 7 | 1 behoben, 6 offen |
| Mittel | 11 | Alle offen |
| Niedrig | 11 | Alle offen |

## 🔧 Nächste Schritte

1. **SOFORT beheben (Sicherheitskritisch):**
   - Multi-Tenant Isolation bei Dokumenten-API
   - Tenant-Filter in allen API-Endpoints prüfen

2. **Vor Beta beheben:**
   - showSection Error durch Script-Import
   - Invalid Date Problem
   - Chat-Polling Optimierung
   - Navigation reparieren
   - Falsche Statistiken korrigieren

3. **Nice-to-have:**
   - UI/UX Verbesserungen
   - Section-basierte Navigation

## 📝 Notizen

- Frontend läuft auf Port 5173 (Dev) und Port 3000 (Prod)
- Nach Frontend-Änderungen muss `npm run build` ausgeführt werden
- WebSocket funktioniert nach Bugfix einwandfrei
- Multi-Tenant API Endpoints fehlen noch (/api/tenants, /api/features/status)

---

**Zuletzt aktualisiert:** 31.05.2025, 13:57 Uhr