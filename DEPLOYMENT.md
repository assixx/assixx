# Assixx Multi-Tenant Deployment Guide

## Übersicht

Assixx nutzt eine Multi-Tenant-Architektur, bei der jede Firma eine eigene Subdomain und Datenbank erhält. Diese Anleitung beschreibt die Einrichtung neuer Firmen und das Deployment.

## Neue Firma einrichten

### 1. Tenant erstellen

```bash
cd backend/scripts
node setup-tenant.js <tenant-id> "<Firmenname>"

# Beispiel:
node setup-tenant.js mercedes "Mercedes-Benz AG"
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

### 5. Nginx aktivieren

```bash
sudo ln -s /path/to/project/infrastructure/nginx/mercedes.conf /etc/nginx/sites-enabled/
sudo nginx -s reload
```

## Docker Deployment

### 1. Docker Images bauen

```bash
# Backend
cd backend
docker build -t assixx-backend:latest .

# Frontend
cd ../frontend
docker build -t assixx-frontend:latest .
```

### 2. Container für neue Firma starten

```bash
docker run -d \
  --name assixx-mercedes \
  -e TENANT_ID=mercedes \
  -e DB_HOST=mysql \
  -v /path/to/data:/app/data \
  -p 3001:3000 \
  assixx:latest
```

### 3. Docker Compose (Multi-Tenant)

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx:/etc/nginx/conf.d
      - ./certs:/etc/nginx/certs
    depends_on:
      - app

  backend:
    image: assixx-backend:latest
    environment:
      - NODE_ENV=production
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    ports:
      - '3000:3000'

  frontend:
    image: assixx-frontend:latest
    ports:
      - '80:80'
    depends_on:
      - backend

  mysql:
    image: mysql:8
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_PASSWORD}
    volumes:
      - mysql-data:/var/lib/mysql

volumes:
  mysql-data:
```

## Monitoring

### Logs prüfen

```bash
# Container-Logs
docker logs assixx-mercedes

# Application-Logs
tail -f backend/logs/combined.log
```

### Health Checks

```bash
# API Health Check
curl https://mercedes.assixx.de/api/health

# Database Connection
mysql -h localhost -u root -p -e "SHOW DATABASES LIKE 'assixx_%';"
```

## Backup

### Datenbank-Backup

```bash
# Einzelne Firma
mysqldump assixx_mercedes > backup_mercedes_$(date +%Y%m%d).sql

# Alle Firmen
for db in $(mysql -u root -p -e "SHOW DATABASES LIKE 'assixx_%';" -s --skip-column-names); do
  mysqldump $db > backup_${db}_$(date +%Y%m%d).sql
done
```

### Dateien-Backup

```bash
# Uploads und Assets
tar -czf assixx_files_$(date +%Y%m%d).tar.gz uploads/ frontend/dist/assets/
```

## Skalierung

### Horizontal (mehr Firmen)

1. Neue Subdomains hinzufügen
2. Separate Container pro Firma
3. Load Balancer vor Nginx

### Vertikal (mehr Nutzer)

1. Container-Ressourcen erhöhen
2. Datenbank-Replikation
3. Redis für Caching

## Troubleshooting

### Subdomain funktioniert nicht

1. DNS-Propagierung prüfen: `dig mercedes.assixx.de`
2. Nginx-Konfiguration testen: `nginx -t`
3. SSL-Zertifikat prüfen: `certbot certificates`

### Datenbank-Verbindungsfehler

1. MySQL-Status: `sudo service mysql status`
2. Berechtigungen prüfen: `SHOW GRANTS FOR 'root'@'localhost';`
3. Firewall-Regeln checken

### Performance-Probleme

1. Container-Ressourcen: `docker stats`
2. Datenbank-Indizes prüfen
3. Slow Query Log aktivieren
