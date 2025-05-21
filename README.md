# Assixx - Firmenkommunikations- und Verwaltungssystem

## Projektbeschreibung

Assixx ist eine umfassende Kommunikations- und Verwaltungslösung für Industriefirmen, speziell entwickelt für Produktionsarbeiter ohne PC-Zugang. Das System verbessert die Kommunikation zwischen Arbeitern, Administration und Management durch mobile Technologie.

## Vision
Assixx wird eine vollständige SaaS-Plattform für Industriefirmen, die modular erweiterbare Features anbietet und Kunden ermöglicht, nur für die Funktionen zu bezahlen, die sie tatsächlich benötigen.

### Hauptfunktionen:

- **Fehlermeldesystem**: Arbeiter können Fotos von Problemen machen und direkt melden
- **Dokumentenverwaltung**: Digitale Verwaltung von Lohnabrechnungen, Krankmeldungen und Bescheinigungen
- **Firmenkommunikation**: ✅ Kalender, ✅ Blackboard (Ankündigungen) und Umfragen
- **Verbesserungsvorschläge**: Mitarbeiter können Ideen einreichen und diskutieren
- **Echtzeit-Benachrichtigungen**: ✅ E-Mail-Benachrichtigungen und zukünftig Push-Notifications

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

2. **E-Mail-Benachrichtigungen** ✅
   - ✅ Nodemailer Integration
   - ✅ Templates für verschiedene Events (Willkommen, Neue Dokumente, Allgemein)
   - ✅ Queue für Massen-E-Mails mit Batch-Verarbeitung
   - ✅ Unsubscribe-Funktion mit Token-basierter Verifizierung
   - ✅ Automatische Benachrichtigungen bei neuen Dokumenten

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
- ✅ E-Mail-Benachrichtigungen
  - ✅ Nodemailer Integration
  - ✅ Templates für verschiedene Events
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

## Aktueller Fokus: Mobile-First & Chat-Funktion
Der aktuelle Entwicklungsfokus liegt auf zwei Hauptbereichen:

1. **Mobile-First Optimierung**:
   - Entwicklung einer Progressive Web App (PWA)
   - Service Worker für Offline-Funktionalität
   - Responsive Design für alle Bildschirmgrößen
   - Push-Benachrichtigungen für neue Dokumente

2. **Chat-Funktion**:
   - Direkte Kommunikation zwischen Admins und Mitarbeitern
   - Posteingang für jeden Mitarbeiter
   - Benachrichtigungen über neue Nachrichten
   - Möglichkeit für Dateianhänge

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

## Systemvoraussetzungen für Windows 11

Bevor Sie beginnen, stellen Sie sicher, dass Sie folgende Software installiert haben:

- **Node.js** (Version 16 oder höher)
  - Download unter: https://nodejs.org/
  - Installieren Sie die LTS-Version mit den Standardeinstellungen
  - Überprüfen Sie die Installation mit `node --version` im Command Prompt oder PowerShell

- **XAMPP** (für MySQL-Datenbank)
  - Download unter: https://www.apachefriends.org/de/index.html
  - Mindestens die Komponenten Apache und MySQL auswählen
  - Empfohlener Installationspfad: `C:\xampp`

- **Git** (für das Klonen des Repositories)
  - Download unter: https://git-scm.com/download/win
  - Installieren Sie mit den Standardeinstellungen
  - Wählen Sie die Option "Git from the command line and also from 3rd-party software"

- **Visual Studio Code** (empfohlen, aber optional)
  - Download unter: https://code.visualstudio.com/

## Installation unter Windows 11

### 1. Repository klonen

Öffnen Sie den Windows Command Prompt oder PowerShell und führen Sie folgende Befehle aus:

```cmd
git clone https://github.com/SCS-Technik/Assixx.git
cd Assixx
```

### 2. Abhängigkeiten installieren

```cmd
cd server
npm install
```

Falls `npm install` Fehler ausgibt, versuchen Sie:

```cmd
npm install --legacy-peer-deps
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