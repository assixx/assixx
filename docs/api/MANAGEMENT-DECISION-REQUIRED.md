# Management Decision Required: API Test Strategy

## Situation

Wir haben ein kritisches Problem mit unseren Unit Tests entdeckt:

- **502+ Tests**, nur **~40 bestehen** (< 10%)
- Tests wurden für eine andere API-Version geschrieben
- API wurde grundlegend geändert ohne Tests anzupassen

## Problem Impact

### Blockiert

- ❗ CI/CD Pipeline (alle PRs scheitern)
- ❗ Neue Feature-Entwicklung
- ❗ Code-Qualitätssicherung

### Beispiel

- Tests erwarten: `/api/chat/channels`
- API bietet: `/api/chat/conversations` (komplett anderes Konzept!)

## Optionen

### Option 1: Quick Fix (NICHT EMPFOHLEN)

**Was:** Tests an aktuelle API anpassen
**Dauer:** 2-3 Wochen
**Ergebnis:** Fragil, API-Probleme bleiben

### Option 2: Nachhaltige Lösung (EMPFOHLEN) ✅

**Was:** API Design Workshop + komplette Überarbeitung
**Dauer:** 2-3 Wochen
**Ergebnis:** Zukunftssichere API + Tests

### Option 3: Hybrid-Ansatz

**Was:** Minimal-Fix für CI/CD + paralleles API v2 Design
**Dauer:** 1 Woche + 2-3 Wochen
**Ergebnis:** CI/CD läuft, dann saubere Lösung

## Empfehlung

**Option 2: API Design Workshop**

Warum:

1. Einmalige Chance, es richtig zu machen
2. Team-Alignment für alle zukünftigen Features
3. Gleicher Zeitaufwand wie Quick-Fix
4. Verhindert zukünftige Probleme

## Nächste Schritte

1. **Entscheidung** bis: [DATUM]
2. **Workshop-Termin** festlegen (4-6 Stunden)
3. **Teilnehmer:** Backend, Frontend, Product Owner
4. **Vorbereitung:** OpenAPI Spec + Postman Collection vorhanden

## Risiken bei Verzögerung

- Jeder neue PR scheitert an Tests
- Entwickler frustriert durch broken tests
- Technische Schulden wachsen täglich
- Neue Features ohne Tests = Produktionsrisiko

---

**Bitte um Entscheidung:** Welche Option sollen wir verfolgen?
