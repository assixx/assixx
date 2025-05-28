# 🍎 Assixx Setup Guide für macOS

Dieser Guide führt dich Schritt für Schritt durch die komplette Einrichtung des Assixx-Projekts auf macOS.

## 📋 Voraussetzungen

- macOS 11 (Big Sur) oder höher
- Administratorrechte
- Mindestens 8 GB RAM
- 10 GB freier Speicherplatz
- Apple Command Line Tools

## 📚 Inhaltsverzeichnis

1. [System vorbereiten](#1-system-vorbereiten)
2. [Homebrew Installation](#2-homebrew-installation)
3. [VS Code Installation](#3-vs-code-installation)
4. [Git und GitHub Setup](#4-git-und-github-setup)
5. [Node.js Installation](#5-nodejs-installation)
6. [MySQL Installation](#6-mysql-installation)
7. [Projekt Setup](#7-projekt-setup)
8. [Datenbank Setup](#8-datenbank-setup)
9. [Projekt starten](#9-projekt-starten)
10. [LaunchAgent Setup (Optional)](#10-launchagent-setup-optional)
11. [Fehlerbehebung](#11-fehlerbehebung)

---

## 1. System vorbereiten

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

## 2. Homebrew Installation

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

## 3. VS Code Installation

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

## 4. Git und GitHub Setup

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

## 5. Node.js Installation

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

## 6. MySQL Installation

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

## 7. Projekt Setup

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

## 8. Datenbank Setup

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

## 9. Projekt starten

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

## 10. LaunchAgent Setup (Optional)

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

## 11. Fehlerbehebung

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
