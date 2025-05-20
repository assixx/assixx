# Assixx - Firmenkommunikations- und Verwaltungssystem

## Projektbeschreibung

Assixx ist eine umfassende Kommunikations- und Verwaltungslösung für Industriefirmen, speziell entwickelt für Produktionsarbeiter ohne PC-Zugang. Das System verbessert die Kommunikation zwischen Arbeitern, Administration und Management durch mobile Technologie.

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







## Roadmap und geplante Features

### Phase 1: Aktuelle Basis (bereits implementiert)
- ✅ Benutzerverwaltung (Root, Admin, Mitarbeiter)
- ✅ Dokumentenupload und -download
- ✅ JWT-basierte Authentifizierung
- ✅ Basis-Dashboard

### Phase 2: Mobile-First Optimierung
- [ ] Progressive Web App (PWA) Implementierung
- [ ] Responsive Design für alle Bildschirmgrößen
- [ ] Touch-optimierte UI-Elemente
- [ ] Offline-Funktionalität

### Phase 3: Fehlermeldesystem
- [ ] Foto-Upload von Mobilgeräten
- [ ] Ticketsystem für Problemmeldungen
- [ ] Push-Benachrichtigungen an Maintenance
- [ ] Status-Tracking für gemeldete Probleme

### Phase 4: Erweiterte Kommunikation
- [ ] Firmenkalender mit Events
- [ ] Ankündigungssystem
- [ ] Umfragemodul mit Auswertungen
- [ ] Verbesserungsvorschläge-Portal

### Phase 5: Erweiterte Features
- [ ] Mehrsprachige Unterstützung
- [ ] QR-Code oder PIN-basierte Anmeldung
- [ ] Automatische Berichte und Auswertungen
- [ ] Integration mit bestehenden Firmensystemen

### Phase 6: Multi-Tenant-Architektur ✅
- ✅ Subdomain-basierte Mandantentrennung
- ✅ Feature-Management-System
- ✅ Modulare Feature-Aktivierung pro Kunde
- [ ] Automatisiertes Onboarding neuer Firmen
- [ ] White-Label-Branding pro Firma
- [ ] Separate Datenbanken pro Mandant (derzeit gemeinsame DB)
- [ ] Docker-Container-Deployment

### Phase 7: SaaS-Monetarisierung
- ✅ Feature-basierte Preispläne (Basic, Premium, Enterprise)
- ✅ Feature-Toggle-System
- ✅ Usage-Tracking für Features
- [ ] Stripe/PayPal Integration
- [ ] Automatische Abrechnungen
- [ ] Customer Self-Service Portal
- [ ] Billing Dashboard
- [ ] Automatische Feature-Aktivierung nach Zahlung
- [ ] Trial-Perioden-Management
- [ ] Nutzungsbasierte Abrechnung

## Beitragen

Wir freuen uns über Beiträge! Bitte erstellen Sie einen Fork des Repositories und senden Sie Pull Requests für neue Features oder Bugfixes.

## Lizenz und Urheberrecht

© 2024-2025 Simon Öztürk / SCS-Technik. Alle Rechte vorbehalten.

Dieses Projekt ist proprietär und vertraulich. Jede unautorisierte Nutzung, Vervielfältigung, Modifikation, Verteilung oder Anzeige dieses Quellcodes, ganz oder teilweise, ist strengstens untersagt.

Die Nutzung dieser Software ist nur nach ausdrücklicher schriftlicher Genehmigung durch den Urheberrechtsinhaber zulässig. Für Lizenzvereinbarungen oder Fragen wenden Sie sich bitte an scs-technik@protonmail.com.

Dieses Projekt enthält möglicherweise Geschäftsgeheimnisse. Unbefugter Zugriff, Nutzung oder Offenlegung kann zu rechtlichen Konsequenzen führen.







## Komplette Anleitung: Lohnabrechnung-Projekt unter WSL Ubuntu einrichten

Diese Anleitung führt dich Schritt für Schritt durch die Installation und Einrichtung des Lohnabrechnung-Projekts unter Windows Subsystem for Linux (WSL) mit Ubuntu.

### 1. WSL mit Ubuntu installieren

PowerShell als Administrator öffnen und ausführen:
```powershell
wsl --install -d Ubuntu
```

Ubuntu starten und Benutzernamen/Passwort einrichten

### 2. Visual Studio Code installieren und konfigurieren

VS Code herunterladen von code.visualstudio.com
WSL-Extension installieren: In VS Code: Extensions > "Remote - WSL" suchen und installieren

### 3. Projekt klonen oder herunterladen
```bash
# Verzeichnis erstellen und hineinwechseln
mkdir -p ~/projects
cd ~/projects

# Projekt klonen (ersetze die URL durch dein Repository)
git clone https://github.com/dein-username/dein-projektname.git lohnabrechnung
cd lohnabrechnung
4. Node.js einrichten
bash# Node.js und npm installieren
sudo apt update
sudo apt install -y nodejs npm

# Node Version Manager installieren
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
source ~/.bashrc

# Node.js LTS installieren
nvm install --lts
nvm use --lts

# Ins Projektverzeichnis wechseln
cd ~/projects/lohnabrechnung/server

# Abhängigkeiten installieren
npm install
5. MySQL installieren und richtig konfigurieren
bash# MySQL installieren
sudo apt update
sudo apt install -y mysql-server

# MySQL-Dienst starten
sudo service mysql start

# MySQL sicher konfigurieren
sudo mysql_secure_installation
Beantworte die Fragen bei mysql_secure_installation wie folgt:

Passwortvalidierung-Plugin: Ja
Setze ein starkes Passwort: StrongP@ssw0rd!123 (oder eigenes starkes Passwort)
Anonymen Benutzer entfernen: Ja
Root-Login von außen verbieten: Nein
Test-Datenbank entfernen: Nein
Berechtigungstabellen neu laden: Ja

6. Datenbank und Tabellen erstellen
bash# Bei MySQL anmelden
sudo mysql -u root -p
# Passwort eingeben (dein starkes MySQL-Passwort)
Führe folgende SQL-Befehle aus:
sql-- Datenbank erstellen
CREATE DATABASE lohnabrechnung;
USE lohnabrechnung;

-- Tabellen erstellen
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  department_id INT,
  position VARCHAR(100),
  phone VARCHAR(20),
  profile_picture VARCHAR(255),
  address TEXT,
  birthday DATE,
  hire_date DATE,
  emergency_contact TEXT,
  editable_fields JSON
);

CREATE TABLE documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_content LONGBLOB NOT NULL,
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  category VARCHAR(50) DEFAULT 'other',
  description TEXT,
  year INT,
  month VARCHAR(20),
  is_archived BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  manager_id INT,
  parent_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  department_id INT,
  leader_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_teams (
  user_id INT NOT NULL,
  team_id INT NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, team_id)
);

CREATE TABLE admin_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(50) NOT NULL DEFAULT 'login',
  ip_address VARCHAR(50),
  status ENUM('success', 'failure') NOT NULL DEFAULT 'success',
  details TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indizes erstellen
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_documents_user_category ON documents(user_id, category);
CREATE INDEX idx_documents_archive_status ON documents(is_archived);
CREATE INDEX idx_admin_logs_user_id ON admin_logs(user_id);
CREATE INDEX idx_admin_logs_timestamp ON admin_logs(timestamp);

EXIT;
7. Root-Benutzer anlegen mit korrektem Hash
bash# Ins Projektverzeichnis wechseln
cd ~/projects/lohnabrechnung/server

# Korrekten Hash für das Passwort "root" generieren
node -e "const bcrypt = require('bcrypt'); console.log(bcrypt.hashSync('root', 10));"
Kopiere den erzeugten Hash (er sollte wie $2b$10$... aussehen).
bash# Bei MySQL anmelden
sudo mysql -u root -p
# Passwort eingeben
sqlUSE lohnabrechnung;

-- Root-Benutzer mit dem gerade generierten Hash anlegen
-- WICHTIG: Ersetze den Platzhalter durch deinen tatsächlichen Hash!
INSERT INTO users (username, email, password, role) VALUES 
('root', 'root@example.com', '$2b$10$DEIN_GENERIERTER_HASH', 'root');

-- Überprüfe, ob der Benutzer korrekt angelegt wurde
SELECT id, username, role FROM users WHERE username = 'root';

EXIT;
8. Umgebungsvariablen einrichten
bash# .env-Datei im server-Verzeichnis erstellen
cd ~/projects/lohnabrechnung/server
Erstelle eine .env-Datei:
bashcat > .env << EOF
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=StrongP@ssw0rd!123
DB_NAME=lohnabrechnung
JWT_SECRET=ein_sicherer_zufallsstring
EOF
Ersetze StrongP@ssw0rd!123 durch dein tatsächliches MySQL-Passwort.
9. Verzeichnisstruktur für Uploads erstellen
bash# Erstelle die notwendigen Verzeichnisse
mkdir -p uploads/profile_pictures uploads/documents
10. Server starten
bash# Starte den Server
node server.js
11. Anmeldung testen
Öffne deinen Browser und navigiere zu http://localhost:3000
Melde dich mit den folgenden Daten an:

Benutzername: root
Passwort: root

Fehlerbehebung
Problem: MySQL-Zugriffsfehler
Wenn du Fehler wie Error: Access denied for user 'root'@'localhost' erhältst:
bashsudo mysql
sqlALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'StrongP@ssw0rd!123';
FLUSH PRIVILEGES;
EXIT;
bashsudo service mysql restart
Problem: Falscher Passwort-Hash
Wenn die Anmeldung mit "Invalid password" fehlschlägt:

Überprüfe den Hash:
bashnode -e "const bcrypt = require('bcrypt'); console.log(bcrypt.compareSync('root', 'DEIN_HASH_AUS_DER_DATENBANK'));"

Wenn false zurückkommt, erzeuge einen neuen Hash und aktualisiere ihn in der Datenbank:
bashnode -e "const bcrypt = require('bcrypt'); console.log(bcrypt.hashSync('root', 10));"
sqlUSE lohnabrechnung;
UPDATE users SET password = '$2b$10$DEIN_NEUER_HASH' WHERE username = 'root';
EXIT;


Problem: Server startet nicht
Überprüfe die Logs mit:
bashcat combined.log
cat error.log
Wichtige Hinweise

MySQL-Passwort: Stelle sicher, dass das MySQL-Passwort in der .env-Datei mit dem tatsächlichen Passwort übereinstimmt.
Passwort-Hash: Setze immer den vollständigen Hash ein. Der Hash muss mit $2b$10$ beginnen und hat eine bestimmte Länge.
Port-Konflikte: Wenn Port 3000 bereits belegt ist, ändere ihn in der server.js-Datei oder setze die Umgebungsvariable PORT.

Mit dieser Anleitung sollte die Einrichtung des Lohnabrechnung-Projekts reibungslos funktionieren!
