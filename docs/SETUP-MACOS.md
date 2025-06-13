# 🍎 Assixx Setup Guide für macOS

> **🚀 SCHNELLSTART MIT DOCKER**: Für eine schnelle Einrichtung empfehlen wir die [Docker-Installation](#docker-setup-schnellstart). Die manuelle Installation ist für fortgeschrittene Benutzer oder spezielle Anforderungen gedacht.

Dieser Guide führt dich Schritt für Schritt durch die Einrichtung des Assixx-Projekts auf macOS.

## 📋 Voraussetzungen

- macOS 11 (Big Sur) oder höher
- Administratorrechte
- Mindestens 8 GB RAM
- 10 GB freier Speicherplatz

## 🔍 Überblick der Installationsmethoden

### 1. 🐳 Docker (Empfohlen - 15 Minuten)

- ✅ Schnellste Einrichtung
- ✅ Keine Systemkonfiguration nötig
- ✅ Isolierte Umgebung
- ✅ Einfache Updates
- ✅ Ideal für: Alle Benutzer

### 2. 🛠 Manuelle Installation (1-2 Stunden)

- ⚙️ Vollständige Kontrolle
- ⚙️ Native Performance
- ⚙️ Direkter Systemzugriff
- ⚠️ Komplexere Einrichtung
- 💻 Ideal für: Entwickler mit Erfahrung

## 📚 Inhaltsverzeichnis

1. [Docker Setup (Schnellstart)](#docker-setup-schnellstart)
2. [Manuelle Installation](#manuelle-installation)
   - [System vorbereiten](#1-system-vorbereiten-manuell)
   - [Homebrew Installation](#2-homebrew-installation-manuell)
   - [VS Code Installation](#3-vs-code-installation-manuell)
   - [Git und GitHub Setup](#4-git-und-github-setup-manuell)
   - [Node.js Installation](#5-nodejs-installation-manuell)
   - [MySQL Installation](#6-mysql-installation-manuell)
   - [Projekt Setup](#7-projekt-setup-manuell)
   - [Datenbank Setup](#8-datenbank-setup-manuell)
   - [Projekt starten](#9-projekt-starten-manuell)
   - [LaunchAgent Setup (Optional)](#10-launchagent-setup-optional-manuell)
   - [Fehlerbehebung](#11-fehlerbehebung-manuell)

---

## 🐳 Docker Setup (Schnellstart)

> **Zeit benötigt**: Etwa 15 Minuten

### Schritt 1: Docker Desktop installieren

1. **Docker Desktop herunterladen**:

   - Gehe zu [Docker Desktop für Mac](https://www.docker.com/products/docker-desktop/)
   - Wähle die richtige Version:
     - **Apple Silicon** (M1/M2/M3): "Mac with Apple Chip"
     - **Intel**: "Mac with Intel Chip"
   - Lade die .dmg Datei herunter

2. **Installation**:

   - Öffne die heruntergeladene .dmg Datei
   - Ziehe Docker.app in den Applications Ordner
   - Starte Docker aus dem Applications Ordner
   - Folge dem Einrichtungsassistenten

3. **Docker verifizieren**:
   ```bash
   # Terminal öffnen (Cmd + Space, "Terminal" eingeben)
   docker --version
   docker-compose --version
   ```

### Schritt 2: Projekt klonen

```bash
# Entwicklungsordner erstellen
mkdir -p ~/Development/projects
cd ~/Development/projects

# Repository klonen
git clone https://github.com/SCS-Technik/Assixx.git
cd Assixx
```

### Schritt 3: Docker Container starten

```bash
# Environment-Datei erstellen
cp .env.docker .env

# Container starten
docker-compose up -d

# Logs anzeigen (optional)
docker-compose logs -f
```

### Schritt 4: Anwendung öffnen

1. Warte etwa 30 Sekunden bis alle Services gestartet sind
2. Öffne deinen Browser
3. Gehe zu http://localhost:3000
4. Fertig! 🎉

### Schritt 5: Admin-Zugang

- **Email**: admin@assixx.local
- **Passwort**: Admin123!

> **Weitere Informationen**: Siehe [DOCKER-SETUP.md](./DOCKER-SETUP.md) für detaillierte Docker-Konfigurationen und Befehle.

---

## 🛠 Manuelle Installation

> **Hinweis**: Die folgenden Abschnitte sind für die manuelle Installation gedacht. Wenn du Docker verwendest, kannst du diese überspringen.

## 1. System vorbereiten (Manuell)

### Schritt 1.1: Terminal öffnen

- Drücke `Cmd + Leertaste` (Spotlight)
- Tippe "Terminal"
- Enter drücken

### Schritt 1.2: Command Line Tools installieren

```bash
# Xcode Command Line Tools installieren
xcode-select --install

# Im Popup auf "Installieren" klicken
# Warte bis Installation abgeschlossen ist (5-10 Minuten)

# Installation prüfen
xcode-select -p
# Sollte ausgeben: /Library/Developer/CommandLineTools
```

## 2. Homebrew Installation (Manuell)

### Schritt 2.1: Homebrew installieren

```bash
# Homebrew Installationsscript ausführen
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Folge den Anweisungen im Terminal
# Passwort eingeben wenn gefragt
```

### Schritt 2.2: Homebrew zum PATH hinzufügen

```bash
# Für Apple Silicon Macs (M1/M2/M3)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

# Für Intel Macs
echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/usr/local/bin/brew shellenv)"

# Homebrew Version prüfen
brew --version
```

### Schritt 2.3: Homebrew aktualisieren

```bash
# Homebrew updaten
brew update

# Homebrew upgraden
brew upgrade
```

## 3. VS Code Installation (Manuell)

### Schritt 3.1: VS Code mit Homebrew installieren

```bash
# VS Code installieren
brew install --cask visual-studio-code

# Installation prüfen
code --version
```

### Schritt 3.2: VS Code zum PATH hinzufügen (falls nötig)

```bash
# PATH prüfen
which code

# Falls nicht gefunden, manuell hinzufügen
sudo ln -s "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" /usr/local/bin/code
```

### Schritt 3.3: VS Code Shell-Befehl installieren

1. Öffne VS Code
2. Drücke `Cmd + Shift + P`
3. Tippe "Shell Command: Install 'code' command in PATH"
4. Enter drücken

## 4. Git und GitHub Setup (Manuell)

### Schritt 4.1: Git installieren

```bash
# Git installieren (neueste Version)
brew install git

# Version prüfen
git --version

# macOS Git durch Homebrew Git ersetzen
echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Schritt 4.2: Git konfigurieren

```bash
# Name setzen
git config --global user.name "Dein Name"

# E-Mail setzen (gleiche wie GitHub!)
git config --global user.email "deine.email@example.com"

# VS Code als Standard-Editor
git config --global core.editor "code --wait"

# macOS-spezifische Einstellungen
git config --global core.ignorecase false
git config --global init.defaultBranch main

# Konfiguration anzeigen
git config --list
```

### Schritt 4.3: SSH-Schlüssel erstellen

```bash
# SSH-Verzeichnis erstellen
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# SSH-Schlüssel generieren
ssh-keygen -t ed25519 -C "deine.email@example.com"

# Bei allen Fragen Enter drücken

# SSH-Agent konfigurieren
eval "$(ssh-agent -s)"

# SSH-Config erstellen/bearbeiten
touch ~/.ssh/config
echo "Host *
  AddKeysToAgent yes
  UseKeychain yes
  IdentityFile ~/.ssh/id_ed25519" >> ~/.ssh/config

# Schlüssel zum SSH-Agent hinzufügen
ssh-add --apple-use-keychain ~/.ssh/id_ed25519

# Öffentlichen Schlüssel kopieren
pbcopy < ~/.ssh/id_ed25519.pub
echo "SSH-Schlüssel wurde in die Zwischenablage kopiert!"
```

### Schritt 4.4: SSH-Schlüssel zu GitHub hinzufügen

1. Öffne https://github.com/settings/keys
2. Klicke auf "New SSH key"
3. Title: "MacBook Pro" (oder dein Gerätename)
4. Key: Cmd+V (Schlüssel einfügen)
5. Klicke auf "Add SSH key"

### Schritt 4.5: Verbindung testen

```bash
# GitHub Verbindung testen
ssh -T git@github.com

# Bei "Are you sure...?" mit "yes" antworten
# Erfolg: "Hi username! You've successfully authenticated..."
```

## 5. Node.js Installation (Manuell)

### Schritt 5.1: Node.js mit nvm installieren

```bash
# nvm installieren
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# nvm zum Shell-Profil hinzufügen
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.zshrc
echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"' >> ~/.zshrc

# Shell neu laden
source ~/.zshrc

# Node.js 20 LTS installieren
nvm install 20
nvm use 20
nvm alias default 20

# Versionen prüfen
node --version  # sollte v20.x.x zeigen
npm --version   # sollte 10.x.x zeigen
```

## 6. MySQL Installation (Manuell)

### Schritt 6.1: MySQL mit Homebrew installieren

```bash
# MySQL 8.0 installieren
brew install mysql

# MySQL Service starten
brew services start mysql

# Installation prüfen
mysql --version
```

### Schritt 6.2: MySQL absichern

```bash
# Sicherheitsscript ausführen
mysql_secure_installation

# Antworten:
# - Would you like to setup VALIDATE PASSWORD component: n
# - New password: sicheres_passwort
# - Re-enter new password: passwort_wiederholen
# - Remove anonymous users: y
# - Disallow root login remotely: y
# - Remove test database: y
# - Reload privilege tables: y
```

### Schritt 6.3: MySQL Benutzer und Datenbank erstellen

```bash
# Als root einloggen
mysql -u root -p
# Root-Passwort eingeben
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

-- Überprüfen
SHOW DATABASES;
SELECT User, Host FROM mysql.user;

-- MySQL verlassen
EXIT;
```

### Schritt 6.4: MySQL GUI installieren (optional)

```bash
# TablePlus installieren (empfohlen)
brew install --cask tableplus

# Oder Sequel Pro
brew install --cask sequel-pro
```

## 7. Projekt Setup (Manuell)

### Schritt 7.1: Entwicklungsordner erstellen

```bash
# Zum Home-Verzeichnis
cd ~

# Entwicklungsordner erstellen
mkdir -p Development/projects
cd Development/projects
```

### Schritt 7.2: Repository klonen

```bash
# Mit SSH (empfohlen)
git clone git@github.com:dein-username/Assixx.git

# ODER mit HTTPS
git clone https://github.com/dein-username/Assixx.git

# In Projektverzeichnis wechseln
cd Assixx
```

### Schritt 7.3: Projekt in VS Code öffnen

```bash
# VS Code öffnen
code .
```

### Schritt 7.4: Dependencies installieren

```bash
# Backend Dependencies
npm install

# Frontend Dependencies
cd frontend
npm install

# Zurück zum Hauptverzeichnis
cd ..
```

## 8. Datenbank Setup (Manuell)

### Schritt 8.1: Datenbankschema importieren

```bash
# Schema importieren
mysql -u assixx_user -p assixx_db < database-setup.sql
# Passwort eingeben
```

### Schritt 8.2: Environment-Datei konfigurieren

```bash
# .env aus Vorlage erstellen
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

# JWT Secret (generiere einen sicheren Schlüssel)
JWT_SECRET=dein_super_sicherer_jwt_schluessel_hier_eingeben

# Session Secret
SESSION_SECRET=noch_ein_sicherer_session_schluessel

# E-Mail Konfiguration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=deine.email@gmail.com
SMTP_PASS=app_spezifisches_passwort
```

### Schritt 8.3: Sichere Secrets generieren

```bash
# JWT Secret generieren
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Session Secret generieren
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Ausgaben in .env kopieren
```

## 9. Projekt starten (Manuell)

### Schritt 9.1: Development Server starten

```bash
# Im Projekthauptverzeichnis
npm run dev

# Server läuft auf http://localhost:3000
```

### Schritt 9.2: Anwendung im Browser öffnen

1. Öffne Safari/Chrome/Firefox
2. Gehe zu http://localhost:3000
3. Login-Seite sollte erscheinen

### Schritt 9.3: Admin-Benutzer erstellen

```bash
# Neues Terminal-Tab öffnen (Cmd+T)
cd ~/Development/projects/Assixx/backend/utils/scripts

# Admin erstellen
node create-employee.js

# Anweisungen folgen:
# - Rolle: root
# - E-Mail: admin@assixx.local
# - Passwort: sicheres Passwort
```

## 10. LaunchAgent Setup (Optional) (Manuell)

Für automatischen Start:

### Schritt 10.1: LaunchAgent erstellen

```bash
# LaunchAgents Verzeichnis erstellen
mkdir -p ~/Library/LaunchAgents

# Plist-Datei erstellen
nano ~/Library/LaunchAgents/com.assixx.server.plist
```

Inhalt:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.assixx.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/DEIN_BENUTZERNAME/.nvm/versions/node/v20.11.0/bin/node</string>
        <string>/Users/DEIN_BENUTZERNAME/Development/projects/Assixx/backend/src/server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/DEIN_BENUTZERNAME/Development/projects/Assixx</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/DEIN_BENUTZERNAME/Library/Logs/assixx.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/DEIN_BENUTZERNAME/Library/Logs/assixx.error.log</string>
</dict>
</plist>
```

### Schritt 10.2: LaunchAgent aktivieren

```bash
# DEIN_BENUTZERNAME durch deinen ersetzen
sed -i '' "s/DEIN_BENUTZERNAME/$(whoami)/g" ~/Library/LaunchAgents/com.assixx.server.plist

# LaunchAgent laden
launchctl load ~/Library/LaunchAgents/com.assixx.server.plist

# Status prüfen
launchctl list | grep assixx
```

## 11. Fehlerbehebung (Manuell)

### Problem: brew command not found

```bash
# Homebrew PATH neu setzen (Apple Silicon)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

# Für Intel Macs
echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/usr/local/bin/brew shellenv)"
```

### Problem: MySQL Verbindung schlägt fehl

```bash
# MySQL Status prüfen
brew services list

# MySQL neu starten
brew services restart mysql

# MySQL Logs prüfen
tail -f /opt/homebrew/var/mysql/*.err
```

### Problem: Port 3000 bereits belegt

```bash
# Prozess auf Port finden
lsof -i :3000

# Prozess beenden
kill -9 <PID>

# Oder alle Node-Prozesse beenden
killall node
```

### Problem: npm Berechtigungsfehler

```bash
# npm Cache löschen
npm cache clean --force

# Global npm Verzeichnis prüfen
npm config get prefix

# Bei Problemen neu setzen
npm config set prefix /usr/local
```

### Problem: nvm command not found

```bash
# Shell-Profil neu laden
source ~/.zshrc

# Oder für bash
source ~/.bash_profile

# nvm manuell laden
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

## 🛠 Entwickler-Tools

### Empfohlene VS Code Extensions

```bash
# Extension Pack installieren
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension eamodio.gitlens
code --install-extension formulahendry.auto-rename-tag
code --install-extension christian-kohler.npm-intellisense
```

### Nützliche macOS Tools

```bash
# HTTPie für API Tests
brew install httpie

# jq für JSON Verarbeitung
brew install jq

# tree für Verzeichnisstruktur
brew install tree

# GitHub CLI
brew install gh
```

### Entwicklungs-Aliases

```bash
# Zu ~/.zshrc hinzufügen
echo 'alias assixx="cd ~/Development/projects/Assixx && npm run dev"' >> ~/.zshrc
echo 'alias gs="git status"' >> ~/.zshrc
echo 'alias gc="git commit"' >> ~/.zshrc
echo 'alias gp="git push"' >> ~/.zshrc
echo 'alias gl="git pull"' >> ~/.zshrc
source ~/.zshrc
```

## 🎉 Fertig!

Deine Assixx-Entwicklungsumgebung auf macOS ist eingerichtet!

### Nächste Schritte:

- Erkunde [ARCHITECTURE.md](./ARCHITECTURE.md) für die Systemarchitektur
- Lies [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md) für Coding-Standards
- Checke [TODO.md](./TODO.md) für offene Aufgaben

### Täglicher Workflow:

```bash
# Terminal öffnen (Cmd+Space, "Terminal")
cd ~/Development/projects/Assixx

# Git Status prüfen
git status

# Neueste Änderungen holen
git pull

# Feature-Branch erstellen
git checkout -b feature/neue-funktion

# Server starten
npm run dev

# VS Code öffnen
code .
```

### Keyboard Shortcuts:

- `Cmd + Space`: Spotlight (Apps suchen)
- `Cmd + Tab`: Zwischen Apps wechseln
- `Cmd + ~`: Zwischen Fenstern einer App wechseln
- `Cmd + T`: Neuer Tab im Terminal
- `Cmd + K`: Terminal leeren

---

Support:

- GitHub Issues erstellen
- Team Slack/Discord
- Stack Overflow für allgemeine Fragen
