# Assixx Projekt - Claude Memory

## Projektübersicht
- **Name**: Assixx (Lohnabrechnungssystem)
- **Standort**: `/home/scs/projects/Assixx/` (WSL Ubuntu)
- **Repository**: https://github.com/SCS-Technik/Assixx

## Aktuelle Aufgaben
- WSL-Anleitung in README.md wurde hinzugefügt und formatiert
- Merge-Konflikte gelöst

## Projektstruktur
- Node.js/Express Backend
- MySQL Datenbank
- Benutzerrollen: root, admin, employee
- Hauptdateien:
  - `/server/server.js` - Express Server
  - `/server/database.js` - DB Verbindung
  - `/server/routes/` - API Routes
  - `/server/public/` - Frontend Dateien

## Wichtige Befehle
- Server starten: `cd server && node server.js`
- MySQL starten: `sudo service mysql start`
- Git push: `git push origin master`

## Aktuelle Issues
- [ ] Passwort-Management implementieren
- [ ] E-Mail-Benachrichtigungen hinzufügen
- [ ] Dokumentenkategorisierung verbessern
- [ ] Mobile UI optimieren

## Entwickler
- Simon Öztürk

## Letzte Änderungen
- 2025-05-19: WSL-Anleitung zur README hinzugefügt
- 2025-05-19: Merge-Konflikte gelöst und gepusht

## Notizen
- Arbeite primär im WSL-Verzeichnis, nicht im Windows-Verzeichnis
- MySQL-Passwort in .env Datei muss mit tatsächlichem Passwort übereinstimmen