# 📚 Swagger API-Dokumentation Nutzungsguide

## 🎯 Quick Start

1. **Öffne Swagger UI**: http://localhost:3000/api-docs/
2. **Login** über die API um einen Token zu erhalten
3. **Authorisiere** dich mit dem Token
4. **Teste** die Endpoints direkt in der UI

## 🔐 Schritt 1: Token erhalten

### Via Swagger UI:

1. Finde den Endpoint: `POST /api/auth/login`
2. Klicke "Try it out"
3. Gib deine Credentials ein:

```json
{
  "username": "admin",
  "password": "dein-passwort"
}
```

4. Klicke "Execute"
5. Kopiere den Token aus der Response

### Via Terminal:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

## 🔑 Schritt 2: Authentifizierung

1. Klicke auf den **"Authorize"** Button (🔓)
2. Gib ein: `Bearer <dein-token>`
3. Klicke "Authorize"
4. Das Schloss wird grün (🔒)

## 🧪 Schritt 3: APIs testen

### Beispiel 1: User-Profil abrufen

```
GET /api/user/profile
```

- Keine Parameter nötig
- Zeigt dein eigenes Profil

### Beispiel 2: Alle Mitarbeiter auflisten

```
GET /api/users
```

- Optional: Query Parameter für Pagination
- Zeigt alle Mitarbeiter deines Tenants

### Beispiel 3: Neuen Mitarbeiter erstellen

```
POST /api/users
```

Body:

```json
{
  "username": "max.mustermann",
  "email": "max@firma.de",
  "password": "SecurePass123!",
  "first_name": "Max",
  "last_name": "Mustermann",
  "role": "employee",
  "department_id": 1
}
```

## 📊 Nützliche Features

### 1. **Schema-Dokumentation**

- Klicke auf "Schemas" am Ende der Seite
- Sieh alle Datenmodelle mit Beispielen
- Verstehe die Struktur der Request/Response Bodies

### 2. **Request/Response Beispiele**

- Jeder Endpoint zeigt Beispiel-Requests
- Response Codes mit Erklärungen
- Beispiel-Responses für verschiedene Status Codes

### 3. **Parameter-Dokumentation**

- Required vs Optional Parameter
- Datentypen und Validierungen
- Default-Werte

### 4. **Export-Funktionen**

- Download OpenAPI Spec: http://localhost:3000/api-docs/swagger.json
- Import in Postman oder Insomnia
- Generiere Client-Code

## 🛠️ Entwickler-Workflow

### Frontend-Entwicklung:

1. Teste API-Calls in Swagger
2. Kopiere funktionierende Requests
3. Implementiere im Frontend mit `fetchWithAuth()`

### Backend-Entwicklung:

1. Entwickle neuen Endpoint
2. Füge Swagger-Dokumentation hinzu
3. Teste direkt in Swagger UI
4. Verifiziere Response-Format

### Testing & Debugging:

1. Reproduziere Fehler in Swagger
2. Prüfe Request/Response Details
3. Teste verschiedene Parameter-Kombinationen
4. Validiere Error Responses

## 💡 Pro-Tipps

### 1. **Browser DevTools nutzen**

- Öffne Network Tab während Swagger-Tests
- Sieh die exakten HTTP-Requests
- Kopiere als cURL für Terminal-Tests

### 2. **Batch-Testing**

- Teste mehrere Endpoints nacheinander
- Der Token bleibt für die Session aktiv
- Perfekt für Integrationstests

### 3. **Environment Variables**

- Nutze Browser-Bookmarklets für Token-Speicherung
- Erstelle Shortcuts für häufige Tests

### 4. **API-Versionierung**

- Prüfe die API-Version in der Swagger-Header
- Dokumentation zeigt deprecated Endpoints

## 🔍 Troubleshooting

### Problem: 401 Unauthorized

- Token abgelaufen? → Neu einloggen
- Token falsch kopiert? → Prüfe auf Leerzeichen
- Bearer-Prefix vergessen? → `Bearer <token>`

### Problem: 403 Forbidden

- Falsche Rolle für Endpoint
- Tenant-Isolation verhindert Zugriff
- Prüfe deine Berechtigungen

### Problem: 400 Bad Request

- Prüfe Required Fields
- Validiere Datentypen
- Sieh dir das Schema an

## 📚 Weiterführende Ressourcen

- OpenAPI Specification: https://swagger.io/specification/
- Swagger UI Docs: https://swagger.io/tools/swagger-ui/
- Postman Import: File → Import → Link → `http://localhost:3000/api-docs/swagger.json`

## 🎯 Nächste Schritte

1. **Explore**: Durchstöbere alle verfügbaren Endpoints
2. **Test**: Probiere verschiedene Szenarien aus
3. **Document**: Melde fehlende oder falsche Dokumentation
4. **Integrate**: Nutze die getesteten Calls in deiner Entwicklung
