# Workshop Demo Requests

## 🔐 Auth Setup (falls User vorhanden)

```bash
# Token Variable setzen
export TOKEN="your-auth-token-here"
```

## 📅 Calendar API Demos

### 1. Aktueller Zustand (funktioniert)

```bash
# GET alle Events
curl -X GET http://localhost:3000/api/calendar \
  -H "Authorization: Bearer $TOKEN"

# POST neues Event (aktuelle API)
curl -X POST http://localhost:3000/api/calendar \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Workshop Demo Event",
    "start_time": "2025-07-25T10:00:00Z",
    "end_time": "2025-07-25T12:00:00Z",
    "org_level": "company",
    "description": "API Design Workshop"
  }'
```

### 2. Test-Erwartung (schlägt fehl)

```bash
# Tests erwarten /events suffix
curl -X GET http://localhost:3000/api/calendar/events \
  -H "Authorization: Bearer $TOKEN"
# Erwartet: 404 Not Found
```

## 💬 Chat API Demos

### 1. Aktueller Zustand (conversations)

```bash
# GET alle Conversations
curl -X GET http://localhost:3000/api/chat/conversations \
  -H "Authorization: Bearer $TOKEN"

# POST neue Conversation
curl -X POST http://localhost:3000/api/chat/conversations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "participant_ids": [1, 2],
    "is_group": false,
    "name": "Workshop Chat"
  }'
```

### 2. Test-Erwartung (channels - existiert nicht)

```bash
# Tests erwarten channels endpoint
curl -X POST http://localhost:3000/api/chat/channels \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "General",
    "type": "public",
    "visibility_scope": "company"
  }'
# Erwartet: 404 Not Found
```

## 🔄 Response Format Unterschied

### Was Tests erwarten

```json
{
  "success": true,
  "data": {...}
}
```

### Was API liefert

```json
{
  "data": {...},
  "message": "Success"
}
// KEIN success field!
```

## 🚨 Kritische Probleme zeigen

### Field Naming Chaos

```bash
# API erwartet: start_time, end_time
# DB hat aber: start_date, end_date
# Tests verwenden: start_date, end_date

# Dies führt zu Verwirrung und Bugs!
```

## 🔍 Swagger UI Demo

1. Öffnen: <http://localhost:3000/api-docs/>
2. Zeigen:
   - 38 dokumentierte Endpoints
   - Inkonsistente Naming Conventions
   - Fehlende Standardisierung
3. Live testen (wenn Auth funktioniert):
   - Try it out bei verschiedenen Endpoints
   - Response Formate vergleichen
