# 🪟 Assixx Setup Guide für Windows (WSL)

Dieser Guide führt dich Schritt für Schritt durch die komplette Einrichtung des Assixx-Projekts auf Windows mit WSL (Windows Subsystem for Linux).

## 📋 Voraussetzungen

- Windows 10 Version 2004+ oder Windows 11
- Administratorrechte
- Mindestens 8 GB RAM
- 10 GB freier Speicherplatz

## 📚 Inhaltsverzeichnis

1. [WSL Installation](#1-wsl-installation)
2. [VS Code Installation](#2-vs-code-installation)
3. [Git und GitHub Setup](#3-git-und-github-setup)
4. [Node.js Installation](#4-nodejs-installation)
5. [MySQL Installation](#5-mysql-installation)
6. [Projekt Setup](#6-projekt-setup)
7. [Datenbank Setup](#7-datenbank-setup)
8. [Projekt starten](#8-projekt-starten)
9. [Fehlerbehebung](#9-fehlerbehebung)

---

## 1. WSL Installation

### Schritt 1.1: PowerShell als Administrator öffnen

1. Rechtsklick auf Start-Button
2. "Windows PowerShell (Administrator)" wählen
3. Bei der Sicherheitsabfrage "Ja" klicken

### Schritt 1.2: WSL installieren

```powershell
# WSL mit Ubuntu installieren
wsl --install

# Computer neustarten (wichtig!)
shutdown /r /t 0
```

### Schritt 1.3: Ubuntu einrichten (nach Neustart)

1. Ubuntu aus dem Startmenü öffnen
2. Warten bis Installation abgeschlossen ist (ca. 2 Minuten)
3. Benutzername eingeben (z.B. dein Vorname, kleingeschrieben)
4. Passwort eingeben (wird nicht angezeigt!)
5. Passwort wiederholen

### Schritt 1.4: Ubuntu aktualisieren

```bash
# System aktualisieren
sudo apt update && sudo apt upgrade -y
```

## 2. VS Code Installation

### Schritt 2.1: VS Code herunterladen

1. Öffne https://code.visualstudio.com/
2. Klicke auf "Download for Windows"
3. Installiere VS Code mit allen Standardeinstellungen

### Schritt 2.2: WSL Extension installieren

1. Öffne VS Code
2. Klicke auf Extensions-Icon (linke Seitenleiste) oder `Strg+Shift+X`
3. Suche nach "WSL"
4. Installiere "WSL" von Microsoft

### Schritt 2.3: VS Code mit WSL verbinden

1. Drücke `F1` oder `Strg+Shift+P`
2. Tippe "WSL: Connect to WSL"
3. Wähle den Befehl aus
4. VS Code startet neu und verbindet sich mit WSL

## 3. Git und GitHub Setup

### Schritt 3.1: Git installieren (in WSL Ubuntu)

```bash
# Git installieren
sudo apt install git -y

# Git Version prüfen
git --version
```

### Schritt 3.2: Git konfigurieren

```bash
# Deinen Namen setzen
git config --global user.name "Dein Name"

# Deine E-Mail setzen (gleiche wie bei GitHub!)
git config --global user.email "deine.email@example.com"

# Konfiguration prüfen
git config --list
```

### Schritt 3.3: SSH-Schlüssel für GitHub erstellen

```bash
# SSH-Schlüssel generieren
ssh-keygen -t ed25519 -C "deine.email@example.com"

# Bei allen Fragen einfach Enter drücken (Standardwerte übernehmen)

# SSH-Agent starten
eval "$(ssh-agent -s)"

# Schlüssel zum SSH-Agent hinzufügen
ssh-add ~/.ssh/id_ed25519

# Öffentlichen Schlüssel anzeigen und kopieren
cat ~/.ssh/id_ed25519.pub
```

### Schritt 3.4: SSH-Schlüssel zu GitHub hinzufügen

1. Öffne https://github.com/settings/keys
2. Klicke auf "New SSH key"
3. Title: "WSL Ubuntu"
4. Key: Füge den kopierten Schlüssel ein
5. Klicke auf "Add SSH key"

### Schritt 3.5: Verbindung testen

```bash
# GitHub Verbindung testen
ssh -T git@github.com

# Bei der Frage "Are you sure...?" mit "yes" antworten
```

## 4. Node.js Installation

### Schritt 4.1: Node.js 20 installieren

```bash
# NodeSource Repository hinzufügen
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js installieren
sudo apt install nodejs -y

# Versionen prüfen
node --version  # sollte v20.x.x zeigen
npm --version   # sollte 10.x.x zeigen
```

## 5. MySQL Installation

### Schritt 5.1: MySQL Server installieren

```bash
# MySQL installieren
sudo apt install mysql-server -y

# MySQL Service starten
sudo systemctl start mysql

# MySQL Service aktivieren (automatischer Start)
sudo systemctl enable mysql
```

### Schritt 5.2: MySQL absichern

```bash
# Sicherheitsscript ausführen
sudo mysql_secure_installation

# Antworten:
# - VALIDATE PASSWORD component: n
# - New password: ein sicheres Passwort eingeben
# - Re-enter password: Passwort wiederholen
# - Remove anonymous users: y
# - Disallow root login remotely: y
# - Remove test database: y
# - Reload privilege tables: y
```

### Schritt 5.3: MySQL Benutzer erstellen

```bash
# Als root in MySQL einloggen
sudo mysql

# In der MySQL-Konsole:
```

```sql
-- Neuen Benutzer erstellen
CREATE USER 'assixx_user'@'localhost' IDENTIFIED BY 'dein_sicheres_passwort';

-- Datenbank erstellen
CREATE DATABASE assixx_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Berechtigungen vergeben
GRANT ALL PRIVILEGES ON assixx_db.* TO 'assixx_user'@'localhost';
FLUSH PRIVILEGES;

-- MySQL verlassen
EXIT;
```

## 6. Projekt Setup

### Schritt 6.1: Projektordner erstellen

```bash
# Zum Home-Verzeichnis wechseln
cd ~

# Projekte-Ordner erstellen
mkdir -p projects
cd projects
```

### Schritt 6.2: Repository klonen

```bash
# Assixx klonen (SSH)
git clone git@github.com:dein-username/Assixx.git

# ODER mit HTTPS (falls SSH nicht funktioniert)
git clone https://github.com/dein-username/Assixx.git

# In Projektordner wechseln
cd Assixx
```

### Schritt 6.3: Projekt in VS Code öffnen

```bash
# VS Code im aktuellen Ordner öffnen
code .
```

### Schritt 6.4: Dependencies installieren

```bash
# Backend Dependencies installieren
npm install

# Frontend Dependencies installieren
cd frontend
npm install

# Zurück zum Hauptverzeichnis
cd ..
```

## 7. Datenbank Setup

### Schritt 7.1: Datenbankschema importieren

```bash
# Schema importieren
mysql -u assixx_user -p assixx_db < database-setup.sql

# Passwort eingeben wenn gefragt
```

### Schritt 7.2: Umgebungsvariablen konfigurieren

```bash
# .env Datei erstellen
cp .env.example .env

# .env Datei bearbeiten
nano .env
```

Bearbeite die `.env` Datei:

```env
# Server Konfiguration
PORT=3000
NODE_ENV=development

# Datenbank Konfiguration
DB_HOST=localhost
DB_PORT=3306
DB_USER=assixx_user
DB_PASSWORD=dein_sicheres_passwort
DB_NAME=assixx_db

# JWT Secret (zufälligen String generieren)
JWT_SECRET=hier_einen_sehr_langen_zufaelligen_string_eingeben

# Session Secret
SESSION_SECRET=noch_einen_anderen_zufaelligen_string

# E-Mail Konfiguration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=deine.email@gmail.com
SMTP_PASS=dein_app_passwort
```

Speichern mit `Strg+O`, Enter, dann `Strg+X`

## 8. Projekt starten

### Schritt 8.1: Backend starten

```bash
# Im Hauptverzeichnis
npm run dev

# Server läuft jetzt auf http://localhost:3000
```

### Schritt 8.2: Im Browser öffnen

1. Öffne einen Browser (Chrome/Firefox/Edge)
2. Gehe zu http://localhost:3000
3. Du solltest die Login-Seite sehen

### Schritt 8.3: Admin-Benutzer erstellen

```bash
# Neues Terminal in VS Code öffnen (Strg+Shift+`)
cd backend/utils/scripts

# Admin erstellen
node create-employee.js

# Folge den Anweisungen
```

## 9. Fehlerbehebung

### Problem: "Permission denied" Fehler

```bash
# Berechtigungen für npm global directory setzen
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Problem: MySQL Verbindung schlägt fehl

```bash
# MySQL Status prüfen
sudo systemctl status mysql

# MySQL neu starten
sudo systemctl restart mysql

# Logs prüfen
sudo journalctl -u mysql
```

### Problem: Port 3000 bereits belegt

```bash
# Prozess auf Port 3000 finden
sudo lsof -i :3000

# Prozess beenden (PID aus vorherigem Befehl)
kill -9 <PID>
```

### Problem: WSL2 Netzwerkprobleme

```powershell
# In Windows PowerShell (Administrator)
wsl --shutdown
wsl
```

## 🎉 Fertig!

Du hast erfolgreich das Assixx-Projekt auf Windows mit WSL eingerichtet!

### Nächste Schritte:

- Lies die [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md) für Entwicklungsrichtlinien
- Schau dir [ARCHITECTURE.md](./ARCHITECTURE.md) für die Projektstruktur an
- Beginne mit der Entwicklung!

### Tägliches Arbeiten:

```bash
# WSL Ubuntu öffnen
# Zum Projekt navigieren
cd ~/projects/Assixx

# Git Status prüfen
git status

# Neueste Änderungen holen
git pull

# Server starten
npm run dev

# VS Code öffnen
code .
```

---

Bei Fragen oder Problemen:

- Erstelle ein Issue auf GitHub
- Frage im Team-Chat
- Schau in die [FAQ](./FAQ.md)
