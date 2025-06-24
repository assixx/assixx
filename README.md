# 🏭 Assixx - Multi-Tenant SaaS Platform für Industrieunternehmen

[![Version](https://img.shields.io/badge/Version-2025.1-blue.svg)](https://github.com/SCS-Technik/Assixx)
[![Status](https://img.shields.io/badge/Status-Development%20v0.0.2-yellow.svg)](https://github.com/SCS-Technik/Assixx)
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

### 🐳 Docker Setup (Empfohlen):

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

### ✅ Bereits verfügbar:

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

### 🚨 Deal-Breaker Features (in Entwicklung):

- **TPM-System** - Wartungsplanung für Maschinen (KRITISCH laut docs/QUESTIONS.md)
- **Gehaltsabrechnung** - Sichere Lohndokumente (KRITISCH laut docs/QUESTIONS.md)
- **Urlaubsantrag** - Digitaler Workflow (KRITISCH laut docs/QUESTIONS.md)

### 🔮 Geplant:

- **Microsoft Integration** (Outlook, Azure AD, SharePoint)
- **Mobile App** (iOS/Android)
- **Mehrsprachigkeit** (DE, EN, TR, PL)

Siehe [FEATURES.md](./docs/FEATURES.md) für Details und Preise.

## 🛠️ Tech Stack

- **Backend**: Node.js + Express.js + TypeScript (MVC-Architektur mit Type-Safety)
- **Frontend**: Vanilla JS + Vite Build System (TypeScript Migration in Arbeit)
- **Datenbank**: MySQL mit Multi-Tenant Architektur
- **Echtzeit**: WebSocket für Chat & Notifications

Siehe [ARCHITECTURE.md](./docs/ARCHITECTURE.md) für technische Details.

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

## 👥 Team & Kontakt

- **Entwicklung**: SCS-Technik Team
- **Support**: support@assixx.com
- **GitHub**: [SCS-Technik/Assixx](https://github.com/SCS-Technik/Assixx)

## 📄 Lizenz

Proprietäre Software - Alle Rechte vorbehalten. Siehe [LICENSE](./docs/LICENSE) für Details.

---

**🔗 Quick Links**: [Demo](http://localhost:3000) | [API Docs](./docs/API-TEST-README.md) | [Support](./docs/TROUBLESHOOTING.md)
