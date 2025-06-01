# 🏭 Assixx - Multi-Tenant SaaS Platform für Industrieunternehmen

[![Version](https://img.shields.io/badge/Version-2025.1-blue.svg)](https://github.com/SCS-Technik/Assixx)
[![Status](https://img.shields.io/badge/Status-Development%20v0.0.2-yellow.svg)](https://github.com/SCS-Technik/Assixx)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](./LICENSE)

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

```bash
# Repository klonen
git clone https://github.com/SCS-Technik/Assixx.git
cd Assixx

# Docker-Umgebung starten
docker-compose -f docker-compose.dev.yml up -d

# Auf http://localhost:3000 zugreifen
```

Siehe **[DOCKER-SETUP.md](./DOCKER-SETUP.md)** für detaillierte Anweisungen und **[DOCKER-BEGINNERS-GUIDE.md](./DOCKER-BEGINNERS-GUIDE.md)** für Docker-Einsteiger.

### Platform-spezifische Setup-Guides:

- **[Windows (WSL)](./SETUP-WINDOWS-WSL.md)** - Kompletter Setup-Guide für Windows mit WSL
- **[Ubuntu/Linux](./SETUP-UBUNTU-LINUX.md)** - Setup-Guide für Ubuntu und Debian-basierte Systeme
- **[macOS](./SETUP-MACOS.md)** - Setup-Guide für macOS mit Homebrew

Siehe auch [DATABASE-SETUP-README.md](./DATABASE-SETUP-README.md) für detaillierte Datenbank-Konfiguration.

## 📚 Dokumentation

| Dokument                                                  | Beschreibung                         |
| --------------------------------------------------------- | ------------------------------------ |
| 📁 [PROJEKTSTRUKTUR.md](./PROJEKTSTRUKTUR.md)             | Vollständige Verzeichnisstruktur     |
| 📋 [FEATURES.md](./FEATURES.md)                           | Komplette Feature-Übersicht & Preise |
| 🏗️ [ARCHITECTURE.md](./ARCHITECTURE.md)                   | Technische Architektur & Stack       |
| 🐳 [DOCKER-SETUP.md](./DOCKER-SETUP.md)                   | Docker Development Environment       |
| 🐳 [DOCKER-BEGINNERS-GUIDE.md](./DOCKER-BEGINNERS-GUIDE.md) | Docker Anleitung für Einsteiger   |
| 🐳 [DOCKER-SETUP-SUMMARY.md](./DOCKER-SETUP-SUMMARY.md)   | Docker Setup Zusammenfassung         |
| 💾 [BACKUP-GUIDE.md](./BACKUP-GUIDE.md)                   | Backup-Strategie & Anleitung         |
| 🪟 [SETUP-WINDOWS-WSL.md](./SETUP-WINDOWS-WSL.md)         | Windows (WSL) Setup Guide            |
| 🐧 [SETUP-UBUNTU-LINUX.md](./SETUP-UBUNTU-LINUX.md)       | Ubuntu/Linux Setup Guide             |
| 🍎 [SETUP-MACOS.md](./SETUP-MACOS.md)                     | macOS Setup Guide                    |
| 💾 [DATABASE-SETUP-README.md](./DATABASE-SETUP-README.md) | Detaillierte Datenbank-Installation  |
| 📝 [TODO.md](./TODO.md)                                   | Aktuelle Aufgaben & Roadmap          |
| 🔧 [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md)         | Entwickler-Richtlinien               |
| 🚢 [DEPLOYMENT.md](./DEPLOYMENT.md)                       | Production Deployment                |
| 🎨 [DESIGN-STANDARDS.md](./DESIGN-STANDARDS.md)           | UI/UX Design Standards               |
| 🗺️ [ROADMAP.md](./ROADMAP.md)                             | Entwicklungsfahrplan                 |

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

- **TPM-System** - Wartungsplanung für Maschinen (KRITISCH laut QUESTIONS.md)
- **Gehaltsabrechnung** - Sichere Lohndokumente (KRITISCH laut QUESTIONS.md)
- **Urlaubsantrag** - Digitaler Workflow (KRITISCH laut QUESTIONS.md)

### 🔮 Geplant:

- **Microsoft Integration** (Outlook, Azure AD, SharePoint)
- **Mobile App** (iOS/Android)
- **Mehrsprachigkeit** (DE, EN, TR, PL)

Siehe [FEATURES.md](./FEATURES.md) für Details und Preise.

## 🛠️ Tech Stack

- **Backend**: Node.js + Express.js + TypeScript (MVC-Architektur mit Type-Safety)
- **Frontend**: Vanilla JS + Vite Build System (TypeScript Migration in Arbeit)
- **Datenbank**: MySQL mit Multi-Tenant Architektur
- **Echtzeit**: WebSocket für Chat & Notifications

Siehe [ARCHITECTURE.md](./ARCHITECTURE.md) für technische Details.

## 🐳 Docker Quick Start

Die Docker-Entwicklungsumgebung bietet:

- ✅ **Automatisches Setup** - Datenbank, Backend und Frontend in einem Befehl
- ✅ **Hot-Reload** - Änderungen werden sofort sichtbar
- ✅ **Isolierte Umgebung** - Keine Konflikte mit lokalen Installationen
- ✅ **Production-Ready** - Gleiche Umgebung wie in Production

```bash
# Entwicklungsumgebung starten
docker-compose -f docker-compose.dev.yml up -d

# Logs anzeigen
docker-compose -f docker-compose.dev.yml logs -f

# Umgebung stoppen
docker-compose -f docker-compose.dev.yml down
```

Details siehe:
- [DOCKER-SETUP.md](./DOCKER-SETUP.md) - Vollständige Anleitung
- [DOCKER-BEGINNERS-GUIDE.md](./DOCKER-BEGINNERS-GUIDE.md) - Für Docker-Einsteiger
- [BACKUP-GUIDE.md](./BACKUP-GUIDE.md) - Backup-Strategie

## 👥 Team & Kontakt

- **Entwicklung**: SCS-Technik Team
- **Support**: support@assixx.com
- **GitHub**: [SCS-Technik/Assixx](https://github.com/SCS-Technik/Assixx)

## 📄 Lizenz

Proprietäre Software - Alle Rechte vorbehalten. Siehe [LICENSE](./LICENSE) für Details.

---

**🔗 Quick Links**: [Demo](http://localhost:3000) | [API Docs](./server/API-TEST-README.md) | [Support](./TROUBLESHOOTING.md)
