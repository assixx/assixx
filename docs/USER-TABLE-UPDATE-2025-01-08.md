# Users Table Update - 08.01.2025

## 🆕 Neue Spalten

Die `users` Tabelle wurde um folgende Spalten erweitert:

### 1. **landline** (Festnetznummer)

- **Typ**: `VARCHAR(30)`
- **Nullable**: JA
- **Unique**: NEIN
- **Kommentar**: "Festnetznummer (optional)"
- **Position**: Nach `phone` Spalte

### 2. **employee_number** (Personalnummer)

- **Typ**: `VARCHAR(50)`
- **Nullable**: NEIN
- **Unique**: JA
- **Kommentar**: "Personalnummer (unique, required)"
- **Position**: Nach `employee_id` Spalte
- **Hinweis**: Für bestehende User wurde automatisch eine temporäre Nummer generiert (Format: `EMP-000001`)

## 📝 Wichtige Hinweise

### Phone-Spalte (Handynummer)

- Bleibt weiterhin `VARCHAR(30)` und UNIQUE
- Für Admin und Employee Rollen sollte diese Spalte in der Anwendungslogik als PFLICHTFELD behandelt werden
- Root-User können optional eine Telefonnummer haben

### Employee Number

- Muss für ALLE User vorhanden sein (NOT NULL)
- Ist eindeutig über alle Tenants hinweg (UNIQUE)
- Format kann später angepasst werden (z.B. firmenspezifische Präfixe)

## 🔧 Migration Details

```sql
-- Spalten hinzugefügt
ALTER TABLE users ADD COLUMN landline VARCHAR(30) NULL DEFAULT NULL AFTER phone;
ALTER TABLE users ADD COLUMN employee_number VARCHAR(50) NULL DEFAULT NULL AFTER employee_id;

-- Unique Index für employee_number
ALTER TABLE users ADD UNIQUE INDEX idx_employee_number (employee_number);

-- Temporäre Personalnummern generiert
UPDATE users SET employee_number = CONCAT('EMP-', LPAD(id, 6, '0')) WHERE employee_number IS NULL;

-- employee_number auf NOT NULL gesetzt
ALTER TABLE users MODIFY COLUMN employee_number VARCHAR(50) NOT NULL;
```

## 🛠️ Backend Anpassungen

### TypeScript Types aktualisiert:

- `User` Interface in `models.d.ts`
- `DatabaseUser` Interface in `models.d.ts`
- `DbUser` Interface in `user.ts`
- `UserCreateData` Interface in `user.ts`

### SELECT Statements erweitert:

Alle SELECT Queries wurden um die neuen Felder erweitert:

- `u.landline`
- `u.employee_number`

## 📋 Nächste Schritte

1. Frontend Forms anpassen für:
   - User-Erstellung (Admin/Employee)
   - User-Bearbeitung
   - Profil-Ansichten

2. Validierung implementieren:
   - Phone ist Pflicht für Admin/Employee
   - Employee Number Format-Validierung
   - Unique-Check für Employee Number bei User-Erstellung
