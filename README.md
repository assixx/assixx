# Assixx - Firmenkommunikations- und Verwaltungssystem

## Projektbeschreibung

Assixx ist eine umfassende Kommunikations- und Verwaltungslösung für Industriefirmen, speziell entwickelt für Produktionsarbeiter ohne PC-Zugang. Das System verbessert die Kommunikation zwischen Arbeitern, Administration und Management durch mobile Technologie.

## Vision
Assixx wird eine vollständige SaaS-Plattform für Industriefirmen, die modular erweiterbare Features anbietet und Kunden ermöglicht, nur für die Funktionen zu bezahlen, die sie tatsächlich benötigen.

### Hauptfunktionen:

- **Fehlermeldesystem**: Arbeiter können Fotos von Problemen machen und direkt melden
- **Dokumentenverwaltung**: Digitale Verwaltung von Lohnabrechnungen, Krankmeldungen und Bescheinigungen
- **Firmenkommunikation**: Kalender, Ankündigungen und Umfragen
- **Verbesserungsvorschläge**: Mitarbeiter können Ideen einreichen und diskutieren
- **Echtzeit-Benachrichtigungen**: Wichtige Meldungen erreichen sofort die richtigen Personen

### Zielgruppen:

- **Produktionsarbeiter**: Mobile App für einfachen Zugang zu Firmeninformationen
- **Administratoren**: Web-Dashboard für Dokumentenverwaltung und Kommunikation
- **Maintenance-Team**: Sofortige Benachrichtigungen bei gemeldeten Problemen
- **Management**: Auswertungen und Berichte für bessere Entscheidungen

## Feature-Management-System (bereits implementiert)

### Basis-Features (€0/Monat)
- ✅ Mitarbeiterverwaltung (bis 10 Mitarbeiter)
- ✅ Basis-Dokumentenupload
- ✅ Lohnabrechnungsverwaltung

### Premium-Features (€49/Monat)
- ✅ Unbegrenzte Mitarbeiter
- ✅ E-Mail-Benachrichtigungen (bis 1000/Monat)
- ✅ Erweiterte Berichte
- ✅ Audit Logs

### Enterprise-Features (€149/Monat)
- ✅ API-Zugang
- ✅ Custom Branding
- ✅ Priority Support
- ✅ Automatisierung
- ✅ Multi-Mandanten-Verwaltung
- ✅ Unbegrenzte E-Mail-Benachrichtigungen

## Prioritäten für die nächsten Entwicklungsphasen

### Priorität 1: Kritische Funktionen
1. **Dokumenten-Download** ✅
   - ✅ Download-Route implementiert
   - ✅ Berechtigungsprüfung
   - ✅ Stream für große Dateien
   - ✅ Download-Counter
   - 🔄 Fehlerbehebung bei Dokumenten-Download

2. **E-Mail-Benachrichtigungen** 📧
   - Nodemailer Integration
   - Templates für verschiedene Events
   - Queue für Massen-Mails
   - Unsubscribe-Funktion

3. **Mobile PWA** 📱
   - Service Worker
   - Offline-Funktionalität
   - Push-Notifications
   - App-Icon und Manifest

### Priorität 2: Wichtige Funktionen
1. **Stripe Integration** 💳
   - Payment Routes erstellen
   - Webhook Handler
   - Automatische Feature-Aktivierung nach Zahlung

2. **Lohnabrechnungs-Upload & Verwaltung** 
   - [ ] Sichere Datei-Uploads mit Verschlüsselung
   - [ ] Automatische Kategorisierung
   - [ ] Versionskontrolle für Dokumente
   - [ ] Massenupload-Funktion
   - [ ] Automatische Benachrichtigungen bei neuen Dokumenten

3. **Customer Portal**
   - Subscription Management 
   - Feature-Übersicht
   - Rechnungshistorie
   - Billing Dashboard

4. **Benachrichtigungssystem**
   - [ ] E-Mail-Templates anpassbar
   - [ ] SMS-Benachrichtigungen (optional)
   - [ ] In-App Push-Notifications
   - [ ] Benachrichtigungs-Center
   - [ ] Eskalationsregeln

### Priorität 3: Zusätzliche Features
1. **Reporting & Analytics**
   - Dashboard mit KPIs
   - Export-Funktionen
   - Automatische Reports

2. **Sicherheit & Datenschutz**
   - [ ] End-to-End-Verschlüsselung für Dokumente
   - [ ] 2-Faktor-Authentifizierung
   - [ ] DSGVO-konforme Datenverarbeitung
   - [ ] Automatisches Löschen alter Dokumente
   - [ ] Zugriffskontrolle mit detaillierten Rechten

3. **UI/UX Polish**
   - Dark Mode
   - Keyboard Shortcuts
   - Performance-Optimierung

## Technische Roadmap

### Q1 2025
- [ ] Stripe Integration
- [ ] Mobile PWA
- [ ] 2FA Implementation
- [ ] Automatische Backups

### Q2 2025
- [ ] Docker-Deployment
- [ ] Kubernetes-Orchestrierung
- [ ] CI/CD Pipeline
- [ ] Monitoring & Alerting

### Q3 2025
- [ ] Mobile Apps (iOS/Android)
- [ ] API v2 mit GraphQL
- [ ] Mehrsprachigkeit (EN, TR, PL)
- [ ] Advanced Analytics

### Q4 2025
- [ ] AI-Features (Dokumentenklassifizierung)
- [ ] Voice-Integration
- [ ] Blockchain für Audit-Trail
- [ ] IoT-Integration für Industrie 4.0

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

### Phase 2: Kommunikations-Features
- 🔄 E-Mail-Benachrichtigungen
  - Nodemailer Integration
  - Templates für verschiedene Events
  - Queue für Massen-Mails
  - Unsubscribe-Funktion
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

## Aktueller Fokus: Dokumenten-Download-Feature
Der aktuelle Entwicklungsfokus liegt auf der Vervollständigung des Dokumenten-Download-Features:
- Streaming-Unterstützung für große Dateien
- Tracking von Downloads mit Counter
- Optimierte Berechtigungsprüfung
- Verbessertes Frontend für Dokumente

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

## Systemvoraussetzungen

Bevor Sie beginnen, stellen Sie sicher, dass Sie folgende Software installiert haben:

- **Node.js** (Version 16 oder höher)
- **XAMPP** (oder eine andere MySQL-Datenbank)
- **Git** (optional, für das Klonen des Repositories)

## Installation

### 1. Repository klonen oder entpacken

```bash
git clone [repository-url]
cd neuer-projektordner
```

Oder entpacken Sie das Archiv in einen Ordner Ihrer Wahl.

### 2. Abhängigkeiten installieren

```bash
cd server
npm install
```

### 3. MySQL-Datenbank einrichten

1. Starten Sie XAMPP und aktivieren Sie den MySQL-Dienst
2. Öffnen Sie phpMyAdmin (http://localhost/phpmyadmin)
3. Erstellen Sie eine neue Datenbank mit dem Namen `lohnabrechnung` (oder einem Namen Ihrer Wahl)
4. Importieren Sie die Datenbankstruktur aus der Datei `database/schema.sql` (siehe unten)

#### Datenbankstruktur (schema.sql)

Erstellen Sie eine Datei `schema.sql` mit folgendem Inhalt und importieren Sie diese in Ihre Datenbank:

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

### 4. Root-Benutzer erstellen

Führen Sie das folgende SQL-Statement aus, um einen Root-Benutzer zu erstellen:

```sql
INSERT INTO users (username, email, password, role) VALUES 
('root', 'root@example.com', '$2b$10$KbHQjW.ORFZvQmrR15T9.Op08o9SwAKUedMzpVhWsM3V5MNd9Dj/y', 'root');
```

Das Passwort für diesen Benutzer ist `root`. Sie können es später im System ändern.

Alternativ können Sie folgendes Skript ausführen, um ein Root-Passwort zu generieren:

```bash
cd server
node hash_password.js
```

Verwenden Sie dann den generierten Hash im obigen SQL-Statement.

### 5. Umgebungsvariablen konfigurieren

Erstellen Sie eine `.env`-Datei im `server`-Verzeichnis mit folgendem Inhalt:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=lohnabrechnung
JWT_SECRET=IhrGeheimesTokenHier
```

Passen Sie die Datenbankverbindungsdaten entsprechend Ihrer Einrichtung an. Setzen Sie unbedingt ein sicheres, zufälliges JWT_SECRET!

## Server starten

```bash
cd server
node server.js
```

Der Server startet auf Port 3000. Sie können die Anwendung unter http://localhost:3000 aufrufen.

## Anmeldung und erste Schritte

1. Melden Sie sich mit dem Root-Benutzer an:
   - Benutzername: `root`
   - Passwort: `root`

2. Im Root-Dashboard können Sie Administratoren erstellen.

3. Melden Sie sich mit einem Administrator-Account an, um:
   - Mitarbeiter anzulegen
   - Dokumente für Mitarbeiter hochzuladen

4. Mitarbeiter können sich anmelden, um ihre Dokumente einzusehen und herunterzuladen.

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

## Fehlerbehebung

### Probleme mit der Datenbank

- Stellen Sie sicher, dass MySQL läuft
- Überprüfen Sie die Verbindungsdaten in der `.env`-Datei
- Prüfen Sie, ob die Datenbank und Tabellen korrekt erstellt wurden

### Authentifizierungsprobleme

- Der JWT_SECRET in der `.env`-Datei muss gesetzt sein
- Stellen Sie sicher, dass Root-Benutzer korrekt in der Datenbank existiert

### Probleme beim Starten des Servers

- Stellen Sie sicher, dass Port 3000 frei ist
- Überprüfen Sie, ob alle Abhängigkeiten installiert sind (`npm install`)
- Prüfen Sie die Server-Logs auf Fehlermeldungen

## Technologien

### Aktuell implementiert:
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Datenbank: MySQL
- Authentifizierung: JWT (JSON Web Tokens)
- Passwortverschlüsselung: bcrypt
- Multi-Tenant-Architektur
- Feature-Management-System
- Modulare Feature-Aktivierung

### Geplante Erweiterungen:
- Progressive Web App (PWA) für mobile Nutzung
- Push-Benachrichtigungen
- Bildupload und -verarbeitung
- WebSocket für Echtzeit-Updates
- Offline-Synchronisation
- Mehrsprachige Unterstützung
- Stripe/PayPal Integration
- Automatische Abrechnung

## Sicherheitshinweise

- Ändern Sie das Standard-Root-Passwort nach der ersten Anmeldung
- Verwenden Sie ein sicheres JWT_SECRET
- Stellen Sie sicher, dass die Anwendung hinter einer Firewall läuft, wenn sie öffentlich zugänglich ist
- Führen Sie regelmäßige Backups der Datenbank durch

## Nächste Schritte

1. **Sofort**: Stripe Account einrichten
2. **Diese Woche**: Payment-Flow implementieren
3. **Dieser Monat**: Mobile Optimierung
4. **Dieses Quartal**: Erste zahlende Kunden

## Beitragen

Wir freuen uns über Beiträge! Bitte erstellen Sie einen Fork des Repositories und senden Sie Pull Requests für neue Features oder Bugfixes.

## Lizenz und Urheberrecht

© 2024-2025 Simon Öztürk / SCS-Technik. Alle Rechte vorbehalten.

Dieses Projekt ist proprietär und vertraulich. Jede unautorisierte Nutzung, Vervielfältigung, Modifikation, Verteilung oder Anzeige dieses Quellcodes, ganz oder teilweise, ist strengstens untersagt.

Die Nutzung dieser Software ist nur nach ausdrücklicher schriftlicher Genehmigung durch den Urheberrechtsinhaber zulässig. Für Lizenzvereinbarungen oder Fragen wenden Sie sich bitte an info@scs-technik.de.

Dieses Projekt enthält möglicherweise Geschäftsgeheimnisse. Unbefugter Zugriff, Nutzung oder Offenlegung kann zu rechtlichen Konsequenzen führen.