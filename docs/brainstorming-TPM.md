# Brainstorming: TPM (Total Productive Maintenance)

> **Created:** 2026-02-18
> **Status:** BRAINSTORMING — Session 1
> **Branch:** `feature/TPM`
> **Version:** 0.4.0

---

## Vision

TPM/Wartung ist DAS Key Feature für Kundengewinnung. In der Industrie läuft Wartung/Instandhaltung noch größtenteils über Papier, Boards und Karten. Wer das einfach und digital abbildet, gewinnt.

**Kernidee:** Das physische Kamishibai-Board an der Maschine + die Excel-Wartungsplanung digital abbilden — mit allen Vorteilen (Einfachheit, Visuell, Sofort erkennbar) PLUS digitalen Mehrwerten (Historie, Erinnerungen, Slot-Vorschläge, Multi-Standort, Auswertungen).

**Referenz:** LPS Lichtgitter GmbH — echte physische Boards + Excel-basierte Wartungsplanung (Screenshots im `archive/screenshots/`)

---

## Key Notes (iterativ aktualisiert)

- [x] TPM als Killer-Feature für Kundenakquise identifiziert
- [x] Papier/Board-basierte Wartung in der Industrie = Pain Point
- [x] Kamishibai (Rot/Grün-Karten) als zentrales UX-Konzept erkannt
- [x] Kamishibai + Kanban Kombination recherchiert (Routinen als "zweiter Backlog")
- [x] TPM-Domänenwissen in `TPM-ECOSYSTEM-CONTEXT.md` dokumentiert
- [x] Screenshots analysiert (physische Boards + Excel-Planung)
- [x] User-Vision vollständig erfasst (siehe unten)
- [ ] Scope V1 definieren (welche Features zuerst?)
- [ ] Bestehendes Maschinen-Modul analysieren (was gibt's schon in Assixx?)
- [ ] DB-Schema-Entwurf für TPM-Entitäten

---

## User-Vision (Zusammenfassung Session 1)

### 1. Sidebar Navigation

```
Lean Management          [1]  ← Notification Badge
  └── TPM                [1]  ← Anstehende Wartungen
```

### 2. TPM Hauptseite (Dashboard)

Admin sieht beim Öffnen:

- **Info-Box:** Nächste anstehende Wartung (Datum, Maschine, was)
- **Wartungsplanübersicht** (= digitale Version von Screenshot 4):

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                    Bestimmung TPM Maßnahmedauer Instandhaltung                                │
├──────────┬────────┬────────┬──────────┬──────────┬──────────┬──────────┬────────────┬────────┤
│ Anlage   │Uhrzeit │Täglich │Wöchentl. │ Monatlich│Vierteljä.│Halbjährl.│ Jährlich   │Langlä. │ Custom     │
├──────────┼────────┼────────┼──────────┼──────────┼──────────┼──────────┼────────────┼────────┼────────────┤
│ SP08     │ 07:00  │ ✓ 05:00│ Do 07:00 │23.01.2026│16.02.2026│16.02.2026│18.08.2025  │        │            │
│ P07      │        │ ✓ 05:00│ Do 07:00 │25.01.2026│29.03.2026│28.10.2018│27.01.2019  │        │ alle 100T  │
│ P17      │ 09:15  │ ✓ 05:00│ Mo 09:15 │16.02.2026│20.04.2026│19.11.2018│18.02.2019  │        │            │
│ SP08     │ 07:00  │ ✓ 05:00│ Do 07:00 │23.01.2026│23.01.2026│23.01.2026│23.01.2026  │255(Öl) │ alle 45T   │
│ ...      │        │ ...    │ ...      │ ...      │ ...      │ ...      │ ...        │ ...    │ ...        │
└──────────┴────────┴────────┴──────────┴──────────┴──────────┴──────────┴────────────┴────────┴────────────┘
```

**Default-Ansicht:** Monatlich — umschaltbar auf alle Intervalle (täglich, wöchentlich, monatlich, vierteljährlich, halbjährlich, jährlich, Langläufer, custom).

### 3. Zeiterfassung pro Maschine (unter der Übersicht) — NUR SOLL!

Pro Wartungsereignis wird die **GEPLANTE** Zeit erfasst (nicht tatsächlich):

| Anlage | Anzahl MA | Vorbereitung (Min.) | Durchführung (Min.) | Nachbereitung (Min.) |
| ------ | --------- | ------------------- | ------------------- | -------------------- |
| P17    | 2         | 30                  | 80                  | 30                   |
| RE05   | 1         | 20                  | 60                  | 260                  |
| RE09   | 1         | 20                  | 75                  | 260                  |

**Zweck:** Puffer-Berechnung, Ressourcenplanung, Kapazitätsübersicht. Admin plant damit wie viel Zeit pro Wartung eingeplant werden muss.

### 4. Wartungsplan-Erstellung (pro Maschine)

**Basis-Intervall:**

- Wochentag + Wiederholung wählen: z.B. "Jeden Donnerstag" oder "Jeden 2. Donnerstag" oder "Jeden 3. Donnerstag"
- Daraus werden ALLE Intervalle dynamisch berechnet:
  - Monatlich → der gewählte Donnerstag im Monat
  - Vierteljährlich → alle 3 Monate
  - Halbjährlich → alle 6 Monate
  - Jährlich → einmal pro Jahr
  - Langläufer → custom (z.B. alle 255 Betriebsstunden → Ölwechsel)

**CRITICAL: Slot-Verfügbarkeits-Assistent!**

- Problem: Bei 20 Maschinen weiß man ab Maschine #15 nicht mehr, welche Slots frei sind
- Lösung: System zeigt an: "Jeder 2. Dienstag um 10:00 ist noch frei!"
- Visualisierung: Belegte vs. freie Zeitslots beim Erstellen

### 5. Mitarbeiter-Zuweisung (Screenshot 3)

- Pro Maschine: Mitarbeiter aus Liste auswählen (Multi-Select)
- Dialog: "Mitarbeiter aussuchen!" → Klick zum Zuweisen → Speichern
- Zugewiesene Mitarbeiter sind für die Wartung dieser Maschine verantwortlich

### 6. Kamishibai Board (Screenshots 5, 5(2), 55)

**Zugang:** Vom Wartungsplan → Klick auf Maschine → Kamishibai Board öffnen

**Board-Struktur:**

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        KAMISHIBAI BOARD — Maschine P17                           │
├──────────┬──────────────┬──────────────┬──────────────┬──────────┬──────────────┤
│ Täglich  │ Wöchentlich  │  Monatlich   │Vierteljährl. │Halbjährl.│  Langläufer  │
│ Bediener │ Bediener     │  Bediener    │Instandhaltung│Instandh. │ Instandhalt. │
│ 05:00    │ 05:00 Uhr    │              │              │          │              │
├──────────┼──────────────┼──────────────┼──────────────┼──────────┼──────────────┤
│[BT1] GRÜN│ [BW1] GRÜN   │ [BM1] ROT    │ [IV1] GRÜN   │[IH1] ROT│ [IL1] GRÜN   │
│Sichtprüf.│ Board reini- │ Führungswa-  │ Pneumatik    │Revision  │ Hydrauliköl  │
│          │ gen          │ gen prüfen   │ prüfen       │          │ prüfen       │
│          │              │              │              │          │              │
│[BT2] GRÜN│ [BW2] GRÜN   │ [BM2] ROT    │ [IV2] GRÜN   │[IH2] GRÜN│ [IL2] GRÜN  │
│Reinigung │ Richtrollen  │ Reinigung    │ Abschmieren  │Kalibrier.│ Hydrauliklei-│
│          │ prüfen       │ Sammelbeh.   │ Spreizspindel│          │ tungen wechs.│
│          │              │              │              │          │              │
│          │ [BW3] ROT    │ [BM3] GRÜN   │ [IV3] GRÜN   │          │              │
│          │ Zahnräder    │ ...          │ Kegelrad     │          │              │
│          │ fetten       │              │ fetten       │          │              │
└──────────┴──────────────┴──────────────┴──────────────┴──────────┴──────────────┘
```

**Ansicht-Filter:** Gesamt / nur ein Intervall / nur offene (rote) / nur Bediener / nur Instandhaltung

**Sichtbarkeit für Employee:**

- Sieht ALLE Karten (Bediener UND Instandhaltung) seiner zugewiesenen Maschinen
- Maschinen-Zuweisung läuft über Team-Assignment (machine → team → user)
- Filter möglich: nur Bediener-Karten / nur Instandhaltungs-Karten
- Standard-Pattern: Bediener = täglich + wöchentlich, Instandhaltung = monatlich+
- Aber: NICHT hardcoded — Admin konfiguriert frei wer was macht

**Karten-Verhalten (2 Flows je nach Karten-Konfiguration):**

**Flow A — Karte OHNE Freigabe-Pflicht:**

```
GRÜN (nicht fällig) → ROT (Termin!) → Mitarbeiter klickt "Done" → GRÜN
```

1. Karte ist **GRÜN** wenn Aufgabe nicht fällig
2. Bei Termin dreht sich Karte automatisch auf **ROT**
3. Mitarbeiter klickt auf rote Karte → sieht Details
4. Erledigt Aufgabe → optional: Fotos/Protokoll
5. Klickt "Done" → Karte wird direkt wieder **GRÜN**

**Flow B — Karte MIT Freigabe-Pflicht (Checkbox "Erfordert Freigabe/Prüfung" bei Erstellung):**

```
GRÜN → ROT (Termin!) → Mitarbeiter: Doku + Fotos + "Done" → GELB (wartet auf Prüfung) → Admin/Schichtleiter prüft → GRÜN
```

1. Karte ist **GRÜN** wenn Aufgabe nicht fällig
2. Bei Termin dreht sich Karte automatisch auf **ROT**
3. Mitarbeiter klickt auf rote Karte → sieht Details
4. Erledigt Aufgabe → **MUSS** dokumentieren (Text + optionale Fotos hochladen)
5. Klickt "Done" → Karte wird **GELB** (erledigt, wartet auf Freigabe)
6. Admin/Schichtleiter prüft Dokumentation + Fotos → **Freigabe** → Karte wird **GRÜN**
7. Oder: **Ablehnung** mit Kommentar → Karte wird zurück auf **ROT** (nochmal machen!)

**Bei Karten-Erstellung:** Checkbox "Erfordert Freigabe/Prüfung" — wenn aktiv, ist Flow B Pflicht.
**Alles wird mit Timestamp + User in der Historie gespeichert.**
**REGEL: Ohne Done oder Prüfung/Freigabe KEIN Umdrehen auf Grün. Nie. Niemals.**

### Farben

| Status                  | Default-Farbe | Bedeutung                    |
| ----------------------- | ------------- | ---------------------------- |
| Nicht fällig / Erledigt | **GRÜN**      | Alles ok                     |
| Fällig / Offen          | **ROT**       | Muss gemacht werden          |
| Wartet auf Freigabe     | **GELB**      | Erledigt, Admin muss prüfen  |
| Abgelehnt               | **ROT**       | Zurück, nochmal machen       |
| Überfällig              | **ROT** + ⚠️  | Fällig + Frist überschritten |

**Custom Farben:** Wie beim KVP-Modul (Color Picker bei Definitions) — jede Firma kann eigene Farben definieren. Default bleibt Grün/Rot/Gelb.

### Überfällige Karten — Eskalation

```
Karte wird ROT (Termin)
  │
  ├── Mitarbeiter erledigt innerhalb der Frist → OK
  │
  └── Frist überschritten (konfigurierbar, z.B. 2 Tage)
        │
        ├── Notification an Schichtleiter/Admin
        ├── Karte bleibt ROT (+ visueller Überfällig-Indikator)
        └── Erscheint im Dashboard als "Überfällig"
```

**Eskalations-Frist:** Pro Tenant konfigurierbar (z.B. 1 Tag, 2 Tage, 1 Woche).

### Card-Flip Animation (Svelte)

Physisches Kartenumdrehen digital nachempfunden:

```svelte
<!-- Svelte style directive + CSS 3D Transform -->
<div class="card" class:flipped={isDone}>
  <div class="front">ROT — Aufgabe offen</div>
  <div class="back">GRÜN — Erledigt</div>
</div>

<style>
  .card {
    transform: rotateY(180deg);
    transition: transform 0.4s;
    transform-style: preserve-3d;
  }
  .card.flipped { transform: rotateY(0); }
  .front, .back {
    backface-visibility: hidden;
    position: absolute;
  }
  .back { transform: rotateY(180deg); }
</style>
```

Ref: https://svelte.dev/tutorial/svelte/styles

### CRITICAL: Intervall-Kaskade (Alle Intervalle gleichzeitig!)

**Kernregel:** Wenn ein längeres Intervall fällig ist, sind ALLE kürzeren Intervalle gleichzeitig fällig!

```
Jährlich fällig → ALLE Karten ROT:
  ├── Jährlich-Karten         (IJ)  → ROT
  ├── Halbjährlich-Karten     (IH)  → ROT
  ├── Vierteljährlich-Karten  (IV)  → ROT
  ├── Monatlich-Karten        (BM)  → ROT
  ├── Wöchentlich-Karten      (BW)  → ROT
  └── Täglich-Karten          (BT)  → ROT

Halbjährlich fällig → diese Karten ROT:
  ├── Halbjährlich-Karten     (IH)  → ROT
  ├── Vierteljährlich-Karten  (IV)  → ROT
  ├── Monatlich-Karten        (BM)  → ROT
  ├── Wöchentlich-Karten      (BW)  → ROT
  └── Täglich-Karten          (BT)  → ROT

Monatlich fällig → diese Karten ROT:
  ├── Monatlich-Karten        (BM)  → ROT
  ├── Wöchentlich-Karten      (BW)  → ROT
  └── Täglich-Karten          (BT)  → ROT
```

**Warum?** Die Maschine steht sowieso still für die große Wartung → dann macht man gleich ALLES auf einmal. Wöchentliche und tägliche Aufgaben überlappen sich mit monatlich etc.

### CRITICAL: Duplikat-Erkennung bei Karten-Erstellung

**Problem:** Eine Aufgabe wie "Schraube 7 nachziehen" existiert vielleicht schon als monatliche Karte. Wenn der Admin jetzt eine jährliche Karte mit derselben Aufgabe erstellt → Redundanz.

**Lösung:**

1. Admin erstellt neue Karte (z.B. für Intervall "Jährlich")
2. System prüft: Existiert diese Aufgabe (oder ähnlich) bereits in einem kürzeren Intervall?
3. **Warnung:** "Diese Aufgabe existiert bereits als monatliche Karte BM4 'Schraube 7 nachziehen'. Trotzdem erstellen?"
4. Admin kann:
   - **Abbrechen** (Duplikat vermeiden)
   - **Trotzdem erstellen** (bewusste Doppelung)

**Ergebnis:** Jährliche Karten fokussieren sich auf echte Jahres-Aufgaben:

- Kalibrierung
- Verschleißteile wechseln
- TÜV / Generalüberholung
- Dinge die NICHT in kürzeren Intervallen vorkommen

### Machine Availability Integration

**Bestehendes System:**

- `/manage-machines` — Maschinenübersicht mit Status
- `/manage-machines/availability/{uuid}` — Maschinenausfallzeiten (primär für manuelle Abwesenheiten)

**TPM-Integration:**

- Wenn Wartungsplan aktiv ist → Machine Availability automatisch auf "Wartung" setzen
- Analog zu Vacation → `user_availability`: Hier TPM → `machine_availability`
- `/manage-machines` soll dynamisch den Status updaten wenn Wartung läuft
- Availability-Seite bleibt primär für MANUELLE Abwesenheiten (Störung, Umbau etc.)
- TPM-Wartungstermine werden zusätzlich automatisch eingetragen

### CRITICAL: Schichtplan ↔ Wartungsplan Abhängigkeit

**Bestehende Systeme die wir nutzen:**

- Shift Planning (Schichtplanung) — fertig ✅
- Employee Availability — fertig ✅
- Vacation Planning — fertig ✅
- Machine Availability — fertig ✅

**REGEL: Reihenfolge ist NICHT verhandelbar!**

```
1. Schichtplan erstellen (wer arbeitet wann?)
         │
         ▼
2. Wartungsplan erstellen (System liest Schichtplan!)
         │
         ├── System erkennt: "2 MA vom Instandhaltungsteam sind
         │   Freitag Frühschicht eingeplant → verfügbar für Wartung"
         │
         └── Slot-Vorschlag berücksichtigt NUR verfügbare MA
```

**Warum diese Reihenfolge?**

- Edge Case: MA wird im Wartungsplan eingetragen, DANACH wird Schichtplan erstellt
- Schichtplan zeigt was anderes → MA ist zur Wartungszeit gar nicht da!
- Lösung: Wartungsplan-Assignment geht NUR wenn Schichtplan schon existiert
- System validiert: "Ist dieser MA laut Schichtplan zu diesem Zeitpunkt verfügbar?"

**Edge Cases die wir abfangen müssen:**

| Edge Case                                     | Problem                           | Lösung                                                              |
| --------------------------------------------- | --------------------------------- | ------------------------------------------------------------------- |
| Schichtplan noch nicht erstellt               | MA-Verfügbarkeit unbekannt        | Wartungsplan-Erstellung blockieren ODER Warnung                     |
| MA im Wartungsplan, dann Schichtplan-Änderung | MA plötzlich nicht mehr verfügbar | Notification: "MA X ist nicht mehr verfügbar für Wartung am DD.MM." |
| MA hat Urlaub an dem Wartungstag              | Konflikt Vacation ↔ Wartung       | System prüft Employee Availability (Urlaub/Krank)                   |
| MA krank gemeldet (kurzfristig)               | Wartung kann nicht stattfinden    | Notification + Umplanung nötig                                      |

### Instandhaltungsteam = Sonderstatus ("Joker")

**CRITICAL: Das Instandhaltungsteam ist ANDERS als normale Teams:**

```
Normales Team (z.B. "Produktion Halle 3"):
  └── Fest zugeordnet an bestimmte Maschinen
  └── Bediener arbeiten an IHREN Maschinen

Instandhaltungsteam:
  └── NICHT fest an Maschinen gebunden
  └── Geht dahin wo Wartung/Reparatur nötig ist
  └── "Joker" — wird ad-hoc zugewiesen
  └── Machine-Assignment ist OPTIONAL (schon so im System gebaut!)
```

**Konsequenz für Wartungsplan:**

- Beim Slot-Vorschlag: System schaut welche Instandhaltungs-MA laut Schichtplan verfügbar sind
- Diese können dann JEDER Maschine zugewiesen werden (nicht nur "ihren")
- Bediener hingegen werden nur ihren zugewiesenen Maschinen zugeordnet

### Shift-Modul Erweiterung (für TPM)

**Neues Feature im bestehenden Shift-Modul:**

- Toggle/Filter im Wochen-Grid: "Wartungstermine anzeigen"
- Wenn aktiv: Wartungstermine als farbige Blöcke im Schichtplan sichtbar
- Zweck: Beim Erstellen des Schichtplans für das Instandhaltungsteam kann man Schichten um Wartungstermine herum planen
- Optional, nicht Pflicht — aber extrem nützlich für die Planung

### 7. TPM-Karten (Screenshot 5 Detail)

**Standard-Kartenvorlage (wie physische LPS-Karten):**

```
┌─────────────────────────────────────────┐
│ IV13                        [LPS Logo]  │
│─────────────────────────────────────────│
│ Abteilung:      P Standard    TPM       │
│ Arbeitsplatz:   P17                     │
│ Verantwortlich: MI                      │
│ Örtlichkeit:    4                       │
│─────────────────────────────────────────│
│                                         │
│ Drehbare Luftzuführung abschmieren      │
│                                         │
└─────────────────────────────────────────┘
```

**Karten-Namenskonvention (aus physischen Boards abgeleitet):**

| Kürzel | Bedeutung                                   |
| ------ | ------------------------------------------- |
| BT     | **B**ediener **T**äglich + Laufnummer       |
| BW     | **B**ediener **W**öchentlich + Laufnummer   |
| BM     | **B**ediener **M**onatlich + Laufnummer     |
| IV     | **I**nstandhaltung **V**ierteljährlich + Nr |
| IH     | **I**nstandhaltung **H**albjährlich + Nr    |
| IJ     | **I**nstandhaltung **J**ährlich + Nr        |
| IL     | **I**nstandhaltung **L**angläufer + Nr      |
| IC     | **I**nstandhaltung **C**ustom + Nr          |
| BC     | **B**ediener **C**ustom + Nr                |

Beispiel: **BM3** = Bediener Monatlich, dritte Karte. **IV13** = Instandhaltung Vierteljährlich, Karte 13.

**KRITISCHE UNTERSCHEIDUNG: Bediener vs. Instandhaltung**

| Rolle                  | Kürzel | Wer ist das                                    | Aufgaben                                              |
| ---------------------- | ------ | ---------------------------------------------- | ----------------------------------------------------- |
| **Bediener (B)**       | B      | Employee/Operator der an der Maschine arbeitet | Einfache Wartung: Reinigung, Sichtprüfung, Schmierung |
| **Instandhaltung (I)** | I      | Eigenes Wartungs-TEAM, nur Reparatur & Wartung | Komplexe Wartung: Pneumatik, Hydraulik, Revision, TÜV |

- Der **Bediener** hat mit Instandhaltungs-Karten NICHTS zu tun
- Das **Instandhaltungsteam** hat eigene Aufgaben, eigene Karten, eigene Intervalle
- Im UI: Jeder sieht NUR seine relevanten Karten (rollenbasiert)
- Dies muss im Permission-System und in der Karten-Zuordnung abgebildet werden!

**"Örtlichkeit" → Foto-Referenz:**

- Physisch: Sticker-Nummer an der Maschine zeigt wo die Aufgabe ist
- Digital: Klickbarer Link → zeigt Foto + Text der genauen Stelle an der Maschine
- Wird in der Karten-Doku hinterlegt (Foto-Upload mit Beschreibung)

**WICHTIG: Custom Kartenvorlagen!**

- Admins können Karten nach Standard-Vorlage erstellen (wie oben)
- ABER auch eigene Vorlagen erstellen → jede Firma hat andere Standards
- Custom Felder möglich (z.B. zusätzliche Felder, anderes Layout)
- Dokumentation/Fotos pro Karte (Örtlichkeit als Foto statt Sticker-Nummer)

### 8. Maschinen-Dokumentation

- Pro Maschine: Standard-Dokumente hochladen
- Wartungsanleitungen, Handbücher, Sicherheitshinweise
- Verknüpfung mit TPM-Karten (Karte verweist auf Doku)

### 9. Intervall-Typen

| Intervall       | Kürzel | Beispiel                                           | Wer                |
| --------------- | ------ | -------------------------------------------------- | ------------------ |
| Täglich         | T      | Sichtprüfung, Reinigung                            | Bediener           |
| Wöchentlich     | W      | Schmierung, Ölstand                                | Bediener           |
| Monatlich       | M      | Filterprüfung, Dichtungen                          | Bediener/Instandh. |
| Vierteljährlich | VJ     | Pneumatik, Kalibrierung                            | Instandhaltung     |
| Halbjährlich    | HJ     | Revision, große Inspektion                         | Instandhaltung     |
| Jährlich        | J      | TÜV, Generalüberholung                             | Instandhaltung     |
| Langläufer      | LL     | Ölwechsel Typ 255, große Revision                  | Instandhaltung     |
| Custom          | C      | Frei definierbar: z.B. alle 100 Tage, alle 45 Tage | Konfigurierbar     |

**Hinweis:** Langläufer = im Prinzip Custom mit langem Intervall. "255" in der Excel ist der Öltyp, NICHT Betriebsstunden. Kein Maschinenzähler nötig — reine Kalenderberechnung für alle Intervalle.

**Wichtig aus Screenshots:** Board-Sektionen unterscheiden zwischen "Bediener" und "Instandhaltung" als Verantwortliche!

---

## Session 1 — 2026-02-18

### Recherche abgeschlossen

**Quellen gelesen:**

1. REFA Lexikon — TPM (6 Implementierungsphasen)
2. Remberg Blog — TPM (8 Säulen, Digitalisierung, CMMS-Kontext)
3. Simplefactory — Kamishibai Board (14 Schritte, Board-Layout, Kartensystem)
4. t2informatik — Kamishibai + Kanban (Interdisziplinäre Teams, zweiter Backlog)

**Screenshots analysiert:**

1. `screenshot1.png` — Excel Wartungsplan: monatliche Termine pro Maschine, Uhrzeiten, Farbcodierung
2. `screnshot 2.png` — Unterer Teil: Maschinen-Grid + Mitarbeiter-Zeitsummen (alle 0 = Template)
3. `screenshot3.png` — Mitarbeiter-Auswahl Dialog: Multi-Select, Tabs pro Maschine
4. `screenshot4png.png` — **HAUPTANSICHT:** Alle Intervalle (monatlich bis Langläufer) + Zeiterfassung pro Maschine (MA-Anzahl, Vor-/Durchführung/Nachbereitung in Minuten)
5. `screen5.jpeg` — Physisches Kamishibai: "Vierteljährlich Instandhaltung" + "Langläufer Instandhaltung", Karten IV1-IV10
6. `screen5.jpeg (2).jpeg` — Physisches Board: "Monatlich Bediener" mit Letzte/Nächste Prüfung Datum
7. `screen55.jpeg` — Physisches Board: "Wöchentlich Bediener 05:00 Uhr" (7 Karten) + "Monatlich Instandhaltung"
8. `screen5.jpeg.jpeg` — Karten-Detail: IV13 = "Drehbare Luftzuführung abschmieren", Abteilung/Arbeitsplatz/Verantwortlich/Örtlichkeit

---

## Offene Fragen

1. ~~Welche der 8 TPM-Säulen decken wir in V1 ab?~~ → Klar: Säule 1 (Autonome IH) + Säule 2 (Geplante IH) + Wartungsplanung
2. ~~Bestehendes Maschinen-Modul?~~ → ✅ Verifiziert (siehe brainstorming-TPM-Verification.md)
3. ~~"Örtlichkeit" auf den Karten~~ → E1: Foto-Referenz statt Sticker-Nummer
4. ~~Zeiterfassung~~ → E2: Nur SOLL (geplante Zeit)
5. ~~Langläufer-Intervall~~ → E4: Custom mit langem Intervall, reine Kalenderberechnung
6. ~~Bediener vs. Instandhaltung~~ → E3+E5: Strikt getrennt, aber Employee sieht ALLE Karten, filterbar
7. ~~Genehmigung/Freigabe~~ → E9: Konfigurierbar pro Karte (Checkbox bei Erstellung)
8. ~~Kosten-Tracking~~ → E13: NICHT in V1
9. ~~Schichtplan-Integration~~ → E14+E15: Schichtplan + Maschinenauslastung, Schichtplan MUSS zuerst existieren
10. ~~Überfällige Wartung~~ → E10: Bleibt ROT + Eskalation nach konfigurierbarer Frist

---

## Entscheidungen

| #   | Entscheidung                                                                                                                      | Begründung                                                                                        | Datum      |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------- |
| E1  | Örtlichkeit → Foto-Referenz statt Sticker-Nummer                                                                                  | Digital keine Sticker möglich, Foto+Text ist besser                                               | 2026-02-18 |
| E2  | Zeiterfassung = nur SOLL (geplante Zeit)                                                                                          | Für Puffer-Berechnung und Ressourcenplanung                                                       | 2026-02-18 |
| E3  | Bediener (B) und Instandhaltung (I) strikt getrennt                                                                               | Unterschiedliche Rollen, unterschiedliche Karten                                                  | 2026-02-18 |
| E4  | Langläufer = Custom mit langem Intervall, kein Stundenzähler                                                                      | "255" = Öltyp, reine Kalenderberechnung reicht                                                    | 2026-02-18 |
| E5  | Employee sieht ALLE Karten (B+I) seiner zugewiesenen Maschinen                                                                    | Transparenz, aber filterbar nach B/I                                                              | 2026-02-18 |
| E6  | Intervall-Kaskade: Jährlich = ALLE kürzeren Intervalle gleichzeitig fällig                                                        | Maschine steht eh still, alles auf einmal machen                                                  | 2026-02-18 |
| E7  | Duplikat-Warnung bei Karten-Erstellung wenn Aufgabe in kürzerem Intervall existiert                                               | Vermeidet Redundanz, fokussiert auf echte Jahres-Aufgaben                                         | 2026-02-18 |
| E8  | Machine Availability automatisch auf "Wartung" wenn Wartungsplan aktiv                                                            | Wie Vacation→user_availability, hier TPM→machine_availability                                     | 2026-02-18 |
| E9  | Freigabe pro Karte konfigurierbar (Checkbox bei Erstellung)                                                                       | Manche Karten brauchen Prüfung, manche nicht. Bei Freigabe-Karten: Doku + optionale Fotos Pflicht | 2026-02-18 |
| E10 | Überfällige Karten: Bleibt ROT + Eskalations-Notification nach konfigurierbarer Frist                                             | Kein Umdrehen ohne Done/Prüfung. Intern wird's geklärt, System warnt zusätzlich                   | 2026-02-18 |
| E11 | Kartenfarben: Custom möglich (wie KVP Color Picker bei Definitions)                                                               | Jede Firma hat eigene Farbstandards, Default bleibt Grün/Rot/Gelb                                 | 2026-02-18 |
| E12 | Card-Flip Animation: Svelte `rotateY(180deg)` + `transition: transform 0.4s`                                                      | Physisches Umdrehen digital nachempfunden, `backface-visibility: hidden`                          | 2026-02-18 |
| E13 | Kein Kosten-/Ersatzteil-Tracking in V1                                                                                            | Scope bewusst klein halten, ggf. V2. Lagerbestand/Drittanbieter vielleicht später                 | 2026-02-18 |
| E14 | Slot-Vorschlag prüft Maschinen-Belegung UND Schichtplan                                                                           | Employee Availability, Shift, Vacation sind schon fertig — nutzen!                                | 2026-02-18 |
| E15 | REGEL: Schichtplan MUSS VOR Wartungsplan existieren                                                                               | Wartungsplan liest Schichtplan um verfügbare MA zu erkennen                                       | 2026-02-18 |
| E16 | Instandhaltungsteam = Joker, nicht fest an Maschine gebunden                                                                      | Geht dahin wo Wartung/Reparatur ist. Machine-Assignment optional (schon so gebaut)                | 2026-02-18 |
| E17 | Shift-Modul braucht Toggle/Filter für Wartungstermine im Week-Grid                                                                | Instandhaltung kann bei Schichtplanung Wartung sehen und Schicht planen                           | 2026-02-18 |
| E18 | Permission-Hierarchie: root/admin(full_access)=RWX, employee=R(own), teamlead=RWX(team), dept_lead=RWX(dept), area_lead=RWX(area) | Analog zu bestehendem RBAC-System                                                                 | 2026-02-18 |

---

## Verworfene Ideen

| #   | Idee | Warum verworfen | Datum |
| --- | ---- | --------------- | ----- |

---

## Permission-Hierarchie (E18 — Detail)

### Rollen im System

| Rolle                     | DB-Feld                                           | `has_full_access`             | TPM-Zugriff                                                    |
| ------------------------- | ------------------------------------------------- | ----------------------------- | -------------------------------------------------------------- |
| **root**                  | `users.role = 'root'`                             | Immer `true` (DB-Constraint)  | RWX alles                                                      |
| **admin** (full)          | `users.role = 'admin'`, `has_full_access = true`  | Ja                            | RWX alles                                                      |
| **admin** (eingeschränkt) | `users.role = 'admin'`, `has_full_access = false` | Nein                          | Über `admin_area_permissions` / `admin_department_permissions` |
| **employee**              | `users.role = 'employee'`                         | Immer `false` (DB-Constraint) | Read only, nur eigene Maschinen                                |

### Zugriffskette: Employee → Maschine

```
Employee (user_id=42)
  └── user_teams (user_id=42, team_id=7, role='member')
        └── machine_teams (team_id=7, machine_id=15)
              └── Maschine P17 → Employee sieht Kamishibai-Karten für P17
```

### Zugriffskette: Team-Lead → Maschinen

```
Team Lead (user_id=10, users.role='admin')
  └── teams.team_lead_id = 10 (Team "Produktion Halle 3")
        └── machine_teams → Alle Maschinen des Teams
              └── RWX: Karten erstellen, bearbeiten, freigeben
```

### Zugriffskette: Department-Lead → Maschinen

```
Dept Lead (user_id=5, users.role='admin')
  └── departments.department_lead_id = 5
        └── Alle Teams in dieser Abteilung
              └── Alle Maschinen dieser Teams
                    └── RWX: Alles was Team-Leads können + abteilungsübergreifend
```

### Zugriffskette: Area-Lead → Maschinen

```
Area Lead (user_id=3, users.role='admin')
  └── areas.area_lead_id = 3
        └── Alle Abteilungen in diesem Bereich
              └── Alle Teams in diesen Abteilungen
                    └── Alle Maschinen
                          └── RWX: Bereichsweiter Zugriff
```

### Feature-Permission Integration (ADR-020)

TPM muss sich im Decentralized Permission Registry registrieren:

```
tpm.permissions.ts → {
  code: 'tpm',
  label: 'TPM / Wartung',
  modules: [
    { code: 'tpm-plans', label: 'Wartungspläne', allowedPermissions: ['canRead', 'canWrite', 'canDelete'] },
    { code: 'tpm-cards', label: 'Kamishibai-Karten', allowedPermissions: ['canRead', 'canWrite', 'canDelete'] },
    { code: 'tpm-executions', label: 'Durchführungen', allowedPermissions: ['canRead', 'canWrite'] },
    { code: 'tpm-reports', label: 'Auswertungen', allowedPermissions: ['canRead'] },
  ]
}
```

### Frontend Route Security (ADR-012 + ADR-024)

```
routes/(app)/
├── (admin)/lean-management/tpm/           ← Admin: Pläne erstellen, Karten verwalten
│   ├── +page.server.ts                    ← requireFeature(activeFeatures, 'tpm')
│   ├── plan/[uuid]/+page.server.ts
│   └── ...
└── (shared)/lean-management/tpm/          ← Employee: Board ansehen, Karten erledigen
    ├── +page.server.ts                    ← requireFeature(activeFeatures, 'tpm')
    └── board/[uuid]/+page.server.ts
```

---

## V1 Scope (bestätigt)

1. Wartungsplan pro Maschine erstellen (alle Intervalle: T, W, M, VJ, HJ, J, LL, Custom)
2. Kamishibai Board pro Maschine (Karten mit Rot/Grün/Gelb)
3. Card-Flip Animation (Svelte)
4. Kartenvorlagen (Standard + Custom)
5. Slot-Verfügbarkeits-Assistent (Schichtplan + Maschinenauslastung)
6. Mitarbeiter-Zuweisung pro Maschine (über Teams)
7. Zeiterfassung SOLL (Vorbereitung/Durchführung/Nachbereitung)
8. Intervall-Kaskade (Jährlich → alle kürzeren)
9. Duplikat-Erkennung bei Karten-Erstellung
10. Freigabe-Flow (konfigurierbar pro Karte)
11. Eskalation bei überfälligen Karten
12. Machine Availability Integration
13. Schichtplan ↔ Wartungsplan Abhängigkeit

**NICHT V1:** Kosten-Tracking, Ersatzteil-Management, Prädiktive Wartung, OEE-Dashboard

---

## Bestehendes Fundament in Assixx

> **Status:** ✅ Verifiziert am 2026-02-18 → Siehe [brainstorming-TPM-Verification.md](./brainstorming-TPM-Verification.md)

- [x] `machines` Tabelle (vollständiges CRUD + UUID + RLS) — **VERIFIZIERT**
- [x] `machine_teams` Junction Table (N:M, is_primary, assigned_by) — **VERIFIZIERT**
- [x] `machine_availability` Tabelle (operational/maintenance/repair/standby/cleaning/other) — **VERIFIZIERT**
- [x] `machine_maintenance_history` Tabelle (Audit Trail, maintenance_type enum) — **VERIFIZIERT**
- [x] `machine_documents` Tabelle (existiert aber NICHT im Backend integriert) — **VERIFIZIERT**
- [x] `teams` + `user_teams` (N:M, Multi-Team seit 2026-02-18) — **VERIFIZIERT**
- [x] `departments` + `user_departments` (N:M, is_primary) — **VERIFIZIERT**
- [x] `areas` (mit area_lead_id) — **VERIFIZIERT**
- [x] Notification-System (SSE + persistent + Badge + Feature-Notifications ADR-004) — **VERIFIZIERT**
- [x] Permission-System (ADR-010 RBAC + ADR-020 Feature Permissions + ADR-024 Frontend Guards) — **VERIFIZIERT**
- [x] Feature-Flag-System (tenant_features + TenantFeatureGuard) — **VERIFIZIERT**
- [x] Shift Planning mit Machine-ID FK (shifts.machine_id, shift_plans.machine_id) — **VERIFIZIERT**
- [x] User Availability (vacation/sick/training/other) — **VERIFIZIERT**
- [x] Deputy Lead auf Teams (teams.deputy_lead_id) — **VERIFIZIERT**

---

## Referenzen

- [HOW-TO-INTEGRATE-FEATURE.md](./HOW-TO-INTEGRATE-FEATURE.md) — Feature-Integration-Checkliste
- [HOW-TO-PLAN-SAMPLE.md](./HOW-TO-PLAN-SAMPLE.md) — Masterplan-Template
- [FEAT_TPM_MASTERPLAN.md](./FEAT_TPM_MASTERPLAN.md) — **TPM Execution Masterplan (28 Sessions, 6 Phasen)**
- [FEAT_VACCATION_MASTERPLAN.md](./FEAT_VACCATION_MASTERPLAN.md) — Referenz-Implementation (24 Sessions)
- [TPM-ECOSYSTEM-CONTEXT.md](./TPM-ECOSYSTEM-CONTEXT.md) — Domänenwissen TPM, Kamishibai, Kanban
- [brainstorming-TPM-Verification.md](./brainstorming-TPM-Verification.md) — Codebase-Verifizierung aller Annahmen
- Screenshots: `archive/screenshots/screenshot1.png` bis `screen5.jpeg.jpeg`
