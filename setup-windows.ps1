# =====================================================
# ASSIXX AUTOMATISCHES SETUP SCRIPT FÜR WINDOWS
# SaaS Platform für Industrieunternehmen
# Version: 2025-01-23
# Erfordert PowerShell als Administrator
# =====================================================

# Überprüfung ob als Administrator ausgeführt
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "FEHLER: Dieses Script muss als Administrator ausgeführt werden!" -ForegroundColor Red
    Write-Host "Rechtsklick auf PowerShell -> Als Administrator ausführen" -ForegroundColor Yellow
    Read-Host "Drücken Sie Enter zum Beenden"
    exit 1
}

# Farb-Funktionen
function Write-Success { param($Message) Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "⚠ $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "✗ $Message" -ForegroundColor Red }
function Write-Info { param($Message) Write-Host "ℹ $Message" -ForegroundColor Blue }

# Konfiguration
$DBName = "assixx_db"
$DBUser = "assixx_user"
$DBPassword = -join ((1..32) | ForEach {[char](Get-Random -Min 65 -Max 91)})
$ProjectPath = "C:\Assixx"
$LogFile = "assixx-setup.log"

# Logging-Funktion
function Write-Log {
    param($Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$Timestamp - $Message" | Out-File -FilePath $LogFile -Append
    Write-Host $Message
}

Write-Host "======================================================" -ForegroundColor Blue
Write-Host "    ASSIXX SETUP SCRIPT FÜR WINDOWS" -ForegroundColor Blue
Write-Host "    $(Get-Date)" -ForegroundColor Blue
Write-Host "======================================================" -ForegroundColor Blue

Write-Log "Starte Assixx Setup für Windows..."

# Funktion: Chocolatey installieren
function Install-Chocolatey {
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Success "Chocolatey bereits installiert"
        return
    }
    
    Write-Warning "Chocolatey wird installiert..."
    
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Fehler bei der Chocolatey Installation!"
        exit 1
    }
    
    # PowerShell-Session aktualisieren
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    Write-Success "Chocolatey erfolgreich installiert"
}

# Funktion: Node.js installieren
function Install-NodeJS {
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $NodeVersion = node --version
        Write-Success "Node.js bereits installiert: $NodeVersion"
        return
    }
    
    Write-Warning "Node.js wird installiert..."
    
    choco install nodejs -y
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Fehler bei der Node.js Installation!"
        exit 1
    }
    
    # PowerShell-Session aktualisieren
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    $NodeVersion = node --version
    $NpmVersion = npm --version
    Write-Success "Node.js installiert: $NodeVersion"
    Write-Success "npm installiert: $NpmVersion"
}

# Funktion: Git installieren
function Install-Git {
    if (Get-Command git -ErrorAction SilentlyContinue) {
        $GitVersion = git --version
        Write-Success "Git bereits installiert: $GitVersion"
        return
    }
    
    Write-Warning "Git wird installiert..."
    
    choco install git -y
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Fehler bei der Git Installation!"
        exit 1
    }
    
    # PowerShell-Session aktualisieren
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    Write-Success "Git erfolgreich installiert"
}

# Funktion: MySQL installieren
function Install-MySQL {
    if (Get-Command mysql -ErrorAction SilentlyContinue) {
        Write-Success "MySQL bereits installiert"
        return
    }
    
    Write-Warning "MySQL wird installiert..."
    
    # MySQL über Chocolatey installieren
    choco install mysql -y
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Fehler bei der MySQL Installation!"
        exit 1
    }
    
    # PowerShell-Session aktualisieren
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    Write-Success "MySQL erfolgreich installiert"
    
    # MySQL-Service starten
    Write-Warning "MySQL-Service wird gestartet..."
    Start-Service MySQL
    Set-Service MySQL -StartupType Automatic
    
    Write-Success "MySQL-Service gestartet und auf automatischen Start gesetzt"
    
    # Root-Passwort setzen
    Write-Warning "MySQL Root-Passwort wird konfiguriert..."
    $MySQLRootPassword = Read-Host "Geben Sie ein sicheres Root-Passwort für MySQL ein" -AsSecureString
    $MySQLRootPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($MySQLRootPassword))
    
    # MySQL-Root-Passwort setzen
    try {
        mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$MySQLRootPasswordPlain';"
        Write-Success "MySQL Root-Passwort erfolgreich gesetzt"
        return $MySQLRootPasswordPlain
    }
    catch {
        Write-Warning "Root-Passwort möglicherweise bereits gesetzt"
        $MySQLRootPasswordPlain = Read-Host "Geben Sie das aktuelle MySQL Root-Passwort ein" -AsSecureString
        return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($MySQLRootPasswordPlain))
    }
}

# Funktion: Projekt erstellen/klonen
function Setup-Project {
    Write-Warning "Projekterstellung..."
    
    # Projektordner erstellen
    if (Test-Path $ProjectPath) {
        Write-Warning "Projektordner existiert bereits: $ProjectPath"
        $Overwrite = Read-Host "Möchten Sie den Ordner überschreiben? (y/N)"
        if ($Overwrite -eq "y" -or $Overwrite -eq "Y") {
            Remove-Item $ProjectPath -Recurse -Force
        } else {
            Write-Info "Verwende bestehenden Projektordner"
            Set-Location $ProjectPath
            return
        }
    }
    
    # Repository URL abfragen
    Write-Info "Geben Sie die Git Repository URL ein (oder lassen Sie es leer für lokale Kopie):"
    $RepoURL = Read-Host "Repository URL"
    
    if ([string]::IsNullOrWhiteSpace($RepoURL)) {
        Write-Warning "Lokaler Projektordner wird erstellt..."
        New-Item -ItemType Directory -Path $ProjectPath -Force
        Set-Location $ProjectPath
        
        # Grundstruktur erstellen
        New-Item -ItemType Directory -Path "server" -Force
        
        Write-Info "Kopieren Sie das Assixx-Projekt manuell in diesen Ordner: $ProjectPath"
        Read-Host "Drücken Sie Enter wenn Sie das Projekt kopiert haben"
    } else {
        Write-Warning "Repository wird geklont..."
        git clone $RepoURL $ProjectPath
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Fehler beim Klonen des Repositories!"
            exit 1
        }
        
        Set-Location $ProjectPath
        Write-Success "Projekt erfolgreich geklont"
    }
}

# Funktion: NPM-Abhängigkeiten installieren
function Install-Dependencies {
    Write-Warning "NPM-Abhängigkeiten werden installiert..."
    
    if (-not (Test-Path "server\package.json")) {
        Write-Error "package.json nicht gefunden! Stellen Sie sicher, dass das Projekt korrekt kopiert wurde."
        exit 1
    }
    
    Set-Location "server"
    npm install
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Fehler bei der Installation der NPM-Abhängigkeiten!"
        exit 1
    }
    
    Set-Location ..
    Write-Success "NPM-Abhängigkeiten erfolgreich installiert"
}

# Funktion: Datenbank einrichten
function Setup-Database {
    param($RootPassword)
    
    Write-Warning "Datenbank wird eingerichtet..."
    
    # Datenbank und Benutzer erstellen
    $MySQLCommands = @"
CREATE DATABASE IF NOT EXISTS $DBName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DBUser'@'localhost' IDENTIFIED BY '$DBPassword';
GRANT ALL PRIVILEGES ON $DBName.* TO '$DBUser'@'localhost';
FLUSH PRIVILEGES;
"@
    
    try {
        $MySQLCommands | mysql -u root -p$RootPassword
        Write-Success "Datenbank '$DBName' erstellt"
        Write-Success "Benutzer '$DBUser' erstellt"
    }
    catch {
        Write-Error "Fehler beim Erstellen der Datenbank: $_"
        exit 1
    }
    
    # Datenbankschema importieren
    if (Test-Path "database-setup.sql") {
        Write-Warning "Datenbankschema wird importiert..."
        try {
            Get-Content "database-setup.sql" | mysql -u $DBUser -p$DBPassword $DBName
            Write-Success "Datenbankschema erfolgreich importiert"
        }
        catch {
            Write-Error "Fehler beim Importieren des Datenbankschemas: $_"
            exit 1
        }
    } else {
        Write-Warning "database-setup.sql nicht gefunden - manueller Import erforderlich"
    }
}

# Funktion: .env-Datei erstellen
function Create-EnvFile {
    Write-Warning ".env-Datei wird erstellt..."
    
    # Zufällige Secrets generieren
    $JWTSecret = -join ((1..64) | ForEach {[char](Get-Random -Min 48 -Max 123)})
    $SessionSecret = -join ((1..64) | ForEach {[char](Get-Random -Min 48 -Max 123)})
    $EncryptionKey = -join ((1..64) | ForEach {[char](Get-Random -Min 48 -Max 123)})
    
    $EnvContent = @"
# Assixx Environment Configuration
# Automatisch generiert am $(Get-Date)

# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
DB_HOST=localhost
DB_USER=$DBUser
DB_PASSWORD=$DBPassword
DB_NAME=$DBName

# Security Configuration
JWT_SECRET=$JWTSecret
SESSION_SECRET=$SessionSecret
ENCRYPTION_KEY=$EncryptionKey

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
"@
    
    Set-Content -Path "server\.env" -Value $EnvContent
    Write-Success ".env-Datei erfolgreich erstellt"
}

# Funktion: Windows Firewall konfigurieren
function Configure-Firewall {
    Write-Warning "Windows Firewall wird konfiguriert..."
    
    try {
        New-NetFirewallRule -DisplayName "Assixx Server" -Direction Inbound -Port 3000 -Protocol TCP -Action Allow
        Write-Success "Firewall-Regel für Port 3000 erstellt"
    }
    catch {
        Write-Warning "Firewall-Regel konnte nicht erstellt werden: $_"
        Write-Info "Öffnen Sie Port 3000 manuell in der Windows Firewall"
    }
}

# Funktion: Windows-Service erstellen (optional)
function Create-WindowsService {
    $CreateService = Read-Host "Möchten Sie einen Windows-Service erstellen? (y/N)"
    
    if ($CreateService -eq "y" -or $CreateService -eq "Y") {
        Write-Warning "Windows-Service wird erstellt..."
        
        # NSSM (Non-Sucking Service Manager) installieren
        if (-not (Get-Command nssm -ErrorAction SilentlyContinue)) {
            choco install nssm -y
        }
        
        $NodePath = (Get-Command node).Source
        $AppPath = Join-Path $ProjectPath "server\index.js"
        
        # Service erstellen
        nssm install AssixxService $NodePath $AppPath
        nssm set AssixxService AppDirectory (Join-Path $ProjectPath "server")
        nssm set AssixxService DisplayName "Assixx SaaS Platform"
        nssm set AssixxService Description "Assixx SaaS Platform für Industrieunternehmen"
        
        Write-Success "Windows-Service 'AssixxService' erstellt"
        Write-Info "Starten mit: net start AssixxService"
        Write-Info "Stoppen mit: net stop AssixxService"
    }
}

# Funktion: Abschluss-Informationen
function Show-CompletionInfo {
    Write-Host ""
    Write-Host "======================================================" -ForegroundColor Blue
    Write-Host "    ASSIXX SETUP ERFOLGREICH ABGESCHLOSSEN!" -ForegroundColor Green
    Write-Host "======================================================" -ForegroundColor Blue
    Write-Host ""
    
    Write-Host "Datenbank-Informationen:" -ForegroundColor Yellow
    Write-Host "  Host: localhost"
    Write-Host "  Datenbank: $DBName"
    Write-Host "  Benutzer: $DBUser"
    Write-Host "  Passwort: $DBPassword"
    Write-Host ""
    
    Write-Host "Anwendung starten:" -ForegroundColor Yellow
    Write-Host "  cd $ProjectPath\server"
    Write-Host "  npm start"
    Write-Host ""
    
    Write-Host "Anwendung aufrufen:" -ForegroundColor Yellow
    Write-Host "  http://localhost:3000"
    Write-Host ""
    
    Write-Host "Erste Schritte:" -ForegroundColor Yellow
    Write-Host "  1. Gehen Sie zu http://localhost:3000/signup.html"
    Write-Host "  2. Erstellen Sie Ihr erstes Unternehmen (Tenant)"
    Write-Host "  3. Melden Sie sich als Admin an"
    Write-Host "  4. Richten Sie Abteilungen und Teams ein"
    Write-Host "  5. Fügen Sie Mitarbeiter hinzu"
    Write-Host ""
    
    Write-Host "Das Log wurde gespeichert in: $LogFile" -ForegroundColor Green
    Write-Host "======================================================" -ForegroundColor Blue
    
    # Anmeldedaten speichern
    $CredentialsContent = @"
# ASSIXX SETUP INFORMATIONEN
# Generiert am: $(Get-Date)

## Datenbank
Host: localhost
Datenbank: $DBName
Benutzer: $DBUser
Passwort: $DBPassword

## Anwendung
URL: http://localhost:3000
Projekt Pfad: $ProjectPath

## Erste Schritte
1. cd $ProjectPath\server
2. npm start
3. Browser öffnen: http://localhost:3000/signup.html
4. Erstes Unternehmen erstellen

## Wichtige Befehle
Anwendung starten: cd $ProjectPath\server && npm start
Anwendung stoppen: Ctrl+C
Logs anzeigen: Get-Content $ProjectPath\server\combined.log -Tail 50
Datenbank zugreifen: mysql -u $DBUser -p$DBPassword $DBName

WARNUNG: Diese Datei enthält sensible Informationen! 
Sicher aufbewahren und nicht in Git committen!
"@
    
    Set-Content -Path "assixx-credentials.txt" -Value $CredentialsContent
    Write-Host "Anmeldedaten gespeichert in: assixx-credentials.txt" -ForegroundColor Yellow
}

# Hauptfunktion
function Main {
    try {
        Write-Info "Starte Assixx Setup für Windows..."
        
        Install-Chocolatey
        Install-NodeJS
        Install-Git
        $MySQLRootPassword = Install-MySQL
        Setup-Project
        Install-Dependencies
        Setup-Database -RootPassword $MySQLRootPassword
        Create-EnvFile
        Configure-Firewall
        Create-WindowsService
        Show-CompletionInfo
        
        Write-Success "Setup erfolgreich abgeschlossen!"
    }
    catch {
        Write-Error "Fehler während des Setups: $_"
        Write-Host "Überprüfen Sie das Log: $LogFile" -ForegroundColor Yellow
        exit 1
    }
}

# Script ausführen
Main