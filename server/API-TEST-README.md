# API-Testschnittstelle

Diese Dokumentation beschreibt die temporäre API-Testschnittstelle, die für Entwicklungszwecke implementiert wurde, um direkt auf API-Endpunkte zugreifen zu können, ohne Authentifizierungstoken verwalten zu müssen.

## ⚠️ SICHERHEITSHINWEIS

**DIESE FUNKTIONALITÄT IST NUR FÜR ENTWICKLUNGSZWECKE!**

Die Test-Endpunkte umgehen die Authentifizierung und Autorisierung vollständig und dürfen NIEMALS in einer Produktionsumgebung verfügbar sein. Sie werden automatisch deaktiviert, wenn `NODE_ENV=production` gesetzt ist.

## Einrichtung

1. Kopiere die Datei `env.test-example` zu `.env` und passe die Werte an:
   ```
   cp env.test-example .env
   ```

2. Stelle sicher, dass `NODE_ENV=development` in der `.env`-Datei gesetzt ist.

3. Setze `TEST_USER_ID` auf eine gültige Benutzer-ID in deiner Datenbank.

4. Starte den Server:
   ```
   npm start
   ```

## Zugriff auf die Test-Schnittstelle

Die Testschnittstelle ist unter der folgenden URL verfügbar:

```
http://localhost:3000/api-test.html
```

Für Administratoren und Root-Benutzer ist die API-Testschnittstelle auch über die Navigationsseitenleiste zugänglich.

## Verfügbare Test-Endpunkte

Alle Test-Endpunkte sind unter dem Präfix `/test/...` verfügbar. Die folgenden Routen wurden implementiert:

### Mitarbeiter-Endpunkte

| Endpunkt | Methode | Beschreibung |
|----------|---------|--------------|
| `/test/employee/info` | GET | Ruft Informationen zum Test-Mitarbeiter ab |
| `/test/employee/documents` | GET | Listet alle Dokumente des Test-Mitarbeiters auf |
| `/test/employee/documents/:documentId` | GET | Lädt ein spezifisches Dokument herunter |
| `/test/employee/search-documents?query=...` | GET | Sucht nach Dokumenten mit einem Suchbegriff |
| `/test/employee/salary-documents?archived=...` | GET | Ruft Gehaltsabrechnungen ab (archived=true/false) |

## Anpassung des Test-Benutzers

Standardmäßig wird die in `.env` als `TEST_USER_ID` definierte Benutzer-ID verwendet. In der Test-Benutzeroberfläche kann die ID auch temporär geändert werden, ohne den Server neu zu starten.

## Deaktivierung der Test-Funktionalität

Um die Test-Funktionen zu deaktivieren, setze in der `.env`-Datei:

```
NODE_ENV=production
```

In der Produktionsumgebung wird sowohl die Test-API als auch die Testoberfläche deaktiviert, und Zugriffe auf diese Endpunkte werden mit einem 404-Fehler beantwortet.

## Code-Implementierung

Die Test-Funktionalität wurde in den folgenden Dateien implementiert:

1. `/routes/employee-test.js` - Test-Routen für Mitarbeiter-Endpunkte
2. `/server.js` - Registrierung der Test-Routen und Zugriffssteuerung
3. `/public/api-test.html` - Test-Benutzeroberfläche

## Hinweis für Code-Reviews

Bei Code-Reviews sollte darauf geachtet werden, dass:

1. Die Test-Routen nur im Entwicklungsmodus aktiviert sind
2. Alle Test-Routen deutlich als solche gekennzeichnet sind
3. Sicherheitshinweise in den Kommentaren enthalten sind