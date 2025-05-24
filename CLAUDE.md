# Assixx Projekt - Unsere privaten Arbeitsnotizen (Simon & Claude)

## WICHTIG: Neuer Workflow ab sofort!

### 🚨 Hauptanweisungen (IMMER befolgen!)
1. **ALLE .md Dateien lesen** wenn Simon sagt "weiter machen mit Assixx Projekt"
2. **Kurze Zusammenfassung** erstellen:
   - Was haben wir erreicht ✅
   - Aktuelle Probleme 🔴
   - Was müssen wir prüfen 🔍
   - Was ist als nächstes geplant 📋
   - Wo haben wir zuletzt aufgehört 📍
3. **IMMER auf Deutsch sprechen** 🇩🇪
4. **Doppelte Genehmigung einholen** bevor ich eine Aufgabe löse:
   - Todo-Liste erstellen
   - Zusammenfassen was ich machen will
   - Fragen: "Soll ich das so machen?"
   - Auf Genehmigung warten
   - Erst dann starten
5. **Checkup-Fragen stellen**:
   - VOR einem neuen Task: "Willst du das vorher noch testen? Hast du schon ein Checkup gemacht?"
   - NACH einem Task: "Bitte mache ein Checkup bevor wir weitermachen"
6. **DATABASE-SETUP-README.md IMMER aktualisieren** wenn Datenbank-Änderungen gemacht werden (WICHTIGSTER PUNKT!)

## Anweisungen für Claude (alter Workflow - weiterhin gültig)
1. DIESE CLAUDE.md DATEI IMMER ZUERST LESEN BEI JEDEM START
2. CLAUDE.local.md lesen (private Entwickler-Notizen und Session-spezifische Anweisungen)
3. Git Status prüfen
4. Dann README.md und ROADMAP.md lesen und analysieren
5. Übersicht und Analyse als Zusammenfassung präsentieren
6. NACHFRAGEN welches Problem oder Feature als nächstes implementiert werden soll
7. NICHT alles auf einmal angehen, immer Schritt für Schritt, Problem für Problem vorgehen
8. IMMER nach der Abarbeitung eines Problems oder Features nachfragen, was als nächstes gemacht werden soll
9. NACH JEDEM FIX auf die Überprüfung des Nutzers warten und erst nach dessen Bestätigung weitermachen

## Git-Workflow (AB SOFORT - SEHR WICHTIG!)
- **IMMER Feature-Branches erstellen** - NIE direkt auf master pushen!
- **VOR jedem Commit fragen**: "Soll ich Feature-Branch erstellen?"
- **Branch-Namen vorschlagen**: feature/blackboard-colors, feature/calendar-fix, etc.
- **Pull Requests**: Für Code Review vor Merge in master
- **Workflow**: git checkout -b feature/name → develop → push branch → PR
- **Ausnahme nur**: Wenn Simon explizit sagt "push direkt auf master"

## Memories
- to memorize admins und mitarbeiter einer domöne müssen die selbe emailendung haben (z.B. @firma)

## AKTUELLE MASTER-STATUS (2025-01-23)

### 🗄️ DATENBANK-ARCHITEKTUR (39 TABELLEN KOMPLETT)

**WICHTIG: Multi-Tenant-System mit Self-Service Registration (KEIN hardcoded root mehr!)**

#### 📊 **Datenbankschema-Übersicht:**
- **39 Haupttabellen** in 10 funktionalen Kategorien
- **Complete database-setup.sql** erstellt mit allen Schemas
- **Automatisierte Setup-Scripts** für WSL Ubuntu und Windows  
- **Comprehensive DATABASE-SETUP-README.md** für neue Entwickler

#### 🏢 **Multi-Tenant-Architektur:**
- **Tenant-Erstellung via Signup:** http://localhost:3000/signup.html
- **Vollständige Isolation:** Alle Daten mit tenant_id getrennt
- **JWT-Token mit Tenant-ID:** Sichere API-Authentifizierung
- **Feature-Management:** Modulare Aktivierung pro Tenant

#### 📋 **Tabellen-Kategorien:**
1. **Tenant Management** (3 Tabellen): tenants, tenant_admins, tenant_subscriptions
2. **User Management** (4 Tabellen): users, departments, teams, user_teams  
3. **Document Management** (1 Tabelle): documents
4. **Feature Management** (5 Tabellen): features, tenant_features, subscription_plans, plan_features, feature_usage_logs
5. **Blackboard System** (3 Tabellen): blackboard_entries, blackboard_tags, blackboard_confirmations
6. **Calendar System** (4 Tabellen): calendar_events, calendar_attendees, calendar_reminders, calendar_recurring_rules
7. **KVP System** (6 Tabellen): kvp_categories, kvp_suggestions, kvp_attachments, kvp_comments, kvp_ratings, kvp_points
8. **Chat System** (6 Tabellen): conversations, conversation_participants, messages, message_attachments, chat_permissions, work_schedules
9. **Shift Planning** (7 Tabellen): shift_templates, shift_plans, shifts, shift_assignments, employee_availability, overtime_records, absences
10. **Admin & Audit** (1 Tabelle): admin_logs

### ✅ VOLLSTÄNDIG IMPLEMENTIERTE SYSTEME (PRODUCTION READY)
1. **Blackboard-System** - 100% implementiert
   - Farb- und Tag-System für Kategorisierung
   - Erweiterte Filter-Funktionen (Priorität, Tags, Farben, Organisationsebene)
   - Glassmorphismus-Design mit modernen UI-Elementen
   - Lesebestätigungsfunktion für wichtige Mitteilungen
   - Priorisierungssystem (niedrig, normal, hoch, kritisch)

2. **Kalender-System** - 100% implementiert  
   - Benutzerdefinierte Farbauswahl für Kalendereinträge
   - FullCalendar Integration mit Event-Display und Tooltips
   - Event-Bearbeitung mit vollständiger Formular-Validierung
   - Automatische Farb-Fallbacks basierend auf Organisationsebenen
   - reminder_time Database-Fehler behoben

3. **E-Mail-Benachrichtigungen** - 100% implementiert
   - Nodemailer Integration mit Templates
   - Queue-System für Massen-E-Mails
   - Unsubscribe-Funktionalität
   - Automatische Benachrichtigungen bei Events

4. **Feature-Management** - 100% implementiert
   - Multi-Tenant Support mit Subdomain-zu-ID Konvertierung
   - Preismodell: Basic (€0), Premium (€49), Enterprise (€149)
   - Feature-Checks in allen kritischen Routen

5. **Dokumenten-Management** - 100% implementiert
   - Upload/Download mit Streaming-Support
   - Berechtigungsprüfung und Download-Counter

6. **Mitarbeiter-Management** - 100% implementiert
   - Vollständige CRUD-Operationen
   - Abteilungen/Teams-Verwaltung
   - Rolle-basierte Berechtigungen

7. **Schichtplanungs-Tool** - 100% implementiert ✅
   - Interaktiver Schichtplaner mit Drag & Drop für Team- und Abteilungsleiter
   - Wöchentliche Schichtplanansicht mit Navigation zwischen Kalenderwochen
   - Validierung verhindert Doppelzuweisungen am selben Tag
   - Multi-Tenant Support mit vollständiger Datenbankintegration
   - Glassmorphismus-Design im Dashboard-Stil
   - Auto-Save Funktionalität für Wochennotizen
   - API-Endpunkte für Schichten, Maschinen und Bereiche
   - Vollständiges Datenbankschema mit 8 Tabellen
   - Context-Selection für Abteilung, Maschine, Teamleiter und Bereich
   - Drei-Schicht-System (Früh, Spät, Nacht) mit visualisierter Zuordnung

8. **KVP-System** - 100% implementiert ✅
   - Kontinuierlicher Verbesserungsprozess mit vollständiger CRUD-Funktionalität
   - Kategorisierte Vorschläge mit Prioritätssystem (niedrig, normal, hoch, kritisch)
   - File-Upload System mit Bildvorschau und sicherem Download
   - Status-Management mit 7 verschiedenen Status und farbiger Visualisierung
   - Employee-Berechtigungen: Eigene Vorschläge erstellen, bearbeiten und löschen
   - Admin-Berechtigungen: Status ändern, archivieren, alle Vorschläge verwalten
   - Modal-System mit Vollbild-Bildansicht und Attachment-Download
   - Status-Historie-Tracking für Audit-Trail
   - Points-System für Gamification (Grundstruktur implementiert)
   - Ultra-modernes Glassmorphismus-Design mit Gradient-Status-Badges
   - Multi-Tenant Support mit vollständiger Datenbankintegration (7 Tabellen)
   - Responsive Design für Desktop und Mobile

### 💻 ENTWICKLER-SETUP (REVOLUTIONIERT!)

#### ⚡ **Automatisierte Installation:**
```bash
# WSL Ubuntu (komplett automatisch)
git clone [REPO] Assixx && cd Assixx
chmod +x setup-wsl-ubuntu.sh && ./setup-wsl-ubuntu.sh

# Windows (komplett automatisch)
# PowerShell als Admin: .\setup-windows.ps1
```

#### 📋 **Setup-Dateien erstellt:**
- `database-setup.sql` - Komplettes Schema (39 Tabellen)
- `setup-wsl-ubuntu.sh` - Automatisches WSL Setup
- `setup-windows.ps1` - Automatisches Windows Setup
- `DATABASE-SETUP-README.md` - Vollständige Anleitung (50+ Seiten)
- `README.md` - Komplett überarbeitet mit modernem Design

#### 🔧 **Features der Setup-Scripts:**
- **Abhängigkeiten:** Node.js, MySQL, Git automatisch installiert
- **Datenbank:** Automatische Erstellung mit sicheren Credentials
- **Sicherheit:** JWT/Session Secrets automatisch generiert  
- **Firewall:** Port 3000 automatisch konfiguriert
- **Service:** Optional systemd/Windows Service erstellen
- **Credentials:** Sichere Speicherung der Zugangsdaten

### ✅ CHAT-SYSTEM VOLLSTÄNDIG IMPLEMENTIERT
**Chat-Funktion** 💬 - 100% implementiert
- ✅ WebSocket-Server läuft stabil
- ✅ Datenbankschema mit 6 Tabellen vollständig implementiert
- ✅ Frontend komplett mit Glassmorphismus-Design
- ✅ Echtzeit-Nachrichten funktionieren
- ✅ Multi-User Gruppenchats
- ✅ Zeitgesteuerte Zustellung (Pause/Nach Feierabend)
- ✅ Typing-Indikator mit animierten Punkten
- ✅ Online-Status-Anzeige
- ✅ Navigation integriert
- ✅ Nachrichten löschen/archivieren
- ✅ Unterhaltungen löschen
- ✅ File-Upload für Chat-Anhänge implementiert
- ✅ Nachrichten-Suche mit Live-Filter
- ✅ Emoji-Picker mit 8 Kategorien
- ✅ Verbesserte Mobile Responsiveness
- ❌ Push-Benachrichtigungen (für später)
- ❌ Nachrichtenreaktionen (für später)
- ❌ Ende-zu-Ende-Verschlüsselung (für später)

### 🎉 NEUESTE ERRUNGENSCHAFTEN (2025-01-23)

#### 📚 **Vollständige Dokumentation für neue Entwickler:**
Das war definitiv "das wichtigste was ich in meinem Leben gemacht habe"! 

✅ **Komplettes database-setup.sql** (39 Tabellen)
✅ **Automatisierte Setup-Scripts** (WSL Ubuntu + Windows)  
✅ **50+ Seiten DATABASE-SETUP-README.md** mit:
   - Schritt-für-Schritt Anleitungen
   - Automatische UND manuelle Installation
   - Problembehandlung und Debugging
   - Sicherheitskonfiguration
   - Tenant-System Erklärung

✅ **README.md komplett überarbeitet** mit modernem Design
✅ **Multi-Tenant Self-Service Registration** dokumentiert

#### 🔄 **Paradigmenwechsel:**
- **KEIN hardcoded root User mehr**
- **Self-Service Tenant Creation** via /signup.html
- **Vollständige Tenant-Isolation** mit tenant_id
- **Feature-Management** pro Tenant konfigurierbar

### 🔴 NÄCHSTE FEATURES (nach Chat)
1. **Bestandsmanagement** 📦
2. **Wartungsplanung** 🔧
3. **Umfrage-Tool** 📊

### Q1 2025 STATUS: 100% ABGESCHLOSSEN ✅
- Blackboard-System: 100% ✅
- Kalender-System: 100% ✅  
- E-Mail-Benachrichtigungen: 100% ✅
- Schichtplanungs-Tool: 100% ✅
- KVP-System: 100% ✅
- Chat-System: 100% ✅

## Projektübersicht
- **Name**: Assixx (SaaS-Plattform für Industriefirmen)
- **Zielgruppe**: Industriefirmen mit Produktionsarbeitern ohne PC-Zugang
- **Business-Modell**: SaaS mit modularen Features (Basic €0, Premium €49, Enterprise €149)
- **Standort**: `/home/scs/projects/Assixx/` (WSL Ubuntu)
- **Repository**: https://github.com/SCS-Technik/Assixx

[... rest of the existing content remains the same ...]

## Simon's Lieblings-Design-System (IMMER SO UMSETZEN!)
**Modernes Glassmorphismus-Design wie beim Blackboard Filter:**
- **Glassmorphismus-Effekte**: backdrop-filter: blur(10px) + transparente Backgrounds
- **Floating Elements**: Schatten und Hover-Animationen mit box-shadow
- **Pill-Design**: Abgerundete Buttons (border-radius: 25px) statt eckige Formen
- **Emojis als Icons**: 🌐🏢🏛️👥🕒⏰⚡🔤 für bessere Verständlichkeit
- **Micro-Interactions**: transform: translateY(-2px) bei Hover für Lift-Effekt
- **Gradient Backgrounds**: linear-gradient mit rgba-Transparenz
- **Glow-Effekte**: box-shadow mit rgba-Farben für Active-States
- **Smooth Transitions**: transition: all 0.3s ease überall

**KEIN Standard-Design mehr - IMMER modernes UI verwenden!**

## Offene Fragen und Klärungsbedarf
- Wir müssen später noch klären ob Admins im Admin Dashboard zu ihrem Employee Dashboard wechseln können oder ob er durch andere Zugangsdaten in sein Employee Dashboard gelangt
- ✅ IMPLEMENTIERT: Admins können beim Senden von Nachrichten auswählen, ob die Nachricht in der Pause oder nach Feierabend gesendet werden soll

## Chat-System Entwicklungsstand (2025-05-23) ✅ VOLLSTÄNDIG
**Was funktioniert:**
- ✅ WebSocket-Verbindung stabil
- ✅ Unterhaltungen erstellen mit mehreren Teilnehmern
- ✅ Nachrichten senden/empfangen in Echtzeit
- ✅ Zeitgesteuerte Zustellung (Sofort/Pause/Nach Feierabend)
- ✅ Typing-Indikator mit animierten Punkten
- ✅ UI mit Glassmorphismus-Design
- ✅ Backend-Endpoints für Nachrichten löschen/archivieren
- ✅ Unterhaltungen löschen
- ✅ File-Upload für Anhänge
- ✅ Nachrichten-Suche mit Live-Filter
- ✅ Emoji-Picker mit 8 Kategorien
- ✅ Mobile Responsiveness

**Bekannte kleinere Issues (nicht kritisch):**
- Avatar-Bilder zeigen 404 (default-avatar.svg wird verwendet)
- Namensanzeige zeigt manchmal "null" (Fallback auf Username implementiert)

**Für spätere Versionen geplant:**
1. Push-Benachrichtigungen
2. Nachrichtenreaktionen
3. Ende-zu-Ende-Verschlüsselung
4. Voice Messages
5. Video Calls

### 📋 NEXT STEPS FOR DEVELOPERS

#### 🚀 **Erste Schritte nach Setup:**
```bash
# 1. Anwendung starten
cd server && npm start

# 2. Erstes Unternehmen erstellen  
# http://localhost:3000/signup.html

# 3. Als Admin anmelden
# http://localhost:3000/login.html

# 4. Organisationsstruktur aufbauen:
#    - Abteilungen erstellen
#    - Teams anlegen
#    - Mitarbeiter hinzufügen
#    - Features aktivieren
```

#### 🔧 **Development-Commands:**
```bash
# Datenbank-Tests
node server/test-db-connection.js
node server/show-tables.js

# Development-Server
npm run dev          # mit nodemon
npm start           # normal

# Logs anzeigen
tail -f server/combined.log

# Datenbank-Zugriff
mysql -u assixx_user -p assixx_db
```

## 🗄️ Production File Storage (TODO für später)
**WICHTIG**: Aktuell werden Fotos lokal in `server/uploads/` gespeichert - für Production muss das geändert werden!

**Empfohlene Lösung: AWS S3**
- Tenant-basierte Ordnerstruktur: `bucket/tenantId/kvp/filename`
- Kosten: ~€0.023/GB/Monat + Transfer
- Integration: AWS SDK for Node.js
- Code-Änderungen: `/server/routes/kvp.js` und `/server/models/kvp.js`

**Alternative Optionen:**
- Google Cloud Storage (~€0.020/GB/Monat)
- Cloudinary für Image-Management (~€0.0018/Image)

**Betrifft Module:**
- KVP-System (Verbesserungsvorschläge mit Fotos)
- Dokumenten-Management (bereits implementiert)
- Profil-Bilder (bereits implementiert)
- Zukünftige Features mit File-Uploads
