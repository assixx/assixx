# 🗄️ Assixx Database Structure

## 📁 Verzeichnisstruktur

```
database/
├── schema/                      # Modulare Schema-Dateien
│   ├── 00-core/                # Kern-Tabellen (Reihenfolge wichtig!)
│   │   ├── 01-database.sql     # Datenbank erstellen
│   │   ├── 02-tenants.sql      # Tenant-System
│   │   ├── 03-users.sql        # Benutzer-System
│   │   └── 04-departments.sql  # Abteilungen & Teams
│   ├── 01-features/            # Feature-Management
│   │   ├── 01-features.sql     # Feature-Definitionen
│   │   └── 02-tenant-features.sql # Feature-Zuordnungen
│   ├── 02-modules/             # Einzelne Module (unabhängig)
│   │   ├── blackboard.sql      # Schwarzes Brett
│   │   ├── calendar.sql        # Kalender-System
│   │   ├── chat.sql            # Chat-System
│   │   ├── documents.sql       # Dokumenten-Management
│   │   ├── kvp.sql             # KVP-System
│   │   ├── shifts.sql          # Schichtplanung
│   │   └── surveys.sql         # Umfrage-System
│   └── 03-views/               # Views (am Ende)
│       └── views.sql           # Alle Views
├── migrations/                  # Datenbank-Änderungen
│   └── YYYY-MM-DD-description.sql
├── seeds/                       # Test-/Demo-Daten
│   ├── 01-demo-tenants.sql
│   └── 02-demo-users.sql
├── build/                       # Build-Scripts
│   └── build-schema.js          # Generiert complete-schema.sql
└── complete-schema.sql          # Generierte Datei (aktuell halten!)
```

## 🔧 Verwendung

### Entwicklung (Modular)
```bash
# Einzelnes Modul testen
mysql -u root -p assixx < database/schema/02-modules/surveys.sql
```

### Deployment (Komplett)
```bash
# Schema builden
cd database/build && node build-schema.js

# Deployment lokal
mysql -u root -p assixx < database/complete-schema.sql

# Deployment Docker
docker exec -i assixx-mysql mysql -u root -p assixx < database/complete-schema.sql
```

## 📋 Konventionen

1. **Dateinamen**: `nummer-beschreibung.sql` (z.B. `01-tenants.sql`)
2. **Reihenfolge**: 00-core muss zuerst, dann 01-features, dann 02-modules
3. **Kommentare**: Jede Datei beginnt mit Beschreibung
4. **Drops**: Keine DROP Statements in Schema-Dateien (nur in Migrations)
5. **IF NOT EXISTS**: Immer verwenden für Idempotenz

## 📦 Build-Prozess

Das Build-Script kombiniert alle Module zu einer Datei:

```bash
cd database/build
node build-schema.js
```

Dies erstellt `complete-schema.sql` mit dem aktuellen Stand aller Tabellen.

### Build-Output

- **Datei**: `database/complete-schema.sql` 
- **Inhalt**: Alle Tabellen, Views und Daten in korrekter Reihenfolge
- **Größe**: ~69 KB, ~2000 Zeilen
- **Verwendung**: Für neue Installationen oder komplette Reinitialisierungen

## 📝 Neue Features hinzufügen

1. Neue Datei in `schema/02-modules/` erstellen
2. Build-Script ausführen
3. Testen
4. Migration erstellen wenn nötig

## ⚠️ Wichtig

- **Immer aktuell halten**: Nach Änderungen an Schema-Dateien das Build-Script ausführen
- **complete-schema.sql** wird committed (zentrale Referenz wie gewünscht)
- Bei Änderungen an bestehenden Tabellen immer Migration erstellen
- Neue Module können direkt in `schema/02-modules/` hinzugefügt werden