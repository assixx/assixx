# 🧪 Assixx Funktionstest-Plan

> **Ziel:** Systematischer Test aller Features mit Fokus auf Funktionalität und Benutzererlebnis
> **Dauer:** Ca. 2-3 Tage
> **Letzte Durchführung:** [Noch nicht durchgeführt]

## 📋 Übersicht

Der Funktionstest besteht aus zwei Phasen:

1. **Phase 1:** Automatische Tests (Backend & API)
2. **Phase 2:** Interaktive Benutzertests (Frontend & UX)

---

## 🤖 PHASE 1: Automatische Tests (Tag 1)

### 1.1 Backend Health Checks

```bash
# Server Status
curl http://localhost:3000/health

# API Verfügbarkeit
curl http://localhost:3000/api/status

# Database Verbindung
npm run test:db-connection
```

### 1.2 API Endpoint Tests

#### Authentication

```bash
# Login Test
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.de","password":"testpass"}'

# Session Check
curl http://localhost:3000/api/auth/check-session \
  -b cookies.txt

# Logout Test
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt
```

#### Multi-Tenant Tests

```bash
# Tenant Liste
curl http://localhost:3000/api/tenants \
  -b cookies.txt

# Feature Status
curl http://localhost:3000/api/features/status \
  -b cookies.txt
```

### 1.3 WebSocket Tests

```bash
# WebSocket Verbindung
npm run test:websocket

# Chat System
npm run test:chat-system
```

### 1.4 File Upload Tests

```bash
# Dokument Upload
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@test-document.pdf" \
  -F "category=general" \
  -b cookies.txt

# Profilbild Upload
curl -X POST http://localhost:3000/api/profile/picture \
  -F "picture=@test-image.jpg" \
  -b cookies.txt
```

---

## 👤 PHASE 2: Interaktive Benutzertests (Tag 2-3)

### 🎯 Test-Szenario 1: Neue Firma Onboarding (Root User)

**Rolle:** Root User (Systemadministrator)
**Ziel:** Komplettes Setup einer neuen Firma

1. **Registrierung**

   - [ ] Öffne http://localhost:3000/signup
   - [ ] Fülle aus: Firmenname: "Testfirma GmbH"
   - [ ] Subdomain: "testfirma"
   - [ ] Email: "admin@testfirma.de"
   - [ ] Passwort: Sicheres Passwort wählen
   - [ ] Telefon: "+49 123 456789"
   - [ ] ✅ Registrierung sollte erfolgreich sein
   - [ ] ✅ Automatischer Login sollte erfolgen

2. **Erste Schritte**

   - [ ] Dashboard sollte erscheinen
   - [ ] Willkommensnachricht sichtbar?
   - [ ] Navigation funktioniert?
   - [ ] Alle Menüpunkte klickbar?

3. **Mitarbeiter anlegen**
   - [ ] Gehe zu "Mitarbeiter" → "Neuer Mitarbeiter"
   - [ ] Erstelle 3 Test-Mitarbeiter:
     - Max Mustermann (Produktion)
     - Erika Muster (Verwaltung)
     - Hans Test (Lager)
   - [ ] Verschiedene Rollen zuweisen
   - [ ] ✅ Mitarbeiter erscheinen in Liste?

### 🎯 Test-Szenario 2: Admin Workflow

**Rolle:** Admin User
**Ziel:** Tägliche Verwaltungsaufgaben

1. **Login als Admin**

   - [ ] Logout vom Root Account
   - [ ] Login mit Admin-Zugangsdaten
   - [ ] ✅ Richtiges Dashboard?

2. **Schwarzes Brett**

   - [ ] Neue Mitteilung erstellen
   - [ ] Titel: "Wichtige Betriebsinfo"
   - [ ] Inhalt mit Formatierung (Fett, Liste)
   - [ ] Kategorie: "Wichtig"
   - [ ] Ablaufdatum: In 7 Tagen
   - [ ] ✅ Mitteilung erscheint auf Schwarzem Brett?
   - [ ] Als Mitarbeiter: Mitteilung sichtbar?

3. **Dokumente hochladen**

   - [ ] Gehe zu "Dokumente"
   - [ ] Lade 3 verschiedene Dokumente hoch:
     - PDF Arbeitsanweisung
     - Excel Schichtplan
     - Word Protokoll
   - [ ] Verschiedene Kategorien wählen
   - [ ] Zugriffsrechte setzen (nur bestimmte Abteilungen)
   - [ ] ✅ Download funktioniert?
   - [ ] ✅ Vorschau funktioniert?

4. **Kalender Event**

   - [ ] Öffne Kalender
   - [ ] Erstelle Event: "Teammeeting"
   - [ ] Datum: Nächste Woche
   - [ ] Drag & Drop auf anderen Tag
   - [ ] ✅ Event verschiebt sich korrekt?
   - [ ] Event löschen
   - [ ] ✅ Event verschwindet?

5. **Umfrage erstellen**
   - [ ] Gehe zu "Umfragen"
   - [ ] Neue Umfrage: "Mitarbeiterzufriedenheit"
   - [ ] 5 Fragen hinzufügen:
     - Multiple Choice
     - Bewertungsskala
     - Ja/Nein
     - Textfeld
     - Mehrfachauswahl
   - [ ] Zeitraum: 1 Woche
   - [ ] ✅ Vorschau korrekt?
   - [ ] Umfrage aktivieren

### 🎯 Test-Szenario 3: Mitarbeiter Experience

**Rolle:** Employee (Mitarbeiter)
**Ziel:** Tägliche Nutzung aus Mitarbeitersicht

1. **Login als Mitarbeiter**

   - [ ] Login mit Mitarbeiter-Account
   - [ ] ✅ Eingeschränktes Dashboard?
   - [ ] ✅ Nur erlaubte Menüpunkte sichtbar?

2. **Profil vervollständigen**

   - [ ] Gehe zu "Mein Profil"
   - [ ] Profilbild hochladen
   - [ ] Kontaktdaten ergänzen
   - [ ] ✅ Änderungen gespeichert?
   - [ ] ✅ Profilbild überall sichtbar?

3. **Chat nutzen**

   - [ ] Öffne Chat
   - [ ] Schreibe Nachricht an Kollegen
   - [ ] Erstelle Gruppenchat "Schichtteam"
   - [ ] Lade 2 Kollegen ein
   - [ ] Sende Nachricht mit Emoji 😊
   - [ ] Hänge Datei an
   - [ ] ✅ Echtzeit-Updates funktionieren?
   - [ ] ✅ Benachrichtigungen kommen an?

4. **KVP-Vorschlag**

   - [ ] Gehe zu "KVP"
   - [ ] Neuer Vorschlag: "Prozessverbesserung"
   - [ ] Detaillierte Beschreibung
   - [ ] Kategorie: "Effizienz"
   - [ ] Datei anhängen (Skizze)
   - [ ] ✅ Vorschlag erscheint in Liste?
   - [ ] ✅ Status-Updates möglich?

5. **Schichtplan ansehen**

   - [ ] Öffne Schichtplanung
   - [ ] ✅ Eigene Schichten sichtbar?
   - [ ] ✅ Wochenansicht korrekt?
   - [ ] ✅ Monatsübersicht funktioniert?
   - [ ] Schichtnotiz hinzufügen
   - [ ] ✅ Notiz gespeichert?

6. **Umfrage ausfüllen**
   - [ ] Gehe zu "Umfragen"
   - [ ] Öffne "Mitarbeiterzufriedenheit"
   - [ ] Alle Fragen beantworten
   - [ ] ✅ Fortschritt wird angezeigt?
   - [ ] Umfrage abschicken
   - [ ] ✅ Bestätigung erhalten?

### 🎯 Test-Szenario 4: Cross-Feature Tests

**Ziel:** Integration zwischen Features testen

1. **Dokument → Chat**

   - [ ] Lade Dokument hoch
   - [ ] Teile Link im Chat
   - [ ] ✅ Kollege kann Dokument öffnen?

2. **Kalender → Schwarzes Brett**

   - [ ] Erstelle Event im Kalender
   - [ ] Erstelle Ankündigung auf Schwarzem Brett
   - [ ] ✅ Verweise funktionieren?

3. **KVP → Umfrage**
   - [ ] Erstelle KVP-Vorschlag
   - [ ] Erstelle Umfrage zu KVP-Ideen
   - [ ] ✅ Zusammenhang erkennbar?

### 🎯 Test-Szenario 5: Stress & Edge Cases

1. **Gleichzeitige Nutzung**

   - [ ] 2 Browser-Fenster öffnen
   - [ ] Verschiedene Benutzer einloggen
   - [ ] Gleichzeitig chatten
   - [ ] ✅ Nachrichten kommen in Echtzeit?

2. **Große Dateien**

   - [ ] Versuche 50MB Datei hochzuladen
   - [ ] ✅ Fehlermeldung oder Upload?
   - [ ] ✅ Fortschrittsanzeige?

3. **Lange Texte**

   - [ ] Sehr lange Chat-Nachricht
   - [ ] Sehr langer KVP-Vorschlag
   - [ ] ✅ Layout bricht nicht?

4. **Browser-Tests**
   - [ ] Chrome ✅
   - [ ] Firefox ✅
   - [ ] Safari ✅
   - [ ] Edge ✅
   - [ ] Mobile Browser ✅

---

## 📊 Test-Protokoll

### Fehler-Dokumentation

| Feature  | Fehler             | Schweregrad | Status |
| -------- | ------------------ | ----------- | ------ |
| Beispiel | Login schlägt fehl | Kritisch    | Offen  |

### Performance-Messung

| Aktion                  | Erwartete Zeit | Gemessene Zeit | Status |
| ----------------------- | -------------- | -------------- | ------ |
| Login                   | < 1s           | ?              | -      |
| Dokumenten-Upload (5MB) | < 3s           | ?              | -      |
| Seitenwechsel           | < 0.5s         | ?              | -      |
| Chat-Nachricht          | < 0.1s         | ?              | -      |

### Browser-Kompatibilität

| Browser | Version | Desktop | Mobile | Probleme |
| ------- | ------- | ------- | ------ | -------- |
| Chrome  | 120+    | ✅      | ✅     | -        |
| Firefox | 120+    | ✅      | ✅     | -        |
| Safari  | 17+     | ✅      | ✅     | -        |
| Edge    | 120+    | ✅      | ✅     | -        |

---

## 🔄 Nach dem Test

1. **Fehler priorisieren**

   - Kritisch: Blockiert Nutzung
   - Hoch: Wichtige Funktion beeinträchtigt
   - Mittel: Ärgerlich aber umgehbar
   - Niedrig: Kosmetisch

2. **Dokumentation aktualisieren**

   - [ ] Gefundene Fehler in TODO.md
   - [ ] Performance-Probleme notieren
   - [ ] UX-Verbesserungen vorschlagen

3. **Fixes implementieren**
   - Kritische Fehler sofort
   - Andere nach Priorität

---

## ✅ Test-Checkliste

### Vor dem Test

- [ ] Datenbank-Backup erstellen
- [ ] Test-Tenant anlegen
- [ ] Browser-Cache leeren
- [ ] Console auf Fehler überwachen

### Während des Tests

- [ ] Screenshots bei Fehlern
- [ ] Console-Fehler dokumentieren
- [ ] Ladezeiten notieren
- [ ] Unerwartetes Verhalten dokumentieren

### Nach dem Test

- [ ] Test-Daten bereinigen
- [ ] Fehler-Report erstellen
- [ ] Prioritäten festlegen
- [ ] Nächste Schritte planen

---

**Test durchgeführt von:** ********\_********  
**Datum:** ********\_********  
**Gesamtergebnis:** ⬜ Bestanden / ⬜ Fehlgeschlagen

**Notizen:**

---

---

---
