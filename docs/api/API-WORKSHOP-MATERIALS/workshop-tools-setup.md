# Workshop Tools Setup Guide

## 🔧 Vor dem Workshop (30 Min vorher)

### 1. Docker & Services Check

```bash
# Im Docker-Verzeichnis
cd /home/scs/projects/Assixx/docker

# Status prüfen
docker-compose ps

# Wenn nicht alle Services laufen:
docker-compose down
docker-compose up -d

# Health Check
curl -s http://localhost:3000/health | jq '.'
```

### 2. Swagger UI Vorbereiten

```bash
# Browser öffnen
open http://localhost:3000/api-docs/

# Token generieren für Live-Tests
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' \
  | jq -r '.token'

# Token in Swagger UI "Authorize" Button einfügen
```

### 3. Postman Setup

```bash
# OpenAPI Spec exportieren
curl http://localhost:3000/api-docs/swagger.json -o assixx-api-current.json

# In Postman:
# 1. Import > File > assixx-api-current.json
# 2. Create Environment "Assixx Workshop"
# 3. Variables:
#    - base_url: http://localhost:3000
#    - token: {{auth_token}}
```

### 4. VS Code Setup

```bash
# Workshop-Workspace öffnen
code /home/scs/projects/Assixx/

# Wichtige Dateien in Tabs öffnen:
# - docs/API-WORKSHOP-MATERIALS/decision-matrix.md
# - docs/API-WORKSHOP-MATERIALS/api-standards-template.md
# - docs/current-openapi-spec.json
# - docs/API-MISMATCHES.md
```

## 📊 Live Demo Prep

### Test-Requests vorbereiten

#### 1. Calendar API (Current)

```bash
# Funktionierender Request
curl -X POST http://localhost:3000/api/calendar \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Workshop Demo",
    "start_time": "2025-07-25T10:00:00Z",
    "end_time": "2025-07-25T12:00:00Z",
    "org_level": "company"
  }'
```

#### 2. Chat API (Current)

```bash
# Funktionierender Request
curl -X POST http://localhost:3000/api/chat/conversations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "participant_ids": [1, 2],
    "name": "Workshop Chat"
  }'
```

#### 3. Failing Test Demo

```bash
# Zeigt das Problem
curl -X POST http://localhost:3000/api/chat/channels \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "General",
    "type": "public"
  }'
# Erwartet: 404 Not Found
```

## 🖥 Screen Sharing Setup

### Browser Tabs vorbereiten:

1. **Tab 1**: Swagger UI (http://localhost:3000/api-docs/)
2. **Tab 2**: Postman mit importierter Collection
3. **Tab 3**: VS Code mit Workshop-Dateien
4. **Tab 4**: Terminal für Live-Demos
5. **Tab 5**: Miro/Whiteboard für Brainstorming

### VS Code Split View:

```
Links: decision-matrix.md
Rechts: api-standards-template.md
Terminal: Bereit für curl commands
```

## 🎯 Whiteboard/Miro Template

### Board-Struktur erstellen:

```
+------------------+------------------+------------------+
|   IST-Zustand    |   SOLL-Zustand   |   Migration      |
+------------------+------------------+------------------+
| Current Endpoints| New Standards    | Timeline         |
| Pain Points      | Best Practices   | Owners           |
| Test Failures    | Success Criteria | Dependencies     |
+------------------+------------------+------------------+
```

### Sticky Notes vorbereiten:

- 🔴 Rot: Probleme/Blocker
- 🟡 Gelb: Ideen/Vorschläge
- 🟢 Grün: Entscheidungen
- 🔵 Blau: Fragen

## 📡 Backup Plan

### Falls Swagger UI nicht läuft:

```bash
# Alternative: JSON direkt anzeigen
python -m json.tool docs/current-openapi-spec.json | less

# Oder: Lokaler HTTP Server
python -m http.server 8080
# Dann: http://localhost:8080/docs/api/current-openapi-spec.json
```

### Falls Docker Probleme macht:

```bash
# Logs prüfen
docker-compose logs -f backend

# Neustart einzelner Services
docker-compose restart backend
docker-compose restart mysql
```

## 📋 Workshop Moderation Tools

### Timer/Timeboxing:

- https://pomofocus.io/ (für Phasen)
- Oder: `countdown 25m` im Terminal

### Voting/Priorisierung:

- Dot-Voting in Miro
- Oder: Einfache Handzeichen (1-5 Finger)

### Dokumentation:

```bash
# Live-Mitschrift Template
cat > workshop-notes-$(date +%Y%m%d).md << 'EOF'
# API Workshop Notes - $(date +%Y-%m-%d)

## Teilnehmer:
- [ ]

## Entscheidungen:

### Endpoint: /api/xxx
- Decision:
- Reason:
- Owner:
- Timeline:

EOF
```

## 🎆 Nach dem Workshop

### Sofort erfassen:

```bash
# Screenshot von Whiteboard
# Decisions exportieren
# Aktionspunkte in JIRA/GitHub Issues

# Git commit vorbereiten
git add docs/API-WORKSHOP-MATERIALS/
git commit -m "docs: API Workshop results and decisions"
```

### Follow-Up Template:

```markdown
## API Workshop Follow-Up

**Datum:** 2025-07-24
**Teilnehmer:** [Liste]

### Key Decisions:

1. ...
2. ...

### Action Items:

- [ ] @person1: Task (bis: Datum)
- [ ] @person2: Task (bis: Datum)

### Nächstes Meeting:\*\* [Datum]
```

## 🚑 Troubleshooting

### Problem: "Unauthorized" in Swagger

```bash
# Neuen Token generieren
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' \
  | jq -r '.data.token')

echo "Token: $TOKEN"
```

### Problem: Port 3000 belegt

```bash
lsof -i :3000
# Kill process oder anderen Port nutzen
```

### Problem: MySQL Connection Error

```bash
# MySQL Container prüfen
docker exec assixx-mysql mysql -u root -p -e "SHOW DATABASES;"
# Password: root
```
