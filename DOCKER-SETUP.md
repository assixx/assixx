# 🐳 Assixx Docker Setup Guide

> **Für Beta-Kunden** - Schnelle Installation mit Docker

## 📋 Voraussetzungen

- Docker installiert (Version 20.10+)
- Docker Compose installiert (Version 2.0+)
- 2GB freier RAM
- 5GB freier Speicherplatz

## 🚀 Quick Start (5 Minuten)

### 1️⃣ Repository klonen

```bash
git clone https://github.com/SCS-Technik/Assixx.git
cd Assixx
```

### 2️⃣ Environment konfigurieren

```bash
# Beispiel-Config kopieren
cp .env.docker.example .env

# .env Datei bearbeiten und anpassen
nano .env
```

**WICHTIG zu ändern:**
- `JWT_SECRET` - Zufälliger String (min. 32 Zeichen)
- `SESSION_SECRET` - Zufälliger String (min. 32 Zeichen)
- `SMTP_*` - Ihre E-Mail Einstellungen

### 3️⃣ Docker Container starten

```bash
# Alle Services starten
docker-compose up -d

# Logs anzeigen
docker-compose logs -f
```

### 4️⃣ Zugriff testen

- **Anwendung**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## 🔧 Konfiguration

### E-Mail Setup (Gmail Beispiel)

1. Gmail App-Passwort erstellen:
   - Gehe zu: https://myaccount.google.com/apppasswords
   - Erstelle ein App-Passwort für "Mail"

2. In `.env` eintragen:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ihre-email@gmail.com
SMTP_PASS=ihr-app-passwort
```

### Datenbank-Zugriff

```bash
# MySQL Shell öffnen
docker exec -it assixx-mysql mysql -u root -p

# Backup erstellen
docker exec assixx-mysql mysqldump -u root -p assixx > backup.sql
```

## 📊 Verwaltung

### Container Status

```bash
# Alle Container anzeigen
docker-compose ps

# Container stoppen
docker-compose stop

# Container neustarten
docker-compose restart backend
```

### Logs

```bash
# Alle Logs
docker-compose logs

# Nur Backend Logs
docker-compose logs backend

# Live Logs
docker-compose logs -f backend
```

### Updates

```bash
# Neueste Version holen
git pull origin master

# Container neu bauen
docker-compose build

# Mit neuer Version starten
docker-compose up -d
```

## 🔒 Sicherheit

### Firewall-Regeln

```bash
# Nur localhost Zugriff (Development)
# Nichts zu tun - Standard

# Externer Zugriff (Production)
# Port 3000 in Firewall öffnen
sudo ufw allow 3000/tcp
```

### SSL/HTTPS (Production)

Für Production-Einsatz empfehlen wir einen Reverse Proxy:

1. Nginx Proxy Manager
2. Traefik
3. Caddy

Siehe `infrastructure/nginx/` für Beispiel-Configs.

## 🚨 Troubleshooting

### Container startet nicht

```bash
# Logs prüfen
docker-compose logs backend

# Container neu starten
docker-compose restart backend

# Komplett neu aufbauen
docker-compose down
docker-compose up -d --build
```

### Datenbank-Verbindung fehlgeschlagen

```bash
# MySQL Status prüfen
docker-compose ps mysql

# MySQL Logs
docker-compose logs mysql

# Verbindung testen
docker exec -it assixx-mysql mysql -u assixx_user -p
```

### Port bereits belegt

```bash
# Wer nutzt Port 3000?
sudo lsof -i :3000

# Alternative Ports in docker-compose.yml:
# ports:
#   - "3001:3000"  # Host:Container
```

## 📱 Mobile Zugriff

Für Zugriff vom Smartphone/Tablet im lokalen Netzwerk:

1. Server-IP herausfinden:
```bash
hostname -I
# z.B. 192.168.1.100
```

2. Im Browser öffnen:
```
http://192.168.1.100:3000
```

## 🆘 Support

- **GitHub Issues**: https://github.com/SCS-Technik/Assixx/issues
- **E-Mail**: support@scs-technik.de
- **Dokumentation**: `/docs` Ordner

## 🎯 Nächste Schritte

1. ✅ Admin-Account erstellen
2. ✅ Erste Mitarbeiter anlegen
3. ✅ Features aktivieren
4. ✅ E-Mail-Versand testen

---

**Version**: 1.0.0 | **Stand**: 31.05.2025