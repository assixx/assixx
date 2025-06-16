# 🪟 Assixx Setup Guide für Windows (WSL)

> **⚡ Schnellstart:** Mit Docker in nur 15 Minuten startklar! Siehe [Docker Setup](#2-docker-setup-empfohlen---schnellste-methode)

Dieser Guide führt dich Schritt für Schritt durch die komplette Einrichtung des Assixx-Projekts auf Windows mit WSL (Windows Subsystem for Linux).

## 🚀 Setup-Methoden

Es gibt zwei Wege, Assixx auf Windows einzurichten:

### 1. 🐳 **Docker Setup (EMPFOHLEN)** - ⏱️ ~15 Minuten

- Schnellste und einfachste Methode
- Automatische Konfiguration aller Komponenten
- Keine manuelle Installation von Datenbank, Node.js etc.
- Ideal für schnellen Start und einheitliche Entwicklungsumgebung

### 2. 🔧 **Manuelle Installation** - ⏱️ ~45-60 Minuten

- Für fortgeschrittene Nutzer
- Volle Kontrolle über alle Komponenten
- Direkter Zugriff auf alle Services
- Mehr Flexibilität bei der Konfiguration

## 📋 Voraussetzungen

- Windows 10 Version 2004+ oder Windows 11
- Administratorrechte
- Mindestens 8 GB RAM
- 10 GB freier Speicherplatz

## 📚 Inhaltsverzeichnis

1. [WSL Installation](#1-wsl-installation)
2. [Docker Setup (EMPFOHLEN)](#2-docker-setup-empfohlen---schnellste-methode)
3. [Manuelle Installation](#3-manuelle-installation-fortgeschrittene-nutzer)
   - [VS Code Installation](#31-vs-code-installation)
   - [Git und GitHub Setup](#32-git-und-github-setup)
   - [Node.js Installation](#33-nodejs-installation)
   - [MySQL Installation](#34-mysql-installation)
   - [Projekt Setup](#35-projekt-setup)
   - [Datenbank Setup](#36-datenbank-setup)
   - [Projekt starten](#37-projekt-starten)
4. [Fehlerbehebung](#4-fehlerbehebung)

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

---

## 2. 🐳 Docker Setup (EMPFOHLEN - Schnellste Methode)

> **Hinweis:** Dies ist die empfohlene Methode für die meisten Entwickler. Wenn du die manuelle Installation bevorzugst, springe zu [Abschnitt 3](#3-manuelle-installation-fortgeschrittene-nutzer).

### Schritt 2.1: Docker Desktop installieren

1. Lade Docker Desktop für Windows herunter: https://www.docker.com/products/docker-desktop/
2. Führe den Installer aus
3. **WICHTIG:** Stelle sicher, dass "Use WSL 2 instead of Hyper-V" aktiviert ist
4. Nach der Installation: Computer neustarten

### Schritt 2.2: Docker Desktop konfigurieren

1. Starte Docker Desktop
2. Gehe zu Settings → General
3. Stelle sicher, dass "Use the WSL 2 based engine" aktiviert ist
4. Gehe zu Settings → Resources → WSL Integration
5. Aktiviere Integration für deine Ubuntu-Distribution
6. Klicke "Apply & Restart"

### Schritt 2.3: Repository klonen

```bash
# In WSL Ubuntu Terminal:
cd ~
mkdir -p projects
cd projects

# Repository klonen
git clone https://github.com/SCS-Technik/Assixx.git
cd Assixx
```

### Schritt 2.4: Docker Compose starten

```bash
# Entwicklungsumgebung mit Docker starten
docker-compose up -d

# Logs anzeigen (optional)
docker-compose logs -f

# Status prüfen
docker-compose ps
```

### Schritt 2.5: Zugriff auf die Anwendung

Nach etwa 1-2 Minuten ist alles bereit:

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3000/api
- **MySQL:** localhost:3306 (User: root, Password: siehe .env.docker)

### Schritt 2.6: VS Code mit Projekt verbinden

```bash
# VS Code im Projektverzeichnis öffnen
code .
```

### Schritt 2.7: Docker Befehle

```bash
# Container stoppen
docker-compose down

# Container neu starten
docker-compose restart

# Datenbank zurücksetzen
docker-compose down -v
docker-compose up -d

# In Container einloggen (für Debugging)
docker-compose exec backend bash
docker-compose exec database mysql -u root -p
```

> **Weitere Details:** Siehe [DOCKER-SETUP.md](./DOCKER-SETUP.md) für erweiterte Docker-Konfiguration und Troubleshooting.

---

## 3. Manuelle Installation (Fortgeschrittene Nutzer)

> **Hinweis:** Die folgenden Schritte sind nur notwendig, wenn du NICHT die Docker-Methode verwendest.

### 3.1. VS Code Installation

#### Schritt 3.1.1: VS Code herunterladen

1. Öffne https://code.visualstudio.com/
2. Klicke auf "Download for Windows"
3. Installiere VS Code mit allen Standardeinstellungen

#### Schritt 3.1.2: WSL Extension installieren

1. Öffne VS Code
2. Klicke auf Extensions-Icon (linke Seitenleiste) oder `Strg+Shift+X`
3. Suche nach "WSL"
4. Installiere "WSL" von Microsoft

#### Schritt 3.1.3: VS Code mit WSL verbinden

1. Drücke `F1` oder `Strg+Shift+P`
2. Tippe "WSL: Connect to WSL"
3. Wähle den Befehl aus
4. VS Code startet neu und verbindet sich mit WSL

### 3.2. Git und GitHub Setup

#### Schritt 3.2.1: Git installieren (in WSL Ubuntu)

```bash
# Git installieren
sudo apt install git -y

# Git Version prüfen
git --version
```

#### Schritt 3.2.2: Git konfigurieren

```bash
# Deinen Namen setzen
git config --global user.name "Dein Name"

# Deine E-Mail setzen (gleiche wie bei GitHub!)
git config --global user.email "deine.email@example.com"

# Konfiguration prüfen
git config --list
```

#### Schritt 3.2.3: SSH-Schlüssel für GitHub erstellen

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

#### Schritt 3.2.4: SSH-Schlüssel zu GitHub hinzufügen

1. Öffne https://github.com/settings/keys
2. Klicke auf "New SSH key"
3. Title: "WSL Ubuntu"
4. Key: Füge den kopierten Schlüssel ein
5. Klicke auf "Add SSH key"

#### Schritt 3.2.5: Verbindung testen

```bash
# GitHub Verbindung testen
ssh -T git@github.com

# Bei der Frage "Are you sure...?" mit "yes" antworten
```

### 3.3. Node.js Installation

#### Schritt 3.3.1: Node.js 20 installieren

```bash
# NodeSource Repository hinzufügen
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js installieren
sudo apt install nodejs -y

# Versionen prüfen
node --version  # sollte v20.x.x zeigen
npm --version   # sollte 10.x.x zeigen

# pnpm installieren
npm install -g pnpm

# pnpm Version prüfen
pnpm --version
```

### 3.4. MySQL Installation

#### Schritt 3.4.1: MySQL Server installieren

```bash
# MySQL installieren
sudo apt install mysql-server -y

# MySQL Service starten
sudo systemctl start mysql

# MySQL Service aktivieren (automatischer Start)
sudo systemctl enable mysql
```

#### Schritt 3.4.2: MySQL absichern

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

#### Schritt 3.4.3: MySQL Benutzer erstellen

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

### 3.5. Projekt Setup

#### Schritt 3.5.1: Projektordner erstellen

```bash
# Zum Home-Verzeichnis wechseln
cd ~

# Projekte-Ordner erstellen
mkdir -p projects
cd projects
```

#### Schritt 3.5.2: Repository klonen

```bash
# Assixx klonen (SSH)
git clone git@github.com:dein-username/Assixx.git

# ODER mit HTTPS (falls SSH nicht funktioniert)
git clone https://github.com/dein-username/Assixx.git

# In Projektordner wechseln
cd Assixx
```

#### Schritt 3.5.3: Projekt in VS Code öffnen

```bash
# VS Code im aktuellen Ordner öffnen
code .
```

#### Schritt 3.5.4: Dependencies installieren

```bash
# Backend Dependencies installieren
pnpm install

# Frontend Dependencies installieren
cd frontend
pnpm install

# Zurück zum Hauptverzeichnis
cd ..
```

### 3.6. Datenbank Setup

#### Schritt 3.6.1: Datenbankschema importieren

```bash
# Schema importieren
mysql -u assixx_user -p assixx_db < database-setup.sql

# Passwort eingeben wenn gefragt
```

#### Schritt 3.6.2: Umgebungsvariablen konfigurieren

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

### 3.7. Projekt starten

#### Schritt 3.7.1: Backend starten

```bash
# Im Hauptverzeichnis
pnpm dev

# Server läuft jetzt auf http://localhost:3000
```

#### Schritt 3.7.2: Im Browser öffnen

1. Öffne einen Browser (Chrome/Firefox/Edge)
2. Gehe zu http://localhost:3000
3. Du solltest die Login-Seite sehen

#### Schritt 3.7.3: Admin-Benutzer erstellen

```bash
# Neues Terminal in VS Code öffnen (Strg+Shift+`)
cd backend/utils/scripts

# Admin erstellen
node create-employee.js

# Folge den Anweisungen
```

## 4. Fehlerbehebung

### Problem: "Permission denied" Fehler

```bash
# Berechtigungen für pnpm setzen
sudo chown -R $(whoami) ~/.local/share/pnpm
sudo chown -R $(whoami) ~/.config/pnpm
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
pnpm dev

# VS Code öffnen
code .
```

---

Bei Fragen oder Problemen:

- Erstelle ein Issue auf GitHub
- Frage im Team-Chat
- Schau in die [FAQ](./FAQ.md)
