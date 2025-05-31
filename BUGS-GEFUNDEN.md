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

## 🟡 Mittlere Bugs

### 5. **Invalid Date bei Sitzungsinformationen**
- **Wo:** Root Dashboard - Sitzungsinformationen Box
- **Anzeige:** 
  - "Angemeldet seit: Invalid Date"
  - "Sitzung gültig bis: Invalid Date"
  - "Verbleibende Zeit: NaN Minuten"
- **Vermutliche Ursache:** JWT Token Zeitstempel werden falsch geparst

### 6. **Chat-Polling zu häufig**
- **Wo:** Alle Seiten mit Chat-Integration
- **Problem:** `/api/chat/unread-count` wird mehrfach pro Sekunde aufgerufen
- **Auswirkung:** Unnötige Serverlast
- **Lösung:** Polling-Intervall erhöhen (z.B. alle 10-30 Sekunden)

### 7. **Navigation "Administratoren" funktioniert nicht**
- **Wo:** Root Dashboard Sidebar
- **Problem:** Klick auf "Administratoren" löst Fehler aus (siehe Bug #1)
- **Erwartung:** Section mit Admin-Verwaltung sollte angezeigt werden
- **Tatsächlich:** Nichts passiert, nur Fehler in Konsole

### 8. **Falsche Mitarbeiter-Statistik**
- **Wo:** Admin Dashboard - Statistiken
- **Problem:** Zeigt falsche Anzahl von Mitarbeitern
- **Vermutliche Ursache:** API zählt möglicherweise alle User statt nur Mitarbeiter des Tenants

## 🟢 Kleinere Bugs / Verbesserungen

### 9. **UI/UX: Fehlende Section-Struktur**
- **Wo:** root-dashboard.html
- **Problem:** Admin-Formular und Liste sind immer sichtbar
- **Besser:** Tab-System oder Sections implementieren
- **Vorschlag:** Konsistenz mit anderen Dashboards (admin-dashboard.html)

### 10. **Benutzer-ID zu prüfen**
- **Wo:** Root Dashboard - Nutzerinformationen
- **Anzeige:** "Benutzer-ID: 53"
- **Zu prüfen:** Ist diese ID korrekt für neu erstellten Root User?

### 11. **Admin-Formular verbesserungswürdig**
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

### 12. **Feature-Beschreibung zeigt [object Object]**
- **Wo:** Feature-Management Seite
- **Problem:** Beschreibungsfeld zeigt "[object Object]" statt Text
- **Vermutliche Ursache:** JSON-Objekt wird nicht korrekt in String konvertiert
- **Lösung:** .description Property korrekt auslesen

### 13. **Feature-Management UI verbesserungswürdig**
- **Wo:** Feature-Management Seite
- **Fehlende Bereiche:**
  - ❌ "Tenant-Paket" Bereich (was ist im aktuellen Paket enthalten)
  - ❌ "Zusätzliche Features" Bereich (zum Nachbuchen)
  - ❌ Klare Trennung zwischen inkludierten und zusätzlichen Features
- **Verbesserung:** UI in Bereiche aufteilen für bessere Übersicht

### 14. **Font Awesome Glyph Warnung**
- **Wo:** Konsole auf allen Seiten
- **Problem:** "Glyph bbox was incorrect" für viele Font Awesome Icons
- **Auswirkung:** Nur kosmetisch, Icons funktionieren trotzdem
- **Lösung:** Font Awesome Version aktualisieren oder lokale Kopie verwenden

## 📊 Bug-Statistik

| Priorität | Anzahl | Status |
|-----------|--------|---------|
| Kritisch | 4 | 1 behoben, 3 offen |
| Mittel | 5 | Alle offen |
| Niedrig | 6 | Alle offen |

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