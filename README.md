<p align="center">
  <img src="frontend/static/images/logo.png" alt="Assixx Logo" width="200">
</p>

# Assixx

**Multi-Tenant SaaS Platform für Industrieunternehmen**

[![Version](https://img.shields.io/badge/Version-0.1.1-blue.svg)](https://github.com/SCS-Technik/Assixx)
[![Status](https://img.shields.io/badge/Status-Development-yellow.svg)](https://github.com/SCS-Technik/Assixx)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](./docs/LICENSE)

Digitalisierung von Papier zu Cloud – speziell für produzierende Unternehmen.

---

## Übersicht

Assixx digitalisiert bestehende Papierprozesse in Industrieunternehmen. Von TPM-Checklisten bis zu Gehaltsabrechnungen – digital, sicher und effizient.

**Zielgruppe:** Automotive, Maschinenbau, Chemie, Metallverarbeitung | 50–500 Mitarbeiter | Deutschland

---

## Schnellstart

```bash
git clone https://github.com/SCS-Technik/Assixx.git
cd Assixx/docker
./docker-init.sh
```

Development: `http://localhost:5173` | Production: `http://localhost`

---

## Tech Stack

| Komponente | Technologie                            |
| ---------- | -------------------------------------- |
| Backend    | NestJS 11 + Fastify + TypeScript       |
| Frontend   | SvelteKit 5 + Tailwind v4              |
| Datenbank  | PostgreSQL 17 + Row Level Security     |
| Cache      | Redis 7                                |
| Echtzeit   | WebSocket (Chat & Notifications)       |
| Validation | Zod                                    |
| Container  | Docker + Nginx (Reverse Proxy)         |

---

## Features

**Verfügbar:**

- Benutzerverwaltung (Multi-Tenant, Rollen: Root/Admin/Employee)
- Dokumenten-System (Upload, Kategorien, Zugriffsrechte)
- Schwarzes Brett (Digitale Mitteilungen)
- Kalender (Events, Drag & Drop)
- KVP-System (Verbesserungsvorschläge)
- Schichtplanung (Wochenansicht, Drag & Drop)
- Chat-System (Echtzeit, Gruppen, Dateianhänge)

**In Entwicklung:**

- TPM-System – Wartungsplanung für Maschinen
- Gehaltsabrechnung – Sichere Lohndokumente
- Urlaubsantrag – Digitaler Workflow

Details: [FEATURES.md](./docs/FEATURES.md)

---

## Dokumentation

| Dokument                                  | Inhalt                     |
| ----------------------------------------- | -------------------------- |
| [FEATURES.md](./docs/FEATURES.md)         | Feature-Übersicht & Preise |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Technische Architektur     |
| [DOCKER-SETUP.md](./docs/DOCKER-SETUP.md) | Docker Setup               |
| [TODO.md](./TODO.md)                      | Aktuelle Aufgaben          |

---

## Docker

```bash
cd docker

docker-compose up -d                              # Development starten
docker-compose --profile production up -d         # Production starten
docker-compose ps                                 # Status
docker-compose logs -f backend                    # Logs
docker-compose down                               # Stoppen
```

---

## Kontakt

**Entwicklung:** SCS-Technik Team
**GitHub:** [SCS-Technik/Assixx](https://github.com/SCS-Technik/Assixx)

---

## Lizenz

Proprietäre Software – Alle Rechte vorbehalten. Siehe [LICENSE](./docs/LICENSE).
