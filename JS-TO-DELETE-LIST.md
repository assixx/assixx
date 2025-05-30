# JavaScript Files die gelöscht werden müssen

## Zusammenfassung
- **Backend**: 84 JavaScript Files wurden durch TypeScript ersetzt
- **Frontend**: 4 JavaScript Files wurden durch TypeScript ersetzt
- **Gesamt**: 88 Files zu löschen

## Backend Files (backend/src/)
```bash
# Alle JS Files mit TS Gegenstücken löschen:
for js in $(find backend/src -name "*.js"); do 
  ts="${js%.js}.ts"
  if [ -f "$ts" ]; then 
    echo "Lösche: $js"
    rm "$js"
  fi
done
```

## Frontend Files (frontend/src/)
```bash
# Alle JS Files mit TS Gegenstücken löschen:
for js in $(find frontend/src -name "*.js"); do 
  ts="${js%.js}.ts"
  if [ -f "$ts" ]; then 
    echo "Lösche: $js"
    rm "$js"
  fi
done
```

## Wichtige Hinweise
1. Vor dem Löschen unbedingt sicherstellen, dass alle TypeScript Files funktionieren
2. Build testen nach dem Löschen
3. Git commit nach dem Löschen erstellen