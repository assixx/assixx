# 🐧 Assixx Setup Guide für Ubuntu/Linux

> **🚀 Schnellstart gesucht?** Für die schnellste Installation (5-10 Minuten) nutze [Docker Setup](#docker-setup-empfohlen)!

Dieser Guide führt dich Schritt für Schritt durch die komplette Einrichtung des Assixx-Projekts auf Ubuntu oder anderen Debian-basierten Linux-Distributionen.

## 📋 Voraussetzungen

- Ubuntu 20.04 LTS oder höher (oder andere Debian-basierte Distribution)
- Sudo-Rechte
- Mindestens 4 GB RAM
- 10 GB freier Speicherplatz

## 🎯 Setup-Optionen

### Option 1: Docker Setup (Empfohlen) ⭐

- **Zeit:** 5-10 Minuten
- **Schwierigkeit:** Einfach
- **Ideal für:** Schnellen Start, Entwicklung, Testing
- **Vorteile:** Keine manuelle Konfiguration, isolierte Umgebung

### Option 2: Manuelle Installation

- **Zeit:** 30-45 Minuten
- **Schwierigkeit:** Mittel
- **Ideal für:** Produktionsumgebungen, volle Kontrolle
- **Vorteile:** Optimale Performance, individuelle Anpassungen

## 📚 Inhaltsverzeichnis

### Docker Setup (Empfohlen):

1. [System vorbereiten](#1-system-vorbereiten)
2. [Docker Setup](#docker-setup-empfohlen)

### Manuelle Installation:

3. [VS Code Installation](#2-vs-code-installation)
4. [Git und GitHub Setup](#3-git-und-github-setup)
5. [Node.js Installation](#4-nodejs-installation)
6. [MySQL Installation](#5-mysql-installation)
7. [Projekt Setup](#6-projekt-setup)
8. [Datenbank Setup](#7-datenbank-setup)
9. [Projekt starten](#8-projekt-starten)
10. [Systemd Service (Optional)](#9-systemd-service-optional)
11. [Fehlerbehebung](#10-fehlerbehebung)

---

## 1. System vorbereiten

### Schritt 1.1: Terminal öffnen

- Drücke `Strg+Alt+T` oder
- Klicke auf "Terminal" im Anwendungsmenü

### Schritt 1.2: System aktualisieren

```bash
# Paketlisten aktualisieren
sudo apt update

# Alle Pakete aktualisieren
sudo apt upgrade -y

# Wichtige Build-Tools installieren
sudo apt install build-essential curl wget gnupg2 software-properties-common -y
```

---

## 🐳 Docker Setup (Empfohlen)

> **⚡ Schnellste Option!** Mit Docker ist Assixx in 5-10 Minuten startklar.

### Schritt 2.1: Docker installieren

```bash
# Docker GPG Schlüssel hinzufügen
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Docker Repository hinzufügen
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Docker installieren
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-compose-plugin -y

# Benutzer zur docker Gruppe hinzufügen (kein sudo mehr nötig)
sudo usermod -aG docker $USER

# WICHTIG: Neu einloggen oder folgendes ausführen
newgrp docker

# Installation testen
docker --version
docker compose version
```

### Schritt 2.2: Repository klonen

```bash
# Projektordner erstellen
mkdir -p ~/projects
cd ~/projects

# Repository klonen
git clone https://github.com/SCS-Technik/Assixx.git
cd Assixx
```

### Schritt 2.3: Docker Container starten

```bash
# Development-Container starten
docker compose -f docker-compose.dev.yml up -d

# Logs anzeigen (optional)
docker compose -f docker-compose.dev.yml logs -f

# Container-Status prüfen
docker ps
```

### Schritt 2.4: Auf Assixx zugreifen

1. Öffne deinen Browser
2. Navigiere zu http://localhost:3000
3. Login mit Standard-Credentials (siehe `.env.docker`)

### Schritt 2.5: Fertig! 🎉

Deine Assixx-Entwicklungsumgebung läuft! Für weitere Details:

- Siehe [DOCKER-SETUP.md](./DOCKER-SETUP.md) für erweiterte Docker-Konfiguration
- Siehe [DOCKER-BEGINNERS-GUIDE.md](./DOCKER-BEGINNERS-GUIDE.md) für Docker-Grundlagen

### Docker-Befehle Übersicht

```bash
# Container stoppen
docker compose -f docker-compose.dev.yml down

# Container neu starten
docker compose -f docker-compose.dev.yml restart

# Logs anzeigen
docker compose -f docker-compose.dev.yml logs -f [service-name]

# In Container-Shell einloggen
docker compose -f docker-compose.dev.yml exec app bash
```

---

## 📦 Manuelle Installation (Erweiterte Benutzer)

> **⚠️ Hinweis:** Die folgenden Schritte sind nur für die manuelle Installation notwendig. Wenn du Docker verwendest, kannst du direkt zum [Abschnitt Fehlerbehebung](#10-fehlerbehebung) springen.

## 2. VS Code Installation

### Option A: Über Snap (empfohlen)

```bash
# VS Code installieren
sudo snap install code --classic

# Installation prüfen
code --version
```

### Option B: Über APT Repository

```bash
# Microsoft GPG Schlüssel hinzufügen
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/

# VS Code Repository hinzufügen
sudo sh -c 'echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'

# Installieren
sudo apt update
sudo apt install code -y
```

## 3. Git und GitHub Setup

### Schritt 3.1: Git installieren

```bash
# Git installieren
sudo apt install git -y

# Version prüfen
git --version
```

### Schritt 3.2: Git konfigurieren

```bash
# Deinen Namen setzen
git config --global user.name "Dein Name"

# Deine E-Mail setzen (gleiche wie bei GitHub!)
git config --global user.email "deine.email@example.com"

# Editor setzen (optional)
git config --global core.editor "code --wait"

# Konfiguration anzeigen
git config --list
```

### Schritt 3.3: SSH-Schlüssel erstellen

```bash
# SSH-Verzeichnis erstellen (falls nicht vorhanden)
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# SSH-Schlüssel generieren
ssh-keygen -t ed25519 -C "deine.email@example.com"

# Bei allen Fragen Enter drücken (Standardwerte)

# SSH-Agent starten
eval "$(ssh-agent -s)"

# Schlüssel hinzufügen
ssh-add ~/.ssh/id_ed25519

# Öffentlichen Schlüssel anzeigen
cat ~/.ssh/id_ed25519.pub
```

### Schritt 3.4: SSH-Schlüssel zu GitHub hinzufügen

1. Kopiere den ausgegebenen Schlüssel
2. Öffne https://github.com/settings/keys
3. Klicke auf "New SSH key"
4. Title: "Ubuntu Desktop" (oder beschreibender Name)
5. Key: Füge den kopierten Schlüssel ein
6. Klicke auf "Add SSH key"

### Schritt 3.5: Verbindung testen

```bash
# GitHub Verbindung testen
ssh -T git@github.com

# Bei "Are you sure...?" mit "yes" antworten
# Erfolgsmeldung: "Hi username! You've successfully authenticated..."
```

## 4. Node.js Installation

### Schritt 4.1: Node.js 20 LTS installieren

```bash
# NodeSource Repository hinzufügen
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js und npm installieren
sudo apt install nodejs -y

# Versionen prüfen
node --version  # sollte v20.x.x zeigen
npm --version   # sollte 10.x.x zeigen

# npm global Verzeichnis einrichten (vermeidet sudo für npm)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

## 5. MySQL Installation

### Schritt 5.1: MySQL Server installieren

```bash
# MySQL Server installieren
sudo apt install mysql-server mysql-client -y

# Service starten und aktivieren
sudo systemctl start mysql
sudo systemctl enable mysql

# Status prüfen
sudo systemctl status mysql
```

### Schritt 5.2: MySQL absichern

```bash
# Sicherheitsscript ausführen
sudo mysql_secure_installation

# Antworten:
# - VALIDATE PASSWORD component: n (für Entwicklung)
# - New password: sicheres_passwort_eingeben
# - Re-enter password: passwort_wiederholen
# - Remove anonymous users: y
# - Disallow root login remotely: y
# - Remove test database: y
# - Reload privilege tables: y
```

### Schritt 5.3: MySQL Benutzer und Datenbank erstellen

```bash
# Als root in MySQL einloggen
sudo mysql
```

In der MySQL-Konsole:

```sql
-- Benutzer erstellen
CREATE USER 'assixx_user'@'localhost' IDENTIFIED BY 'AssixxPass123!';

-- Datenbank erstellen
CREATE DATABASE assixx_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Berechtigungen vergeben
GRANT ALL PRIVILEGES ON assixx_db.* TO 'assixx_user'@'localhost';
FLUSH PRIVILEGES;

-- Prüfen
SHOW DATABASES;
SELECT User, Host FROM mysql.user;

-- MySQL verlassen
EXIT;
```

### Schritt 5.4: Verbindung testen

```bash
# Mit neuem Benutzer verbinden
mysql -u assixx_user -p

# Passwort eingeben
# Bei Erfolg: "mysql>" Prompt erscheint
# EXIT zum Verlassen
```

## 6. Projekt Setup

### Schritt 6.1: Workspace erstellen

```bash
# Zum Home-Verzeichnis
cd ~

# Projektordner erstellen
mkdir -p projects
cd projects
```

### Schritt 6.2: Repository klonen

```bash
# Mit SSH (empfohlen)
git clone git@github.com:dein-username/Assixx.git

# ODER mit HTTPS
git clone https://github.com/dein-username/Assixx.git

# In Projektverzeichnis wechseln
cd Assixx
```

### Schritt 6.3: VS Code öffnen

```bash
# VS Code im aktuellen Verzeichnis öffnen
code .
```

### Schritt 6.4: Dependencies installieren

```bash
# Backend Dependencies
npm install

# Frontend Dependencies
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

### Schritt 7.2: Environment-Datei erstellen

```bash
# .env aus Beispiel erstellen
cp .env.example .env

# Mit VS Code bearbeiten
code .env
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
DB_PASSWORD=AssixxPass123!
DB_NAME=assixx_db

# JWT Secret (generiere einen zufälligen String)
JWT_SECRET=dein_super_geheimer_jwt_schluessel_hier

# Session Secret
SESSION_SECRET=noch_ein_geheimer_session_schluessel

# E-Mail Konfiguration (optional für Entwicklung)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=deine.email@gmail.com
SMTP_PASS=dein_app_spezifisches_passwort
```

### Schritt 7.3: JWT Secret generieren (optional)

```bash
# Zufälligen String generieren
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Ausgabe in .env bei JWT_SECRET einfügen
```

## 8. Projekt starten

### Schritt 8.1: Development Server starten

```bash
# Im Hauptverzeichnis des Projekts
npm run dev

# Server läuft auf http://localhost:3000
```

### Schritt 8.2: Browser öffnen

1. Öffne Firefox/Chrome
2. Navigiere zu http://localhost:3000
3. Login-Seite sollte erscheinen

### Schritt 8.3: Test-Admin erstellen

```bash
# Neues Terminal öffnen (Strg+Shift+T)
cd ~/projects/Assixx/backend/utils/scripts

# Admin-Benutzer erstellen
node create-employee.js

# Folge den Anweisungen:
# - Rolle: root
# - E-Mail: admin@assixx.local
# - Passwort: sicheres Passwort wählen
```

## 9. Systemd Service (Optional)

Für automatischen Start beim Booten:

### Schritt 9.1: Service-Datei erstellen

```bash
# Service-Datei erstellen
sudo nano /etc/systemd/system/assixx.service
```

Inhalt:

```ini
[Unit]
Description=Assixx Application Server
After=network.target mysql.service

[Service]
Type=simple
User=dein-benutzername
WorkingDirectory=/home/dein-benutzername/projects/Assixx
Environment=NODE_ENV=production
ExecStart=/usr/bin/node backend/src/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Schritt 9.2: Service aktivieren

```bash
# Service neu laden
sudo systemctl daemon-reload

# Service aktivieren
sudo systemctl enable assixx

# Service starten
sudo systemctl start assixx

# Status prüfen
sudo systemctl status assixx
```

## 10. Fehlerbehebung

### Problem: EACCES npm Fehler

```bash
# npm Berechtigungen reparieren
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/lib/node_modules
```

### Problem: MySQL Verbindung verweigert

```bash
# MySQL Status prüfen
sudo systemctl status mysql

# MySQL Logs prüfen
sudo journalctl -u mysql -n 50

# MySQL neu starten
sudo systemctl restart mysql
```

### Problem: Port 3000 bereits belegt

```bash
# Prozess auf Port 3000 finden
sudo lsof -i :3000

# Oder mit netstat
sudo netstat -tulpn | grep :3000

# Prozess beenden
kill -9 <PID>
```

### Problem: Node Version zu alt

```bash
# Aktuelle Version prüfen
node --version

# NodeSource Repository neu hinzufügen
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y
```

### Firewall konfigurieren (falls aktiviert)

```bash
# UFW Status prüfen
sudo ufw status

# Port 3000 erlauben (nur Entwicklung!)
sudo ufw allow 3000/tcp

# Für Produktion: Nur SSH und HTTP/HTTPS
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
```

## 🚀 Produktive Tipps

### Alias für schnelleren Zugriff

```bash
# Zu .bashrc hinzufügen
echo "alias assixx='cd ~/projects/Assixx && npm run dev'" >> ~/.bashrc
source ~/.bashrc

# Jetzt einfach 'assixx' tippen zum Starten
```

### Git Aliases

```bash
# Nützliche Git Shortcuts
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.cm commit
```

### VS Code Extensions empfohlen

1. ESLint
2. Prettier
3. GitLens
4. MySQL (von Jun Han)
5. Thunder Client (API Testing)

## 🎉 Geschafft!

Dein Assixx-Entwicklungsumgebung ist bereit!

### 🐳 Bei Docker-Installation:

- Schnellzugriff: http://localhost:3000
- PhpMyAdmin: http://localhost:8080
- Container-Management: `docker compose -f docker-compose.dev.yml [command]`

### 🔧 Bei manueller Installation:

- Server läuft auf: http://localhost:3000
- Starten mit: `npm run dev`
- Stoppen mit: `Ctrl+C`

### Nächste Schritte:

- Lies [ARCHITECTURE.md](./ARCHITECTURE.md) für Projektstruktur
- Studiere [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md) für Best Practices
- Schaue dir [TODO.md](./TODO.md) für offene Aufgaben an
- Bei Docker: Siehe [DOCKER-SETUP.md](./DOCKER-SETUP.md) für Details

### Täglicher Workflow:

#### Mit Docker:

```bash
# Terminal öffnen
cd ~/projects/Assixx

# Neueste Änderungen holen
git pull

# Branch erstellen für neue Feature
git checkout -b feature/meine-neue-funktion

# Docker-Container starten
docker compose -f docker-compose.dev.yml up -d

# VS Code öffnen
code .
```

#### Mit manueller Installation:

```bash
# Terminal öffnen
cd ~/projects/Assixx

# Neueste Änderungen holen
git pull

# Branch erstellen für neue Feature
git checkout -b feature/meine-neue-funktion

# Development Server starten
npm run dev

# VS Code öffnen
code .
```

---

Bei Fragen:

- GitHub Issues: https://github.com/dein-org/Assixx/issues
- Team Chat
- Dokumentation im `/docs` Ordner
