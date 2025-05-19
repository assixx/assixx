# Assixx Projekt - Claude Memory

## Projektübersicht
- **Name**: Assixx (Firmenkommunikations- und Verwaltungssystem für Industriearbeiter)
- **Zielgruppe**: Industriefirmen mit Produktionsarbeitern ohne PC-Zugang
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

## Hauptfunktionen (geplant)
1. **Dokumentenverwaltung**
   - Lohnabrechnungen
   - Krankheitsbescheinigungen
   - Firmenbescheinigungen
   
2. **Fehlermeldesystem**
   - Arbeiter können Fotos von Fehlern/Problemen machen
   - Sofortige Benachrichtigung an Maintenance/Admin
   - Ticketsystem für Verfolgung
   
3. **Firmenkommunikation**
   - Firmenkalender für Events und Sitzungen
   - Ankündigungen und Nachrichten
   - Umfragen mit automatischen Auswertungen
   
4. **Verbesserungsvorschläge**
   - Mitarbeiter können Vorschläge einreichen
   - Bewertungs- und Diskussionsfunktion
   
5. **Mobile-First Design**
   - Hauptnutzung über Smartphones der Arbeiter
   - Einfache, intuitive Bedienung
   - Offline-Funktionalität für Produktionsumgebung

## Zielgruppen
- **Produktionsarbeiter**: Hauptsächlich mobile App-Nutzung
- **Admins/HR**: Web-Dashboard für Verwaltung
- **Maintenance**: Echtzeit-Benachrichtigungen für Probleme
- **Management**: Auswertungen und Berichte

## Technische Überlegungen
- Progressive Web App (PWA) für ersten Rollout
- Push-Benachrichtigungen für dringende Meldungen
- Offline-Sync für schlechte Netzabdeckung in Produktionshallen
- Mehrsprachigkeit (verschiedene Muttersprachen der Arbeiter)
- Einfache Authentifizierung (evtl. QR-Code oder PIN)

## Architektur-Entscheidung: Hybrid Multi-Tenant

### Konzept:
- **Subdomain-basierte Trennung**: Jede Firma erhält eigene Subdomain (z.B. bosch.assixx.de)
- **Getrennte Datenbanken**: Jede Firma hat eine eigene Datenbank für maximale Sicherheit
- **Gemeinsame Codebasis**: Wartungsfreundlich mit firmaspezifischen Konfigurationen
- **Docker-basiertes Deployment**: Automatisierte Bereitstellung neuer Kundeninstanzen

### Vorteile:
- Maximale Datensicherheit durch Trennung
- DSGVO-konform und Compliance-freundlich
- Individuelle Anpassungen pro Firma möglich
- Zentrale Wartung der Codebasis
- Skalierbar durch Container-Architektur

### Technische Umsetzung:
1. **Tenant-Erkennung** über Subdomain
2. **Dynamische Datenbankverbindung** basierend auf Tenant
3. **Konfigurationsmanagement** für firmenspezifische Einstellungen
4. **White-Label Branding** pro Firma
5. **Kubernetes/Docker** für Orchestrierung

### Deployment-Strategie:
- Basis-Docker-Image für alle Kunden
- Automatisches Setup-Script für neue Firmen
- Nginx als Reverse Proxy für Subdomain-Routing
- Separate Datenbank-Container pro Kunde
- Optional: Edge-Deployment direkt beim Kunden

## Entwickler
- Simon Öztürk

## Letzte Änderungen
- 2025-05-19: WSL-Anleitung zur README hinzugefügt
- 2025-05-19: Merge-Konflikte gelöst und gepusht

## Notizen
- Arbeite primär im WSL-Verzeichnis, nicht im Windows-Verzeichnis
- MySQL-Passwort in .env Datei muss mit tatsächlichem Passwort übereinstimmen