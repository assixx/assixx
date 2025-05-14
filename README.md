# Lohnabrechnung Online

## Projektbeschreibung

Lohnabrechnung Online ist ein webbasiertes System zur Verwaltung von Lohnabrechnungen und anderen HR-Dokumenten. Das System ermöglicht es:

- **Root-Benutzern**: Administratoren zu erstellen und zu verwalten
- **Administratoren**: Mitarbeiter anzulegen und Dokumente für sie hochzuladen
- **Mitarbeitern**: Ihre Dokumente einzusehen und herunterzuladen

Das System verwendet eine hierarchische Benutzerstruktur mit drei Benutzerrollen (Root, Admin, Mitarbeiter) und ermöglicht die sichere Speicherung und Übermittlung von Dokumenten.

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

Das System verwendet drei Benutzerrollen:

1. **Root** - Höchste Berechtigungsstufe:
   - Kann Administratoren erstellen und löschen
   - Hat vollen Zugriff auf alle Funktionen

2. **Admin** - Mittlere Berechtigungsstufe:
   - Kann Mitarbeiter erstellen und löschen
   - Kann Dokumente für Mitarbeiter hochladen
   - Verwaltet Mitarbeiterinformationen

3. **Mitarbeiter** - Niedrigste Berechtigungsstufe:
   - Kann eigene Dokumente einsehen und herunterladen
   - Kann nach Dokumenten suchen

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

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Datenbank: MySQL
- Authentifizierung: JWT (JSON Web Tokens)
- Passwortverschlüsselung: bcrypt

## Sicherheitshinweise

- Ändern Sie das Standard-Root-Passwort nach der ersten Anmeldung
- Verwenden Sie ein sicheres JWT_SECRET
- Stellen Sie sicher, dass die Anwendung hinter einer Firewall läuft, wenn sie öffentlich zugänglich ist
- Führen Sie regelmäßige Backups der Datenbank durch
