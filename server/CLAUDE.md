# Claude Assistenz-Informationen

## Projektübersicht
Assixx ist ein Personalverwaltungssystem mit folgenden Hauptkomponenten:
- Multi-Tenant-System für mehrere Organisationen
- Benutzerrollen: Root (Super-Admin), Admin und Mitarbeiter
- Dokumentenverwaltung für Mitarbeiter

## Wichtige Dateien
- `server.js` - Haupteinstiegspunkt der Anwendung
- `database.js` - Datenbankverbindung und Konfiguration
- `models/` - Datenmodelle für verschiedene Entitäten
- `routes/` - API-Routen nach Funktionalität gruppiert
- `public/` - Frontend-Dateien und Dashboards

## Datenbankstruktur
- `users` - Benutzerinformationen mit Spalten für `is_archived` und `status`
- `documents` - Speichert Mitarbeiterdokumente (binäre Daten in `file_content`)
- `departments` - Abteilungen der Organisation
- `teams` - Teamstruktur innerhalb von Abteilungen

## Aktuelle Arbeiten
- Verbesserung der Mitarbeiterlöschfunktion mit Archivierungsoption
- Implementierung der Dokumentenanzeige und -download im Mitarbeiter-Dashboard
- Behebung von Problemen mit Dokumentendownloads

## Bekannte Probleme
- Dokumentendownload funktioniert nicht zuverlässig (wird noch behoben)
- Binary-Daten (BLOB) in der Datenbank müssen korrekt behandelt werden

## Build- und Test-Befehle
```
npm start          # Server starten
npm run dev        # Server im Entwicklungsmodus starten
npm test           # Tests ausführen
```

## Wichtige Hinweise
- Bei Änderungen an Datenbank-Schemas müssen ggf. Skripte für Migrationen erstellt werden
- Alle Dokumentenoperationen müssen Zugriffsberechtigungen prüfen
- TypeCast für BLOB-Felder in der Datenbankverbindung beachten