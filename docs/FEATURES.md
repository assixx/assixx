# Assixx Features & Funktionsübersicht

> **Letzte Aktualisierung:** 26.05.2025  
> **Version:** 1.0.0  
> **Status:** Production Ready (8 von 11 Hauptfeatures live)

## 📋 Inhaltsverzeichnis

1. [Aktuelle Features](#aktuelle-features)
2. [Feature-Status Matrix](#feature-status-matrix)
3. [Preismodelle](#preismodelle)
4. [Feature-Details](#feature-details)
5. [Geplante Features](#geplante-features)

## 🚀 Aktuelle Features

### ✅ Live Features (Production Ready)

#### 1. **Benutzerverwaltung**

- Multi-Tenant Architektur mit Subdomain-Isolation
- Drei Benutzerrollen: Root, Admin, Employee
- JWT-basierte Authentifizierung
- Profilbild-Upload
- Passwort-Reset Funktionalität

#### 2. **Dokumentenverwaltung**

- Upload/Download für PDF-Dokumente
- Kategorisierung (Gehaltsabrechnungen, Verträge, etc.)
- Zugriffsrechte-Management
- Versionskontrolle
- Suchfunktion

#### 3. **Schwarzes Brett (Blackboard)**

- Unternehmensweite Ankündigungen
- Kategorien und Tags
- Farbcodierung für Prioritäten
- Lesebestätigungen
- Anhänge (Bilder, PDFs)
- Organisationsebenen-Filter

#### 4. **Kalender**

- Event-Management
- Ganztags- und Zeitbasierte Events
- Drag & Drop Funktionalität
- Organisationsebenen (Firma/Abteilung/Team)
- iCal Export/Import
- Farbcodierung nach Event-Typ

#### 5. **KVP-System (Kontinuierlicher Verbesserungsprozess)**

- Verbesserungsvorschläge einreichen
- Status-Tracking (Eingereicht → In Prüfung → Umgesetzt)
- Punkte-/Prämiensystem
- Kategorisierung
- Dateianhänge
- Kommentarfunktion

#### 6. **Schichtplanung**

- Wochenansicht mit Drag & Drop
- Drei Schichttypen (Früh/Spät/Nacht)
- Mitarbeiterverfügbarkeit
- Abteilungs- und Maschinenfilter
- Schichtinformationen und Notizen
- Excel-Export

#### 7. **Chat-System**

- Echtzeit-Messaging (WebSocket)
- Einzel- und Gruppenchats
- Dateianhänge
- Typing-Indicators
- Ungelesene Nachrichten Badge
- Tenant-isolierte Kommunikation

#### 8. **Automatisches Backup-System**

- Tägliche automatische Backups
- 30 Tage Aufbewahrung
- Einfache Wiederherstellung
- Manuelle Quick-Backups
- Backup-Rotation (täglich/wöchentlich/monatlich)

### 🚧 In Entwicklung

#### 9. **Umfrage-Tool** (80% fertig)

- Admin kann Umfragen erstellen
- Multiple-Choice und Freitext
- Anonyme/Nicht-anonyme Optionen
- Echtzeit-Ergebnisse
- Export-Funktionen

## 📊 Feature-Status Matrix

| Feature              | Basic      | Premium      | Enterprise     | Status          |
| -------------------- | ---------- | ------------ | -------------- | --------------- |
| Benutzerverwaltung   | ✅ 50 User | ✅ 200 User  | ✅ Unlimited   | Live            |
| Dokumentenverwaltung | ✅ 10GB    | ✅ 100GB     | ✅ 1TB         | Live            |
| Schwarzes Brett      | ✅         | ✅           | ✅             | Live            |
| Kalender             | ✅         | ✅           | ✅             | Live            |
| KVP-System           | ❌         | ✅           | ✅             | Live            |
| Schichtplanung       | ❌         | ✅           | ✅             | Live            |
| Chat-System          | ✅ Basic   | ✅ Erweitert | ✅ Vollversion | Live            |
| Backup-System        | ✅         | ✅           | ✅             | Live            |
| Umfrage-Tool         | ❌         | ✅           | ✅             | In Entwicklung  |
| Urlaubsverwaltung    | ❌         | ✅           | ✅             | Geplant Q2/2025 |
| Mobile App           | ❌         | ❌           | ✅             | Geplant Q2/2025 |

## 💰 Preismodelle

### Basic Plan - 49€/Monat

- Bis zu 50 Benutzer
- 10GB Speicherplatz
- Basis-Features
- E-Mail Support

### Premium Plan - 149€/Monat

- Bis zu 200 Benutzer
- 100GB Speicherplatz
- Alle Features außer Enterprise
- Priority Support
- Monatliche Schulungen

### Enterprise Plan - Individuell

- Unbegrenzte Benutzer
- 1TB+ Speicherplatz
- Alle Features + Customization
- 24/7 Phone Support
- Dedicated Account Manager
- On-Premise Option

## 📝 Feature-Details

### Benutzerverwaltung im Detail

**Rollen & Berechtigungen:**

- **Root**: Vollzugriff, Tenant-Management, Billing
- **Admin**: Mitarbeiterverwaltung, Feature-Konfiguration
- **Employee**: Zugriff auf freigegebene Features

**Sicherheit:**

- Bcrypt Passwort-Hashing
- JWT mit 24h Expiration
- Tenant-Isolation auf DB-Ebene
- Session-Management

### Dokumentenverwaltung im Detail

**Unterstützte Formate:**

- PDF (primär)
- Bilder (JPG, PNG)
- Office-Dokumente (geplant)

**Kategorien:**

- Gehaltsabrechnungen
- Arbeitsverträge
- Zertifikate
- Schulungsunterlagen
- Sonstige

### Chat-System im Detail

**Technologie:**

- WebSocket (Socket.io)
- MySQL Message Storage
- File-Upload bis 10MB
- Emoji-Support

**Features:**

- Echtzeit-Synchronisation
- Offline-Message-Queue
- Read-Receipts (Backend ready)
- Typing-Indicators

## 🔮 Geplante Features

### Q1 2025

- [ ] Umfrage-Tool (Fertigstellung)
- [ ] E-Mail-Benachrichtigungen
- [ ] Erweiterte Suchfunktionen

### Q2 2025

- [ ] Urlaubsverwaltung
- [ ] Mobile PWA
- [ ] Stripe Payment Integration
- [ ] Multi-Language Support (EN, TR, PL)

### Q3 2025

- [ ] TPM-Kalender
- [ ] QS-Checklisten
- [ ] Erweiterte Analytics
- [ ] API v2

### Q4 2025

- [ ] KI-Integration
- [ ] Erweiterte Automatisierung
- [ ] Enterprise SSO
- [ ] Audit-Compliance-Modul

## 🔧 Technische Spezifikationen

Siehe [ARCHITECTURE.md](./ARCHITECTURE.md) für detaillierte technische Informationen.

## 📚 Weiterführende Dokumentation

- [Setup-Anleitung](./SETUP-QUICKSTART.md)
- [API-Dokumentation](./server/API-TEST-README.md)
- [Sicherheitskonzept](./server/SECURITY-IMPROVEMENTS.md)
- [Deployment-Guide](./DEPLOYMENT.md)
