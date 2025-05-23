#!/bin/bash

# =====================================================
# ASSIXX AUTOMATISCHES SETUP SCRIPT FÜR WSL UBUNTU
# SaaS Platform für Industrieunternehmen
# Version: 2025-01-23
# =====================================================

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Konfiguration
DB_NAME="assixx_db"
DB_USER="assixx_user"
DB_PASSWORD="$(openssl rand -base64 32)"
ROOT_DB_PASSWORD=""

# Logging
LOG_FILE="assixx-setup.log"
exec 1> >(tee -a "$LOG_FILE")
exec 2> >(tee -a "$LOG_FILE" >&2)

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}    ASSIXX SETUP SCRIPT FÜR WSL UBUNTU${NC}"
echo -e "${BLUE}    $(date)${NC}"
echo -e "${BLUE}======================================================${NC}"

# Funktion: Prüfe ob Befehl existiert
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Funktion: Prüfe Root-Rechte
check_root() {
    if [[ $EUID -eq 0 ]]; then
        echo -e "${RED}Bitte führen Sie dieses Script NICHT als root aus!${NC}"
        echo -e "${YELLOW}Das Script wird sudo verwenden wenn nötig.${NC}"
        exit 1
    fi
}

# Funktion: System aktualisieren
update_system() {
    echo -e "${YELLOW}System wird aktualisiert...${NC}"
    sudo apt update && sudo apt upgrade -y
    if [ $? -ne 0 ]; then
        echo -e "${RED}Fehler beim System-Update!${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ System erfolgreich aktualisiert${NC}"
}

# Funktion: Node.js installieren
install_nodejs() {
    if command_exists node; then
        NODE_VERSION=$(node --version)
        echo -e "${GREEN}✓ Node.js bereits installiert: $NODE_VERSION${NC}"
        return
    fi

    echo -e "${YELLOW}Node.js wird installiert...${NC}"
    
    # NodeSource Repository hinzufügen
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Fehler bei der Node.js Installation!${NC}"
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓ Node.js installiert: $NODE_VERSION${NC}"
    echo -e "${GREEN}✓ npm installiert: $NPM_VERSION${NC}"
}

# Funktion: MySQL installieren und konfigurieren
install_mysql() {
    if command_exists mysql; then
        echo -e "${GREEN}✓ MySQL bereits installiert${NC}"
        return
    fi

    echo -e "${YELLOW}MySQL wird installiert...${NC}"
    
    # MySQL Server installieren
    sudo apt install -y mysql-server mysql-client
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Fehler bei der MySQL Installation!${NC}"
        exit 1
    fi
    
    # MySQL starten und aktivieren
    sudo systemctl start mysql
    sudo systemctl enable mysql
    
    echo -e "${GREEN}✓ MySQL erfolgreich installiert und gestartet${NC}"
    echo -e "${YELLOW}MySQL wird konfiguriert...${NC}"
    
    # MySQL sichern
    sudo mysql_secure_installation
    
    echo -e "${GREEN}✓ MySQL Sicherheitskonfiguration abgeschlossen${NC}"
}

# Funktion: MySQL Root-Passwort abfragen
get_mysql_root_password() {
    echo -e "${YELLOW}MySQL Root-Passwort eingeben:${NC}"
    read -s ROOT_DB_PASSWORD
    echo
    
    # Verbindung testen
    mysql -u root -p"$ROOT_DB_PASSWORD" -e "SELECT 1;" >/dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo -e "${RED}Ungültiges MySQL Root-Passwort!${NC}"
        get_mysql_root_password
    fi
}

# Funktion: Git installieren
install_git() {
    if command_exists git; then
        GIT_VERSION=$(git --version)
        echo -e "${GREEN}✓ Git bereits installiert: $GIT_VERSION${NC}"
        return
    fi

    echo -e "${YELLOW}Git wird installiert...${NC}"
    sudo apt install -y git
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Fehler bei der Git Installation!${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Git erfolgreich installiert${NC}"
}

# Funktion: Weitere Tools installieren
install_additional_tools() {
    echo -e "${YELLOW}Zusätzliche Tools werden installiert...${NC}"
    
    sudo apt install -y \
        curl \
        wget \
        unzip \
        build-essential \
        openssl \
        ca-certificates \
        gnupg \
        lsb-release
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Fehler bei der Installation zusätzlicher Tools!${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Zusätzliche Tools erfolgreich installiert${NC}"
}

# Funktion: Assixx Projekt klonen
clone_project() {
    if [ -d "Assixx" ]; then
        echo -e "${GREEN}✓ Assixx Projekt bereits vorhanden${NC}"
        cd Assixx
        return
    fi

    echo -e "${YELLOW}Assixx Projekt wird geklont...${NC}"
    
    # Repository URL abfragen
    echo -e "${BLUE}Geben Sie die Git Repository URL ein:${NC}"
    read -p "URL: " REPO_URL
    
    if [ -z "$REPO_URL" ]; then
        echo -e "${RED}Keine Repository URL angegeben!${NC}"
        exit 1
    fi
    
    git clone "$REPO_URL" Assixx
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Fehler beim Klonen des Repositories!${NC}"
        exit 1
    fi
    
    cd Assixx
    echo -e "${GREEN}✓ Projekt erfolgreich geklont${NC}"
}

# Funktion: npm Abhängigkeiten installieren
install_dependencies() {
    echo -e "${YELLOW}NPM Abhängigkeiten werden installiert...${NC}"
    
    cd server
    npm install
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Fehler bei der Installation der NPM Abhängigkeiten!${NC}"
        exit 1
    fi
    
    cd ..
    echo -e "${GREEN}✓ NPM Abhängigkeiten erfolgreich installiert${NC}"
}

# Funktion: Datenbank erstellen
setup_database() {
    echo -e "${YELLOW}Datenbank wird erstellt...${NC}"
    
    # Datenbank-Benutzer erstellen
    mysql -u root -p"$ROOT_DB_PASSWORD" << EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF

    if [ $? -ne 0 ]; then
        echo -e "${RED}Fehler beim Erstellen der Datenbank!${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Datenbank '$DB_NAME' erstellt${NC}"
    echo -e "${GREEN}✓ Benutzer '$DB_USER' erstellt${NC}"
    
    # Datenbankschema importieren
    echo -e "${YELLOW}Datenbankschema wird importiert...${NC}"
    
    mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < database-setup.sql
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Fehler beim Importieren des Datenbankschemas!${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Datenbankschema erfolgreich importiert${NC}"
}

# Funktion: .env Datei erstellen
create_env_file() {
    echo -e "${YELLOW}.env Datei wird erstellt...${NC}"
    
    # JWT Secret generieren
    JWT_SECRET=$(openssl rand -base64 64)
    SESSION_SECRET=$(openssl rand -base64 64)
    ENCRYPTION_KEY=$(openssl rand -hex 64)
    
    cat > server/.env << EOF
# Assixx Environment Configuration
# Automatisch generiert am $(date)

# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
DB_HOST=localhost
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME

# Security Configuration
JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AUTH_MAX=5

# Feature Flags
ENABLE_ENCRYPTION_AT_REST=false
ENABLE_AUDIT_LOGS=true
USE_MOCK_DB=false

# Email Configuration (optional - für spätere Konfiguration)
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASSWORD=
# EMAIL_FROM=noreply@assixx.com
EOF

    if [ $? -ne 0 ]; then
        echo -e "${RED}Fehler beim Erstellen der .env Datei!${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ .env Datei erfolgreich erstellt${NC}"
}

# Funktion: Firewall konfigurieren
configure_firewall() {
    echo -e "${YELLOW}Firewall wird konfiguriert...${NC}"
    
    sudo ufw allow 3000/tcp
    sudo ufw --force enable
    
    echo -e "${GREEN}✓ Firewall konfiguriert (Port 3000 geöffnet)${NC}"
}

# Funktion: Systemdienst erstellen (optional)
create_systemd_service() {
    echo -e "${YELLOW}Möchten Sie einen systemd Service erstellen? (y/n)${NC}"
    read -p "Service erstellen: " CREATE_SERVICE
    
    if [[ $CREATE_SERVICE =~ ^[Yy]$ ]]; then
        sudo tee /etc/systemd/system/assixx.service > /dev/null << EOF
[Unit]
Description=Assixx SaaS Platform
After=network.target mysql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)/server
ExecStart=$(which node) index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
        
        sudo systemctl daemon-reload
        sudo systemctl enable assixx
        
        echo -e "${GREEN}✓ Systemd Service 'assixx' erstellt und aktiviert${NC}"
        echo -e "${YELLOW}Starten mit: sudo systemctl start assixx${NC}"
    fi
}

# Funktion: Abschluss-Informationen anzeigen
show_completion_info() {
    echo
    echo -e "${BLUE}======================================================${NC}"
    echo -e "${GREEN}    ASSIXX SETUP ERFOLGREICH ABGESCHLOSSEN!${NC}"
    echo -e "${BLUE}======================================================${NC}"
    echo
    echo -e "${YELLOW}Datenbank-Informationen:${NC}"
    echo -e "  Host: localhost"
    echo -e "  Datenbank: $DB_NAME"
    echo -e "  Benutzer: $DB_USER"
    echo -e "  Passwort: $DB_PASSWORD"
    echo
    echo -e "${YELLOW}Anwendung starten:${NC}"
    echo -e "  cd $(pwd)/server"
    echo -e "  npm start"
    echo
    echo -e "${YELLOW}Anwendung aufrufen:${NC}"
    echo -e "  http://localhost:3000"
    echo
    echo -e "${YELLOW}Erste Schritte:${NC}"
    echo -e "  1. Gehen Sie zu http://localhost:3000/signup.html"
    echo -e "  2. Erstellen Sie Ihr erstes Unternehmen (Tenant)"
    echo -e "  3. Melden Sie sich als Admin an"
    echo -e "  4. Richten Sie Abteilungen und Teams ein"
    echo -e "  5. Fügen Sie Mitarbeiter hinzu"
    echo
    echo -e "${GREEN}Das Log wurde gespeichert in: $LOG_FILE${NC}"
    echo -e "${BLUE}======================================================${NC}"
    
    # Wichtige Informationen in Datei speichern
    cat > assixx-credentials.txt << EOF
# ASSIXX SETUP INFORMATIONEN
# Generiert am: $(date)

## Datenbank
Host: localhost
Datenbank: $DB_NAME
Benutzer: $DB_USER
Passwort: $DB_PASSWORD

## Anwendung
URL: http://localhost:3000
Projekt Pfad: $(pwd)

## Erste Schritte
1. cd $(pwd)/server
2. npm start
3. Browser öffnen: http://localhost:3000/signup.html
4. Erstes Unternehmen erstellen

## Wichtige Befehle
Anwendung starten: cd $(pwd)/server && npm start
Anwendung stoppen: Ctrl+C
Logs anzeigen: tail -f $(pwd)/server/combined.log
Datenbank zugreifen: mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME

WARNUNG: Diese Datei enthält sensible Informationen! 
Sicher aufbewahren und nicht in Git committen!
EOF

    echo -e "${YELLOW}Anmeldedaten gespeichert in: assixx-credentials.txt${NC}"
}

# Hauptfunktion
main() {
    echo -e "${BLUE}Starte Assixx Setup für WSL Ubuntu...${NC}"
    
    check_root
    update_system
    install_additional_tools
    install_nodejs
    install_git
    install_mysql
    get_mysql_root_password
    clone_project
    install_dependencies
    setup_database
    create_env_file
    configure_firewall
    create_systemd_service
    show_completion_info
}

# Script ausführen
main "$@"