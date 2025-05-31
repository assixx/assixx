# 📊 Assixx Monitoring & Logging Setup

## 🎯 Übersicht

Monitoring-Stack für Assixx mit:
- **Prometheus**: Metriken-Sammlung
- **Grafana**: Visualisierung
- **Loki**: Log-Aggregation
- **AlertManager**: Benachrichtigungen

## 📝 Docker Compose Erweiterung

Füge zu `docker-compose.yml` hinzu:

```yaml
  # Prometheus
  prometheus:
    image: prom/prometheus:latest
    container_name: assixx-prometheus
    restart: unless-stopped
    volumes:
      - ./infrastructure/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
    ports:
      - "9090:9090"
    networks:
      - assixx-network

  # Grafana
  grafana:
    image: grafana/grafana:latest
    container_name: assixx-grafana
    restart: unless-stopped
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-admin}
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./infrastructure/monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
      - ./infrastructure/monitoring/grafana/datasources:/etc/grafana/provisioning/datasources:ro
    ports:
      - "3001:3000"
    networks:
      - assixx-network

  # Loki (Log Aggregation)
  loki:
    image: grafana/loki:latest
    container_name: assixx-loki
    restart: unless-stopped
    volumes:
      - ./infrastructure/monitoring/loki-config.yml:/etc/loki/local-config.yaml:ro
      - loki_data:/loki
    ports:
      - "3100:3100"
    networks:
      - assixx-network

  # Promtail (Log Collector)
  promtail:
    image: grafana/promtail:latest
    container_name: assixx-promtail
    restart: unless-stopped
    volumes:
      - ./infrastructure/monitoring/promtail-config.yml:/etc/promtail/config.yml:ro
      - /var/log:/var/log:ro
      - ./backend/logs:/app/logs:ro
    networks:
      - assixx-network

volumes:
  prometheus_data:
  grafana_data:
  loki_data:
```

## 📊 Prometheus Configuration

`infrastructure/monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: []

scrape_configs:
  # Node Exporter
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  # MySQL Exporter
  - job_name: 'mysql'
    static_configs:
      - targets: ['mysql-exporter:9104']

  # Assixx Backend Metrics
  - job_name: 'assixx-backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: '/metrics'

  # Docker Metrics
  - job_name: 'docker'
    static_configs:
      - targets: ['docker-exporter:9323']
```

## 📈 Backend Metrics Integration

Füge Prometheus-Metriken zum Backend hinzu:

```typescript
// backend/src/utils/metrics.ts
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const register = new Registry();

// HTTP Request Metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Business Metrics
export const activeUsers = new Gauge({
  name: 'assixx_active_users',
  help: 'Number of active users',
  registers: [register]
});

export const documentsUploaded = new Counter({
  name: 'assixx_documents_uploaded_total',
  help: 'Total documents uploaded',
  labelNames: ['tenant', 'type'],
  registers: [register]
});

// WebSocket Metrics
export const wsConnections = new Gauge({
  name: 'assixx_websocket_connections',
  help: 'Current WebSocket connections',
  registers: [register]
});
```

## 🎨 Grafana Dashboards

### System Dashboard

```json
{
  "dashboard": {
    "title": "Assixx System Overview",
    "panels": [
      {
        "title": "CPU Usage",
        "targets": [
          {
            "expr": "100 - (avg(irate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "targets": [
          {
            "expr": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100"
          }
        ]
      },
      {
        "title": "HTTP Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ]
      }
    ]
  }
}
```

## 🚨 Alerting Rules

`infrastructure/monitoring/alerts.yml`:

```yaml
groups:
  - name: assixx_alerts
    interval: 30s
    rules:
      # High CPU Usage
      - alert: HighCPUUsage
        expr: (100 - (avg(irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage detected"
          description: "CPU usage is above 80% (current value: {{ $value }}%)"

      # High Memory Usage
      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is above 85% (current value: {{ $value }}%)"

      # Service Down
      - alert: ServiceDown
        expr: up{job="assixx-backend"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Assixx Backend is down"
          description: "The Assixx backend service has been down for more than 1 minute"

      # High Response Time
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time"
          description: "95th percentile response time is above 1 second"

      # Database Connection Issues
      - alert: DatabaseConnectionError
        expr: mysql_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "MySQL database is down"
          description: "Cannot connect to MySQL database"

      # Disk Space Low
      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 < 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Low disk space"
          description: "Disk space is below 10% (current: {{ $value }}%)"
```

## 📱 Benachrichtigungen

### E-Mail Alerts

`infrastructure/monitoring/alertmanager.yml`:

```yaml
global:
  smtp_from: 'alerts@assixx.com'
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_auth_username: 'alerts@assixx.com'
  smtp_auth_password: 'app-specific-password'

route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'email-notifications'

receivers:
  - name: 'email-notifications'
    email_configs:
      - to: 'admin@example.com'
        headers:
          Subject: 'Assixx Alert: {{ .GroupLabels.alertname }}'
```

### Slack Integration

```yaml
receivers:
  - name: 'slack-notifications'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#assixx-alerts'
        title: 'Assixx Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
```

## 🔍 Log Queries (Loki)

### Häufige Queries

```logql
# Alle Fehler
{job="assixx"} |= "error"

# Login-Versuche
{job="assixx"} |= "login" |= "attempt"

# Langsame Queries
{job="assixx"} |= "slow query" | duration > 1000

# Fehlerhafte Requests
{job="assixx"} | json | status >= 400

# Speicher-Warnungen
{job="assixx"} |= "memory" |= "warning"
```

## 📊 Metriken für Business KPIs

```typescript
// Aktive Benutzer pro Tenant
const usersByTenant = new Gauge({
  name: 'assixx_users_by_tenant',
  help: 'Number of users per tenant',
  labelNames: ['tenant'],
  registers: [register]
});

// Feature-Nutzung
const featureUsage = new Counter({
  name: 'assixx_feature_usage_total',
  help: 'Feature usage counter',
  labelNames: ['feature', 'tenant'],
  registers: [register]
});

// Upload-Größen
const uploadSize = new Histogram({
  name: 'assixx_upload_size_bytes',
  help: 'Size of uploaded files',
  labelNames: ['type'],
  buckets: [1000, 10000, 100000, 1000000, 10000000],
  registers: [register]
});
```

## 🚀 Quick Start

```bash
# Monitoring Stack starten
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Zugriff:
# - Grafana: http://localhost:3001 (admin/admin)
# - Prometheus: http://localhost:9090
# - Loki: http://localhost:3100

# Dashboards importieren
# 1. Login zu Grafana
# 2. Go to Dashboards > Import
# 3. Upload JSON files from infrastructure/monitoring/grafana/dashboards/
```

## 📈 Performance-Tipps

1. **Retention konfigurieren**
   ```yaml
   # Prometheus: 30 Tage
   --storage.tsdb.retention.time=30d
   
   # Loki: 7 Tage
   retention_period: 168h
   ```

2. **Sampling für High-Volume Metrics**
   ```typescript
   // Nur 10% der Requests tracken
   if (Math.random() < 0.1) {
     httpRequestDuration.observe(responseTime);
   }
   ```

3. **Index-Labels minimieren**
   - Verwende max. 3-4 Labels pro Metric
   - Vermeide high-cardinality Labels (z.B. user_id)

---

**Tipp**: Starte mit Basic-Monitoring und erweitere schrittweise!