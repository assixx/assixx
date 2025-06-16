# Assixx Multi-Tenant Deployment Guide

## Übersicht

Assixx nutzt eine Multi-Tenant-Architektur, bei der jede Firma eine eigene Subdomain und Datenbank erhält. Diese Anleitung beschreibt die Einrichtung neuer Firmen und das Deployment.

## 🐳 Docker Deployment (EMPFOHLEN)

Docker ist die empfohlene Methode für das Production-Deployment von Assixx. Es bietet eine konsistente Umgebung, einfache Skalierung und vereinfachtes Management.

### Voraussetzungen

- Docker und Docker Compose installiert
- Domain mit DNS-Zugriff
- SSL-Zertifikate (Let's Encrypt empfohlen)

### 1. Repository klonen und vorbereiten

```bash
git clone https://github.com/SCS-Technik/Assixx.git
cd Assixx

# Environment-Dateien erstellen
cp .env.example .env
cp .env.docker.example .env.docker
```

### 2. Environment-Variablen konfigurieren

Bearbeiten Sie `.env.docker` mit Ihren Production-Einstellungen:

```env
# Datenbank
DB_HOST=mysql
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-secure-password
DB_NAME=main

# Application
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-secure-session-secret

# Domain
DOMAIN=assixx.de
PROTOCOL=https

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Storage
UPLOAD_PATH=/app/uploads
MAX_FILE_SIZE=10485760
```

### 3. Production Deployment starten

```bash
# Production-Container starten
docker-compose -f docker-compose.yml up -d

# Logs prüfen
docker-compose logs -f

# Status überprüfen
docker-compose ps
```

### 4. SSL/TLS mit Nginx einrichten

Erstellen Sie eine Nginx-Konfiguration für SSL:

```nginx
server {
    listen 80;
    server_name *.assixx.de assixx.de;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name *.assixx.de assixx.de;

    ssl_certificate /etc/letsencrypt/live/assixx.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/assixx.de/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. Backup-Konfiguration

Erstellen Sie ein automatisiertes Backup-Script:

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/assixx"
DATE=$(date +%Y%m%d_%H%M%S)

# Datenbank-Backup
docker exec assixx-mysql mysqldump -u root -p${DB_PASSWORD} --all-databases > "$BACKUP_DIR/db_$DATE.sql"

# Uploads-Backup
docker cp assixx-app:/app/uploads "$BACKUP_DIR/uploads_$DATE"

# Alte Backups löschen (älter als 30 Tage)
find "$BACKUP_DIR" -type f -mtime +30 -delete
```

Cron-Job für tägliche Backups:

```bash
0 2 * * * /path/to/backup.sh
```

## Neue Firma einrichten (Docker)

### 1. Tenant im Docker-Container erstellen

```bash
# In den App-Container wechseln
docker exec -it assixx-app bash

# Tenant-Setup-Script ausführen
cd /app/backend/scripts
node setup-tenant.js <tenant-id> "<Firmenname>"

# Beispiel:
node setup-tenant.js mercedes "Mercedes-Benz AG"

# Container verlassen
exit
```

Alternativ direkt von außen:

```bash
docker exec assixx-app node /app/backend/scripts/setup-tenant.js mercedes "Mercedes-Benz AG"
```

### 2. DNS-Eintrag konfigurieren

Fügen Sie einen A-Record oder CNAME für die neue Subdomain hinzu:

```
mercedes.assixx.de → Server-IP
```

### 3. SSL-Zertifikat erstellen

```bash
sudo certbot --nginx -d mercedes.assixx.de
```

### 4. Logo hochladen

Platzieren Sie das Firmenlogo unter:

```
frontend/src/assets/images/mercedes-logo.png
```

### 5. Nginx Container neu laden

```bash
# Nginx-Konfiguration neu laden
docker exec assixx-nginx nginx -s reload
```

## 🔒 Production Security

### Environment-Dateien

1. **Niemals .env-Dateien ins Repository committen**

   ```bash
   # .gitignore sollte enthalten:
   .env
   .env.docker
   .env.production
   ```

2. **Sichere Passwörter verwenden**

   ```bash
   # Passwort-Generator verwenden
   openssl rand -base64 32
   ```

3. **Separate .env für Production**
   ```bash
   # Production-spezifische Variablen
   NODE_ENV=production
   LOG_LEVEL=error
   RATE_LIMIT_WINDOW=15
   RATE_LIMIT_MAX=100
   ```

### SSL/TLS Setup mit Let's Encrypt

```bash
# Certbot im Docker installieren
docker run -it --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  certbot/certbot certonly \
  --webroot -w /var/www/certbot \
  -d assixx.de -d *.assixx.de

# Auto-Renewal einrichten
0 0 * * * docker run --rm -v /etc/letsencrypt:/etc/letsencrypt certbot/certbot renew --quiet && docker exec assixx-nginx nginx -s reload
```

### Firewall-Konfiguration

```bash
# UFW (Ubuntu Firewall) konfigurieren
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Docker Security Best Practices

1. **Non-root User in Containers**

   ```dockerfile
   # In Dockerfile
   USER node
   ```

2. **Read-only Dateisystem wo möglich**

   ```yaml
   # docker-compose.yml
   services:
     app:
       read_only: true
       tmpfs:
         - /tmp
         - /app/tmp
   ```

3. **Netzwerk-Isolation**
   ```yaml
   networks:
     frontend:
     backend:
       internal: true
   ```

### Backup-Automatisierung

1. **Datenbank-Backup mit Verschlüsselung**

   ```bash
   #!/bin/bash
   # secure-backup.sh

   BACKUP_DIR="/secure/backups"
   DATE=$(date +%Y%m%d_%H%M%S)
   ENCRYPTION_KEY="your-encryption-key"

   # Backup mit Kompression und Verschlüsselung
   docker exec assixx-mysql mysqldump -u root -p${DB_PASSWORD} --all-databases | \
     gzip | \
     openssl enc -aes-256-cbc -salt -k "$ENCRYPTION_KEY" \
     > "$BACKUP_DIR/db_$DATE.sql.gz.enc"
   ```

2. **Backup auf externen Server**

   ```bash
   # Rsync zu Backup-Server
   rsync -avz --delete "$BACKUP_DIR/" backup-server:/backups/assixx/
   ```

3. **Backup-Monitoring**
   ```bash
   # Prüfen ob Backup erfolgreich
   if [ $? -eq 0 ]; then
     echo "Backup successful" | mail -s "Assixx Backup OK" admin@assixx.de
   else
     echo "Backup failed!" | mail -s "Assixx Backup FAILED" admin@assixx.de
   fi
   ```

## Monitoring Setup

### Prometheus & Grafana mit Docker

```bash
# Monitoring-Stack starten
docker-compose -f docker-compose.monitoring.yml up -d
```

Die `docker-compose.monitoring.yml` enthält:

- Prometheus für Metriken
- Grafana für Visualisierung
- Loki für Log-Aggregation
- Promtail für Log-Shipping
- Alertmanager für Benachrichtigungen

### Zugriff auf Monitoring

- Grafana: http://localhost:3001 (admin/admin)
- Prometheus: http://localhost:9090
- Alertmanager: http://localhost:9093

### Wichtige Metriken

1. **Application Metrics**

   - Request Rate
   - Response Time
   - Error Rate
   - Active Users

2. **System Metrics**

   - CPU Usage
   - Memory Usage
   - Disk I/O
   - Network Traffic

3. **Business Metrics**
   - Tenant Count
   - Document Uploads
   - Active Sessions
   - Feature Usage

## Manuelle Installation (Alternative)

Falls Docker nicht verfügbar ist, kann Assixx auch manuell installiert werden:

### 1. Systemvoraussetzungen

- Node.js 18+ und npm
- MySQL 8.0+
- Nginx
- PM2 (für Process Management)

### 2. Installation

```bash
# Repository klonen
git clone https://github.com/SCS-Technik/Assixx.git
cd Assixx

# Dependencies installieren
npm install
cd frontend && npm install && cd ..

# Environment konfigurieren
cp .env.example .env
# .env bearbeiten mit Ihren Einstellungen

# Datenbank einrichten
mysql -u root -p < database/complete-schema.sql

# Frontend builden
cd frontend && npm run build && cd ..

# Backend mit PM2 starten
pm2 start backend/src/server.js --name assixx-backend
pm2 save
pm2 startup
```

### 3. Nginx konfigurieren

```nginx
server {
    listen 80;
    server_name assixx.de *.assixx.de;

    root /path/to/assixx/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Health Monitoring & Logs

### Docker Container Logs

```bash
# Live-Logs aller Container
docker-compose logs -f

# Spezifische Container-Logs
docker-compose logs -f app
docker-compose logs -f mysql
docker-compose logs -f nginx

# Logs mit Zeitstempel
docker-compose logs -f --timestamps

# Letzte 100 Zeilen
docker-compose logs --tail=100 app
```

### Health Checks

```bash
# Container-Status
docker-compose ps

# API Health Check
curl http://localhost:3000/api/health

# Datenbank-Status
docker exec assixx-mysql mysql -u root -p${DB_PASSWORD} -e "SHOW STATUS;"

# Container-Ressourcen
docker stats
```

### Application Monitoring

```bash
# PM2 Status (wenn verwendet)
docker exec assixx-app pm2 status

# Error Logs
docker exec assixx-app tail -f /app/backend/logs/error.log

# Access Logs
docker exec assixx-nginx tail -f /var/log/nginx/access.log
```

## Wartung & Updates

### Zero-Downtime Updates

```bash
# 1. Neue Images bauen
docker-compose build

# 2. Container einzeln updaten
docker-compose up -d --no-deps --build app

# 3. Health Check
curl http://localhost:3000/api/health

# 4. Bei Erfolg: Weitere Container
docker-compose up -d --no-deps --build nginx
```

### Datenbank-Migrationen

```bash
# Migration im Container ausführen
docker exec assixx-app bash -c "cd /app && npm run migrate"

# Backup vor Migration
docker exec assixx-mysql mysqldump -u root -p${DB_PASSWORD} --all-databases > pre-migration-backup.sql
```

## Skalierung

### Horizontal Scaling mit Docker Swarm

```bash
# Swarm initialisieren
docker swarm init

# Service erstellen
docker service create \
  --name assixx \
  --replicas 3 \
  --publish 80:3000 \
  assixx-app:latest

# Skalieren
docker service scale assixx=5
```

### Load Balancing mit Traefik

```yaml
# docker-compose.yml Ergänzung
services:
  traefik:
    image: traefik:v2.9
    command:
      - '--api.insecure=true'
      - '--providers.docker=true'
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock

  app:
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.app.rule=Host(`assixx.de`) || HostRegexp(`{subdomain:[a-z]+}.assixx.de`)'
```

## Troubleshooting

### Docker-spezifische Probleme

1. **Container startet nicht**

   ```bash
   # Logs prüfen
   docker-compose logs app

   # Container manuell starten für Debug
   docker run -it --rm assixx-app:latest bash
   ```

2. **Netzwerk-Probleme**

   ```bash
   # Docker-Netzwerke anzeigen
   docker network ls

   # Container-Netzwerk prüfen
   docker inspect assixx-app | grep NetworkMode
   ```

3. **Volume-Probleme**

   ```bash
   # Volumes anzeigen
   docker volume ls

   # Volume inspizieren
   docker volume inspect assixx_mysql-data
   ```

### Performance-Optimierung

1. **Docker-Ressourcen erhöhen**

   ```yaml
   # docker-compose.yml
   services:
     app:
       deploy:
         resources:
           limits:
             cpus: '2'
             memory: 2G
           reservations:
             cpus: '1'
             memory: 1G
   ```

2. **Build-Cache nutzen**

   ```bash
   # Multi-stage builds für kleinere Images
   docker build --target production -t assixx-app:latest .
   ```

3. **Health Check optimieren**
   ```yaml
   healthcheck:
     test: ['CMD', 'curl', '-f', 'http://localhost:3000/api/health']
     interval: 30s
     timeout: 10s
     retries: 3
   ```
