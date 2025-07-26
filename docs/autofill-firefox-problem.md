# Autofill Firefox Problem

## Problem

In signup.html änderten sich bei Firefox Autofill die Eingabefelder optisch:

- Hintergrund wurde heller (0.06 statt 0.04)
- Border wurde blau statt grau
- Design-Inkonsistenz zwischen normalem und autofill Zustand

## Ursache

Fehlende CSS-Transition und falsche Farben in den Autofill-Pseudo-Klassen.

## Lösung

1. **Transition hinzugefügt**: `transition: background-color 5000s ease-in-out 0s;`
2. **Farben angepasst**:
   - Background: `rgba(255, 255, 255, 0.04)` (statt 0.06)
   - Border: `rgba(255, 255, 255, 0.12)` (statt blau)

## Betroffene Dateien

- `/frontend/src/pages/signup.html` (Zeilen 592-609)
- `/frontend/src/pages/login.html` (als Referenz, war korrekt)

## Status

✅ Behoben am 24.07.2025
