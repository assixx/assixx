# Shifts in Calendar Feature - Implementation Plan

## 🎯 Ziel

Integration der Schichtanzeige (F/S/N) in den Firmenkalender für den eingeloggten User.

## 📋 Anforderungen

### UI/UX

1. **Checkbox "Schicht anzeigen"**
   - Position: Links neben "Legende" in der Filterleiste
   - Standard: Deaktiviert
   - Persistent: LocalStorage speichert Zustand

2. **Schicht-Indikator im Kalender**
   - Position: Kleines Quadrat unter/neben der Tageszahl
   - Inhalt: F, S oder N (je nach Schicht)
   - Styling:
     - Hintergrund: Weiß
     - F (Frühschicht): Blauer Text
     - S (Spätschicht): Oranger Text
     - N (Nachtschicht): Schwarzer Text

### Datenquellen

- Primär: `shifts` Tabelle
  - Spalten: `type`, `date`, `user_id`, `tenant_id`
- Sekundär: `shift_rotation_history` Tabelle
  - Spalten: `shift_type`, `shift_date`, `user_id`, `tenant_id`

## 🏗️ Architektur

### Frontend

```
frontend/src/scripts/shifts-in-calendar.ts
├── ShiftCalendarIntegration class
│   ├── init() - Initialisierung
│   ├── addCheckbox() - Checkbox hinzufügen
│   ├── fetchUserShifts() - API-Call für Schichten
│   ├── renderShiftIndicators() - Anzeige in Kalender
│   └── handleCheckboxToggle() - Toggle-Event
└── CSS für Shift-Indikatoren
```

### API Endpoint

```
GET /api/v2/shifts/my-calendar-shifts
Query params:
- startDate: YYYY-MM-DD
- endDate: YYYY-MM-DD
Response: Array of { date, type }
```

## 📝 Implementation Steps

### Phase 1: Setup

1. ✅ Create shifts-in-calendar.md (this file)
2. Create shifts-in-calendar.ts module
3. Import module in calendar.ts

### Phase 2: UI Components

1. Add checkbox HTML in calendar.html
2. Add CSS for shift indicators
3. LocalStorage integration

### Phase 3: Data Integration

1. Create API endpoint for user shifts
2. Fetch shifts when calendar loads
3. Fetch shifts when month changes

### Phase 4: Display Logic

1. Hook into FullCalendar render events
2. Add shift indicators to day cells
3. Update on calendar navigation

### Phase 5: Testing

1. Test with different users
2. Test month navigation
3. Test localStorage persistence

## 🔧 Technical Details

### FullCalendar Integration

```javascript
// Hook into dayRender callback
calendar.on('datesSet', function (info) {
  if (showShifts) {
    renderShiftIndicators(info.start, info.end);
  }
});
```

### Shift Indicator HTML

```html
<div class="shift-indicator shift-F">F</div>
```

### CSS Classes

```css
.shift-indicator {
  display: flex;
  position: absolute;
  right: 2px;
  bottom: 2px;
  justify-content: center;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  background: #fff;
  width: 20px;
  height: 20px;
  font-weight: bold;
  font-size: 12px;
}

.shift-indicator.shift-F {
  color: #3498db;
} /* Blau */
.shift-indicator.shift-S {
  color: #ff9800;
} /* Orange */
.shift-indicator.shift-N {
  color: #000000;
} /* Schwarz */
```

## 🚀 API Response Format

```json
{
  "success": true,
  "data": [
    { "date": "2025-08-28", "type": "F" },
    { "date": "2025-08-29", "type": "S" },
    { "date": "2025-08-30", "type": "N" }
  ]
}
```

## ⚠️ KRITISCHE PUNKTE

1. **USER IDENTITÄT**:
   - NUR Schichten des EINGELOGGTEN Users anzeigen!
   - user_id aus Session/Token nehmen (auth.getUserId())
   - NIEMALS andere User-Schichten zeigen!

2. **Performance**: Cache Shifts für aktuellen Monat
3. **Security**: Tenant-Isolation beachten (tenant_id)
4. **Fallback**: Wenn keine Shifts → keine Indikatoren
5. **Responsiveness**: Mobile-optimierte Darstellung
6. **Accessibility**: ARIA-Labels für Screenreader

## 🔄 Event Flow

1. User aktiviert "Schicht anzeigen" Checkbox
2. System fetcht Shifts für aktuellen Monat
3. System rendert Shift-Indikatoren in Kalendertage
4. Bei Monatswechsel: Neue Shifts fetchen
5. LocalStorage speichert Checkbox-Status

## 📊 Datenbank-Queries

### Für shifts Tabelle

```sql
SELECT date, type
FROM shifts
WHERE user_id = ?
  AND tenant_id = ?
  AND date BETWEEN ? AND ?
  AND type IN ('F', 'S', 'N')
ORDER BY date;
```

### Für shift_rotation_history

```sql
SELECT shift_date as date, shift_type as type
FROM shift_rotation_history
WHERE user_id = ?
  AND tenant_id = ?
  AND shift_date BETWEEN ? AND ?
ORDER BY shift_date;
```

## 🎨 UI Mockup

```
[ ] Schicht anzeigen    Legende
                        🟦 Firma
                        🟩 Team

Kalender:
┌─────────┬─────────┐
│ Mo      │ Di      │
│ 28 [F]  │ 29 [S]  │
│         │         │
└─────────┴─────────┘
```

## ✅ Acceptance Criteria

1. Checkbox erscheint links neben Legende
2. Aktivierung zeigt Schichten im Kalender
3. F/S/N werden korrekt farbcodiert
4. Nur eigene Shifts werden angezeigt
5. LocalStorage merkt sich Einstellung
6. Performance bleibt gut bei Monatswechsel

## 🔗 Abhängigkeiten

- FullCalendar v5
- calendar.ts (existing)
- auth.ts (getUserId)
- api-client.ts (API calls)

## 📅 Geschätzter Aufwand

- Setup: 30min
- UI Implementation: 1h
- API Integration: 1h
- Testing & Bugfixing: 30min
- **Total: ~3 Stunden**
