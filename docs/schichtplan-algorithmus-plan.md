# Schichtplan-Algorithmus: Konzeptioneller Plan

## 1. Zielsetzung

Der Algorithmus soll aus minimalen Benutzereingaben einen vollständigen Schichtplan für einen definierten Zeitraum generieren. Er muss flexibel genug sein, um **99-100% aller in der Praxis vorkommenden Schichtrhythmen** abzubilden.

---

## 2. Kategorisierung realer Schichtrhythmen

Basierend auf Recherche zu industriellen Schichtmodellen in Deutschland lassen sich folgende Hauptkategorien identifizieren:

### Kategorie A: Einfache X/Y-Rhythmen
Der häufigste Typ. Eine feste Anzahl Arbeitstage, gefolgt von einer festen Anzahl freier Tage.

| Bezeichnung | Arbeitstage | Freie Tage | Typische Branche |
|-------------|-------------|------------|------------------|
| 4/4-Rhythmus | 4 | 4 | Industrie, Produktion |
| 5/2-Rhythmus | 5 | 2 | Klassische Woche |
| 6/3-Rhythmus | 6 | 3 | Vollkonti-Betrieb |
| 6/4-Rhythmus | 6 | 4 | Industrie, Logistik, Pflege |
| 7/7-Rhythmus | 7 | 7 | Offshore, Bergbau |
| 14/14-Rhythmus | 14 | 14 | Offshore-Plattformen |
| 21/7-Rhythmus | 21 | 7 | Offshore, Auslandseinsätze |

### Kategorie B: Kurze Wechselrhythmen (2-2-3)
Speziell für 12-Stunden-Schichten entwickelt, um jedes zweite Wochenende frei zu haben.

| Bezeichnung | Muster | Beschreibung |
|-------------|--------|--------------|
| 2-2-3-Rhythmus | 2 Arbeit → 2 frei → 3 Arbeit → 2 frei | Jedes 2. Wochenende frei |
| Panama-Plan | Variation des 2-2-3 | 4 Teams rotieren |

### Kategorie C: Wöchentlicher Wechsel
Die Schicht wechselt im Wochenrhythmus, nicht nach Freiphase.

| Bezeichnung | Beschreibung |
|-------------|--------------|
| Klassischer Wochenwechsel | Mo-Fr Früh → nächste Woche Spät → nächste Woche Nacht |
| Zwei-Wochen-Wechsel | 2 Wochen Früh → 2 Wochen Spät → 2 Wochen Nacht |

**Hinweis:** Diese Kategorie ist laut Aufgabenstellung bereits separat implementiert und muss hier nicht behandelt werden.

### Kategorie D: Feste Schicht ohne Wechsel
Manche Mitarbeiter arbeiten dauerhaft in einer Schicht.

| Bezeichnung | Beschreibung |
|-------------|--------------|
| Dauerfrüh | Nur Frühschicht |
| Dauerspät | Nur Spätschicht |
| Dauernacht | Nur Nachtschicht |

---

## 3. Kern-Entscheidung: Wie wechselt die Schicht?

Dies ist die wichtigste konzeptionelle Frage des Algorithmus.

### Option 1: Schichtwechsel nach jedem Zyklus (empfohlen für diesen Algorithmus)
Nach Abschluss eines kompletten Rhythmus-Zyklus (Arbeit + Frei) wechselt die Schicht zur nächsten in der Reihenfolge.

**Beispiel 4/4-Rhythmus mit Schichtwechsel:**
```
Zyklus 1: 4× Früh → 4× frei
Zyklus 2: 4× Spät → 4× frei  
Zyklus 3: 4× Nacht → 4× frei
Zyklus 4: 4× Früh → 4× frei (von vorne)
```

### Option 2: Keine Rotation (feste Schicht)
Der Mitarbeiter/das Team bleibt dauerhaft in einer Schicht.

**Beispiel 6/4-Rhythmus ohne Wechsel:**
```
Zyklus 1: 6× Früh → 4× frei
Zyklus 2: 6× Früh → 4× frei
Zyklus 3: 6× Früh → 4× frei
(immer Früh)
```

### Option 3: Wechsel nach X Zyklen
Die Schicht wechselt erst nach einer bestimmten Anzahl von Zyklen.

**Beispiel: Wechsel nach 2 Zyklen:**
```
Zyklus 1: 4× Früh → 4× frei
Zyklus 2: 4× Früh → 4× frei
Zyklus 3: 4× Spät → 4× frei (Wechsel!)
Zyklus 4: 4× Spät → 4× frei
```

### Empfehlung für den Algorithmus
Der Benutzer sollte wählen können:
1. **Schichtwechsel aktiviert?** (Ja/Nein)
2. **Wenn ja: Nach wie vielen Zyklen?** (Standard: 1)
3. **Schicht-Reihenfolge?** (Standard: Früh → Spät → Nacht)

---

## 4. Benötigte Benutzereingaben

### Pflichtfelder (Minimum für Generierung)

| Feld | Beschreibung | Beispiel |
|------|--------------|----------|
| Startdatum | Beginn des Schichtplans | 01.01.2025 |
| Enddatum | Ende des Schichtplans | 31.12.2025 |
| Startschicht | Welche Schicht am ersten Tag? | Früh |
| Schichtblock-Länge | Wie viele Tage in derselben Schicht? | 10 |
| Freie Tage | Freie Tage zwischen Schichtwechseln | 2 |
| Schicht-Reihenfolge | Rotations-Reihenfolge (Dropdown) | Früh → Spät → Nacht |

### Optionale Felder

| Feld | Beschreibung | Standardwert |
|------|--------------|--------------|
| Sonderregeln | Jeden N-ten Wochentag frei | Keine |

### Feld-Erklärung mit Beispiel

```
Eingabe:
- Startdatum: 01.01.2025
- Enddatum: 31.12.2025
- Startschicht: Früh
- Schichtblock-Länge: 10 Tage
- Freie Tage: 2 Tage
- Schicht-Reihenfolge: Früh → Spät → Nacht

Ergebnis:
Tag 1-10:  FRÜH (10×)
Tag 11-12: FREI (2×)
Tag 13-22: SPÄT (10×)
Tag 23-24: FREI (2×)
Tag 25-34: NACHT (10×)
Tag 35-36: FREI (2×)
Tag 37-46: FRÜH (10×)  ← Zyklus wiederholt
...
```

---

## 5. Algorithmus-Logik in Textform

### Schritt 1: Validierung
Bevor der Algorithmus startet, werden die Eingaben geprüft:

**Bedingung 1:** Startdatum muss vor Enddatum liegen.
- Falls nicht erfüllt → Fehlermeldung: "Startdatum muss vor Enddatum liegen"

**Bedingung 2:** Schichtblock-Länge muss mindestens 1 sein.
- Falls nicht erfüllt → Fehlermeldung: "Mindestens 1 Tag pro Schichtblock"

**Bedingung 3:** Freie Tage müssen mindestens 0 sein.
- 0 freie Tage sind erlaubt (direkter Schichtwechsel ohne Pause)

**Bedingung 4:** Startschicht muss gültig sein (Früh, Spät oder Nacht).
- Falls nicht erfüllt → Fehlermeldung: "Ungültiger Schichttyp"

**Bedingung 5:** Schicht-Reihenfolge muss 3 Elemente haben.
- Falls nicht erfüllt → Fehlermeldung: "Ungültige Schicht-Reihenfolge"

### Schritt 2: Block-Länge berechnen
```typescript
// Ein "Block" = Schichtblock + Freitage
const blockLength: number = shiftBlockLength + freeDays;
// Gesamtzyklus = 3 Blöcke (Früh + Spät + Nacht)
const fullCycleLength: number = blockLength * 3;
```

**Beispiel:** 10 Tage Schicht + 2 Tage frei → Block = 12 Tage, Zyklus = 36 Tage

### Schritt 3: Initialisierung
Der Algorithmus beginnt mit folgenden Startwerten:

```typescript
type ShiftType = 'early' | 'late' | 'night';
type PhaseType = 'shift' | 'free';

interface AlgorithmState {
  currentDate: Date;
  currentPhase: PhaseType;
  dayInPhase: number;
  shiftIndex: number;           // 0, 1, 2 → Index in shiftSequence
  currentShift: ShiftType;
  blockNumber: number;          // Welcher Block im Zyklus?
}

const initialState: AlgorithmState = {
  currentDate: new Date(startDate),
  currentPhase: 'shift',
  dayInPhase: 1,
  shiftIndex: 0,
  currentShift: startShift,     // Vom Benutzer gewählt
  blockNumber: 1,
};
```

### Schritt 4: Hauptschleife
Für jeden Tag im Zeitraum (vom Startdatum bis Enddatum):

```typescript
function generateShiftPlan(config: ShiftPlanConfig): GeneratedDay[] {
  const result: GeneratedDay[] = [];
  const state = createInitialState(config);

  while (state.currentDate <= config.endDate) {
    // A) Status bestimmen (Schicht oder Frei?)
    const dayStatus = determineDayStatus(state);

    // B) Sonderregeln prüfen (z.B. jeden 4. Sonntag frei)
    const finalStatus = applySpecialRules(dayStatus, state.currentDate, config.specialRules);

    // C) Tag speichern
    result.push(createDayEntry(state, finalStatus));

    // D) Zum nächsten Tag navigieren
    advanceToNextDay(state, config);
  }

  return result;
}

// Hilfsfunktion: Status bestimmen
function determineDayStatus(state: AlgorithmState): DayStatus {
  if (state.currentPhase === 'shift') {
    return { status: 'work', shift: state.currentShift };
  }
  return { status: 'free', shift: null };
}

// Hilfsfunktion: Navigation
function advanceToNextDay(state: AlgorithmState, config: ShiftPlanConfig): void {
  state.dayInPhase += 1;

  // Schichtblock beendet? → Wechsel zu Freitagen
  if (state.currentPhase === 'shift' && state.dayInPhase > config.shiftBlockLength) {
    transitionToFreePhase(state);
  }
  // Freitage beendet? → Wechsel zur nächsten Schicht
  else if (state.currentPhase === 'free' && state.dayInPhase > config.freeDays) {
    transitionToNextShift(state, config);
  }

  state.currentDate = addDays(state.currentDate, 1);
}
```

### Schritt 5: Ausgabe
Nach Abschluss der Schleife wird der generierte Plan zurückgegeben:
- Liste aller Tage mit Datum, Status, Schicht
- Zusammenfassung (Gesamtarbeitstage, Gesamtfreie Tage, Anzahl Zyklen)

---

## 6. Sonderregeln-System

### Unterstützte Sonderregel-Typen

#### Typ 1: Bestimmter Wochentag immer frei
**Beschreibung:** Ein bestimmter Wochentag ist immer frei, unabhängig vom Rhythmus.
**Beispiel:** "Jeder Sonntag ist frei"
**Parameter:**
- Wochentag (0 = Sonntag, 1 = Montag, ..., 6 = Samstag)

**Logik:**
```typescript
// ESLint-konform: strict-boolean-expressions
function isWeekdayFree(date: Date, targetWeekday: number): boolean {
  return date.getDay() === targetWeekday;
}
```

#### Typ 2: Jeder N-te Wochentag im Monat frei
**Beschreibung:** Ein bestimmter Wochentag ist nur dann frei, wenn er der N-te im Monat ist.
**Beispiel:** "Jeder 4. Sonntag im Monat ist frei"
**Parameter:**
- Wochentag (0-6)
- N (1-5)

**Logik:**
```typescript
// ESLint-konform: explicit-function-return-type, strict-boolean-expressions
function isNthWeekdayFree(date: Date, targetWeekday: number, n: number): boolean {
  if (date.getDay() !== targetWeekday) {
    return false;
  }
  const position = getWeekdayPositionInMonth(date);
  return position === n;
}

// Berechnung: Der wievielte Wochentag im Monat
function getWeekdayPositionInMonth(date: Date): number {
  const dayOfMonth = date.getDate();
  return Math.floor((dayOfMonth - 1) / 7) + 1;
}

// Beispiel: 22. Januar 2025 ist ein Mittwoch
// (22 - 1) / 7 = 3, 3 + 1 = 4 → Es ist der 4. Mittwoch im Januar
```

#### Typ 3: Bestimmte Daten frei
**Beschreibung:** Spezifische Kalenderdaten sind frei.
**Beispiel:** Feiertage wie 25.12., 01.01., etc.
**Parameter:**
- Liste von Daten

**Logik:**
```typescript
// ESLint-konform: prefer-nullish-coalescing nicht nötig bei boolean
function isSpecificDateFree(date: Date, freeDates: Date[]): boolean {
  const dateString = formatDateISO(date);
  return freeDates.some((freeDate: Date) => formatDateISO(freeDate) === dateString);
}
```

#### Typ 4: Feiertage frei (automatisch)
**Beschreibung:** Gesetzliche Feiertage werden automatisch als frei markiert.
**Parameter:**
- Bundesland (für regionale Feiertage)

**Hinweis:** Erfordert eine Feiertags-Datenbank oder API. Kann als Erweiterung implementiert werden.

### Priorität bei mehreren Sonderregeln
Wenn mehrere Sonderregeln für denselben Tag zutreffen, gilt:
1. Alle "Frei"-Regeln werden angewendet
2. Eine "Frei"-Regel überschreibt immer einen Arbeitstag
3. Keine Konflikte möglich, da Sonderregeln nur "Frei" setzen können

---

## 7. Warnungen und Hinweise

### Warnung 1: Langer Zeitraum
**Bedingung:** Zeitraum > 365 Tage
**Hinweis:** "Der gewählte Zeitraum umfasst mehr als ein Jahr. Die Berechnung kann einen Moment dauern."

### Warnung 2: Viele aufeinanderfolgende Arbeitstage
**Bedingung:** Arbeitstage > 14
**Hinweis:** "Sie haben mehr als 14 aufeinanderfolgende Arbeitstage gewählt. Bitte prüfen Sie, ob dies den arbeitsrechtlichen Bestimmungen entspricht."

### Warnung 3: Keine freien Tage
**Bedingung:** Freie Tage = 0
**Hinweis:** "Sie haben 0 freie Tage gewählt. Der Plan enthält keine Ruhephasen zwischen Zyklen."

### Warnung 4: Sehr kurzer Rhythmus
**Bedingung:** Zyklus-Länge < 3 Tage
**Hinweis:** "Der gewählte Rhythmus ist sehr kurz. Dies ist ungewöhnlich für industrielle Schichtpläne."

---

## 8. Vorlagen für häufige Rhythmen

Um die Eingabe zu erleichtern, sollte der Benutzer aus Vorlagen wählen können:

| Vorlage | Arbeitstage | Freie Tage | Schichtwechsel | Beschreibung |
|---------|-------------|------------|----------------|--------------|
| 4/4 Standard | 4 | 4 | Nach jedem Zyklus | Klassischer Industrierhythmus |
| 5/2 Woche | 5 | 2 | Nach jedem Zyklus | Normale Arbeitswoche |
| 6/4 Vollkonti | 6 | 4 | Nach jedem Zyklus | 24/7-Betrieb |
| 6/3 Kompakt | 6 | 3 | Nach jedem Zyklus | Verdichteter Vollkonti |
| 7/7 Offshore | 7 | 7 | Nach jedem Zyklus | Offshore/Bergbau |
| 14/14 Rotation | 14 | 14 | Nach jedem Zyklus | Lange Einsätze |
| 21/7 Ausland | 21 | 7 | Nach jedem Zyklus | Auslandseinsätze |
| 2-2-3 Panama | Speziell | Speziell | Nach Muster | 12h-Schichten |
| Dauerschicht | Beliebig | Beliebig | Nie | Keine Rotation |

### Hinweis zum 2-2-3-Rhythmus
Dieser Rhythmus ist komplexer und erfordert eine erweiterte Phasen-Definition:
```
Phase 1: 2 Tage Arbeit
Phase 2: 2 Tage frei
Phase 3: 3 Tage Arbeit
Phase 4: 2 Tage frei
(Zyklus wiederholt sich)
```
Dies kann durch ein erweitertes Phasen-Array abgebildet werden (siehe Abschnitt 9).

---

## 9. Erweiterung für komplexe Rhythmen

Für Rhythmen, die nicht dem einfachen X/Y-Muster folgen, kann ein Phasen-Array verwendet werden:

### Konzept
Statt nur "Arbeitstage" und "Freie Tage" definiert der Benutzer eine Sequenz von Phasen:

```typescript
// ESLint-konform: camelCase, PascalCase für Types, explicit types
interface Phase {
  type: PhaseType;   // 'work' | 'free'
  days: number;
}

// 2-2-3 Rhythmus Beispiel
const phases: Phase[] = [
  { type: 'work', days: 2 },
  { type: 'free', days: 2 },
  { type: 'work', days: 3 },
  { type: 'free', days: 2 },
];
```

### Angepasste Algorithmus-Logik
```typescript
// ESLint-konform: max-lines-per-function 60, max-depth 4
function generateComplexPlan(config: ComplexShiftConfig): GeneratedDay[] {
  const result: GeneratedDay[] = [];
  let phaseIndex = 0;
  let dayInPhase = 1;
  let currentDate = new Date(config.startDate);

  while (currentDate <= config.endDate) {
    const currentPhase = config.phases[phaseIndex];
    result.push(createDayFromPhase(currentDate, currentPhase));

    // Navigation zur nächsten Phase
    const navigation = navigateToNextPhase(dayInPhase, phaseIndex, config.phases);
    dayInPhase = navigation.dayInPhase;
    phaseIndex = navigation.phaseIndex;

    currentDate = addDays(currentDate, 1);
  }

  return result;
}

// Separate Hilfsfunktion für Navigation (cognitive-complexity reduzieren)
function navigateToNextPhase(
  dayInPhase: number,
  phaseIndex: number,
  phases: Phase[],
): { dayInPhase: number; phaseIndex: number } {
  const nextDay = dayInPhase + 1;
  const currentPhase = phases[phaseIndex];

  if (nextDay > currentPhase.days) {
    const nextIndex = (phaseIndex + 1) % phases.length;
    return { dayInPhase: 1, phaseIndex: nextIndex };
  }

  return { dayInPhase: nextDay, phaseIndex };
}
```

### Wann ist diese Erweiterung nötig?
- 2-2-3-Rhythmen
- Ungleichmäßige Arbeit/Frei-Verteilungen
- Spezielle Betriebsvereinbarungen

Für 99% der Anwendungsfälle reicht das einfache Schichtblock-Modell.

---

## 10. Benutzer-Dialog (Modal)

> ⚠️ **HINWEIS:** Der ursprünglich geplante 5-Step Wizard wurde verworfen.
> **Siehe Sektion 20 für das aktuelle UI-Design.**

Das Modal integriert sich in den bestehenden Custom Rotation-Flow:
- Toggle "Benutzerdefiniert" aktiviert das Modal
- Konfiguration erfolgt in EINEM Schritt (kein Wizard)
- Danach erscheint das 14-Tage Grid zum Ausfüllen

**Warum kein Wizard?**
- Zu viele Klicks für den User
- Der Flow existiert bereits (Toggle → Modal → Grid)
- KISS-Prinzip: Einfacher ist besser

---

## 11. Ausgabe-Format

### TypeScript Interface für generierte Tage:
```typescript
// ESLint-konform: PascalCase für Types, explicit union types
type ShiftType = 'early' | 'late' | 'night';
type DayStatus = 'work' | 'free';

interface GeneratedDay {
  date: string;                    // ISO-Format: "2025-01-01"
  weekday: number;                 // 0-6 (0 = Sonntag)
  weekdayName: string;             // "Montag", "Dienstag", etc.
  status: DayStatus;
  shift: ShiftType | null;         // null wenn status === 'free'
  cycleNumber: number;
  specialRuleApplied: boolean;
  specialRuleName?: string;        // Optional: welche Regel
}
```

### Beispiel-Ausgabe (Januar 2025, 4/4-Rhythmus, Start: early):
```
date       | weekdayName | status | shift | cycleNumber
-----------|-------------|--------|-------|------------
2025-01-01 | Mittwoch    | work   | early | 1
2025-01-02 | Donnerstag  | work   | early | 1
2025-01-03 | Freitag     | work   | early | 1
2025-01-04 | Samstag     | work   | early | 1
2025-01-05 | Sonntag     | free   | null  | 1
2025-01-06 | Montag      | free   | null  | 1
2025-01-07 | Dienstag    | free   | null  | 1
2025-01-08 | Mittwoch    | free   | null  | 1
2025-01-09 | Donnerstag  | work   | late  | 2  ← Neuer Zyklus, Schichtwechsel!
2025-01-10 | Freitag     | work   | late  | 2
...
```

---

## 12. Edge Cases und Fehlerbehandlung

### Fall 1: Zeitraum kürzer als ein Zyklus
**Situation:** Benutzer wählt 5 Tage Zeitraum bei 4/4-Rhythmus (8 Tage Zyklus)
**Verhalten:** Algorithmus füllt nur die vorhandenen 5 Tage
**Kein Fehler**, aber Hinweis: "Der Zeitraum ist kürzer als ein vollständiger Zyklus"

### Fall 2: Enddatum = Startdatum
**Situation:** Nur ein einzelner Tag
**Verhalten:** Genau 1 Tag wird generiert
**Gültig**, kein Fehler

### Fall 3: 0 freie Tage
**Situation:** Durchgehende Arbeit ohne Pausen
**Verhalten:** Zyklus besteht nur aus Arbeitstagen
**Gültig**, aber Warnung anzeigen

### Fall 4: Sonderregel macht alle Tage frei
**Situation:** Z.B. "Jeder Wochentag frei" würde alle 7 Tage als frei markieren
**Verhalten:** Algorithmus führt aus, aber zeigt Warnung
**Hinweis:** "Die Sonderregeln führen dazu, dass alle Tage als frei markiert sind"

### Fall 5: Startdatum in der Vergangenheit
**Situation:** Benutzer wählt ein Datum in der Vergangenheit
**Verhalten:** Erlaubt (für Nacherfassung oder Planung ab historischem Datum)
**Kein Fehler**

---

## 13. Technische Hinweise für die Implementierung

### Performance
- Für Zeiträume bis 3 Jahre (~1095 Tage) sollte die Berechnung unter 1 Sekunde dauern
- Keine Datenbankabfragen während der Schleife
- Array vorallokieren wenn möglich

### Datumsberechnung
- Zeitzone beachten (Deutschland: Europe/Berlin)
- Sommerzeit-Wechsel berücksichtigen
- Immer mit Datum-Bibliothek arbeiten (z.B. date-fns, dayjs)

### Testbarkeit
Der Algorithmus sollte als reine Funktion implementiert werden:
- Eingabe: Konfiguration
- Ausgabe: Generierter Plan
- Keine Seiteneffekte
- Leicht zu testen

### Erweiterbarkeit
- Sonderregel-Typen als Plugin-System
- Schicht-Typen konfigurierbar (nicht hart-kodiert)
- Export-Formate erweiterbar (CSV, iCal, etc.)

---

## 14. Zusammenfassung der Kernlogik

```
┌──────────────────────────────────────────────────────────────┐
│                        EINGABE                               │
│  • Startdatum, Enddatum                                      │
│  • Arbeitstage, Freie Tage (oder Phasen-Array)              │
│  • Erste Schicht                                             │
│  • Schichtwechsel-Einstellungen                              │
│  • Sonderregeln (optional)                                   │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                      VALIDIERUNG                             │
│  • Pflichtfelder vorhanden?                                  │
│  • Werte plausibel?                                          │
│  • Warnungen generieren                                      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    INITIALISIERUNG                           │
│  • Zyklus-Länge berechnen                                    │
│  • Startwerte setzen                                         │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                     HAUPTSCHLEIFE                            │
│  Für jeden Tag:                                              │
│    1. Status bestimmen (Arbeit/Frei)                         │
│    2. Schicht zuweisen (wenn Arbeit)                         │
│    3. Sonderregeln prüfen                                    │
│    4. Tag speichern                                          │
│    5. Zum nächsten Tag navigieren                            │
│    6. Bei Zyklusende: Schichtwechsel prüfen                  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                        AUSGABE                               │
│  • Array aller Tage mit Details                              │
│  • Metadaten (Zusammenfassung)                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 15. Nächste Schritte (Implementierung)

### MVP (Phase 1)

```
✅ 1. Backend: custom-rotation.service.ts erstellen (in bestehende Datei)
   ├── generateYearPatternFromTwoWeeks() - Kern-Algorithmus
   ├── analyzeTemplate() - Template analysieren
   ├── findDateBoundaries() - Datumsgrenzen finden
   └── groupShiftsByDayIndex() - Schichten gruppieren

✅ 2. Backend: rotation.types.ts erweitern
   └── PatternConfig um shiftBlockLength, freeDays, startShift, shiftSequence, specialRules

✅ 3. Backend: shifts.validation.zod.ts erweitern
   └── NthWeekdayFreeRuleSchema, ShiftBlockConfigSchema

✅ 4. Frontend: shifts.html Modal erweitern
   ├── Schichtblock-Länge Input
   ├── Freie Tage Input
   ├── Startschicht Select
   ├── Schicht-Reihenfolge Dropdown
   ├── Zeitraum Picker (existiert)
   └── Sonderregeln Checkbox (nth_weekday_free)

✅ 5. Frontend: custom-rotation.ts anpassen
   ├── selectPattern() erweitert mit neuen Feldern
   ├── createCustomRotationPattern() sendet neue Felder
   └── Helper-Funktionen hinzugefügt

✅ 6. Frontend: Info-Box hinzufügen
   └── updatePatternCompletionInfo() zeigt "Muster vollständig" wenn Grid ausgefüllt

□ 7. Integration testen
   └── E2E: Team → Toggle → Modal → Grid → Save → Verify DB
```

### Phase 2 (später)

```
8. Weitere Sonderregeln
   ├── weekday_always_free (z.B. Sonntag IMMER frei)
   └── holidays_free (Feiertage per Bundesland-API)

HINWEIS: nth_weekday_free ist bereits im MVP enthalten!
```

### Entscheidungen (GETROFFEN)

| Frage | Entscheidung |
|-------|--------------|
| Wizard oder Modal? | **Modal** (kein Wizard) |
| Neue Datei rhythm-wizard.ts? | **Nein** (custom-rotation.ts erweitern) |
| Sonderregeln in MVP? | **Ja** (nth_weekday_free) |
| Schichtblock-Modell oder Phasen-Array? | **Schichtblock-Modell** (Phasen-Array nur für 2-2-3) |
| API neuer Endpoint? | **Nein** (bestehender POST /rotation) |

---

## 16. ESLint-konforme TypeScript-Typen (Zusammenfassung)

```typescript
// =============================================================================
// shift-algorithm.types.ts
// ESLint-konform: Alle Regeln aus eslint.config.js berücksichtigt
// =============================================================================

// Basis-Typen (Union Types statt Enums für bessere Tree-Shaking)
type ShiftType = 'early' | 'late' | 'night';
type PhaseType = 'shift' | 'free';
type DayStatus = 'work' | 'free';

// Sonderregel-Typen (MVP: nur nth_weekday_free)
type SpecialRuleType = 'nth_weekday_free';

// Konfiguration für den Algorithmus (NEUES MODELL)
interface ShiftPlanConfig {
  startDate: Date;
  endDate: Date;
  startShift: ShiftType;            // Welche Schicht am ersten Tag?
  shiftBlockLength: number;         // Wie viele Tage in derselben Schicht?
  freeDays: number;                 // Freie Tage zwischen Schichtwechseln
  shiftSequence: ShiftType[];       // Reihenfolge: ['early','late','night']
  specialRules: SpecialRule[];      // Optional: Sonderregeln
}

// Sonderregel-Definitionen (vereinfacht für MVP)
interface NthWeekdayFreeRule {
  type: 'nth_weekday_free';
  name: string;
  weekday: number;    // 0-6 (0 = Sonntag)
  n: number;          // 1-5 (z.B. 4 = "jeder 4.")
}

type SpecialRule = NthWeekdayFreeRule;

// Generierter Tag (Ausgabe)
interface GeneratedDay {
  date: string;                    // ISO-Format: "2025-01-01"
  weekday: number;                 // 0-6
  weekdayName: string;             // Lokalisiert
  status: DayStatus;
  shift: ShiftType | null;
  blockNumber: number;             // Welcher Block? (1, 2, 3, ...)
  specialRuleApplied: boolean;
  specialRuleName?: string;
}

// Algorithmus-Zustand (intern)
interface AlgorithmState {
  currentDate: Date;
  currentPhase: PhaseType;
  dayInPhase: number;
  shiftIndex: number;              // 0, 1, 2 → Index in shiftSequence
  currentShift: ShiftType;
  blockNumber: number;
}

// Zusammenfassung der Generierung
interface GenerationSummary {
  totalDays: number;
  shiftDays: number;               // Tage mit Schicht
  freeDays: number;                // Freie Tage
  totalBlocks: number;             // Anzahl Schichtblöcke
  warnings: string[];
}

// Hauptfunktion-Signatur
type GenerateShiftPlanFn = (config: ShiftPlanConfig) => {
  days: GeneratedDay[];
  summary: GenerationSummary;
};

export type {
  ShiftType,
  PhaseType,
  DayStatus,
  SpecialRuleType,
  ShiftPlanConfig,
  ComplexShiftConfig,
  Phase,
  SpecialRule,
  GeneratedDay,
  AlgorithmState,
  GenerationSummary,
  GenerateShiftPlanFn,
};
```

### ESLint-Regeln die dieser Code einhält:

| Regel | Einhaltung |
|-------|------------|
| `@typescript-eslint/naming-convention` | camelCase für Variablen, PascalCase für Types |
| `@typescript-eslint/explicit-function-return-type` | Alle Funktionen haben Return-Types |
| `@typescript-eslint/no-explicit-any` | Kein `any` verwendet |
| `@typescript-eslint/strict-boolean-expressions` | Explizite Vergleiche statt truthy/falsy |
| `max-lines-per-function: 60` | Funktionen in Hilfsfunktionen aufgeteilt |
| `max-depth: 4` | Keine tiefen Verschachtelungen |
| `sonarjs/cognitive-complexity: 10` | Komplexität durch Aufteilung reduziert |
| `@typescript-eslint/typedef` | Parameter haben explizite Typen |

---

## 17. Technische Integration (Datenbank & API)

### Datenbank-Analyse: KEINE neue Migration nötig

Die bestehende Struktur reicht aus:

```
shift_rotation_patterns
├── pattern_config (JSONB)     ← Kann alle neuen Felder aufnehmen
├── cycle_length_weeks         ← Existiert bereits
├── starts_at / ends_at        ← Existiert bereits
└── is_active                  ← Existiert bereits

shifts
├── type (ENUM)                ← 'early'|'late'|'night'|'F'|'S'|'N' vorhanden
├── status (ENUM)              ← 'planned'|'confirmed'|'completed' vorhanden
├── date                       ← Existiert
└── user_id, team_id, etc.     ← Existiert
```

### pattern_config JSONB erweitern

Bestehende `PatternConfig` in `rotation.types.ts` erweitern:

```typescript
// backend/src/routes/v2/shifts/rotation.types.ts
interface PatternConfig {
  // BESTEHENDE Felder (behalten für wochenweisen Modus)
  weekType?: 'F' | 'S';
  shiftType?: 'N';
  pattern?: { week: number; shift: 'F' | 'S' | 'N' }[];
  customPattern?: { week1: WeekSchedule; week2: WeekSchedule };

  // NEU: Schichtblock-Modus
  shiftBlockLength?: number;                        // Tage pro Schichtblock (z.B. 10)
  freeDays?: number;                                // Freie Tage zwischen Wechseln (z.B. 2)
  startShift?: 'early' | 'late' | 'night';          // Startschicht
  shiftSequence?: ('early' | 'late' | 'night')[];   // Reihenfolge der Rotation

  // NEU: Sonderregeln
  specialRules?: NthWeekdayFreeRule[];
}

// Sonderregel (MVP: nur nth_weekday_free)
interface NthWeekdayFreeRule {
  type: 'nth_weekday_free';
  name: string;
  weekday: number;    // 0-6
  n: number;          // 1-5
}
```

### API: Bestehenden Endpoint erweitern (KEIN neuer Endpoint!)

> ⚠️ **Entscheidung:** Wir nutzen den bestehenden Endpoint statt einen neuen zu erstellen.
> Das Backend erkennt am Vorhandensein von `shiftBlockLength` dass Schichtblock-Modus gewünscht ist.

**Bestehender Endpoint:**
```
POST /api/v2/shifts/rotation
```

**Request Body (erweitert um Schichtblock-Felder):**
```json
{
  "patternConfig": {
    "shiftBlockLength": 10,
    "freeDays": 2,
    "startShift": "early",
    "shiftSequence": ["early", "late", "night"],
    "specialRules": [
      { "type": "nth_weekday_free", "name": "4. Sonntag", "weekday": 0, "n": 4 }
    ],
    "customPattern": { ... }  // Grid-Daten mit User IDs
  },
  "startsAt": "2025-01-01",
  "endsAt": "2025-12-31",
  "teamId": 5
}
```

**Backend-Logik:**
```typescript
// In rotation.service.ts oder neuer shift-algorithm.service.ts:
if (patternConfig.shiftBlockLength !== undefined) {
  // Schichtblock-Modus → neuer Algorithmus
  return generateShiftBlockPlan(data, tenantId, userId);
} else {
  // Wochenweiser Modus → bestehende Logik
  return generateRotationShifts(data, tenantId, userId);
}
```

**Bestehende Endpoints nutzen:**

| Endpoint | Verwendung |
|----------|------------|
| `GET /api/v2/shifts/rotation/patterns` | Muster laden |
| `POST /api/v2/shifts/rotation` | Muster speichern (erweitert!) |
| `GET /api/v2/users?teamId=X` | Mitarbeiter für Team laden |

### Implementierungs-Reihenfolge

```
1. rotation.types.ts erweitern (PatternConfig)
2. shift-algorithm.service.ts erstellen (Kern-Logik)
3. rotation.service.ts anpassen (Mode-Detection: Schichtblock vs wochenweise)
4. Frontend-Modal erweitern (neue Felder, KEIN Wizard)
5. Integration testen
```

### Datei-Struktur

```
backend/src/routes/v2/shifts/
├── rotation.types.ts         ← PatternConfig erweitern
├── rotation.service.ts       ← Mode-Detection hinzufügen
├── shift-algorithm.service.ts← NEU: Schichtblock-Algorithmus
└── rotation.controller.ts    ← KEINE Änderung nötig

frontend/src/scripts/shifts/
├── custom-rotation.ts           ← ERWEITERN (collectPatternConfig)
├── custom-rotation-types.ts     ← ERWEITERN (neue Felder)
└── [KEIN rhythm-wizard.ts!]  ← Wurde verworfen
```

### Wichtige Hinweise

1. **JSONB statt Migration:** Alle neuen Felder in `pattern_config` speichern
2. **Bestehende Rotation nicht brechen:** Neue Felder sind optional
3. **Preview-Modus:** Erst generieren, dann speichern (2-Step)
4. **Validierung:** Zod-Schema in `shifts.validation.zod.ts` erweitern

---

## 18. Backend-Analyse: Was existiert, was fehlt

### WAS PASST (wiederverwenden)

| Datei | Funktion | Nutzen |
|-------|----------|--------|
| `rotation.service.ts` | `generateRotationShifts()` | Grundstruktur |
| `rotation.service.ts` | `saveGeneratedShiftInTransaction()` | DB-Speicherung |
| `rotation.controller.ts` | Endpoint-Struktur | Kopierbar |
| `shift-plans.service.ts` | `createShiftPlan()` | Shifts speichern |
| `shifts.validation.zod.ts` | `ShiftTypeSchema` | Types vorhanden |

### WAS FEHLT (neu erstellen)

| Komponente | Beschreibung |
|------------|--------------|
| Schichtblock-Algorithmus | Tagesweise statt wochenweise Rotation |
| Sonderregeln-System | weekday_free, nth_weekday_free, holidays |
| Zod-Schema | `GenerateShiftBlockRequestSchema` |
| Service | `shift-algorithm.service.ts` |

### Kern-Unterschied zur bestehenden Logik

**Bestehend (rotation.service.ts:562):**
```typescript
// WOCHENWEISE: Eine Schicht pro Woche
const weeksSinceStart = Math.floor((date - patternStart) / msPerWeek);
const shiftType = cycleWeek === 0 ? 'F' : cycleWeek === 1 ? 'S' : 'N';
```

**Neu benötigt (Schichtblock-Modus):**
```typescript
// TAGESWEISE: shiftBlockLength Schicht, dann freeDays frei
const blockLength = shiftBlockLength + freeDays;  // z.B. 10+2 = 12
const dayInBlock = daysSinceStart % blockLength;
const isShiftDay = dayInBlock < shiftBlockLength;
// Nach jedem Block: Wechsel zur nächsten Schicht in shiftSequence
const blockNumber = Math.floor(daysSinceStart / blockLength);
const shiftIndex = blockNumber % shiftSequence.length;  // 0, 1, 2 → early, late, night
```

### Anpassungen an bestehenden Dateien

**1. rotation.types.ts:**
```typescript
// Zu PatternConfig hinzufügen:
shiftBlockLength?: number;
freeDays?: number;
startShift?: 'early' | 'late' | 'night';
shiftSequence?: ('early' | 'late' | 'night')[];
specialRules?: NthWeekdayFreeRule[];
```

**2. shifts.validation.zod.ts:**
```typescript
// Neues Schema für Schichtblock-Modus
export const NthWeekdayFreeRuleSchema = z.object({
  type: z.literal('nth_weekday_free'),
  name: z.string().min(1),
  weekday: z.number().int().min(0).max(6),
  n: z.number().int().min(1).max(5),
});

export const GenerateShiftBlockRequestSchema = z.object({
  startDate: ShiftDateSchema,
  endDate: ShiftDateSchema,
  shiftBlockLength: z.number().int().min(1).max(30),
  freeDays: z.number().int().min(0).max(14),
  startShift: z.enum(['early', 'late', 'night']),
  shiftSequence: z.array(z.enum(['early', 'late', 'night'])).length(3),
  specialRules: z.array(NthWeekdayFreeRuleSchema).optional(),
  departmentId: IdSchema,
  teamId: IdSchema.optional(),
  userIds: z.array(IdSchema),
});
```

**3. rotation.controller.ts:**
```typescript
// Bestehender Handler erkennt Modus automatisch:
// Kein neuer Handler nötig - siehe Section 17 Backend-Logik
```

### Speicherort: `shifts` Tabelle (empfohlen)

```typescript
// Nutze shift-plans.service.ts:
await shiftPlansService.createShiftPlan({
  startDate, endDate,
  departmentId, teamId,
  shifts: generatedDays.filter(d => d.status === 'work').map(d => ({
    userId: d.userId,
    date: d.date,
    type: d.shift,      // 'early' | 'late' | 'night'
    startTime: shiftTimes[d.shift].start,
    endTime: shiftTimes[d.shift].end,
  })),
}, tenantId, userId);
```

### Implementierungs-Schritte

```
1. rotation.types.ts      → PatternConfig um shiftBlockLength, startShift, etc.
2. shifts.validation.zod  → GenerateShiftBlockRequestSchema
3. shift-algorithm.service.ts erstellen:
   ├── generateShiftBlockPlan()
   ├── calculateCurrentShift()
   ├── isFreeDayBySpecialRule()
   └── repeatPatternForTimeframe()
4. rotation.service.ts    → Mode-Detection (shiftBlockLength vorhanden?)
5. Frontend-Modal         → Neue Felder hinzufügen
```

---

## 19. Frontend-Analyse: Bestehender Code

> ⚠️ **HINWEIS:** Der ursprünglich geplante rhythm-wizard.ts wurde verworfen.
> **Siehe Sektion 20 für das aktuelle UI-Design.** KEIN neuer Wizard!

### Bestehende Struktur (wiederverwenden)

| Datei | Was existiert | Nutzen |
|-------|---------------|--------|
| `custom-rotation.ts` | `showPatternSelectionModal()` | Modal-Öffnung |
| `custom-rotation.ts` | `savePattern()` | API-Aufruf anpassen |
| `custom-rotation-types.ts` | `CustomRotationPattern` | Interface erweitern |
| `shifts.html` | Modal-Struktur (Zeile 531-581) | Felder hinzufügen |
| `shifts.html` | Date Range Inputs | Start/End bereits vorhanden |
| `shifts.html` | 14-Tage Grid | BLEIBT (D&D) |

### Was angepasst werden muss

**1. PATTERN_TEMPLATES vereinfachen** (`custom-rotation-types.ts`):
```typescript
// "Auto-Erkennung" ENTFERNEN - nicht mehr nötig!
export const PATTERN_TEMPLATES: PatternTemplate[] = [];  // Leer oder entfernen
```

**2. CustomRotationPattern erweitern** (`custom-rotation-types.ts`):
```typescript
export interface CustomRotationPattern {
  name: string;
  patternType: 'auto-detect';  // BLEIBT (für Kompatibilität)
  cycleLengthWeeks: number;
  employeeCount?: number;
  patternConfig: {
    // BESTEHEND:
    customPattern?: { week1: WeekData; week2: WeekData };
    rotationType?: 'forward' | 'backward';
    shiftDuration?: number;

    // NEU für Schichtblock-Modus:
    shiftBlockLength?: number;                        // Tage pro Schichtblock
    freeDays?: number;                                // Freie Tage zwischen Wechseln
    startShift?: 'early' | 'late' | 'night';          // Startschicht
    shiftSequence?: ('early' | 'late' | 'night')[];   // Dropdown-Auswahl
    specialRules?: NthWeekdayFreeRule[];              // Sonderregeln
  };
  startsAt: string;
  endsAt?: string;
  teamId?: number;
}
```

**3. Modal erweitern** (`shifts.html`):
```html
<!-- NEUE Felder im bestehenden Modal hinzufügen: -->

<!-- Schichtblock-Länge -->
<div class="form-group">
  <label>Schichtblock-Länge</label>
  <input type="number" id="shift-block-length" min="1" max="30" value="10">
  <span class="help-text">Tage in derselben Schicht</span>
</div>

<!-- Freie Tage -->
<div class="form-group">
  <label>Freie Tage zwischen Schichtwechseln</label>
  <input type="number" id="free-days" min="0" max="14" value="2">
</div>

<!-- Startschicht -->
<div class="form-group">
  <label>Startschicht am ersten Tag</label>
  <select id="start-shift">
    <option value="early">Frühschicht</option>
    <option value="late">Spätschicht</option>
    <option value="night">Nachtschicht</option>
  </select>
</div>

<!-- Schicht-Reihenfolge (Dropdown) -->
<div class="form-group">
  <label>Schicht-Reihenfolge</label>
  <select id="shift-sequence">
    <option value="early-late-night">Früh → Spät → Nacht</option>
    <option value="night-late-early">Nacht → Spät → Früh (rückwärts)</option>
  </select>
</div>

<!-- Sonderregeln -->
<div class="form-group">
  <label>Sonderregeln (optional)</label>
  <div class="special-rule-row">
    <input type="checkbox" id="nth-weekday-free">
    <span>Jeden</span>
    <select id="nth-value">
      <option value="1">1.</option>
      <option value="2">2.</option>
      <option value="3">3.</option>
      <option value="4" selected>4.</option>
      <option value="5">5.</option>
    </select>
    <select id="weekday-value">
      <option value="0" selected>Sonntag</option>
      <option value="1">Montag</option>
      <option value="6">Samstag</option>
    </select>
    <span>im Monat frei</span>
  </div>
</div>
```

**4. custom-rotation.ts anpassen:**
```typescript
// Neue Felder beim Speichern auslesen:
function collectPatternConfig(): CustomRotationPattern['patternConfig'] {
  return {
    ...existingConfig,
    shiftBlockLength: getInputValue('shift-block-length'),
    freeDays: getInputValue('free-days'),
    startShift: getSelectValue('start-shift'),
    shiftSequence: parseShiftSequence(getSelectValue('shift-sequence')),
    specialRules: collectSpecialRules(),
  };
}

function parseShiftSequence(value: string): ShiftType[] {
  if (value === 'night-late-early') return ['night', 'late', 'early'];
  return ['early', 'late', 'night'];  // Default
}

function collectSpecialRules(): NthWeekdayFreeRule[] {
  const rules: NthWeekdayFreeRule[] = [];
  if (getCheckboxValue('nth-weekday-free')) {
    rules.push({
      type: 'nth_weekday_free',
      name: `Jeder ${getSelectValue('nth-value')}. Tag`,
      weekday: Number(getSelectValue('weekday-value')),
      n: Number(getSelectValue('nth-value')),
    });
  }
  return rules;
}
```

### API bleibt gleich

```
POST /api/v2/shifts/rotation
```

Das Backend erkennt am Feld `shiftBlockLength` dass es den Schichtblock-Algorithmus
verwenden soll statt des wochenweisen Musters.

### Datei-Struktur (KEINE neuen Dateien!)

```
frontend/src/scripts/shifts/
├── custom-rotation.ts           ← ERWEITERN (keine neue Datei!)
├── custom-rotation-types.ts     ← ERWEITERN
└── [KEIN rhythm-wizard.ts!]
```

---

## 20. User Flow - EIN Ablauf, KEINE Optionen

### Begriff: "Custom Rotation" (NEUER NAME!)

**Custom Rotation** = Benutzerdefiniertes Schichtmuster für flexible Rotationen
- Früh-, Spät- und Nachtschicht
- Mindestens 3-5 Schichtgruppen rotieren
- Gesetzliche Ruhezeiten werden eingehalten

Der neue Begriff "Custom Rotation" ersetzt den alten "Kontischicht" Begriff. "Benutzerdefiniert" im Toggle bedeutet: User definiert das Rotationsmuster selbst.

### DER FLOW (einer, fertig!)

```
┌─────────────────────────────────────────────────────────────┐
│ SCHRITT 1: Team auswählen                                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ SCHRITT 2: Toggle "Benutzerdefiniert" aktivieren            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ SCHRITT 3: Modal öffnet - Konfiguration eingeben            │
│                                                             │
│   Zeitraum:              [01.01.2025] bis [31.12.2025]      │
│                                                             │
│   Startschicht:          [Früh ▼]                           │
│                                                             │
│   Schichtblock-Länge:    [10] Tage                          │
│   (Tage in derselben Schicht)                               │
│                                                             │
│   Freie Tage:            [2] Tage                           │
│   (zwischen Schichtwechseln)                                │
│                                                             │
│   Schicht-Reihenfolge:   [Früh → Spät → Nacht ▼]            │
│                                                             │
│   ─────────────────────────────────────────────────────     │
│   Sonderregeln (optional):                                  │
│   ☐ Jeden [4.] [Sonntag ▼] im Monat frei                    │
│                                                             │
│   [Abbrechen]                              [Weiter →]       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ SCHRITT 4: Grid erscheint (14 Tage zum Ausfüllen)           │
│                                                             │
│   Frühschicht:  [___][___][___][___][___][___][___]...      │
│   Spätschicht:  [___][___][___][___][___][___][___]...      │
│   Nachtschicht: [___][___][___][___][___][___][___]...      │
│                                                             │
│   → Mitarbeiter per DRAG & DROP in Cells ziehen             │
│   → Für Schichtblock-Länge (z.B. 10 Tage) ausfüllen         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ SCHRITT 5: Info-Box erscheint                               │
│                                                             │
│   ✅ "Muster vollständig! 10 Schichttage + 2 Freitag        │
│       = 12 Tage Block. Bereit für 365 Tage."                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ SCHRITT 6: "Custom Rotation Muster speichern" Button klicken│
│                                                             │
│   → Algorithmus generiert AUTOMATISCH alle Tage             │
│   → Schichtblock wird für Zeitraum wiederholt               │
│   → Schichten werden in DB gespeichert                      │
│                                                             │
│   ✅ FERTIG!                                                │
└─────────────────────────────────────────────────────────────┘
```

### Was passiert im Hintergrund?

```
User definiert MUSTER:
- Schichtblock: 10 Tage
- Freie Tage: 2 Tage
- Startschicht: Früh
- Reihenfolge: Früh → Spät → Nacht

Algorithmus GENERIERT für Zeitraum (365 Tage):
Tag 1-10:  FRÜH   (Müller, Schmidt, Weber)
Tag 11-12: FREI
Tag 13-22: SPÄT   (Müller, Schmidt, Weber)  ← Schichtwechsel!
Tag 23-24: FREI
Tag 25-34: NACHT  (Müller, Schmidt, Weber)  ← Schichtwechsel!
Tag 35-36: FREI
Tag 37-46: FRÜH   (Müller, Schmidt, Weber)  ← Zyklus wiederholt
... und so weiter für 365 Tage
```

### Info-Box Logik

Die Info-Box erscheint wenn:
```typescript
// Prüfung: Genug Daten für Pattern?
const gesamtBlockLänge = shiftBlockLength + freeDays;  // z.B. 10+2 = 12
const schichtTageAusgefüllt = countFilledShiftDays();

if (schichtTageAusgefüllt >= shiftBlockLength) {
  showInfoBox(`✅ Muster vollständig! ${shiftBlockLength} Schichttage + ${freeDays} Freitag = ${gesamtBlockLänge} Tage Block.`);
}

// Was zählt als "ausgefüllt"?
// → Tag hat mindestens 1 Mitarbeiter in IRGENDEINER Schicht (early, late, night)
function countFilledShiftDays(): number {
  let count = 0;
  for (const day of gridDays) {
    const hasAnyEmployee =
      day.early.length > 0 ||
      day.late.length > 0 ||
      day.night.length > 0;
    if (hasAnyEmployee) count++;
  }
  return count;
}
```

### 14-Tage Grid reicht?

**JA!**
- 10 Schichttage + 2 Freitag = 12 Tage → 14 Tage Grid reicht
- 7 Schichttage + 2 Freitag = 9 Tage → 14 Tage Grid reicht
- 14 Schichttage + 0 Freitag = 14 Tage → Grid reicht genau (Maximalfall)
- Maximal sinnvolle Schichtblock-Länge: 14 Tage (Zod: max 30, aber 14 Tage Grid)

### Kein Wizard, keine Optionen, keine Verwirrung

| Komponente | Bezeichnung |
|------------|-------------|
| Toggle | "Benutzerdefiniert" |
| Modal-Titel | "Custom Rotation Muster erstellen" |
| Button | "Custom Rotation Muster speichern" |
| Fachbegriff | "Custom Rotation" (Benutzerdefinierte Rotation) |

### UI-Änderungen nötig

```
1. Modal anpassen:
   - Titel: "Custom Rotation Muster erstellen"
   - NEUE Felder: Arbeitstage, Freie Tage, Erste Schicht, Zeitraum
   - NEUE Felder: Schichtwechsel Checkbox + Zyklen-Input
   - "Auto-Erkennung" Pattern-Karte ENTFERNEN (nicht mehr nötig)

2. Info-Box hinzufügen:
   - Zeigt wann genug Daten im Grid sind
   - Zeigt wie viele Tage generiert werden
   - Erscheint automatisch bei vollständigem Muster

3. Rest bleibt:
   - Toggle: "Benutzerdefiniert" ✓
   - Button: "Custom Rotation Muster speichern" ✓
   - 14-Tage Grid ✓
   - Drag & Drop ✓
```

### Mitarbeiter-Datenfluss (Grid → Algorithmus)

**Wie kommen die Mitarbeiter vom Grid zum Algorithmus?**

```typescript
// 1. User zieht Mitarbeiter ins Grid (Drag & Drop)
// 2. Grid speichert: DaySchedule aus custom-rotation-types.ts

interface DaySchedule {
  early: number[];   // User IDs für Frühschicht
  late: number[];    // User IDs für Spätschicht
  night: number[];   // User IDs für Nachtschicht
  free: number[];    // User IDs als frei markiert
}

// 3. Bei "Speichern": Grid-Daten werden in patternConfig.customPattern gespeichert
// 4. Backend liest customPattern + shiftBlockLength/freeDays aus
// 5. Algorithmus wiederholt das Muster für jeden User

// Beispiel API Request:
{
  "patternConfig": {
    "shiftBlockLength": 10,
    "freeDays": 2,
    "startShift": "early",
    "shiftSequence": ["early", "late", "night"],
    "specialRules": [
      { "type": "nth_weekday_free", "name": "4. Sonntag", "weekday": 0, "n": 4 }
    ],
    "customPattern": {
      "week1": {
        "monday": { "early": [1, 2, 3], "late": [], "night": [], "free": [] },
        "tuesday": { "early": [1, 2, 3], "late": [], "night": [], "free": [] },
        // ... etc für 7 Tage (nur Schichtblock-Länge Tage werden genutzt)
      },
      "week2": {
        // ... etc für 7 Tage
      }
    }
  },
  "startsAt": "2025-01-01",
  "endsAt": "2025-12-31",
  "teamId": 5
}
```

**Algorithmus-Verarbeitung:**
1. Lies `customPattern` → Erkenne welche User an welchen Tagen welche Schicht haben
2. Lies `shiftBlockLength`/`freeDays` → Erkenne Block-Länge (z.B. 10+2=12 Tage)
3. Für jeden User: Generiere Schichten für gesamten Zeitraum
4. Bei `shiftSequence`: Nach jedem Block wechsle zur nächsten Schicht
5. Bei `specialRules`: Prüfe ob Tag unter Sonderregel fällt → Frei setzen
6. Speichere in `shifts` Tabelle

### Sonderregeln: IM MVP ENTHALTEN!

> ✅ **Sonderregeln sind im MVP enthalten (nur nth_weekday_free).**
>
> Siehe Modal in Schritt 3: "☐ Jeden [4.] [Sonntag ▼] im Monat frei"

**MVP Sonderregel:**
- `nth_weekday_free`: Jeder N-te Wochentag im Monat frei (z.B. 4. Sonntag)

**PHASE 2 Features (später):**
- `weekday_always_free`: Bestimmter Wochentag IMMER frei (z.B. jeden Sonntag)
- `holidays`: Feiertage automatisch frei (Bundesland-abhängig)

**Warum nur nth_weekday_free in MVP?**
- Deckt den häufigsten Anwendungsfall ab (z.B. "jeder 4. Sonntag frei")
- Keine externe API-Abhängigkeit (im Gegensatz zu Feiertage)
- Einfach implementierbar

---

## 21. Multi-User Rotation (KERN-FEATURE!)

> ⚠️ **KRITISCH:** Dies ist KEIN optionales Feature, sondern KERN des Konti-Systems!
> Ohne Multi-User Rotation wäre die Produktion nicht 24/7 besetzt.

### Das Problem

Pro Schicht können MEHRERE User eingetragen sein:

```
Grid Tag 1:
  Frühschicht:  [Müller, Schmidt, Meier]      ← 3 User
  Spätschicht:  [Weber, Fischer]               ← 2 User
  Nachtschicht: [Braun, Hoffmann, Koch, Bauer] ← 4 User
```

**Frage:** Wie rotieren diese GRUPPEN nach dem Schichtwechsel?

### Die Lösung: Gruppen-Rotation

Jede "Schicht-Gruppe" rotiert GEMEINSAM zur nächsten Schicht:

```
Block 0 (Tag 1-10):
  FRÜH:  Müller, Schmidt, Meier (3)
  SPÄT:  Weber, Fischer (2)
  NACHT: Braun, Hoffmann, Koch, Bauer (4)

Block 1 (Tag 13-22) - nach Schichtwechsel:
  FRÜH:  Braun, Hoffmann, Koch, Bauer  ← waren NACHT
  SPÄT:  Müller, Schmidt, Meier        ← waren FRÜH
  NACHT: Weber, Fischer                 ← waren SPÄT

Block 2 (Tag 25-34):
  FRÜH:  Weber, Fischer                 ← waren NACHT
  SPÄT:  Braun, Hoffmann, Koch, Bauer  ← waren FRÜH
  NACHT: Müller, Schmidt, Meier        ← waren SPÄT
```

**Ergebnis: Zu JEDEM Zeitpunkt sind ALLE 3 Schichten besetzt!**

### Die Mathematik

Für jeden User:
1. **Startschicht ermitteln:** In welcher Schicht ist er im Grid eingetragen?
2. **Offset berechnen:** FRÜH=0, SPÄT=1, NACHT=2 (basierend auf shiftSequence)
3. **Pro Block rotieren:** `shiftIndex = (startOffset + blockNumber) % 3`

```typescript
// Müller startet FRÜH (offset=0), shiftSequence: [early, late, night]
Block 0: (0 + 0) % 3 = 0 → FRÜH
Block 1: (0 + 1) % 3 = 1 → SPÄT
Block 2: (0 + 2) % 3 = 2 → NACHT
Block 3: (0 + 3) % 3 = 0 → FRÜH  ← Zyklus wiederholt

// Weber startet SPÄT (offset=1)
Block 0: (1 + 0) % 3 = 1 → SPÄT
Block 1: (1 + 1) % 3 = 2 → NACHT
Block 2: (1 + 2) % 3 = 0 → FRÜH

// Braun startet NACHT (offset=2)
Block 0: (2 + 0) % 3 = 2 → NACHT
Block 1: (2 + 1) % 3 = 0 → FRÜH
Block 2: (2 + 2) % 3 = 1 → SPÄT
```

### Algorithmus: User-Startschicht ermitteln

```typescript
/**
 * Ermittelt die Startschicht eines Users aus dem Grid.
 * Regel: "Erster Eintrag gewinnt" - durchsucht alle Tage, nimmt ersten Treffer.
 */
function findUserStartShift(
  gridData: GridData,
  userId: number
): ShiftType | null {
  for (const day of gridData.days) {
    if (day.early.includes(userId)) return 'early';
    if (day.late.includes(userId)) return 'late';
    if (day.night.includes(userId)) return 'night';
  }
  // User nur in "frei" oder gar nicht eingetragen → ignorieren
  return null;
}
```

### Algorithmus: Schichten für alle User generieren

```typescript
function generateShiftsForAllUsers(
  config: ShiftPlanConfig,
  gridData: GridData,
  userIds: number[]
): GeneratedShift[] {
  const result: GeneratedShift[] = [];
  const blockLength = config.shiftBlockLength + config.freeDays;

  // 1. Für jeden User: Startschicht ermitteln
  const userStartIndices = new Map<number, number>();

  for (const userId of userIds) {
    const startShift = findUserStartShift(gridData, userId);
    if (startShift !== null) {
      const startIndex = config.shiftSequence.indexOf(startShift);
      userStartIndices.set(userId, startIndex);
    }
  }

  // 2. Für jeden Tag im Zeitraum
  let currentDate = new Date(config.startDate);
  let dayOffset = 0;

  while (currentDate <= config.endDate) {
    const dayInBlock = dayOffset % blockLength;
    const blockNumber = Math.floor(dayOffset / blockLength);
    const isWorkDay = dayInBlock < config.shiftBlockLength;

    // Sonderregeln prüfen
    const isFreeByRule = checkSpecialRules(currentDate, config.specialRules);

    if (isWorkDay && !isFreeByRule) {
      // 3. Für jeden User: aktuelle Schicht berechnen
      for (const [userId, startIndex] of userStartIndices) {
        const currentIndex = (startIndex + blockNumber) % config.shiftSequence.length;
        const currentShift = config.shiftSequence[currentIndex];

        result.push({
          userId,
          date: formatISO(currentDate),
          shiftType: currentShift,
          status: 'planned',
        });
      }
    }

    currentDate = addDays(currentDate, 1);
    dayOffset++;
  }

  return result;
}
```

### Edge Cases

#### Edge Case A: User an verschiedenen Tagen in verschiedenen Schichten

```
Grid:
  Tag 1: Müller → FRÜH
  Tag 2: Müller → SPÄT  ← Widerspruch!
```

**Regel:** "Erster Eintrag gewinnt" - Müller startet FRÜH.

#### Edge Case B: User nur in "Frei" eingetragen

```
Grid:
  Tag 1-14: Schulz → nur in "FREI" Spalte
```

**Regel:** User wird IGNORIERT - keine Schichten generiert.

#### Edge Case C: User erst ab Tag 5 eingetragen

```
Grid:
  Tag 1-4: Neumann → nicht eingetragen
  Tag 5:   Neumann → SPÄT
```

**Regel:** Erster Eintrag zählt - Neumann startet SPÄT.

### Visualisierung: 9 User, 4/2 Rhythmus

```
Eingabe:
  shiftBlockLength: 4
  freeDays: 2
  shiftSequence: [early, late, night]

Grid Tag 1:
  FRÜH:  [User 1, 2, 3]
  SPÄT:  [User 4, 5, 6]
  NACHT: [User 7, 8, 9]
```

**Generierter Plan für 18 Tage:**

```
         │ User 1,2,3 │ User 4,5,6 │ User 7,8,9 │
─────────┼────────────┼────────────┼────────────┤
Tag 1-4  │    FRÜH    │    SPÄT    │   NACHT    │ Block 0
Tag 5-6  │    frei    │    frei    │    frei    │
─────────┼────────────┼────────────┼────────────┤
Tag 7-10 │    SPÄT    │   NACHT    │    FRÜH    │ Block 1
Tag 11-12│    frei    │    frei    │    frei    │
─────────┼────────────┼────────────┼────────────┤
Tag 13-16│   NACHT    │    FRÜH    │    SPÄT    │ Block 2
Tag 17-18│    frei    │    frei    │    frei    │
─────────┼────────────┼────────────┼────────────┤
Tag 19-22│    FRÜH    │    SPÄT    │   NACHT    │ Block 3 (=0)
```

**✅ Jeder Tag hat ALLE 3 Schichten besetzt!**

### Performance: Batch-INSERT

Bei großen Teams (z.B. 50 User × 365 Tage = 18.250 Schichten):

```typescript
// NICHT: 18.250 einzelne INSERTs
// SONDERN: Batch-INSERT mit COPY oder multi-row INSERT

const BATCH_SIZE = 1000;
const batches = chunkArray(generatedShifts, BATCH_SIZE);

for (const batch of batches) {
  await pool.query(`
    INSERT INTO shifts (user_id, date, type, status, tenant_id)
    SELECT * FROM UNNEST($1::int[], $2::date[], $3::shift_type[], $4::shift_status[], $5::int[])
  `, [
    batch.map(s => s.userId),
    batch.map(s => s.date),
    batch.map(s => s.shiftType),
    batch.map(s => s.status),
    batch.map(() => tenantId),
  ]);
}
```

### Zusammenfassung Multi-User Rotation

| Aspekt | Regel |
|--------|-------|
| Startschicht | Erster Eintrag im Grid gewinnt |
| Rotation | `(startIndex + blockNumber) % 3` |
| User nur in "Frei" | Wird ignoriert |
| Widersprüchliche Einträge | Erster Tag gewinnt |
| Performance | Batch-INSERT mit UNNEST |

---

## 22. Implementierungs-Referenz: Existierende Dateien & Anknüpfungspunkte

> ⚠️ **KRITISCH:** Diese Section zeigt EXAKT welche Dateien existieren und wo der neue Code eingefügt werden muss!

### 22.1 Frontend-Dateien (EXISTIEREN BEREITS)

#### Modal: `frontend/src/pages/shifts.html`

```
Pfad: frontend/src/pages/shifts.html
Modal-ID: #custom-rotation-modal
Modal-Titel: "Schichtmuster konfigurieren" (bereits umbenannt!)
Zeilen: 530-582
```

**Was existiert:**
- ✅ Modal-Container mit Design System Klassen
- ✅ Zeitraum-Picker (Start/End Date Inputs)
- ✅ Pattern-Cards Container (`#custom-rotation-pattern-list`)
- ✅ Close-Button mit `data-action="close-custom-rotation-modal"`

**Was hinzugefügt werden muss (nach Zeitraum-Picker, vor Pattern-Cards):**
```html
<!-- NEUE FELDER nach Zeile 571: -->

<!-- Schichtblock-Konfiguration -->
<div class="glass-card p-4 mb-4 border border-emerald-500/30 bg-emerald-500/5">
  <h4 class="text-emerald-400 font-medium mb-3">
    <i class="fas fa-cogs mr-2"></i>
    Schichtblock-Konfiguration
  </h4>

  <div class="grid grid-cols-2 gap-4 mb-4">
    <!-- Schichtblock-Länge -->
    <div class="form-field">
      <label class="form-field__label" for="shift-block-length">
        Schichtblock-Länge (Tage)
      </label>
      <input type="number" id="shift-block-length"
             min="1" max="14" value="10"
             class="form-field__control" required />
      <span class="form-field__hint">Tage in derselben Schicht</span>
    </div>

    <!-- Freie Tage -->
    <div class="form-field">
      <label class="form-field__label" for="free-days-count">
        Freie Tage zwischen Wechseln
      </label>
      <input type="number" id="free-days-count"
             min="0" max="14" value="2"
             class="form-field__control" required />
    </div>
  </div>

  <div class="grid grid-cols-2 gap-4">
    <!-- Startschicht -->
    <div class="form-field">
      <label class="form-field__label" for="start-shift-select">
        Startschicht am ersten Tag
      </label>
      <select id="start-shift-select" class="form-field__control">
        <option value="early">Frühschicht</option>
        <option value="late">Spätschicht</option>
        <option value="night">Nachtschicht</option>
      </select>
    </div>

    <!-- Schicht-Reihenfolge -->
    <div class="form-field">
      <label class="form-field__label" for="shift-sequence-select">
        Rotations-Reihenfolge
      </label>
      <select id="shift-sequence-select" class="form-field__control">
        <option value="early-late-night">Früh → Spät → Nacht</option>
        <option value="night-late-early">Nacht → Spät → Früh (rückwärts)</option>
      </select>
    </div>
  </div>
</div>

<!-- Sonderregeln -->
<div class="glass-card p-4 mb-4 border border-amber-500/30 bg-amber-500/5">
  <h4 class="text-amber-400 font-medium mb-3">
    <i class="fas fa-star mr-2"></i>
    Sonderregeln (optional)
  </h4>

  <div class="flex items-center gap-3">
    <input type="checkbox" id="nth-weekday-free-checkbox"
           class="toggle-switch__input" />
    <span>Jeden</span>
    <select id="nth-value-select" class="form-field__control w-16">
      <option value="1">1.</option>
      <option value="2">2.</option>
      <option value="3">3.</option>
      <option value="4" selected>4.</option>
      <option value="5">5.</option>
    </select>
    <select id="weekday-value-select" class="form-field__control w-32">
      <option value="0" selected>Sonntag</option>
      <option value="1">Montag</option>
      <option value="6">Samstag</option>
    </select>
    <span>im Monat frei</span>
  </div>
</div>
```

---

#### Manager-Klasse: `frontend/src/scripts/shifts/custom-rotation.ts`

```
Pfad: frontend/src/scripts/shifts/custom-rotation.ts
Klasse: CustomRotationManager
Export: customRotationManager (Singleton)
Zeilen: 1336
```

**Was existiert:**
- ✅ `showPatternSelectionModal()` - Zeile 129
- ✅ `selectPattern()` - Zeile 313
- ✅ `createCustomRotationPattern()` - Zeile 1114
- ✅ `savePattern()` - Zeile 1181
- ✅ `handleSave()` - Zeile 1074
- ✅ 14-Tage Grid Erweiterung
- ✅ Week 1/Week 2 Daten-Extraktion

**Was hinzugefügt werden muss:**

```typescript
// In selectPattern() nach Zeile 336 erweitern:
private selectPattern(patternId: string): void {
  // ... existierender Code ...

  // NEU: Schichtblock-Felder auslesen
  const shiftBlockLength = this.getNumberInputValue('shift-block-length') ?? 10;
  const freeDays = this.getNumberInputValue('free-days-count') ?? 2;
  const startShift = this.getSelectValue('start-shift-select') ?? 'early';
  const shiftSequence = this.parseShiftSequence(
    this.getSelectValue('shift-sequence-select') ?? 'early-late-night'
  );
  const specialRules = this.collectSpecialRules();

  this.selectedPattern = {
    // ... existierende Felder ...
    patternConfig: {
      // NEU:
      shiftBlockLength,
      freeDays,
      startShift,
      shiftSequence,
      specialRules,
      // Existierend:
      customPattern: { week1: this.week1Data, week2: this.week2Data },
    },
  };
}

// NEUE Hilfsfunktionen hinzufügen:
private getNumberInputValue(id: string): number | null {
  const input = $$id(id);
  if (input instanceof HTMLInputElement) {
    const value = Number.parseInt(input.value, 10);
    return Number.isNaN(value) ? null : value;
  }
  return null;
}

private getSelectValue(id: string): string | null {
  const select = $$id(id);
  if (select instanceof HTMLSelectElement) {
    return select.value;
  }
  return null;
}

private parseShiftSequence(value: string): ('early' | 'late' | 'night')[] {
  if (value === 'night-late-early') {
    return ['night', 'late', 'early'];
  }
  return ['early', 'late', 'night'];
}

private collectSpecialRules(): NthWeekdayFreeRule[] {
  const rules: NthWeekdayFreeRule[] = [];
  const checkbox = $$id('nth-weekday-free-checkbox');

  if (checkbox instanceof HTMLInputElement && checkbox.checked) {
    const nthValue = this.getNumberInputValue('nth-value-select') ?? 4;
    const weekdayValue = this.getNumberInputValue('weekday-value-select') ?? 0;

    rules.push({
      type: 'nth_weekday_free',
      name: `Jeder ${nthValue}. Wochentag`,
      weekday: weekdayValue,
      n: nthValue,
    });
  }

  return rules;
}
```

---

#### Types: `frontend/src/scripts/shifts/custom-rotation-types.ts`

```
Pfad: frontend/src/scripts/shifts/custom-rotation-types.ts
Zeilen: 68
```

**Was existiert:**
- ✅ `DaySchedule` Interface
- ✅ `WeekData` Interface
- ✅ `CustomRotationPattern` Interface
- ✅ `PATTERN_TEMPLATES` Array

**Was erweitert werden muss:**

```typescript
// NEUE Types hinzufügen:
export type ShiftType = 'early' | 'late' | 'night';

export interface NthWeekdayFreeRule {
  type: 'nth_weekday_free';
  name: string;
  weekday: number;  // 0-6 (0 = Sonntag)
  n: number;        // 1-5
}

// CustomRotationPattern.patternConfig erweitern:
export interface CustomRotationPattern {
  // ... existierende Felder ...
  patternConfig: {
    // Existierend:
    customPattern?: { week1: WeekData; week2: WeekData };
    rotationType?: 'forward' | 'backward';
    shiftDuration?: number;

    // NEU für Schichtblock-Algorithmus:
    shiftBlockLength?: number;
    freeDays?: number;
    startShift?: ShiftType;
    shiftSequence?: ShiftType[];
    specialRules?: NthWeekdayFreeRule[];
  };
}
```

---

### 22.2 Backend-Dateien (EXISTIEREN BEREITS)

#### Service Stub: `backend/src/routes/v2/shifts/custom-rotation.service.ts`

```
Pfad: backend/src/routes/v2/shifts/custom-rotation.service.ts
Klasse: CustomRotationService
Export: customRotationService (Singleton)
Zeilen: 227
Status: STUB - TODO Kommentar bei generateYearPatternFromTwoWeeks()
```

**Was existiert:**
- ✅ `isCustomRotationPlan()` - Zeile 22
- ✅ `calculateEndOfFirstWeekNextYear()` - Zeile 35
- ✅ `calculateCustomRotationDateRange()` - Zeile 56
- ✅ `prepareShiftsForCreation()` - Zeile 89
- ✅ `detectPatternType()` - Zeile 174
- 🔴 `generateYearPatternFromTwoWeeks()` - Zeile 219 **← HIER ALGORITHMUS EINFÜGEN!**

**Was implementiert werden muss (Zeile 219):**

```typescript
// ERSETZE den Stub:
private generateYearPatternFromTwoWeeks(
  _twoWeekShifts: ShiftEntry[],
  _year: number,
): ShiftEntry[] {
  // Placeholder - new implementation coming
  return [];
}

// MIT der neuen Implementierung:
private generateYearPatternFromTwoWeeks(
  twoWeekShifts: ShiftEntry[],
  year: number,
  config?: ShiftBlockConfig,
): ShiftEntry[] {
  // Wenn Schichtblock-Modus (config vorhanden):
  if (config !== undefined) {
    return this.generateShiftBlockPattern(twoWeekShifts, year, config);
  }

  // Sonst: 2-Wochen-Wiederholung (bestehende Logik)
  return this.repeat2WeekPattern(twoWeekShifts, year);
}

// NEUE Methode für Schichtblock-Algorithmus:
private generateShiftBlockPattern(
  templateShifts: ShiftEntry[],
  year: number,
  config: ShiftBlockConfig,
): ShiftEntry[] {
  // Implementierung aus Section 21 (Multi-User Rotation)
  // ...
}
```

---

#### Types: `backend/src/routes/v2/shifts/rotation.types.ts`

```
Pfad: backend/src/routes/v2/shifts/rotation.types.ts
```

**Was erweitert werden muss:**

```typescript
// PatternConfig Interface erweitern:
export interface PatternConfig {
  // Existierend:
  weekType?: 'F' | 'S';
  shiftType?: 'N';
  pattern?: { week: number; shift: 'F' | 'S' | 'N' }[];
  customPattern?: { week1: WeekSchedule; week2: WeekSchedule };

  // NEU für Schichtblock-Modus:
  shiftBlockLength?: number;
  freeDays?: number;
  startShift?: 'early' | 'late' | 'night';
  shiftSequence?: ('early' | 'late' | 'night')[];
  specialRules?: NthWeekdayFreeRule[];
}

// NEUER Interface:
export interface NthWeekdayFreeRule {
  type: 'nth_weekday_free';
  name: string;
  weekday: number;
  n: number;
}

// NEUER Interface:
export interface ShiftBlockConfig {
  shiftBlockLength: number;
  freeDays: number;
  startShift: 'early' | 'late' | 'night';
  shiftSequence: ('early' | 'late' | 'night')[];
  specialRules?: NthWeekdayFreeRule[];
}
```

---

#### Validation: `backend/src/routes/v2/shifts/shifts.validation.zod.ts`

```
Pfad: backend/src/routes/v2/shifts/shifts.validation.zod.ts
```

**Was hinzugefügt werden muss:**

```typescript
// NEUE Schemas:
export const NthWeekdayFreeRuleSchema = z.object({
  type: z.literal('nth_weekday_free'),
  name: z.string().min(1).max(100),
  weekday: z.number().int().min(0).max(6),
  n: z.number().int().min(1).max(5),
});

export const ShiftBlockConfigSchema = z.object({
  shiftBlockLength: z.number().int().min(1).max(14),
  freeDays: z.number().int().min(0).max(14),
  startShift: z.enum(['early', 'late', 'night']),
  shiftSequence: z.array(z.enum(['early', 'late', 'night'])).length(3),
  specialRules: z.array(NthWeekdayFreeRuleSchema).optional(),
});
```

---

### 22.3 Implementierungs-Checkliste

```
✅ 1. Frontend: shifts.html
     └── Neue Felder nach Zeitraum-Picker einfügen (Zeile ~571)

✅ 2. Frontend: custom-rotation-types.ts
     └── ShiftType, NthWeekdayFreeRule Types hinzufügen
     └── CustomRotationPattern.patternConfig erweitern

✅ 3. Frontend: custom-rotation.ts
     └── selectPattern() erweitern
     └── Neue Hilfsfunktionen hinzufügen

✅ 4. Backend: rotation.types.ts
     └── PatternConfig erweitern
     └── ShiftBlockConfig Interface hinzufügen

✅ 5. Backend: shifts.validation.zod.ts
     └── NthWeekdayFreeRuleSchema
     └── ShiftBlockConfigSchema

✅ 6. Backend: custom-rotation.service.ts
     └── generateYearPatternFromTwoWeeks() implementieren
     └── analyzeTemplate(), findDateBoundaries(), groupShiftsByDayIndex() Helper

□ 7. Integration Test
     └── Toggle → Modal → Config → Grid → Save → DB Check
```

---

### 22.4 DOM Element IDs (Referenz)

| ID | Typ | Beschreibung |
|----|-----|--------------|
| `custom-rotation-modal` | div | Modal Container |
| `custom-rotation-start-date` | input[date] | Startdatum (EXISTIERT) |
| `custom-rotation-end-date` | input[date] | Enddatum (EXISTIERT) |
| `custom-rotation-pattern-list` | div | Pattern Cards Container (EXISTIERT) |
| `shift-block-length` | input[number] | Schichtblock-Länge (NEU) |
| `free-days-count` | input[number] | Freie Tage (NEU) |
| `start-shift-select` | select | Startschicht (NEU) |
| `shift-sequence-select` | select | Rotations-Reihenfolge (NEU) |
| `nth-weekday-free-checkbox` | input[checkbox] | Sonderregel aktivieren (NEU) |
| `nth-value-select` | select | N-ter Wochentag (NEU) |
| `weekday-value-select` | select | Welcher Wochentag (NEU) |

---

### 22.5 API Endpoint (EXISTIERT - nur Body erweitern)

```
POST /api/v2/shifts/rotation
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body (erweitert):**
```json
{
  "name": "Schichtmuster KW 50",
  "patternType": "auto-detect",
  "cycleLengthWeeks": 2,
  "patternConfig": {
    "shiftBlockLength": 10,
    "freeDays": 2,
    "startShift": "early",
    "shiftSequence": ["early", "late", "night"],
    "specialRules": [
      {
        "type": "nth_weekday_free",
        "name": "4. Sonntag",
        "weekday": 0,
        "n": 4
      }
    ],
    "customPattern": {
      "week1": { "monday": { "early": [1,2,3], "late": [4,5], "night": [6,7], "free": [] }, ... },
      "week2": { ... }
    }
  },
  "startsAt": "2025-01-01",
  "endsAt": "2025-12-31",
  "teamId": 5
}
```

**Backend erkennt Modus automatisch:**
```typescript
// In rotation.service.ts oder custom-rotation.service.ts:
if (patternConfig.shiftBlockLength !== undefined) {
  // → Schichtblock-Algorithmus (NEU)
} else {
  // → 2-Wochen-Wiederholung (EXISTIERT)
}
```

---

## 25. IMPLEMENTIERUNGS-SPEZIFIKATION: `generateYearPatternFromTwoWeeks`

> **STATUS:** 🔴 NICHT IMPLEMENTIERT - Aktuell `return []`
> **PRIORITÄT:** KRITISCH - Ohne diese Methode funktioniert Custom Rotation NICHT

### 25.1 Zweck

Diese Methode ist das **Herzstück** des Custom Rotation Systems. Sie nimmt ein 2-Wochen-Template und wiederholt es für einen gesamten Zeitraum (typisch: 1 Jahr).

### 25.2 Signatur

```typescript
private generateYearPatternFromTwoWeeks(
  twoWeekShifts: ShiftEntry[],
  year: number,
): ShiftEntry[]
```

### 25.3 Input

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `twoWeekShifts` | `ShiftEntry[]` | Array von Schichten aus dem 14-Tage Grid |
| `year` | `number` | Zieljahr (z.B. 2025) |

**ShiftEntry Interface:**
```typescript
interface ShiftEntry {
  userId: number;      // Mitarbeiter-ID
  date: string;        // ISO-Datum "2025-01-06"
  startTime: string;   // "06:00"
  endTime: string;     // "14:00"
  type: string;        // "early" | "late" | "night"
}
```

### 25.4 Output

Array von `ShiftEntry[]` für den gesamten Zeitraum (ca. 365 Tage × Anzahl Schichten pro Tag).

### 25.5 Algorithmus (Pseudo-Code)

```
FUNKTION generateYearPatternFromTwoWeeks(twoWeekShifts, year):

  1. VALIDIERUNG
     - Wenn twoWeekShifts leer → return []
     - Wenn weniger als 1 Tag Daten → return []

  2. TEMPLATE ANALYSIEREN
     - Finde frühestes Datum im Template (templateStartDate)
     - Finde spätestes Datum im Template (templateEndDate)
     - Berechne templateLengthDays = Differenz in Tagen
     - Wenn templateLengthDays < 7 → Warnung, aber weitermachen

  3. ZIELBEREICHE DEFINIEREN
     - targetStartDate = Startdatum aus selectedPattern.startsAt
     - targetEndDate = Enddatum aus selectedPattern.endsAt
     - Wenn nicht gesetzt: targetEndDate = Ende KW1 nächstes Jahr

  4. SCHICHTEN NACH TAG GRUPPIEREN
     - shiftsByDayIndex = Map<number, ShiftEntry[]>
     - Für jede Schicht im Template:
         dayIndex = (shiftDate - templateStartDate) in Tagen
         shiftsByDayIndex[dayIndex].push(shift)

  5. PATTERN WIEDERHOLEN
     - result = []
     - currentDate = targetStartDate
     - WHILE currentDate <= targetEndDate:
         daysSinceStart = (currentDate - targetStartDate) in Tagen
         templateDayIndex = daysSinceStart % templateLengthDays

         IF shiftsByDayIndex[templateDayIndex] existiert:
             FOR EACH templateShift in shiftsByDayIndex[templateDayIndex]:
                 newShift = {
                     userId: templateShift.userId,
                     date: currentDate (ISO format),
                     startTime: templateShift.startTime,
                     endTime: templateShift.endTime,
                     type: templateShift.type
                 }
                 result.push(newShift)

         currentDate = currentDate + 1 Tag

  6. RETURN result
```

### 25.6 Beispiel

**Input (2-Wochen Template):**
```
Woche 1 (06.01.2025 - 12.01.2025):
  Mo: User 1 Früh, User 2 Spät, User 3 Nacht
  Di: User 1 Früh, User 2 Spät, User 3 Nacht
  Mi: User 1 Früh, User 2 Spät, User 3 Nacht
  Do: User 1 Früh, User 2 Spät, User 3 Nacht
  Fr: User 1 Früh, User 2 Spät, User 3 Nacht
  Sa: FREI
  So: FREI

Woche 2 (13.01.2025 - 19.01.2025):
  Mo: User 2 Früh, User 3 Spät, User 1 Nacht  ← Rotation!
  Di: User 2 Früh, User 3 Spät, User 1 Nacht
  ...
```

**Output (generiert für 1 Jahr):**
```
KW 3 (20.01-26.01): Wiederholt Woche 1 Muster
KW 4 (27.01-02.02): Wiederholt Woche 2 Muster
KW 5 (03.02-09.02): Wiederholt Woche 1 Muster
...
KW 52: Wiederholt entsprechendes Muster
```

### 25.7 Edge Cases

| Edge Case | Erwartetes Verhalten |
|-----------|---------------------|
| Leeres Template | `return []` |
| Template < 7 Tage | Trotzdem wiederholen (Warnung loggen) |
| Template = 7 Tage | Normale Wochenwiederholung |
| Template = 14 Tage | Standard 2-Wochen-Rotation |
| Template > 14 Tage | 3-4 Wochen Rotation unterstützen |
| Tage ohne Schichten im Template | Diese Tage bleiben auch im Output leer |
| userId nicht in Team | Übernehmen (Validierung erfolgt vorher) |
| Schaltjahr | 366 Tage generieren |

### 25.8 Abhängigkeiten

Diese Methode wird aufgerufen von:
```
prepareShiftsForCreation()
  └── generateCustomRotationPeriod()
        └── generateCustomRotationYear()
              └── generateYearPatternFromTwoWeeks()  ← HIER
```

### 25.9 Test-Szenarien

```typescript
describe('generateYearPatternFromTwoWeeks', () => {

  it('should return empty array for empty input', () => {
    const result = service.generateYearPatternFromTwoWeeks([], 2025);
    expect(result).toEqual([]);
  });

  it('should repeat 14-day pattern correctly', () => {
    const template = createMockTwoWeekTemplate(); // 14 Tage, 3 User
    const result = service.generateYearPatternFromTwoWeeks(template, 2025);

    // 365 Tage * 3 Schichten pro Tag = ~1095 Einträge
    expect(result.length).toBeGreaterThan(1000);

    // Tag 15 sollte wie Tag 1 sein (gleiche User, gleiche Schichten)
    const day1Shifts = result.filter(s => s.date === '2025-01-06');
    const day15Shifts = result.filter(s => s.date === '2025-01-20');
    expect(day15Shifts.map(s => s.userId)).toEqual(day1Shifts.map(s => s.userId));
  });

  it('should handle leap year correctly', () => {
    const template = createMockTwoWeekTemplate();
    const result = service.generateYearPatternFromTwoWeeks(template, 2024);

    // 2024 ist Schaltjahr
    const feb29Shifts = result.filter(s => s.date === '2024-02-29');
    expect(feb29Shifts.length).toBeGreaterThan(0);
  });

  it('should preserve shift types and times', () => {
    const template = [
      { userId: 1, date: '2025-01-06', type: 'early', startTime: '06:00', endTime: '14:00' }
    ];
    const result = service.generateYearPatternFromTwoWeeks(template, 2025);

    result.forEach(shift => {
      expect(shift.type).toBe('early');
      expect(shift.startTime).toBe('06:00');
      expect(shift.endTime).toBe('14:00');
    });
  });
});
```

### 25.10 Performance-Überlegungen

| Metrik | Erwartung |
|--------|-----------|
| Zeitkomplexität | O(n × d) wobei n = Template-Schichten, d = Ziel-Tage |
| Speicher | ~1000-2000 ShiftEntry Objekte pro Jahr |
| Max. Laufzeit | < 100ms für 1 Jahr |

### 25.11 Implementierungs-Checkliste

- [x] Methode `generateYearPatternFromTwoWeeks` implementieren
- [ ] Unit-Tests schreiben (alle Szenarien aus 25.9)
- [ ] Edge Cases testen
- [ ] Performance-Test (< 100ms)
- [x] Integration mit `prepareShiftsForCreation` verifizieren
- [ ] E2E-Test: Grid ausfüllen → Speichern → DB prüfen
