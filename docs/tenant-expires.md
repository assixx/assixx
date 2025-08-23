# Tenant Trial & Feature Expiration Guide

## 🎯 Problem: 403 Forbidden bei Feature-Zugriff

### Symptom
```
GET /api/availability/current
403 Forbidden
{"error":"Diese Funktion (shift_planning) ist für Ihren Tarif nicht verfügbar."}
```

## 🔍 Ursache: Trial-Zeitraum abgelaufen

Das System hat eine **14-Tage Trial-Period** für neue Tenants. Nach Ablauf werden Features blockiert.

### Beteiligte Tabellen

1. **`tenant_plans`** - Steuert den Trial-Zeitraum
   - `started_at`: Startdatum des Trials
   - `expires_at`: Ablaufdatum (NULL bei unbegrenztem Trial)
   - `status`: 'trial', 'active', 'cancelled'

2. **`tenant_features`** - Feature-spezifische Aktivierung
   - `expires_at`: Feature-spezifisches Ablaufdatum
   - `is_active`: Feature aktiv/inaktiv

## ✅ Lösung: Trial verlängern

### Option 1: Trial-Start verschieben (Quick Fix)
```sql
-- Setze Trial-Start auf aktuelles/zukünftiges Datum
UPDATE tenant_plans 
SET started_at = NOW(),
    expires_at = NULL,
    updated_at = NOW()
WHERE tenant_id = [TENANT_ID];
```

### Option 2: Spezifisches Datum setzen
```sql
-- Beispiel: Trial startet am 3. September 2025
UPDATE tenant_plans 
SET started_at = '2025-09-03 21:02:14',
    expires_at = NULL,
    updated_at = NOW()
WHERE id = [PLAN_ID];
```

### Option 3: Feature direkt verlängern
```sql
-- Verlängere einzelnes Feature um 30 Tage
UPDATE tenant_features 
SET expires_at = DATE_ADD(NOW(), INTERVAL 30 DAY),
    is_active = 1,
    updated_at = NOW()
WHERE tenant_id = [TENANT_ID] 
AND feature_id = (SELECT id FROM features WHERE code = 'shift_planning');
```

## 📋 Trial-Logik im Code

### Bei Tenant-Erstellung (`/backend/src/models/tenant.ts`)
```typescript
// 14 Tage Trial wird automatisch gesetzt
const trialEndsAt = new Date();
trialEndsAt.setDate(trialEndsAt.getDate() + 14);

// Alle Features werden mit 14 Tage Trial aktiviert
for (const feature of features) {
  await conn.query(
    `INSERT INTO tenant_features (tenant_id, feature_id, is_active, expires_at) 
     VALUES (?, ?, TRUE, DATE_ADD(NOW(), INTERVAL 14 DAY))`,
    [tenantId, feature.id]
  );
}
```

### Feature-Check (`/backend/src/models/feature.ts`)
```typescript
// Prüft ob Feature aktiv und nicht abgelaufen ist
const query = `
  SELECT tf.*, f.code, f.name 
  FROM tenant_features tf
  JOIN features f ON tf.feature_id = f.id
  WHERE tf.tenant_id = ? 
  AND f.code = ?
  AND tf.is_active = 1
  AND (tf.expires_at IS NULL OR tf.expires_at >= NOW())
`;
```

## 🔧 Debugging-Befehle

### Prüfe Trial-Status eines Tenants
```bash
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e "
SELECT 
  tp.*,
  t.subdomain,
  DATEDIFF(DATE_ADD(tp.started_at, INTERVAL 14 DAY), NOW()) as days_remaining
FROM tenant_plans tp
JOIN tenants t ON tp.tenant_id = t.id
WHERE tp.tenant_id = [TENANT_ID];"'
```

### Prüfe Feature-Status
```bash
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e "
SELECT 
  tf.*,
  f.code,
  CASE 
    WHEN tf.expires_at IS NULL THEN 'unlimited'
    WHEN tf.expires_at > NOW() THEN 'active'
    ELSE 'expired'
  END as status
FROM tenant_features tf
JOIN features f ON tf.feature_id = f.id
WHERE tf.tenant_id = [TENANT_ID];"'
```

## ⚠️ Wichtige Hinweise

1. **Trial-Dauer**: Standard 14 Tage ab `started_at`
2. **Zwei Ebenen**: Trial kann auf Plan-Ebene ODER Feature-Ebene ablaufen
3. **Priorität**: Wenn tenant_plans abgelaufen ist, helfen aktive tenant_features nicht
4. **Production**: In Production sollte ein automatischer Upgrade-Flow implementiert werden

## 🚀 Best Practice

Für Entwicklung/Testing:
```sql
-- Setze unbegrenzten Trial für Test-Tenant
UPDATE tenant_plans 
SET status = 'active',
    expires_at = NULL
WHERE tenant_id = [TEST_TENANT_ID];

-- Aktiviere alle Features unbegrenzt
UPDATE tenant_features 
SET is_active = 1,
    expires_at = NULL
WHERE tenant_id = [TEST_TENANT_ID];
```