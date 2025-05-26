# Assixx - 5-Minuten Setup Guide

> **Ziel:** Assixx in 5 Minuten lokal zum Laufen bringen!

## 🚀 Option 1: Automatisches Setup (Empfohlen)

### WSL/Ubuntu/Linux
```bash
# 1. Repository klonen
git clone [YOUR-REPO-URL] Assixx
cd Assixx

# 2. Setup-Script ausführen
chmod +x setup-wsl-ubuntu.sh
./setup-wsl-ubuntu.sh

# 3. Fertig! Browser öffnen
# http://localhost:3000/signup.html
```

### Windows (PowerShell als Admin)
```powershell
# 1. Repository klonen
git clone [YOUR-REPO-URL] Assixx
cd Assixx

# 2. Setup-Script ausführen
.\setup-windows.ps1

# 3. Fertig! Browser öffnen
# http://localhost:3000/signup.html
```

## ⚡ Option 2: Manuelles Setup (3 Schritte)

### Voraussetzungen
- Node.js 18+
- MySQL 8.0+
- Git

### Schritt 1: Dependencies installieren
```bash
cd server
npm install
```

### Schritt 2: Datenbank einrichten
```bash
# MySQL starten und als root einloggen
mysql -u root -p

# In MySQL:
source database-setup.sql
exit
```

### Schritt 3: Umgebungsvariablen
```bash
# .env Datei erstellen
cp .env.example .env

# .env bearbeiten mit deinen MySQL-Zugangsdaten:
# DB_USER=assixx_user
# DB_PASSWORD=your_secure_password
```

### Server starten
```bash
npm start
# Server läuft auf http://localhost:3000
```

## 🎯 Erste Schritte

1. **Tenant registrieren**: http://localhost:3000/signup.html
   - Firmenname eingeben
   - Subdomain wählen (z.B. "demo")
   - Admin-Account erstellen

2. **Einloggen**: http://localhost:3000/login.html
   - Mit Admin-Credentials einloggen
   - Dashboard erkunden

3. **Features aktivieren**: Admin Dashboard → Feature Management
   - Gewünschte Module aktivieren
   - Mitarbeiter einladen

## 🆘 Troubleshooting

### MySQL Connection Error
```bash
# MySQL Service prüfen
sudo service mysql status
# Falls nicht läuft:
sudo service mysql start
```

### Port 3000 belegt
```bash
# In .env ändern:
PORT=3001
```

### Node Module Fehler
```bash
# Clean Install
rm -rf node_modules package-lock.json
npm install
```

## 📚 Nächste Schritte

- **Detaillierte Anleitung**: [DATABASE-SETUP-README.md](./DATABASE-SETUP-README.md)
- **Features erkunden**: [FEATURES.md](./FEATURES.md)
- **Entwicklung starten**: [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md)
- **Production Deploy**: [DEPLOYMENT.md](./DEPLOYMENT.md)

## 💡 Tipps

- **Test-Accounts**: Nach Setup sind Test-User verfügbar (siehe DATABASE-SETUP-README.md)
- **API testen**: http://localhost:3000/api-test.html
- **Logs prüfen**: `tail -f combined.log`

---

**Probleme?** Siehe [DATABASE-SETUP-README.md](./DATABASE-SETUP-README.md) für ausführliche Hilfe.