# 🏭 Assixx - Multi-Tenant SaaS Platform für Industrieunternehmen

[![Version](https://img.shields.io/badge/Version-2025.1-blue.svg)](https://github.com/SCS-Technik/Assixx)
[![Status](https://img.shields.io/badge/Status-Development%20v0.0.2-yellow.svg)](https://github.com/SCS-Technik/Assixx)
[![Code Quality](https://github.com/SCS-Technik/Assixx/actions/workflows/unit-tests.yml/badge.svg)](https://github.com/SCS-Technik/Assixx/actions/workflows/unit-tests.yml)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](./docs/LICENSE)

> **Digitalisierung von Papier zu Cloud - Speziell für produzierende Unternehmen**

## 🚀 Was ist Assixx?

Assixx digitalisiert bestehende Papierprozesse in Industrieunternehmen. Wir nehmen was Sie bereits auf Papier haben - von TPM-Checklisten bis zu Gehaltsabrechnungen - und machen es digital, sicher und effizient.

### 🎯 Zielgruppe

- **Branchen**: Automotive, Maschinenbau, Chemie, Metallverarbeitung, Lebensmittel
- **Firmengröße**: 50-500 Mitarbeiter
- **Region**: Deutschland (später weltweit)
- **Problem**: Papierprozesse die digitalisiert werden müssen

## ⚡ Schnellstart

### 🐳 Docker Setup (Empfohlen)

Für die schnellste und einfachste Einrichtung der Entwicklungsumgebung:

#### Option 1: Automatisches Setup (NEU - Empfohlen!)

```bash
# Repository klonen
git clone https://github.com/SCS-Technik/Assixx.git
cd Assixx/docker

# Setup-Script ausführen (erstellt alles automatisch)
./docker-init.sh

# Auf http://localhost:3000 zugreifen
```

#### Option 2: Manuelles Setup

```bash
# Repository klonen
git clone https://github.com/SCS-Technik/Assixx.git
cd Assixx

# In Docker-Verzeichnis wechseln
cd docker

# Volumes erstellen (nur beim ersten Mal nötig)
docker volume create assixx_mysql_data
docker volume create assixx_redis_data

# Docker-Umgebung starten
docker-compose up -d

# Auf http://localhost:3000 zugreifen
```

Siehe **[DOCKER-SETUP.md](./docs/DOCKER-SETUP.md)** für detaillierte Anweisungen.

## 📚 Dokumentation

| Dokument                                                       | Beschreibung                         |
| -------------------------------------------------------------- | ------------------------------------ |
| 📁 [PROJEKTSTRUKTUR.md](./docs/PROJEKTSTRUKTUR.md)             | Vollständige Verzeichnisstruktur     |
| 📋 [FEATURES.md](./docs/FEATURES.md)                           | Komplette Feature-Übersicht & Preise |
| 🏗️ [ARCHITECTURE.md](./docs/ARCHITECTURE.md)                   | Technische Architektur & Stack       |
| 🐳 [DOCKER-SETUP.md](./docs/DOCKER-SETUP.md)                   | Docker Setup & Anleitung             |
| 💾 [BACKUP-GUIDE.md](./docs/BACKUP-GUIDE.md)                   | Backup-Strategie & Anleitung         |
| 💾 [DATABASE-SETUP-README.md](./docs/DATABASE-SETUP-README.md) | Detaillierte Datenbank-Installation  |
| 📝 [TODO.md](./TODO.md)                                        | Aktuelle Aufgaben & Roadmap          |
| 🚢 [DEPLOYMENT.md](./docs/DEPLOYMENT.md)                       | Production Deployment                |
| 🎨 [DESIGN-STANDARDS.md](./docs/DESIGN-STANDARDS.md)           | UI/UX Design Standards               |
| 🗺️ [ROADMAP.md](./docs/ROADMAP.md)                             | Entwicklungsfahrplan                 |

## 🎯 Kernfeatures

### ✅ Bereits verfügbar

- **Benutzerverwaltung** (Multi-Tenant, Rollen)
- **Multi-Tenant Security** (Verbesserte Tenant-Isolation)
- **Docker Development Environment** (Komplette Entwicklungsumgebung)
- **Automatisches Backup-System** (Tägliche Backups, 30 Tage Aufbewahrung)
- **Dokumenten-System** (Upload, Kategorien, Zugriffsrechte)
- **Schwarzes Brett** (Digitale Mitteilungen)
- **Kalender** (Events, Drag & Drop)
- **KVP-System** (Verbesserungsvorschläge)
- **Schichtplanung** (Wochenansicht, Drag & Drop)
- **Chat-System** (Echtzeit, Gruppen, Dateianhänge)

### 🚨 Deal-Breaker Features (in Entwicklung)

- **TPM-System** - Wartungsplanung für Maschinen (KRITISCH laut docs/QUESTIONS.md)
- **Gehaltsabrechnung** - Sichere Lohndokumente (KRITISCH laut docs/QUESTIONS.md)
- **Urlaubsantrag** - Digitaler Workflow (KRITISCH laut docs/QUESTIONS.md)

### 🔮 Geplant

- **Microsoft Integration** (Outlook, Azure AD, SharePoint)
- **Mobile App** (iOS/Android)
- **Mehrsprachigkeit** (DE, EN, TR, PL)

Siehe [FEATURES.md](./docs/FEATURES.md) für Details und Preise.

## 🛠️ Tech Stack

- **Backend**: Node.js + Express.js + TypeScript (100% Type-Safe - [Architecture Guide](./docs/TYPESCRIPT-STANDARDS.md))
- **Frontend**: Vanilla JS + Vite Build System
- **Datenbank**: MySQL mit Multi-Tenant Architektur
- **Echtzeit**: WebSocket für Chat & Notifications

Siehe [ARCHITECTURE.md](./docs/ARCHITECTURE.md) für technische Details.

## 🆕 API v2 - Jetzt verfügbar! (Juli 2025)

Wir freuen uns, die Einführung unserer **nächsten Generation API v2** bekannt zu geben! Die neue API bietet verbesserte Standards, bessere Developer Experience und zukunftssichere Architektur.

### ✨ Was ist neu in API v2?

- **Standardisierte Responses**: Einheitliches Format mit `success` Flag
- **Moderne Authentifizierung**: JWT mit Access & Refresh Tokens (15min/7d)
- **CamelCase Fields**: JavaScript-freundliche Feldnamen statt snake_case
- **Verbesserte Fehlerbehandlung**: Strukturierte Error Codes
- **OpenAPI/Swagger Dokumentation**: Interaktive API-Dokumentation unter `/api-docs/v2`

### 📋 Verfügbare v2 Endpoints

✅ **Auth API v2** (Fertig)

- `POST /api/v2/auth/login` - Benutzer-Login
- `POST /api/v2/auth/register` - Neue Benutzer erstellen
- `POST /api/v2/auth/logout` - Benutzer abmelden
- `POST /api/v2/auth/refresh` - Access Token erneuern
- `GET /api/v2/auth/verify` - Token validieren
- `GET /api/v2/auth/me` - Aktueller Benutzer

🚧 **Weitere APIs folgen**:

- Users API v2 (August 2025)
- Calendar API v2 (September 2025)
- Chat API v2 (Oktober 2025)

### 📖 Migration von v1 zu v2

Die API v1 bleibt bis **31. Dezember 2025** verfügbar. Alle v1 Endpoints zeigen Deprecation-Header:

```
Deprecation: true
Sunset: 2025-12-31
Link: </api/v2>; rel="successor-version"
```

**Hilfreiche Ressourcen:**

- [Migration Guide](./docs/api/MIGRATION-GUIDE-V1-TO-V2.md) - Schritt-für-Schritt Anleitung
- [API v2 Dokumentation](http://localhost:3000/api-docs/v2) - Interaktive Swagger UI
- [API v2 Status](./docs/api/API-V2-STATUS.md) - Aktueller Implementierungsstatus

### 🔗 Quick Example

```javascript
// v2 Login
const response = await fetch("/api/v2/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    password: "password",
  }),
});

const data = await response.json();
if (data.success) {
  localStorage.setItem("accessToken", data.data.accessToken);
  localStorage.setItem("refreshToken", data.data.refreshToken);
}
```

## 🔒 Sicherheit

### Authentifizierung & CSRF-Schutz

Assixx verwendet einen **hybriden Authentifizierungsansatz** für maximale Sicherheit und Flexibilität:

1. **JWT Bearer Tokens (Primär)**
   - API-Aufrufe verwenden `Authorization: Bearer <token>` Header
   - CSRF-immun, da nicht automatisch vom Browser gesendet
   - Tokens werden im localStorage gespeichert

2. **HTTP-Only Cookies (Fallback)**
   - Für direkte HTML-Seitenzugriffe und SSR-Kompatibilität
   - `SameSite=strict` Configuration für CSRF-Schutz
   - Verhindert Cross-Site-Request-Forgery effektiv
   - HTTP-Only verhindert XSS-Zugriff

### Warum kein zusätzlicher CSRF-Token?

- **SameSite=strict** bietet bereits exzellenten CSRF-Schutz ([Browser-Support >95%](https://caniuse.com/same-site-cookie-attribute))
- Verhindert das Senden von Cookies bei Cross-Site-Requests komplett
- Zusätzliche CSRF-Tokens wären redundant und würden nur Komplexität hinzufügen

### Weitere Sicherheitsmaßnahmen

- **Rate Limiting** auf allen Endpoints
- **CORS** mit spezifischen erlaubten Origins
- **Content Security Policy (CSP)** Headers
- **XSS-Schutz** durch konsequentes HTML-Escaping
- **SQL Injection Schutz** durch Prepared Statements
- **Input Validation** auf allen API-Endpoints

## 🐳 Docker Quick Start

```bash
# Repository klonen
git clone https://github.com/SCS-Technik/Assixx.git
cd Assixx

# Volumes erstellen (nur beim ersten Mal)
docker volume create assixx_mysql_data
docker volume create assixx_redis_data

# Docker starten
cd docker && docker-compose up -d

# Auf http://localhost:3000 zugreifen

# Docker stoppen
cd docker && docker-compose down
```

Die Docker-Entwicklungsumgebung bietet:

- ✅ **Automatisches Setup** - Datenbank, Backend und Frontend in einem Befehl
- ✅ **Hot-Reload** - Änderungen werden sofort sichtbar
- ✅ **Isolierte Umgebung** - Keine Konflikte mit lokalen Installationen
- ✅ **Production-Ready** - Gleiche Umgebung wie in Production

```bash
# Entwicklungsumgebung starten (aus docker/ Verzeichnis)
cd docker && docker-compose up -d

# Logs anzeigen
cd docker && docker-compose logs -f

# Umgebung stoppen
cd docker && docker-compose down

# Status prüfen (NEU!)
/home/scs/projects/Assixx/scripts/dev-status.sh
```

Details siehe:

- [DOCKER-SETUP.md](./docs/DOCKER-SETUP.md) - Vollständige Anleitung
- [DOCKER-BEGINNERS-GUIDE.md](./docs/DOCKER-BEGINNERS-GUIDE.md) - Für Docker-Einsteiger
- [BACKUP-GUIDE.md](./docs/BACKUP-GUIDE.md) - Backup-Strategie

## 🧪 Test-Strategie

Assixx nutzt eine **klare Trennung** zwischen GitHub Actions und lokalen Tests:

### 🌐 GitHub Actions (CI/CD)

**Was läuft automatisch bei jedem Push/PR:**

- ✅ **Unit Tests** - 2 Tests ohne DB-Abhängigkeit (errorHandler, health)
- ✅ **Code Quality** - TypeScript, ESLint, Prettier
- ✅ **Docker Build** - Prüft ob Container korrekt gebaut werden

**Warum so minimal?**

- 🚀 Schnelle CI/CD Pipeline
- 🎯 Fokus auf Code-Qualität
- ❌ Keine Mock-Wartung mehr

### 🏠 Lokale Tests (Docker)

**Alle DB-Tests laufen NUR lokal:**

- ✅ **17 Integration Tests** mit echter MySQL Datenbank
- ✅ Nutzt Hauptdatenbank `main` (keine separate Testdatenbank)
- ✅ Keine Mocks - nur echte Datenbankverbindungen
- ✅ Test-Daten werden nach jedem Test automatisch gelöscht

```bash
# Lokale Tests ausführen
./scripts/test-local.sh

# Optionen:
# 1. Alle DB-Tests
# 2. Nur Unit Tests
# 3. Einzelnen Test
# 4. Mit Coverage
```

### 📊 Test-Zusammenfassung

| Test Type    | GitHub | Lokal | Anzahl |
| ------------ | ------ | ----- | ------ |
| Unit Tests   | ✅     | ✅    | 2      |
| DB Tests     | ❌     | ✅    | 17     |
| Code Quality | ✅     | ❌    | 3      |
| Docker Build | ✅     | ❌    | 1      |

Details siehe [FINAL-TEST-STRATEGY.md](./docs/FINAL-TEST-STRATEGY.md)

## 👥 Team & Kontakt

- **Entwicklung**: SCS-Technik Team
- **Support**: <support@assixx.com>
- **GitHub**: [SCS-Technik/Assixx](https://github.com/SCS-Technik/Assixx)

## 📄 Lizenz

Proprietäre Software - Alle Rechte vorbehalten. Siehe [LICENSE](./docs/LICENSE) für Details.

---

**🔗 Quick Links**: [Demo](http://localhost:3000) | [API Docs](./docs/API-TEST-README.md) | [Support](./docs/TROUBLESHOOTING.md)
