# 🏭 Assixx - Multi-Tenant SaaS Platform für Industrieunternehmen

[![Version](https://img.shields.io/badge/Version-0.0.8-blue.svg)](https://github.com/SCS-Technik/Assixx)
[![Status](https://img.shields.io/badge/Status-Development-yellow.svg)](https://github.com/SCS-Technik/Assixx)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](./docs/LICENSE)

> **Digitalisierung von Papier zu Cloud - Speziell für produzierende Unternehmen**

## 🚀 Was ist Assixx?

Assixx digitalisiert bestehende Papierprozesse in Industrieunternehmen. Von TPM-Checklisten bis zu Gehaltsabrechnungen - digital, sicher und effizient.

**Zielgruppe:** Automotive, Maschinenbau, Chemie, Metallverarbeitung | 50-500 Mitarbeiter | Deutschland

## ⚡ Schnellstart (Docker)

```bash
# Repository klonen
git clone https://github.com/SCS-Technik/Assixx.git
cd Assixx/docker

# Setup-Script ausführen
./docker-init.sh

# Zugriff auf http://localhost:3000
```

## 🛠️ Tech Stack

- **Backend**: Node.js + Express.js + TypeScript
- **Frontend**: Vanilla JS + Vite Build System
- **Datenbank**: PostgreSQL 17 mit Row Level Security (RLS)
- **Cache**: Redis 7
- **Echtzeit**: WebSocket für Chat & Notifications

> **Migration:** Das Projekt wurde im November 2025 von MySQL auf PostgreSQL migriert für bessere Multi-Tenant-Isolation durch RLS.

## 🎯 Kernfeatures

### ✅ Verfügbar

- **Benutzerverwaltung** (Multi-Tenant, Rollen: Root/Admin/Employee)
- **Dokumenten-System** (Upload, Kategorien, Zugriffsrechte)
- **Schwarzes Brett** (Digitale Mitteilungen)
- **Kalender** (Events, Drag & Drop)
- **KVP-System** (Verbesserungsvorschläge)
- **Schichtplanung** (Wochenansicht, Drag & Drop)
- **Chat-System** (Echtzeit, Gruppen, Dateianhänge)

### 🚧 In Entwicklung

- **TPM-System** - Wartungsplanung für Maschinen
- **Gehaltsabrechnung** - Sichere Lohndokumente
- **Urlaubsantrag** - Digitaler Workflow

Siehe [FEATURES.md](./docs/FEATURES.md) für Details und Preise.

## 📚 Dokumentation

| Dokument                                  | Beschreibung               |
| ----------------------------------------- | -------------------------- |
| [FEATURES.md](./docs/FEATURES.md)         | Feature-Übersicht & Preise |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Technische Architektur     |
| [DOCKER-SETUP.md](./docs/DOCKER-SETUP.md) | Docker Setup               |
| [TODO.md](./TODO.md)                      | Aktuelle Aufgaben          |

## 🐳 Docker Commands

```bash
cd docker

# Starten
docker-compose up -d

# Logs
docker-compose logs -f backend

# Status
docker-compose ps

# Stoppen
docker-compose down
```

## 👥 Team & Kontakt

- **Entwicklung**: SCS-Technik Team
- **GitHub**: [SCS-Technik/Assixx](https://github.com/SCS-Technik/Assixx)

## 📄 Lizenz

Proprietäre Software - Alle Rechte vorbehalten. Siehe [LICENSE](./docs/LICENSE).
