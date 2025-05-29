# 🏭 Assixx - Multi-Tenant SaaS Platform für Industrieunternehmen

[![Version](https://img.shields.io/badge/Version-2025.1-blue.svg)](https://github.com/SCS-Technik/Assixx)
[![Status](https://img.shields.io/badge/Status-Beta%20Ready-yellow.svg)](https://github.com/SCS-Technik/Assixx)
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
- **Dokumenten-System** (Upload, Kategorien, Zugriffsrechte)
- **Schwarzes Brett** (Digitale Mitteilungen)
- **Kalender** (Events, Drag & Drop)
- **KVP-System** (Verbesserungsvorschläge)
- **Schichtplanung** (Wochenansicht, Drag & Drop)
- **Chat-System** (Echtzeit, Gruppen, Dateianhänge)

### 🚨 Deal-Breaker Features (in Entwicklung):
- **TPM-System** - Wartungsplanung für Maschinen (KRITISCH laut QUESTIONS.md)
- **Gehaltsabrechnung** - Sichere Lohndokumente (KRITISCH laut QUESTIONS.md)
- **Chat-System** - Bereits implementiert (KRITISCH laut QUESTIONS.md)
- **Urlaubsantrag** - Digitaler Workflow

### 🔮 Geplant:
- **Microsoft Integration** (Outlook, Azure AD, SharePoint)
- **Mobile App** (iOS/Android)
- **Mehrsprachigkeit** (DE, EN, TR, PL)

Siehe [FEATURES.md](./FEATURES.md) für Details und Preise.

## 🛠️ Tech Stack

- **Backend**: Node.js + Express.js (MVC-Architektur)
- **Frontend**: Vanilla JS + Vite Build System
- **Datenbank**: MySQL mit Multi-Tenant Architektur
- **Echtzeit**: WebSocket für Chat & Notifications

Siehe [ARCHITECTURE.md](./ARCHITECTURE.md) für technische Details.

## 👥 Team & Kontakt

- **Entwicklung**: SCS-Technik Team
- **Support**: support@assixx.com
- **GitHub**: [SCS-Technik/Assixx](https://github.com/SCS-Technik/Assixx)

## 📄 Lizenz

Proprietäre Software - Alle Rechte vorbehalten. Siehe [LICENSE](./LICENSE) für Details.

---

**🔗 Quick Links**: [Demo](http://localhost:3000) | [API Docs](./server/API-TEST-README.md) | [Support](./TROUBLESHOOTING.md)
