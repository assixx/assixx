# Assixx Server

## Übersicht
Assixx ist ein Personalverwaltungssystem mit verschiedenen Benutzerrollen und Funktionen zur Dokumentenverwaltung. Der Server stellt die API und grundlegende Weboberflächen für verschiedene Benutzergruppen bereit.

## Hauptfunktionen
- Multi-Tenant-Architektur
- Benutzerrollen: Admin, Root, Mitarbeiter
- Dokumentenverwaltung und -archivierung
- Abteilungs- und Teammanagement
- Feature-Management

## Aktuelle Funktionen
- Mitarbeiter können ihre persönlichen Dokumente einsehen und herunterladen
- Administratoren können Mitarbeiterprofile verwalten (erstellen, bearbeiten, archivieren, löschen)
- Erweiterte Löschfunktion für Mitarbeiter mit Archivierungsoption

## Installation
1. Klone das Repository
2. Führe `npm install` aus, um Abhängigkeiten zu installieren
3. Konfiguriere die Datenbankeinstellungen in `.env`
4. Starte den Server mit `npm start`

## Datenbankstruktur
- Tabellen: users, documents, departments, teams, features
- Spezielle Spalten in users: is_archived, status

## Umgebungsvariablen
```
DB_HOST=localhost
DB_USER=benutzer
DB_PASSWORD=passwort
DB_NAME=assixx
JWT_SECRET=geheimnis
PORT=3000
NODE_ENV=development
```

## Bekannte Probleme
- Download-Funktionalität für Dokumente im Mitarbeiter-Dashboard muss noch verbessert werden
- Vorschau von Dokumenten ist derzeit nicht möglich

## Kommende Features
- Erweiterte Dokumentensuchfunktion
- Verbesserte Benutzerbenachrichtigungen
- Dark Mode für alle Dashboard-Seiten