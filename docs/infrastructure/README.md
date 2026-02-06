# 🏗️ Assixx Infrastructure

Dieses Verzeichnis enthält alle Infrastructure-as-Code und Deployment-Konfigurationen für Assixx.

## 📁 Struktur

```
infrastructure/
├── docker/                 # Docker-spezifische Dateien
│   ├── test-docker-build.sh   # Test-Skript für Docker Setup
│   ├── backup-strategy.md     # Backup & Recovery Dokumentation
│   └── monitoring-setup.md    # Monitoring Stack Dokumentation
├── nginx/                  # Nginx Konfigurationen
│   └── nginx.conf.example     # Beispiel für Production Nginx
├── monitoring/             # Prometheus/Grafana Configs
│   ├── prometheus.yml         # Prometheus Konfiguration
│   ├── alerts.yml            # Alert-Regeln
│   ├── loki-config.yml       # Loki Log-Aggregation
│   ├── promtail-config.yml   # Promtail Log-Shipper
│   ├── alertmanager.yml      # AlertManager Config
│   └── grafana/              # Grafana Dashboards
├── kubernetes/             # K8s Manifeste (zukünftig)
└── terraform/             # IaC für Cloud (zukünftig)
```

## 🐳 Docker Setup

### Quick Start

```bash
# 1. Environment vorbereiten
cp .env.docker.example .env
nano .env  # Secrets anpassen!

# 2. Container starten
docker-compose up -d

# 3. Logs prüfen
docker-compose logs -f

# 4. Health Check
curl http://localhost:3000/health
```

### Mit Monitoring (PLG Stack)

```bash
# PLG Stack (Prometheus + Loki + Grafana) starten
cd docker
docker-compose --profile observability up -d

# Zugriff:
# - Grafana: http://localhost:3050 (admin/admin)
# - Prometheus: http://localhost:9090
# - Loki: http://localhost:3100
```

## 🔒 Sicherheit

### SSL/TLS Setup

1. Zertifikate generieren oder von Let's Encrypt holen
2. In `infrastructure/nginx/ssl/` ablegen
3. Nginx-Config anpassen
4. Docker Compose mit Nginx starten

### Secrets Management

- Niemals echte Secrets in Git committen!
- Verwende Environment-Variablen
- Für Production: Verwende Secret Management Tools (Vault, AWS Secrets Manager)

## 📊 Monitoring

### Verfügbare Metriken

- **System**: CPU, Memory, Disk, Network
- **Application**: Request Rate, Response Time, Error Rate
- **Business**: Active Users, Documents Uploaded, Feature Usage

### Alert-Kanäle

- E-Mail (Standard)
- Slack (Optional)
- PagerDuty (Enterprise)

## 🔄 Backup

### Automatisierte Backups

```bash
# Backup-Script einrichten
sudo cp infrastructure/docker/backup.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/backup.sh

# Crontab einrichten
sudo crontab -e
# Hinzufügen: 0 2 * * * /usr/local/bin/backup.sh
```

### Manual Backup

```bash
# Datenbank
docker exec assixx-mysql mysqldump -u root -p assixx > backup.sql

# Uploads
tar -czf uploads-backup.tar.gz uploads/
```

## 🚀 Deployment

### Development

```bash
docker-compose up -d
```

### Production

```bash
# Mit Production Profile + Observability
cd docker
docker-compose --profile production --profile observability up -d
```

## 📚 Weitere Dokumentation

- [Docker Setup Guide](../DOCKER-SETUP.md)
- [Backup Strategy](./docker/backup-strategy.md)
- [Monitoring Setup](./docker/monitoring-setup.md)
- [Main README](../README.md)
