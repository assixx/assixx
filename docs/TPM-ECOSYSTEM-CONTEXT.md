# TPM Ecosystem Context

> **Created:** 2026-02-18
> **Status:** DRAFT — wird iterativ erweitert
> **Zweck:** Dauerhaftes Wissens-Dokument über TPM als Domäne, Real-World-Szenarien und Kontext für die Implementierung
> **Version:** 0.3.0

---

## Was ist TPM?

**Total Productive Maintenance** (TPM) ist eine ganzheitliche Instandhaltungsstrategie, die darauf abzielt, die Gesamtanlageneffektivität (OEE — Overall Equipment Effectiveness) zu maximieren, indem ALLE Mitarbeiter (nicht nur die Instandhaltung) in die Pflege und Wartung der Maschinen einbezogen werden.

### Kernprinzip

> "Null Ausfälle, Null Defekte, Null Unfälle"

### Die 3 Wörter

- **Total** — Ganzheitliche Optimierung aller Prozesse
- **Productive** — Steigerung der Ressourceneffizienz und Anlagenleistung
- **Maintenance** — Vorbeugende und präventive Instandhaltung

### Geschichte

- 1970er Jahre Japan: Seiichi Nakajima bei Nippon Electrical Equipments
- 1980er: Verbreitung nach England und USA
- Später: Übernahme in Deutschland
- Heute: Standard-Methodik in Lean Manufacturing weltweit

### Die 8 Säulen des TPM

1. **Autonome Instandhaltung (Autonomous Maintenance)** — Maschinenbediener übernehmen einfache Wartungsaufgaben (Reinigung, Schmierung, Sichtprüfung). DAS Herzstück von TPM — der Bediener kennt seine Maschine am besten.
2. **Geplante Instandhaltung (Planned Maintenance)** — Systematische, zeitbasierte oder zustandsbasierte Wartung. Intervalle: täglich, wöchentlich, monatlich, vierteljährlich, jährlich.
3. **Qualitätserhaltung (Quality Maintenance)** — Null-Fehler-Ansatz durch vorbeugende Maßnahmen an der Ursache.
4. **Fokussierte Verbesserung (Focused Improvement / Kaizen)** — Systematische Beseitigung der 6 großen Verluste durch interdisziplinäre Teams.
5. **Anlaufmanagement (Early Equipment Management)** — Wissen aus Instandhaltung fließt in Beschaffung und Design neuer Anlagen.
6. **Training & Ausbildung** — Kompetenzaufbau bei allen Mitarbeitern. Bediener lernen Wartungsaufgaben, Instandhalter schulen Bediener.
7. **TPM in der Administration** — Verschwendung in administrativen Prozessen eliminieren (Papier, Excel, manuelle Meldewege).
8. **Arbeitssicherheit & Umwelt (Safety, Health, Environment)** — Null Unfälle. Sicherheitsstandards bei jeder Wartung.

---

## Die 6 großen Verluste (Six Big Losses)

| #   | Verlust                      | Kategorie     | Beispiel                          |
| --- | ---------------------------- | ------------- | --------------------------------- |
| 1   | Ungeplante Stillstände       | Verfügbarkeit | Maschinenausfall, Störung         |
| 2   | Rüsten & Einstellen          | Verfügbarkeit | Werkzeugwechsel, Umrüstung       |
| 3   | Kurzstillstände              | Leistung      | Sensorfehler, kurze Blockierungen |
| 4   | Geschwindigkeitsverluste     | Leistung      | Verschleiß → langsamerer Betrieb |
| 5   | Anlaufverluste               | Qualität      | Ausschuss beim Hochfahren        |
| 6   | Qualitätsverluste/Nacharbeit | Qualität      | Fehlerhafte Teile, Nacharbeit    |

---

## OEE — Overall Equipment Effectiveness

```
OEE = Verfügbarkeit × Leistung × Qualität

Verfügbarkeit = (Geplante Produktionszeit - Stillstandszeit) / Geplante Produktionszeit
Leistung       = (Ist-Ausbringung × Taktzeit) / Betriebszeit
Qualität       = Gutteile / Gesamtproduktion

World-Class OEE: ≥ 85%
Durchschnitt Industrie: 60%
```

---

## TPM-Implementierungsphasen (nach REFA)

| Phase | Beschreibung                                                        |
| ----- | ------------------------------------------------------------------- |
| 1     | TPM-Programm entwickeln (Ziele, Maßnahmen, Meilensteine)           |
| 2     | Anlagen erfassen, Zustände und Defekte dokumentieren                |
| 3     | Pilotbereich etablieren, Schulung, schrittweise Aufgabenübertragung |
| 4     | Piloterfahrungen auswerten, Mitarbeiterkompetenz erweitern          |
| 5     | Erfahrungen auf andere Bereiche übertragen                          |
| 6     | Erkenntnisse in Beschaffungskonzepte für Neuanlagen integrieren     |

**Realität:** Vollständige TPM-Implementierung dauert **3-5 Jahre** in der Praxis.

---

## Begleitende Methoden & Werkzeuge

### 5S-Methode

| Schritt         | Japanisch | Beschreibung                                |
| --------------- | --------- | ------------------------------------------- |
| Sortieren       | Seiri     | Unnötiges entfernen                         |
| Systematisieren | Seiton    | Ordnung schaffen, feste Plätze              |
| Säubern         | Seiso     | Reinigen = Inspizieren                      |
| Standardisieren | Seiketsu  | Standards definieren und dokumentieren       |
| Selbstdisziplin | Shitsuke  | Standards einhalten, kontinuierlich pflegen  |

### 5-Warum-Analyse (5 Why)

Ursachenforschung durch wiederholtes "Warum?" fragen bis zur Grundursache:
```
Problem: Maschine steht still
→ Warum? Motor überhitzt
→ Warum? Kühlung defekt
→ Warum? Filter verstopft
→ Warum? Nie gereinigt
→ Warum? Kein Wartungsintervall definiert
→ ROOT CAUSE: Fehlende autonome Instandhaltung
```

### SMED (Single-Minute Exchange of Die)

Rüstzeitoptimierung: Werkzeugwechsel in unter 10 Minuten. Trennung von internem (Maschine steht) und externem (Maschine läuft) Rüsten.

---

## Kamishibai Board — Das visuelle TPM-Werkzeug

### Was ist Kamishibai?

Ein visuelles Management-System aus dem Lean Manufacturing, das wiederkehrende Aufgaben (Wartung, Inspektion, Reinigung, Audits) durch ein **Kartensystem** steuert und transparent macht.

> Ursprung: Japanisches Papiertheater ("紙芝居") — Geschichtenerzählung mit Bildkarten. Adaptiert für Shopfloor-Management.

### Funktionsweise

**Zweifarbige Karten:**
- **Rot** = Aufgabe offen / nicht erledigt
- **Grün** = Aufgabe erledigt / abgearbeitet

Auf einen Blick sieht jeder: Was ist gemacht, was fehlt noch?

### Board-Layout

```
┌──────────────────────────────────────────────────────────────────┐
│                    KAMISHIBAI BOARD                               │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│ TÄGLICH  │WÖCHENTL. │MONATLICH │QUARTALS- │HALBJÄHRL.│ JÄHRLICH │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Reinigung│ Schmierung│ Filterw. │ Kalibrg. │ Revision │ TÜV      │
│ [GRÜN]   │ [ROT]    │ [GRÜN]   │ [ROT]    │ [ROT]    │ [GRÜN]   │
│          │          │          │          │          │          │
│ Ölstand  │ Riemen   │ Dichtung │ Hydraulik│          │          │
│ [GRÜN]   │ [GRÜN]   │ [ROT]    │ [ROT]    │          │          │
│          │          │          │          │          │          │
│ Sichtprüf│ Drucktest│          │          │          │          │
│ [ROT]    │ [GRÜN]   │          │          │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
  Zeilen = Aufgaben    Spalten = Intervalle    Farbe = Status
```

### Karten-Inhalt (typisch)

Jede Karte enthält:
- **Was:** Aufgabenbeschreibung (z.B. "Ölstand prüfen")
- **Wer:** Verantwortlicher (Bediener, Schichtleiter, Instandhalter)
- **Wann:** Intervall (täglich, wöchentlich, ...)
- **Wie:** Kurze Anleitung / Referenz auf Arbeitsanweisung
- **Dokumentation:** Unterschrift / Datum der Durchführung

### Anwendungsgebiete

**Produktion / Shopfloor:**
- Wartung, Inspektion und Reinigung (autonome Instandhaltung)
- Qualitätssicherung und Stichprobenkontrollen
- Audits und Standardprüfungen
- Sicherheitschecks

**Administration:**
- KPI-Berichte und Kennzahlen
- Buchhaltung und Kostenstellenprüfung
- Datensicherung und Systemwartung

### 14 Implementierungsschritte (nach Simplefactory)

1. Schulung aller Beteiligten
2. Sammlung wiederkehrender Themen
3. Schwerpunktsetzung
4. Herunterbrechen auf Einzelaktivitäten
5. Festlegung von Inhalten und Umfängen
6. Definition von Intervallen
7. Board-Konzeption
8. Auswahl geeigneter Hilfsmittel
9. Board-Aufbau
10. Bestückung mit Karten
11. Festlegung von Spielregeln
12. Auftaktveranstaltung
13. Regelmäßige Teambesprechungen
14. Kontinuierliche Anpassung nach Erfahrungen

---

## Kamishibai + Kanban Kombination

### Problem: Interdisziplinäre Teams

Teams die gleichzeitig Projektarbeit, Support UND Wartung machen müssen, stehen vor einem Konflikt:
- Projekt-Deadlines vs. fällige Wartung
- Support-Tickets vs. geplante Inspektionen
- Stress und Konflikte wenn alles gleichzeitig brennt

### Lösung: Kamishibai als zweiter Backlog

```
┌─────────────────┐         ┌──────────────────────────────────┐
│  KAMISHIBAI     │         │         KANBAN BOARD             │
│  (Routinen)     │         │                                  │
│                 │  fällig  │  Backlog → In Progress → Done    │
│  Reinigung [R]  │────────→│  ┌─────────┐                    │
│  Ölcheck   [G]  │         │  │Reinigung│ ← WIP Limit!       │
│  Filter    [R]  │────────→│  └─────────┘                    │
│  Kalibrg.  [G]  │         │  ┌─────────┐                    │
│                 │  erledigt│  │Ticket #5│                    │
│  Filter    [R]  │←────────│  └─────────┘                    │
│            [G]  │         │  ┌─────────┐                    │
│                 │         │  │Feature X│                    │
└─────────────────┘         └──────────────────────────────────┘
```

**Ablauf im Daily Standup:**
1. Kamishibai-Board checken: Welche Routineaufgaben sind fällig?
2. Fällige Karten ins Kanban-Board ziehen (→ Backlog)
3. WIP-Limits beachten — nicht alles gleichzeitig
4. Erledigte Aufgaben zurück ins Kamishibai (Rot → Grün)

**Vorteil:** Alle Arbeitstypen (Projekt, Support, Wartung) fließen durch EIN System mit klaren Prioritäten und Limits.

---

## Real-World-Szenarien

### Szenario 1: Papier-basierte Wartung (IST-Zustand bei Kunden)

**Typisch in KMU-Produktion:**
- Wartungsplan als laminiertes A3-Blatt an der Maschine
- Maschinenbediener hakt ab mit Edding (Reinigung, Ölstand, Sichtprüfung)
- Wartungstechniker sammelt Zettel ein
- Excel-Liste für "große" Wartungen (Intervall-basiert)
- Papier-Störmeldungen: Maschinenbediener füllt Formular aus, legt es in Fach
- Keine Auswertung, kein Überblick, keine Trends

**Probleme:**
- Keiner weiß, ob die tägliche Wartung wirklich gemacht wurde
- Wartungsintervalle werden vergessen
- Störungen werden zu spät gemeldet
- Kein Überblick über Maschinenhistorie
- Kein OEE-Tracking
- Ersatzteil-Management per Bauchgefühl

### Szenario 2: Physisches Kamishibai-Board (Zwischen-Zustand — LPS Lichtgitter Beispiel)

**Beobachtet bei echtem Kunden (Screenshots vorhanden):**

**Board-Aufbau an der Maschine:**
- Physisches Wandboard mit T-Karten-Haltern
- Sektionen nach Intervall UND Verantwortlichem getrennt:
  - "Wöchentlich Bediener 05:00 Uhr" (7 Karten: BW1-BW7)
  - "Monatlich Bediener" (mit Letzte Prüfung / Nächste Prüfung)
  - "Monatlich Instandhaltung" (IM-Karten, 11:00 Uhr)
  - "Vierteljährlich Instandhaltung" (IV-Karten)
  - "Langläufer Instandhaltung" (IL-Karten)
- Handschriftliche Datumsstempel (z.B. "14.10" / "-.1.22")

**Karten-Format (LPS Standard):**
```
┌─────────────────────────────────────┐
│ IV13                    [LPS Logo]  │
│─────────────────────────────────────│
│ Abteilung:      P Standard   TPM   │
│ Arbeitsplatz:   P17                 │
│ Verantwortlich: MI                  │
│ Örtlichkeit:    4                   │
│─────────────────────────────────────│
│                                     │
│ Drehbare Luftzuführung abschmieren  │
│                                     │
└─────────────────────────────────────┘
```

**Typische Aufgaben auf Karten:**
- BW1: "TPM Board reinigen Putzlappen"
- BW2: "Einzug- und Richtrollen auf Verschleiß prüfen"
- BW3: "Handschmierung Zahnräder fetten (2 Hub) und Sichtkontrolle"
- BW5: "Ölstand Getriebe am Schauglas überprüfen"
- BW6: "Motor Ölstand am Schauglas überprüfen und auf Leckagen überprüfen"
- IV1: "Funktion aller Pneumatik Schaltungskomponenten überprüfen"
- IV5: "Abschmieren, Spreizspindel säubern und fetten (8x)"
- IV10: "Ausgleichszylinder mit Öl (5.Hub) beschmieren"
- IV13: "Drehbare Luftzuführung abschmieren"

**Probleme (identisch mit allgemeinem Szenario + zusätzlich):**
- Board ist nur VOR ORT sichtbar — kein Überblick über alle Maschinen
- Keine Historie — Karten werden einfach zurückgedreht
- Kein digitaler Nachweis für Audits/Zertifizierung
- Keine automatischen Erinnerungen wenn Intervall überschritten
- Kein Multi-Standort-Überblick
- Handschriftliche Daten sind unleserlich oder gehen verloren
- Kein Tracking: Wer hat wann welche Karte erledigt?

**Excel-Wartungsplanung parallel zum Board:**
- Separate Excel "Bestimmung TPM Maßnahmedauer Instandhaltung"
- Zeilen = Maschinen (SP08, P07, SAG20, BRM11, RE09, STM, RE05, P03, RE04, DEM, SR05, SAG28, P17, RE06, P02, ST08)
- Spalten = Monate (12 pro Intervall)
- Mehrere Intervall-Blöcke: Monatlich, Vierteljährlich, Halbjährlich, Jährlich, Langläufer
- Farbcodierung der Termine (orange/gelb/blau)
- Mitarbeiter-Zuweisung pro Maschine (Dialog mit Multi-Select)
- Zeiterfassung pro Wartungsevent: Anzahl Mitarbeiter + Vorbereitung + Durchführung + Nachbereitung (alles in Minuten)
- Tabs pro Maschine (BS02, P17, RE04, RE05, RE06, RE09, SP08, SR05, STM, ST08...)

### Szenario 3: Digitales TPM (SOLL-Zustand — Assixx)

**Was wir bieten wollen:**
- Digitales Kamishibai pro Maschine — von überall sichtbar
- Automatische Intervall-Erinnerungen (SSE + Notification Badge)
- Automatisches Umdrehen: Grün→Rot bei Termin, Rot→Grün bei "Done"
- Lückenlose Historie (wer, wann, was, Fotos/Protokoll)
- Wartungsplan-Übersicht: Alle Maschinen × alle Intervalle auf einen Blick
- **CRITICAL: Slot-Verfügbarkeits-Assistent** beim Planen (freie Termine vorschlagen)
- Zeiterfassung pro Wartung (MA-Anzahl, Vor-/Durchführung/Nachbereitung)
- Custom Kartenvorlagen (jede Firma hat eigene Standards)
- Maschinen-Dokumentation (Anleitungen, Handbücher hochladen)
- Multi-Tenant: Jeder Kunde sieht nur seine Maschinen (RLS)

---

## Intervall-Kaskade — Fundamentale Business-Regel

In der realen Produktion gilt: Wenn eine Maschine für eine große Wartung (z.B. jährlich) stillsteht, werden ALLE kürzeren Intervalle gleichzeitig abgearbeitet. Die Maschine steht sowieso — also macht man alles auf einmal.

```
Hierarchie (höher = inkludiert alle darunter):

  Jährlich
    └── Halbjährlich
          └── Vierteljährlich
                └── Monatlich
                      └── Wöchentlich
                            └── Täglich
```

**Konsequenz für Software:**
- Wenn "Jährlich" fällig → alle Karten aller Intervalle werden ROT
- Duplikat-Erkennung nötig: Aufgaben die in kürzeren Intervallen schon existieren, müssen nicht nochmal in längeren angelegt werden
- Jährliche Karten sollen nur ECHTE Jahresaufgaben enthalten (Kalibrierung, TÜV, Verschleißteile)

---

## Wartungsarten im Überblick

```
                    INSTANDHALTUNG
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   REAKTIV          PRÄVENTIV        PRÄDIKTIV
   (Corrective)     (Preventive)     (Predictive)
        │                │                │
   Nach Ausfall     Nach Plan        Nach Zustand
   "Feuerwehr"     Intervall-basiert Sensor-basiert
                    Zeit/Zyklen      Trends/KI
```

| Art        | Wann                 | Kosten  | Ausfallrisiko | Assixx-Relevanz |
| ---------- | -------------------- | ------- | ------------- | --------------- |
| Reaktiv    | Nach Ausfall         | Hoch    | Hoch          | Störmeldungen   |
| Präventiv  | Nach Intervall/Plan  | Mittel  | Niedrig       | Kernfunktion    |
| Prädiktiv  | Nach Zustandsdaten   | Niedrig | Sehr niedrig  | Zukunft (V2+)   |

---

## Herausforderungen bei TPM-Digitalisierung

| Herausforderung                        | Konsequenz für Assixx                                 |
| -------------------------------------- | ----------------------------------------------------- |
| Widerstand gegen Veränderung           | UI muss EXTREM einfach sein — Bediener sind keine IT-Profis |
| Fehlende Fehlerkultur                  | Anonyme Störmeldungen? Keine Schuldzuweisung?         |
| Hoher Schulungsbedarf                  | Onboarding muss selbsterklärend sein                  |
| 3-5 Jahre Implementierung              | Feature muss schrittweise einführbar sein             |
| Verschiedene Rollen (Bediener vs. Instandhalter) | Rollenbasierte Views sind critical path      |
| Shopfloor-Bedingungen (Handschuhe, Lärm, Schmutz) | Mobile-First, große Buttons, wenig Text    |

---

## Glossar

| Begriff                | Deutsch                    | Erklärung                                                                 |
| ---------------------- | -------------------------- | ------------------------------------------------------------------------- |
| TPM                    | Total Productive Maintenance | Ganzheitliche Instandhaltungsstrategie                                 |
| OEE / GAE              | Gesamtanlageneffektivität  | Kennzahl: Verfügbarkeit × Leistung × Qualität                           |
| MTBF                   | Mittlere Betriebsdauer     | Mean Time Between Failures — durchschnittliche Zeit zwischen Ausfällen   |
| MTTR                   | Mittlere Reparaturzeit     | Mean Time To Repair — durchschnittliche Reparaturdauer                   |
| CMMS                   | Instandhaltungssoftware    | Computerized Maintenance Management System                               |
| Autonomous Maintenance | Autonome Instandhaltung    | Bediener übernimmt einfache Wartungsaufgaben                             |
| Planned Maintenance    | Geplante Instandhaltung    | Systematische Wartung nach Plan/Zustand                                  |
| Corrective Maintenance | Korrektive Instandhaltung  | Reparatur nach Ausfall (reaktiv)                                         |
| Predictive Maintenance | Vorausschauende Instandh.  | Zustandsbasiert, Sensorik, Trends                                        |
| Work Order             | Arbeitsauftrag             | Formaler Auftrag für Wartungs-/Reparaturarbeit                           |
| Checklist              | Prüfliste                  | Abzuarbeitende Punkte bei Wartung/Inspektion                             |
| Downtime               | Stillstandszeit            | Zeit in der die Maschine nicht produziert                                |
| Spare Parts            | Ersatzteile                | Lagerbestand für Wartung/Reparatur                                       |
| Kamishibai             | Kartensystem               | Visuelles Board mit Rot/Grün-Karten für wiederkehrende Aufgaben          |
| Kanban                 | Pull-System                | Arbeit wird "gezogen" statt "geschoben" — WIP-Limits begrenzen Paralleles |
| WIP Limit              | Work-in-Progress-Limit     | Max. Anzahl gleichzeitiger Aufgaben — verhindert Überlastung             |
| 5S                     | Ordnung & Sauberkeit       | Sortieren, Systematisieren, Säubern, Standardisieren, Selbstdisziplin   |
| 5 Why                  | 5-Warum-Analyse            | Ursachenforschung durch wiederholtes "Warum?" fragen                     |
| SMED                   | Schnellrüsten              | Single-Minute Exchange of Die — Rüstzeit unter 10 Minuten               |
| Gemba Walk             | Vor-Ort-Begehung           | Management geht an den Ort des Geschehens (Shopfloor)                    |
| Shopfloor              | Produktionshalle           | Der Ort wo die Wertschöpfung stattfindet                                 |

---

## Quellen & URLs

- [REFA Lexikon — TPM](https://refa.de/service/refa-lexikon/total-productive-maintenance-tpm) — Definition, 6 Implementierungsphasen
- [Remberg Blog — TPM](https://remberg.com/de/blog/total-productive-maintenance-tpm) — 8 Säulen, Digitalisierung, Herausforderungen, CMMS
- [Wikipedia — TPM](https://en.wikipedia.org/wiki/Total_productive_maintenance) — Geschichte, OEE (403 beim Fetch)
- [Simplefactory — Kamishibai Board](https://simplefactory.de/methodendatenbank/kamishibai_board) — 14 Implementierungsschritte, Board-Layout, Intervalle
- [t2informatik — Kamishibai + Kanban](https://t2informatik.de/blog/kamishibai-und-kanban-fuer-zu-interdisziplinaere-teams/) — Kombination beider Systeme für interdisziplinäre Teams

---

## Changelog

| Version | Datum      | Änderung                                                                |
| ------- | ---------- | ----------------------------------------------------------------------- |
| 0.1.0   | 2026-02-18 | Initial Draft erstellt                                                  |
| 0.2.0   | 2026-02-18 | Kamishibai + Kanban, Wartungsarten, Herausforderungen, Quellen ergänzt  |
| 0.3.0   | 2026-02-18 | Real-World LPS-Beispiel aus Screenshots, Kartenformat, typische Aufgaben |
| 0.4.0   | 2026-02-18 | Intervall-Kaskade als fundamentale Business-Regel dokumentiert           |
