# 🏭 Assixx - Multi-Tenant SaaS Platform für Industrieunternehmen

[![Version](https://img.shields.io/badge/Version-2025.1-blue.svg)](https://github.com/SCS-Technik/Assixx)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-green.svg)](https://github.com/SCS-Technik/Assixx)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](./LICENSE)

## 🎯 Projektbeschreibung

**Assixx** ist eine hochmoderne Multi-Tenant SaaS-Plattform für Industrieunternehmen, die speziell für die Bedürfnisse der modernen Fertigungsbranche entwickelt wurde. Das System revolutioniert die Kommunikation und Verwaltung zwischen Produktionsarbeitern, Administration und Management durch intelligente Technologie-Integration.

## 🚀 Vision

Assixx etabliert sich als **führende SaaS-Lösung** für Industrieunternehmen mit modularen, skalierbaren Features. Unternehmen zahlen nur für die Funktionen, die sie benötigen - von grundlegender Mitarbeiterverwaltung bis hin zu fortgeschrittenen Automatisierungslösungen.

## ⚡ Schnellstart für Entwickler

**Neu hier? Hier ist der schnellste Weg:**

```bash
# 🔧 Automatisches Setup (WSL Ubuntu)
git clone [YOUR-REPO] Assixx && cd Assixx
chmod +x setup-wsl-ubuntu.sh && ./setup-wsl-ubuntu.sh

# 🪟 Automatisches Setup (Windows)
# PowerShell als Administrator: .\setup-windows.ps1

# 🌐 Anwendung aufrufen
# http://localhost:3000/signup.html
```

**📋 Vollständige Anleitung:** [DATABASE-SETUP-README.md](./DATABASE-SETUP-README.md)

## 🏢 Kernfunktionen (Stand 2025)

### ✅ **Vollständig implementiert:**
- 👥 **Multi-Tenant-Verwaltung** - Sichere Mandantentrennung mit Self-Service Registration
- 📋 **Mitarbeiterverwaltung** - Komplettes HR-System mit Abteilungen und Teams
- 📄 **Dokumentenmanagement** - Sichere Dokumentenverwaltung mit Kategorisierung
- 📢 **Schwarzes Brett** - Ankündigungen mit Prioritäten, Tags und Lesebestätigungen
- 📅 **Kalender-System** - Firmen-, Abteilungs- und Team-Events mit Teilnehmerverwaltung
- 💡 **KVP-System** - Kontinuierlicher Verbesserungsprozess mit Bewertungen und Belohnungen
- 💬 **Chat-System** - Echtzeit-Kommunikation mit WebSocket, Emoji-Picker und Nachrichtensuche
- ⏰ **Schichtplanung** - Erweiterte Personalplanung mit Templates und Tauschbörse
- 🔐 **Feature-Management** - Modulare Aktivierung/Deaktivierung von Features pro Tenant
- 📊 **Admin-Dashboard** - Umfassende Verwaltungstools mit Glassmorphismus-Design
- 🎨 **Modernes UI/UX** - Einheitliches Glassmorphismus-Design mit kompaktem Header-Layout

### 🎯 **Zielgruppen:**

| Rolle | Beschreibung | Hauptfunktionen |
|-------|-------------|-----------------|
| 🏭 **Produktionsarbeiter** | Mobile-First Design | Dokumente einsehen, Chat, KVP-Vorschläge, Schichtpläne |
| 👨‍💼 **Administratoren** | Web-Dashboard | Mitarbeiterverwaltung, Dokumentenupload, Ankündigungen |
| 🔧 **Maintenance-Team** | Problem-Response | Sofortige Benachrichtigungen, Ticketverwaltung |
| 📈 **Management** | Strategische Übersicht | Auswertungen, Berichte, Feature-Management |

## 💰 SaaS-Preismodell (Feature-basiert)

### 🆓 **Basic Plan** (€0/Monat)
| Feature | Beschreibung |
|---------|-------------|
| 👥 Mitarbeiterverwaltung | Bis zu 10 Mitarbeiter |
| 📄 Dokumenten-Upload | Basis-Funktionalität |
| 💼 Lohnabrechnungen | Sichere Verwaltung |
| 📢 Schwarzes Brett | Grundlegende Ankündigungen |
| 📅 Kalender | Firmen-Events |

### ⭐ **Premium Plan** (€49/Monat)
| Feature | Beschreibung |
|---------|-------------|
| ∞ Unbegrenzte Mitarbeiter | Keine Limits |
| 📧 E-Mail-Benachrichtigungen | 1.000/Monat |
| 💡 KVP-System | Verbesserungsprozess |
| 💬 Chat-System | Interne Kommunikation |
| ⏰ Schichtplanung | Erweiterte Personalplanung |
| 📊 Erweiterte Berichte | Detaillierte Analytics |
| 🔍 Audit Logs | Vollständige Nachverfolgung |

### 🚀 **Enterprise Plan** (€149/Monat)
| Feature | Beschreibung |
|---------|-------------|
| 🔌 API-Zugang | REST API für Integrationen |
| 🎨 Custom Branding | Eigenes Logo und Farben |
| 🆘 Priority Support | 24/7 Support mit SLA |
| 🤖 Automatisierung | Workflows und Imports |
| 🏢 Multi-Mandanten | Mehrere Unternehmen verwalten |
| 📧 Unlimited E-Mails | Keine Begrenzung |

## Prioritäten für die nächsten Entwicklungsphasen

### Priorität 1: Kritische Funktionen
1. **Dokumenten-Download** ✅
   - ✅ Download-Route implementiert
   - ✅ Berechtigungsprüfung
   - ✅ Stream für große Dateien
   - ✅ Download-Counter
   - ✅ Fehlerbehebung bei Dokumenten-Download

2. **E-Mail-Benachrichtigungen** ✅
   - ✅ Nodemailer Integration
   - ✅ Templates für verschiedene Events (Willkommen, Neue Dokumente, Allgemein)
   - ✅ Queue für Massen-E-Mails mit Batch-Verarbeitung
   - ✅ Unsubscribe-Funktion mit Token-basierter Verifizierung
   - ✅ Automatische Benachrichtigungen bei neuen Dokumenten

3. **Blackboard-System** ✅
   - ✅ Frontend-Implementierung mit Dashboard-Design und Glassmorphismus
   - ✅ Backend-API für Verwaltung der Einträge
   - ✅ Datenbankschema und Migrationen
   - ✅ Lesebestätigungsfunktion für wichtige Mitteilungen
   - ✅ Priorisierungssystem für Ankündigungen (Niedrig, Normal, Hoch, Kritisch)
   - ✅ Farb- und Tag-System für bessere Kategorisierung
   - ✅ Erweiterte Filter-Funktionen (Priorität, Tags, Farben, Organisationsebene)

4. **Firmenkalender** ✅
   - ✅ Zentraler Firmenkalender für allgemeine Events
   - ✅ Abteilungsspezifische Kalender für interne Meetings
   - ✅ Integration mit Dashboard und Navigation
   - ✅ Erinnerungsfunktion für wichtige Termine
   - ✅ Benutzerdefinierte Farbauswahl für Kalendereinträge
   - ✅ Event-Bearbeitung mit vollständiger Formular-Validierung
   - ✅ FullCalendar Integration mit Event-Display und Tooltips

5. **Schichtplanungs-Tool** ✅
   - ✅ Interaktiver Schichtplaner mit Drag & Drop für Team- und Abteilungsleiter
   - ✅ Wöchentliche Schichtplanansicht mit Navigation zwischen Kalenderwochen
   - ✅ Validierung verhindert Doppelzuweisungen am selben Tag
   - ✅ Multi-Tenant Support mit vollständiger Datenbankintegration
   - ✅ Glassmorphismus-Design im Dashboard-Stil
   - ✅ Auto-Save Funktionalität für Wochennotizen
   - ✅ API-Endpunkte für Schichten, Maschinen und Bereiche
   - [ ] Mitarbeiter-Tauschbörse für Schichten
   - [ ] Benachrichtigungen über Schichtänderungen
   - [ ] Überstunden- und Fehlzeitenerfassung

6. **KVP-System** ✅
   - ✅ Kontinuierlicher Verbesserungsprozess mit vollständiger CRUD-Funktionalität
   - ✅ Kategorisierte Vorschläge mit Prioritätssystem (niedrig, normal, hoch, kritisch)
   - ✅ File-Upload System mit Bildvorschau und sicherem Download
   - ✅ Status-Management mit 7 verschiedenen Status und farbiger Visualisierung
   - ✅ Employee-Berechtigungen: Eigene Vorschläge erstellen, bearbeiten und löschen
   - ✅ Admin-Berechtigungen: Status ändern, archivieren, alle Vorschläge verwalten
   - ✅ Modal-System mit Vollbild-Bildansicht und Attachment-Download
   - ✅ Status-Historie-Tracking für Audit-Trail
   - ✅ Points-System für Gamification (Grundstruktur implementiert)
   - ✅ Ultra-modernes Glassmorphismus-Design mit Gradient-Status-Badges
   - ✅ Multi-Tenant Support mit vollständiger Datenbankintegration (7 Tabellen)
   - ✅ Responsive Design für Desktop und Mobile

7. **Chat-Funktion** 💬 ✅
   - ✅ WebSocket-basierte Echtzeit-Kommunikation implementiert
   - ✅ Grundlegende Chat-UI mit Glassmorphismus-Design
   - ✅ Unterhaltungs-Management (Erstellen, Anzeigen, Wechseln, Löschen)
   - ✅ Nachrichten senden und empfangen in Echtzeit
   - ✅ Multi-User Unterhaltungen (Gruppenchats)
   - ✅ Zeitgesteuerte Nachrichtenzustellung (Pause/Nach Feierabend)
   - ✅ Typing-Indikator mit animierten Punkten
   - ✅ Online-Status-Anzeige
   - ✅ Navigation in Employee Dashboard integriert
   - ✅ Nachrichten löschen/archivieren
   - ✅ Dateianhänge und Bildversand
   - ✅ Nachrichtensuche mit Live-Filter
   - ✅ Emoji-Picker mit 8 Kategorien
   - ✅ Verbesserte Mobile Responsiveness
   - [ ] Push-Benachrichtigungen
   - [ ] Lesebestätigungen (Backend fertig, Frontend-Anzeige fehlt)
   - [ ] Nachrichtenreaktionen
   - [ ] Verschlüsselte Nachrichten

### Priorität 2: Wichtige Funktionen
1. **Umfrage-Tool** 📊
   - [ ] Erstellung von Multiple-Choice-Umfragen
   - [ ] Verpflichtende Umfragen für Mitarbeiter
   - [ ] Automatische Auswertung und Visualisierung
   - [ ] Anonyme Umfragen für sensible Themen

2. **Urlaubsantrag-System** 🏖️
   - [ ] Digitale Urlaubsanträge von Mitarbeitern
   - [ ] Übersicht über verfügbare Urlaubstage
   - [ ] Genehmigungsprozess mit Benachrichtigungen
   - [ ] Kalenderverfügbarkeit zur Vermeidung von Engpässen

3. **Lohnabrechnungs-Erweiterungen** 📑
   - [ ] Sichere Datei-Uploads mit Verschlüsselung
   - [ ] Automatische Kategorisierung
   - [ ] Versionskontrolle für Dokumente
   - [ ] Massenupload-Funktion
   - [ ] Automatische Benachrichtigungen bei neuen Dokumenten

4. **TPM-Kalender** 🔧
   - [ ] Terminplanung für Maschinenwartungen
   - [ ] Wiederkehrende Wartungsintervalle
   - [ ] Zuständigkeitsverwaltung für Maintenance-Teams
   - [ ] Dokumentation durchgeführter Wartungen

### Priorität 3: Zusätzliche Features
1. **Qualitätssicherungs-Checklisten** ✓
   - [ ] Digitale Checklisten für Qualitätskontrollen
   - [ ] Fotodokumentation von Qualitätsmängeln
   - [ ] Automatische Benachrichtigung bei Abweichungen
   - [ ] Trendanalyse von Qualitätsproblemen

2. **Mehrsprachige Unterstützung** 🌐
   - [ ] Grundlegende Mehrsprachigkeit (DE, EN)
   - [ ] Erweiterung um weitere Sprachen (PL, TR)
   - [ ] Sprachauswahl im Benutzerprofil
   - [ ] Automatische Spracherkennung

3. **Erweiterte Benachrichtigungen** 🔔
   - [ ] E-Mail-Templates anpassbar
   - [ ] SMS-Benachrichtigungen (optional)
   - [ ] In-App Push-Notifications
   - [ ] Benachrichtigungs-Center
   - [ ] Eskalationsregeln

4. **Erweiterte Benutzerverwaltung** 👥
   - [ ] Single Sign-On (SSO)
   - [ ] Active Directory Integration
   - [ ] Detaillierte Audit-Trails
   - [ ] Session-Management
   - [ ] IP-Whitelisting

## Technische Roadmap

### Q1 2025
- [ ] Schichtplanungs-Tool
- [ ] KVP-System
- [ ] Chat-Funktion
- [ ] Umfrage-Tool

### Q2 2025
- [ ] Urlaubsantrag-System
- [ ] Lohnabrechnungs-Erweiterungen
- [ ] TPM-Kalender
- [ ] Qualitätssicherungs-Checklisten

### Q3 2025
- [ ] Mehrsprachige Unterstützung
- [ ] Erweiterte Benachrichtigungen
- [ ] Erweiterte Benutzerverwaltung
- [ ] Mobile PWA

### Q4 2025
- [ ] Reporting & Analytics
- [ ] Skill-Matrix/Qualifikationsmanagement
- [ ] Stripe Integration
- [ ] Automatisierung

## Gesamte Entwicklungsphasen im Überblick

### Phase 1: Aktuelle Basis
- ✅ Benutzerverwaltung (Root, Admin, Mitarbeiter)
- ✅ Basis-Dokumentenupload
- 🔄 Erweiterte Dokumentenfunktionen
  - 🔄 Download mit Streaming-Unterstützung
  - 🔄 Download-Counter und Statistiken
  - 🔄 Berechtigungsprüfung optimieren
- ✅ JWT-basierte Authentifizierung
  - ✅ Token-Debugging und Validierung
  - ✅ Vereinheitlichte Auth-Implementierung
- ✅ Basis-Dashboard
  - ✅ Admin-Dashboard mit Navigation
  - ✅ Interaktive Mitarbeiter-, Abteilungs- und Dokumentenverwaltung
- ✅ CSRF-Schutz und Sicherheitsverbesserungen

### Phase 2: Kommunikations-Features (VOLLSTÄNDIG ✅)
- ✅ E-Mail-Benachrichtigungen
  - ✅ Nodemailer Integration
  - ✅ Templates für verschiedene Events
  - ✅ Queue-System für Massen-E-Mails
  - ✅ Unsubscribe-Funktionalität
- ✅ Blackboard-System (Ankündigungen)
  - ✅ Farb- und Tag-System für Kategorisierung
  - ✅ Priorisierung (Niedrig bis Kritisch)
  - ✅ Lesebestätigungen für wichtige Mitteilungen
  - ✅ Glassmorphismus-Design mit modernen Filtern
- ✅ Kalender-System
  - ✅ Firmentermine für alle Organisationsebenen
  - ✅ Benutzerdefinierte Farbauswahl für Events
  - ✅ FullCalendar-Integration mit interaktiven Features
  - ✅ Event-Management mit vollständiger CRUD-Funktionalität
  - ✅ Queue für Massen-E-Mails
  - ✅ Feature-basierte Verfügbarkeit (Premium/Enterprise)
  - ✅ Unsubscribe-Funktion
- [ ] Ankündigungssystem
- [ ] Umfragemodul mit Auswertungen
- [ ] Verbesserungsvorschläge-Portal

### Phase 3: Mobile-First Optimierung
- 🔄 Progressive Web App (PWA) Implementierung
  - Service Worker
  - Offline-Funktionalität
  - Push-Notifications
  - App-Icon und Manifest
- [ ] Responsive Design für alle Bildschirmgrößen
- [ ] Touch-optimierte UI-Elemente

### Phase 4: Fehlermeldesystem
- [ ] Foto-Upload von Mobilgeräten
- [ ] Ticketsystem für Problemmeldungen
- [ ] Push-Benachrichtigungen an Maintenance
- [ ] Status-Tracking für gemeldete Probleme

### Phase 5: SaaS-Monetarisierung
- ✅ Feature-basierte Preispläne (Basic, Premium, Enterprise)
- ✅ Feature-Toggle-System
- ✅ Usage-Tracking für Features
- 🔄 Stripe Integration
  - Automatische Abrechnung
  - Webhook Handler
  - Automatische Feature-Aktivierung nach Zahlung
- 🔄 Customer Portal
  - Subscription Management
  - Feature-Übersicht
  - Billing Dashboard
- [ ] Trial-Perioden-Management
- [ ] Nutzungsbasierte Abrechnung

### Phase 6: Multi-Tenant-Architektur
- ✅ Subdomain-basierte Mandantentrennung
- ✅ Feature-Management-System
- ✅ Modulare Feature-Aktivierung pro Kunde
- [ ] Automatisiertes Onboarding neuer Firmen
- [ ] White-Label-Branding pro Firma
- [ ] Separate Datenbanken pro Mandant (derzeit gemeinsame DB)
- [ ] Docker-Container-Deployment

### Phase 7: Erweiterte Features
- [ ] Mehrsprachige Unterstützung
- [ ] QR-Code oder PIN-basierte Anmeldung
- [ ] Automatische Berichte und Auswertungen
- [ ] Integration mit bestehenden Firmensystemen
- 🔄 Erweiterte Sicherheitsfunktionen
  - [ ] 2FA Implementation
  - [ ] DSGVO-konforme Verschlüsselung
  - [ ] Erweiterte Audit Logs

## Aktueller Fokus: Schichtplanungs-Tool & KVP-System
Der aktuelle Entwicklungsfokus liegt auf zwei Hauptbereichen:

1. **Schichtplanungs-Tool**:
   - Interaktiver Schichtplaner für Team- und Abteilungsleiter
   - Automatische Schichtplanerstellung basierend auf Verfügbarkeiten
   - Mitarbeiter-Tauschbörse für Schichten
   - Benachrichtigungen über Schichtänderungen
   - Überstunden- und Fehlzeitenerfassung

2. **KVP-System (Kontinuierlicher Verbesserungsprozess)**:
   - Foto-Upload für Verbesserungsvorschläge oder Problemmeldungen
   - Verfolgung des Status von eingereichten Vorschlägen
   - Bewertungssystem für Vorschläge
   - Belohnungssystem für umgesetzte Ideen
   - Auswertung und Reporting über eingereichte KVPs

## KPIs und Erfolgsmessung

### Business KPIs
- Anzahl aktiver Kunden
- Monthly Recurring Revenue (MRR)
- Customer Acquisition Cost (CAC)
- Customer Lifetime Value (CLV)
- Churn Rate

### Technische KPIs
- Uptime (Ziel: 99.9%)
- Response Time (< 200ms)
- Error Rate (< 0.1%)
- Feature Adoption Rate
- Customer Satisfaction Score

## 🏗️ Architektur & Technologie

### 🔧 **Tech-Stack:**
```
Frontend:    HTML5, CSS3, JavaScript (Vanilla), Bootstrap 5
Backend:     Node.js, Express.js, WebSocket
Database:    MySQL 8.0+ mit Multi-Tenant-Isolation
Auth:        JWT mit Tenant-spezifischen Claims
Real-time:   WebSocket für Chat und Benachrichtigungen
Design:      Glassmorphismus mit responsivem Layout
UI/UX:       Kompaktes Header-Design, transparente User-Info
Icons:       Font Awesome 6 für einheitliche Iconographie
```

### 🗄️ **Datenbankschema:**
- **39 Haupttabellen** in 10 funktionalen Kategorien
- **Multi-Tenant-Isolation** mit tenant_id in allen Tabellen
- **Automatische Triggers** für Tenant-Zuordnung
- **Optimierte Views** für häufige Abfragen
- **Feature-Toggle-System** für modulare Aktivierung

### 🔐 **Sicherheit:**
- **Tenant-Isolation:** Vollständige Datentrennung zwischen Unternehmen
- **JWT-Authentication:** Sichere, zustandslose Authentifizierung
- **Role-based Access:** Root → Admin → Employee Hierarchie
- **Input-Validation:** Schutz vor SQL-Injection und XSS
- **Rate-Limiting:** DoS-Schutz auf API-Ebene

## 🚀 Installation & Setup

### ⚡ **Automatisierte Installation:**

**📋 Vollständige Anleitung:** [DATABASE-SETUP-README.md](./DATABASE-SETUP-README.md)

#### WSL Ubuntu:
```bash
git clone [YOUR-REPO] Assixx && cd Assixx
chmod +x setup-wsl-ubuntu.sh && ./setup-wsl-ubuntu.sh
```

#### Windows:
```powershell
# PowerShell als Administrator
git clone [YOUR-REPO] C:\Assixx && cd C:\Assixx
.\setup-windows.ps1
```

### 📋 **Systemvoraussetzungen:**

| Software | Version | Windows | Ubuntu |
|----------|---------|---------|--------|
| Node.js | 18.x+ | ✅ | ✅ |
| MySQL | 8.0+ | ✅ (XAMPP) | ✅ |
| Git | Latest | ✅ | ✅ |
| NPM | 9.x+ | ✅ | ✅ |

## 🚦 Erste Schritte

### 1️⃣ **Erstes Unternehmen erstellen**

**Wichtig:** Es gibt keinen hardcodierten Root-Benutzer mehr! 

```bash
# Anwendung starten
cd server && npm start

# Browser öffnen
http://localhost:3000/signup.html
```

### 2️⃣ **Multi-Tenant-Setup**

1. **Unternehmensdaten eingeben:**
   - Firmenname
   - Eindeutige Subdomain
   - E-Mail-Adresse
   - Admin-Benutzerdaten

2. **Automatische Erstellung:**
   - Tenant wird in `tenants`-Tabelle angelegt
   - Admin-Benutzer automatisch zugeordnet
   - Feature-Set basierend auf gewähltem Plan aktiviert

### 3️⃣ **System konfigurieren**

```bash
# Als Admin anmelden
http://localhost:3000/login.html

# Organisationsstruktur aufbauen:
# 1. Abteilungen erstellen
# 2. Teams innerhalb Abteilungen anlegen  
# 3. Mitarbeiter hinzufügen und zuordnen
# 4. Features nach Bedarf aktivieren
```

### 3. MySQL-Datenbank über XAMPP einrichten

1. Starten Sie XAMPP Control Panel (Suchen Sie nach "XAMPP Control Panel" im Windows-Startmenü)
2. Klicken Sie auf die "Start"-Buttons neben Apache und MySQL
3. Klicken Sie auf den "Admin"-Button neben MySQL oder öffnen Sie http://localhost/phpmyadmin im Browser
4. Erstellen Sie eine neue Datenbank:
   - Klicken Sie links auf "Neu"
   - Geben Sie als Datenbankname `lohnabrechnung` ein
   - Wählen Sie Collation: `utf8mb4_unicode_ci`
   - Klicken Sie auf "Erstellen"

5. Importieren Sie das Datenbankschema:
   - Wählen Sie die Datenbank `lohnabrechnung` in der linken Seitenleiste
   - Klicken Sie oben auf den Reiter "Importieren"
   - Klicken Sie auf "Durchsuchen" und wählen Sie die Datei `[Projektpfad]\server\database\schema.sql`
   - Klicken Sie auf "OK" oder "Importieren"

Falls die Datei `schema.sql` nicht im Repository vorhanden ist, erstellen Sie diese manuell:
- Öffnen Sie Notepad oder einen anderen Texteditor
- Fügen Sie folgenden SQL-Code ein:

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('root', 'admin', 'employee') NOT NULL,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  age INT,
  employee_id VARCHAR(50),
  iban VARCHAR(50),
  company VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_content LONGBLOB NOT NULL,
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

- Speichern Sie die Datei als `schema.sql` im Ordner `server\database`
- Importieren Sie sie wie oben beschrieben

### 4. Root-Benutzer mit gehashtem Passwort erstellen

Um ein korrekt gehashtes Passwort für den Root-Benutzer zu erstellen, folgen Sie diesen Schritten:

1. Erstellen Sie eine temporäre JavaScript-Datei für das Passwort-Hashing:
   - Öffnen Sie den Ordner `server` im Projektverzeichnis
   - Erstellen Sie eine neue Datei `hash_password.js` mit folgendem Inhalt:

```javascript
const bcrypt = require('bcrypt');

// Das Passwort, das Sie verwenden möchten
const password = 'root';

// Das Passwort hashen
bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Fehler beim Hashen des Passworts:', err);
    return;
  }
  
  console.log('Gehashtes Passwort:', hash);
  console.log('SQL-Statement für Root-Benutzer:');
  console.log(`INSERT INTO users (username, email, password, role) VALUES ('root', 'root@example.com', '${hash}', 'root');`);
});
```

2. Führen Sie das Skript aus, um den Hash zu generieren:
   - Öffnen Sie Command Prompt oder PowerShell im Verzeichnis `server`
   - Führen Sie aus:

```cmd
node hash_password.js
```

3. Kopieren Sie das generierte SQL-Statement aus der Konsole
4. Fügen Sie das SQL-Statement in phpMyAdmin ein:
   - Wählen Sie die Datenbank `lohnabrechnung`
   - Klicken Sie auf den Reiter "SQL"
   - Fügen Sie das kopierte SQL-Statement ein
   - Klicken Sie auf "OK" oder "Ausführen"

Das Statement sollte ähnlich wie folgendes aussehen:

```sql
INSERT INTO users (username, email, password, role) VALUES 
('root', 'root@example.com', '$2b$10$KbHQjW.ORFZvQmrR15T9.Op08o9SwAKUedMzpVhWsM3V5MNd9Dj/y', 'root');
```

### 5. Umgebungsvariablen konfigurieren

1. Erstellen Sie eine `.env`-Datei im `server`-Verzeichnis:
   - Öffnen Sie Notepad oder einen anderen Texteditor
   - Fügen Sie folgenden Inhalt ein:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=lohnabrechnung
JWT_SECRET=AssixxSecretKey2025
PORT=3000
NODE_ENV=development
```

2. Wichtige Anmerkungen:
   - Bei XAMPP ist standardmäßig kein Passwort für den MySQL-Benutzer `root` gesetzt
   - Falls Sie ein Passwort gesetzt haben, tragen Sie es bei `DB_PASSWORD=` ein
   - Ändern Sie unbedingt den Wert für `JWT_SECRET` in einen eigenen zufälligen String
   - Speichern Sie die Datei ohne Dateinamenerweiterung als `.env` (nicht als `.env.txt`)

Um sicherzustellen, dass die Datei korrekt gespeichert wurde:
- Öffnen Sie Command Prompt im `server`-Verzeichnis
- Führen Sie `dir /a` aus, um auch versteckte Dateien anzuzeigen
- Sie sollten eine Datei namens `.env` sehen

## Server starten unter Windows 11

1. Öffnen Sie Command Prompt oder PowerShell im `server`-Verzeichnis
2. Führen Sie folgenden Befehl aus:

```cmd
node server.js
```

3. Erfolgsmeldung überprüfen:
   - Die Konsole sollte eine Meldung anzeigen: `Server läuft auf Port 3000`
   - Falls Fehler auftreten, prüfen Sie:
     - Läuft MySQL über XAMPP?
     - Stimmen die Datenbank-Zugangsdaten in der .env-Datei?
     - Wurden alle Abhängigkeiten mit npm install installiert?

4. Öffnen Sie einen Webbrowser und navigieren Sie zu:
   ```
   http://localhost:3000
   ```

## Anmeldung und erste Schritte

1. Falls Apache im XAMPP Control Panel noch nicht läuft, starten Sie ihn
2. Öffnen Sie http://localhost:3000 im Browser
3. Melden Sie sich mit dem Root-Benutzer an:
   - Benutzername: `root`
   - Passwort: `root` (oder das Passwort, das Sie beim Hashen verwendet haben)

4. Im Root-Dashboard können Sie:
   - Die Systemübersicht einsehen
   - Administratoren erstellen (unter "Benutzer > Admin hinzufügen")
   - Systemeinstellungen verwalten

5. So erstellen Sie einen Administrator:
   - Klicken Sie auf "Benutzer" im Navigationsmenü
   - Klicken Sie auf "Admin hinzufügen"
   - Füllen Sie das Formular aus (Username, E-Mail, Passwort)
   - Klicken Sie auf "Erstellen"

6. Melden Sie sich ab und wieder als Administrator an:
   - Klicken Sie auf "Ausloggen" in der oberen rechten Ecke
   - Melden Sie sich mit den Zugangsdaten des erstellten Admins an

7. Als Administrator können Sie:
   - Mitarbeiter anlegen (unter "Mitarbeiter > Neu")
   - Dokumente für Mitarbeiter hochladen (unter "Dokumente > Upload")
   - Abteilungen verwalten
   - Auf das Blackboard und den Kalender zugreifen

## Benutzerrollen und Berechtigungen

Das System verwendet vier Benutzerrollen:

1. **Root** - Systemadministrator:
   - Vollzugriff auf alle Funktionen
   - Verwaltung von Administratoren
   - Systemkonfiguration

2. **Admin** - Firmenadministrator:
   - Mitarbeiterverwaltung
   - Dokumentenupload und -verwaltung
   - Ankündigungen und Kalender pflegen
   - Umfragen erstellen und auswerten

3. **Maintenance** - Wartungspersonal:
   - Empfang von Fehlermeldungen
   - Ticketverwaltung
   - Statusupdates zu Problemen

4. **Mitarbeiter** - Produktionsarbeiter:
   - Dokumente einsehen und herunterladen
   - Fehler mit Fotos melden
   - An Umfragen teilnehmen
   - Verbesserungsvorschläge einreichen
   - Firmenkalender und Ankündigungen ansehen

## Fehlerbehebung unter Windows 11

### Probleme mit der Datenbank

- **MySQL startet nicht**: 
  - Überprüfen Sie im XAMPP Control Panel, dass MySQL erfolgreich startet
  - Falls MySQL mit einer Fehlermeldung abbricht, prüfen Sie die Logs unter `C:\xampp\mysql\data\mysql_error.log`
  - Bei Port-Konflikten: Stellen Sie sicher, dass kein anderer Dienst Port 3306 belegt

- **Verbindungsfehler zur Datenbank**:
  - Öffnen Sie die `.env`-Datei und prüfen Sie die Zugangsdaten:
    ```
    DB_HOST=localhost
    DB_USER=root
    DB_PASSWORD=  (leerer String bei XAMPP-Standardinstallation)
    DB_NAME=lohnabrechnung
    ```
  - Testen Sie die Datenbankverbindung mit folgendem Befehl im `server`-Verzeichnis:
    ```cmd
    node -e "const mysql = require('mysql2'); const conn = mysql.createConnection({host: 'localhost', user: 'root', password: '', database: 'lohnabrechnung'}); conn.connect(err => { if(err) { console.error('Verbindungsfehler:', err); } else { console.log('Verbindung erfolgreich!'); conn.end(); }})"
    ```

- **Tabellen fehlen oder sind falsch**:
  - Überprüfen Sie in phpMyAdmin, ob die Datenbank `lohnabrechnung` existiert
  - Prüfen Sie, ob alle Tabellen vorhanden sind (mindestens `users` und `documents`)
  - Importieren Sie `schema.sql` erneut, falls nötig

### Authentifizierungsprobleme

- **Login funktioniert nicht**:
  - Überprüfen Sie in phpMyAdmin, ob der Root-Benutzer korrekt erstellt wurde:
    ```sql
    SELECT * FROM users WHERE username = 'root';
    ```
  - Stellen Sie sicher, dass in der `.env`-Datei ein gültiges JWT_SECRET gesetzt ist
  - Falls nötig, erstellen Sie den Root-Benutzer neu mit gehashtem Passwort wie oben beschrieben

- **Token-Fehler**:
  - Löschen Sie Browser-Cookies und starten Sie den Server neu
  - Prüfen Sie, ob das JWT_SECRET in der `.env`-Datei keine Leerzeichen enthält

### Probleme beim Starten des Servers

- **"Port already in use" Fehler**:
  - Ein anderer Prozess verwendet bereits Port 3000
  - Finden Sie den blockierenden Prozess:
    ```cmd
    netstat -ano | findstr :3000
    ```
  - Beenden Sie den blockierenden Prozess:
    ```cmd
    taskkill /PID [PID] /F
    ```
  - Alternativ: Ändern Sie den Port in der `.env`-Datei:
    ```
    PORT=3001
    ```

- **"Module not found" Fehler**:
  - Stellen Sie sicher, dass alle Abhängigkeiten installiert sind:
    ```cmd
    npm install
    ```
  - Bei Problemen versuchen Sie die Installation mit:
    ```cmd
    npm install --force
    ```

- **Allgemeine Server-Fehler**:
  - Überprüfen Sie die Konsole auf genaue Fehlermeldungen
  - Starten Sie den Server im Debug-Modus:
    ```cmd
    set DEBUG=* & node server.js
    ```

### Windows-spezifische Probleme

- **Datei .env wird nicht erkannt**:
  - Windows versteckt Dateien, die mit einem Punkt beginnen
  - Stellen Sie sicher, dass die Datei ohne Erweiterung gespeichert wurde
  - Überprüfen Sie mit `dir /a` im Command Prompt, ob die Datei vorhanden ist
  - Wenn Sie die Datei in Notepad erstellen, setzen Sie den Dateinamen in Anführungszeichen: `".env"`

- **Pfad-Probleme**:
  - Windows verwendet Backslashes (`\`) in Pfaden, Node.js erwartet oft Forward-Slashes (`/`)
  - Verwenden Sie `path.join()` in Ihrem Code für pfadübergreifende Kompatibilität
  - Falls nötig, passen Sie absolute Pfade in der Konfiguration an

## 🗂️ Projekt-Struktur

```
Assixx/
├── 📄 database-setup.sql              # Komplettes DB-Schema (39 Tabellen)
├── 🔧 setup-wsl-ubuntu.sh            # Automatisches WSL Setup
├── 🔧 setup-windows.ps1              # Automatisches Windows Setup  
├── 📖 DATABASE-SETUP-README.md       # Vollständige Setup-Anleitung
├── 📋 README.md                      # Projekt-Übersicht (diese Datei)
├── 📚 CLAUDE.md                      # Entwickler-Dokumentation
└── server/
    ├── 🔑 .env                       # Umgebungsvariablen (zu erstellen)
    ├── 📦 package.json               # NPM-Abhängigkeiten
    ├── 🚀 index.js                   # Hauptserver-Datei
    ├── 🗄️ database.js                # DB-Verbindung & Konfiguration
    ├── 📁 models/                    # Datenmodelle (User, Document, etc.)
    ├── 🛣️ routes/                     # API-Endpunkte
    ├── 🛡️ middleware/                # Express-Middleware (Auth, Security)
    ├── 🌐 public/                    # Frontend-Dateien (HTML, CSS, JS)
    ├── 📤 uploads/                   # Hochgeladene Dateien
    └── 🔧 utils/                     # Hilfsfunktionen (Logger, E-Mail)
```

## 📊 Entwicklungsstand

### ✅ **Abgeschlossen (100%):**
- Multi-Tenant-Architektur mit Self-Service Registration
- Komplettes Benutzer-Management (Root/Admin/Employee)
- Sichere Dokumentenverwaltung mit Berechtigungssystem
- Schwarzes Brett mit Tags, Prioritäten und Lesebestätigungen
- Kalender-System mit Multi-Level-Organisationsebenen
- KVP-System mit Bewertungen und Belohnungssystem
- Chat-System mit Echtzeit-Kommunikation, Emoji-Picker und Nachrichtensuche
- Schichtplanung mit Templates und Tauschbörse
- Feature-Management-System mit modularer Aktivierung
- E-Mail-Benachrichtigungen mit Templates und Queue-System
- Einheitliches Glassmorphismus-Design mit kompaktem Header-Layout
- Root-User Profile und Features Pages mit Frontend-Management
- Optimierte Compact-Cards für Admin-Dashboard

### 🚧 **In Entwicklung:**
- Progressive Web App (PWA) für Mobile-First
- Push-Benachrichtigungen
- Stripe-Integration für automatische Abrechnung
- Erweiterte Analytics und Reporting

### 📋 **Geplant:**
- Mehrsprachige Unterstützung (DE/EN/PL/TR)
- Docker-Container-Deployment
- API-Dokumentation mit Swagger
- Automatisierte Tests (Unit & Integration)

## 🔍 Problembehandlung

### ❌ **Häufige Probleme:**

| Problem | Lösung |
|---------|--------|
| 🔴 MySQL-Verbindungsfehler | `sudo systemctl start mysql` (Ubuntu) / XAMPP starten (Windows) |
| 🔴 .env-Datei nicht gefunden | `cp server/.env.example server/.env` |
| 🔴 Port bereits belegt | `sudo lsof -i :3000` → Prozess beenden |
| 🔴 NPM-Fehler | `npm cache clean --force && npm install` |

**📋 Vollständige Problembehandlung:** [DATABASE-SETUP-README.md](./DATABASE-SETUP-README.md#-problembehandlung)

## 🚀 Roadmap 2025

### Q1 2025 ✅
- ✅ Schichtplanungs-Tool vollständig implementiert
- ✅ KVP-System mit Belohnungsmechanismus
- ✅ Chat-System mit Echtzeit-Features
- ✅ Multi-Tenant Self-Service Registration

### Q2 2025 🎯
- 📱 Progressive Web App (PWA)
- 💳 Stripe-Integration für automatische Abrechnung
- 📊 Erweiterte Analytics und Reporting
- 🌐 Mehrsprachige Unterstützung (DE/EN)

### Q3 2025 📈
- 🏖️ Urlaubsantrag-System
- 🔧 TPM-Kalender für Maschinenwartung
- ✓ Qualitätssicherungs-Checklisten
- 🔔 Push-Benachrichtigungen

### Q4 2025 🚀
- 🤖 Automatisierung und Workflows
- 📈 Business Intelligence Dashboard
- 🎓 Skill-Matrix und Qualifikationsmanagement
- 🐳 Docker-Container-Deployment

## 📈 Business-Metriken

### 🎯 **KPIs:**
- **Uptime-Ziel:** 99.9%
- **Response-Time:** < 200ms
- **Error-Rate:** < 0.1%
- **Customer Satisfaction:** > 4.5/5

### 💰 **Revenue-Ziele 2025:**
- Q1: €5K MRR (Monthly Recurring Revenue)
- Q2: €15K MRR
- Q3: €35K MRR
- Q4: €50K MRR

## 🤝 Beitragen & Support

### 📞 **Support:**
- 📧 E-Mail: info@scs-technik.de
- 📋 Issues: [GitHub Issues](./issues)
- 📖 Dokumentation: [CLAUDE.md](./CLAUDE.md)

### 🔧 **Entwickler-Tools:**
```bash
npm run lint      # Code-Qualität prüfen
npm test          # Tests ausführen  
npm run format    # Code formatieren
npm run build     # Produktions-Build
```

## Lizenz und Urheberrecht

© 2024-2025 Simon Öztürk / SCS-Technik. Alle Rechte vorbehalten.

Dieses Projekt ist proprietär und vertraulich. Jede unautorisierte Nutzung, Vervielfältigung, Modifikation, Verteilung oder Anzeige dieses Quellcodes, ganz oder teilweise, ist strengstens untersagt.

Die Nutzung dieser Software ist nur nach ausdrücklicher schriftlicher Genehmigung durch den Urheberrechtsinhaber zulässig. Für Lizenzvereinbarungen oder Fragen wenden Sie sich bitte an info@scs-technik.de.

Dieses Projekt enthält möglicherweise Geschäftsgeheimnisse. Unbefugter Zugriff, Nutzung oder Offenlegung kann zu rechtlichen Konsequenzen führen.