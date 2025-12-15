# 🚀 Test-Migration zu Integration-Only - Konkrete Anleitung

## 🎯 TL;DR für morgen früh

**Was**: Alle Tests auf echte DB umstellen (keine Mocks mehr)
**Warum**: Mock-Wartung ist Hölle, Schema-Drift war das echte Problem
**Wie**: Schema-Sync automatisieren, dann Integration Tests only
**Dauer**: Realistisch 2-3 Tage
**Start**: Step 1 - Schema-Sync in GitHub Actions

## ⚠️ WICHTIG: Was heute schon passiert ist

- documents.test.ts wurde bereits auf Simple-Mock umgestellt (von 900 → 150 Zeilen)
- Alte documents.test.ts gelöscht, documents-simple.test.ts → documents.test.ts
- Aktueller Stand: Minimal gemockt, aber noch nicht mit echter DB

## 📌 Entscheidung: Integration Tests mit Schema-Sync

**Warum**: Nach 124 Commits ist klar - Mocking funktioniert nicht. Wir nutzen echte DB mit automatischem Schema-Sync.

## 📚 Kontext & Historie (WICHTIG für morgen!)

### Branch: unit-tests--Github-Actions (124 commits ahead)

**Was bisher versucht wurde:**

1. **Mock-Ansatz** (auth-refactored) → Funktioniert, aber Mock-Wartung Hölle
2. **DB-Ansatz** (documents.test.ts) → Scheiterte an Schema-Drift
3. **Mix-Ansatz** → Verletzt "Test = Production" Prinzip

### Wichtige Commits & Lessons

```bash
# Success: auth-refactored mit Mocks
64b247f: "Fix all auth-refactored middleware tests by properly mocking database"
→ DB_HOST=mock VOR imports kritisch!

# Fail: documents mit echter DB
9db27c5: "Rewrite documents.test.ts to use real test DB instead of mocks"
→ Schema-Drift zwischen main vs main_test

# Revert: Environment-basierte Queries
f536003: "Revert fix: Support different DB schemas"
→ NODE_ENV checks sind Anti-Pattern!
```

### Das wahre Problem: Schema-Drift

- `main` DB hat aktuelles Schema
- `main_test` DB hat veraltetes Schema aus Migrations
- Tests scheitern wegen fehlender Columns/Tables

### Die Lösung: Schema-Sync

- Nutze `database/current-schema-*.sql` (immer aktuell)
- Keine separaten Test-Migrations mehr
- Test = Production garantiert

### Relevante Dokumente

- `docs/DEBUGGING-WORKFLOW-LESSONS.md` → One-by-One, Test=Production
- `docs/DATABASE-MIGRATION-GUIDE.md` → Schema Management
- `backend/src/routes/__tests__/documents.test.ts` → Aktueller Stand (gemockt)

### Warum KEINE Unit/Integration Trennung

**Von 20 Tests sind nur 5 echte Unit-Test-Kandidaten:**

- `errorHandler.test.ts` (Pure function)
- `health.test.ts` (Simple check)
- 3 weitere Utils maximal

**Die anderen 15 Tests (75%!) sind Integration:**

- Alle Route Tests (auth, documents, users, etc.)
- DB-Operations
- Multi-Tenant Checks

**Fazit**: Künstlich Routes in "Units" zu zerlegen ist Selbstbetrug!

### Jest console.info Problem

- console.info wird in Tests unterdrückt
- Lösung: Error throwing für Debugging
- Dokumentiert in DEBUGGING-WORKFLOW-LESSONS.md (Zeile 130-180)

### Aktuelle Probleme die wir lösen

1. **403 Forbidden** - User not found (DB Mismatch)
2. **Foreign Key Constraints** - department_id fails
3. **Schema-Drift** - Test DB hat alte Struktur
4. **Mock-Wartung** - Jede API-Änderung = Mock Update
5. **False Positives** - Tests grün, Feature kaputt

## 📋 Schritt-für-Schritt Anleitung

### ✅ Step 1: Schema-Sync in GitHub Actions

**Datei**: `.github/workflows/test.yml`

**Suche nach** "Setup test database" und **füge DAVOR ein**:

```yaml
- name: Export and prepare current schema
  run: |
    # Find latest schema file
    cd backend
    latest_schema=$(ls -t database/current-schema-*.sql | head -1)
    echo "Using schema: $latest_schema"

    # Prepare schema for test database
    cp $latest_schema /tmp/test-schema.sql
    sed -i 's/`main`/`main_test`/g' /tmp/test-schema.sql

- name: Setup test database with current schema
  env:
    DB_HOST: localhost
    DB_USER: root
    DB_PASSWORD: YOUR_ROOT_PASSWORD
    DB_NAME: main_test
  run: |
    # Drop and recreate database
    mysql -h localhost -u root -p$DB_PASSWORD -e "DROP DATABASE IF EXISTS main_test; CREATE DATABASE main_test;"

    # Import current production schema
    mysql -h localhost -u root -p$DB_PASSWORD main_test < /tmp/test-schema.sql

    # Grant permissions
    mysql -h localhost -u root -p$DB_PASSWORD -e "GRANT ALL ON main_test.* TO 'assixx_user'@'%';"
```

**Test**: Push zu GitHub, prüfe ob "Setup test database with current schema" grün ist

### ✅ Step 2: Jest Config für bessere Performance

**Datei**: `backend/jest.config.cjs`

**Zeile 30** ändern von:

```javascript
maxWorkers: 1,
```

zu:

```javascript
maxWorkers: 4, // VORSICHT: Kann Race Conditions mit DB geben!
```

**Test**:

```bash
docker exec assixx-backend pnpm test -- --listTests | wc -l
# Sollte 20 Tests zeigen
```

### ✅ Step 3: documents.test.ts auf echte DB umstellen

**Datei**: `backend/src/routes/__tests__/documents.test.ts`

**Komplett ersetzen** mit:

```typescript
/**
 * Document Upload Test - Mit echter Test-Datenbank
 * Kein Mocking von DB oder Models!
 */
import jwt from 'jsonwebtoken';
import request from 'supertest';

import { asTestRows } from '../../__tests__/mocks/db-types';
import app from '../../app';
import { pool } from '../../database';

// Nur externe Services mocken
jest.mock('../../utils/emailService', () => ({
  default: {
    sendEmail: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('fs/promises', () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(Buffer.from('Test PDF content')),
}));

describe('Document Upload - Integration Test', () => {
  let testTenantId: number;
  let testUserId: number;
  let testToken: string;

  beforeAll(async () => {
    // Setup test data
    const [tenantResult] = await pool.execute(
      'INSERT INTO tenants (name, subdomain) VALUES (?, ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',
      ['Test Tenant', 'test-doc'],
    );
    testTenantId = (tenantResult as any).insertId;

    const [userResult] = await pool.execute(
      `INSERT INTO users (username, email, password_hash, role, tenant_id, first_name, last_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [
        'testuser@test.com',
        'testuser@test.com',
        '$2b$10$dummy', // Dummy hash
        'admin',
        testTenantId,
        'Test',
        'User',
        'active',
      ],
    );
    testUserId = (userResult as any).insertId;

    // Create valid JWT token
    testToken = jwt.sign(
      {
        id: testUserId,
        username: 'testuser@test.com',
        role: 'admin',
        tenant_id: testTenantId,
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' },
    );
  });

  afterAll(async () => {
    // Cleanup
    await pool.execute('DELETE FROM documents WHERE tenant_id = ?', [testTenantId]);
    await pool.execute('DELETE FROM users WHERE tenant_id = ?', [testTenantId]);
    await pool.execute('DELETE FROM tenants WHERE id = ?', [testTenantId]);
  });

  beforeEach(async () => {
    // Clean documents before each test
    await pool.execute('DELETE FROM documents WHERE tenant_id = ?', [testTenantId]);
  });

  it('should upload a document successfully', async () => {
    const response = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${testToken}`)
      .field('recipientType', 'company')
      .field('category', 'general')
      .field('description', 'Test document')
      .attach('document', Buffer.from('Test content'), 'test.pdf');

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: expect.stringContaining('erfolgreich'),
      data: {
        documentId: expect.any(Number),
      },
    });

    // Verify in database
    const [rows] = await pool.execute('SELECT * FROM documents WHERE id = ?', [response.body.data.documentId]);
    const docs = asTestRows<any>(rows);
    expect(docs).toHaveLength(1);
    expect(docs[0].tenant_id).toBe(testTenantId);
  });

  it('should reject unauthenticated requests', async () => {
    const response = await request(app)
      .post('/api/documents/upload')
      .field('category', 'general')
      .attach('document', Buffer.from('Test'), 'test.pdf');

    expect(response.status).toBe(401);
  });
});
```

**Test**:

```bash
docker exec assixx-backend pnpm test documents.test.ts
```

### ✅ Step 4: Alle anderen Tests anpassen

⚠️ **WARNUNG**: Dies ist der zeitaufwendigste Teil!

**Für jeden Test** in `backend/src/**/__tests__/*.test.ts`:

1. **Entferne** Mock-Setup für DB/Models
2. **Behalte** Mocks für externe Services (Email, File System)
3. **Nutze** echte Test-Datenbank

**Template**:

```typescript
// ENTFERNEN:
jest.mock("../../database", () => ({...}));
jest.mock("../../models/user", () => ({...}));

// BEHALTEN:
jest.mock("../../utils/emailService", () => ({...}));
```

### ✅ Step 5: Cleanup - Mock-Only Tests löschen

**Zu löschen** (reine Mock-Tests ohne Nutzen):

```bash
# Falls es diese gibt:
rm backend/src/__tests__/mocks/unit-only.test.ts
```

**Test**:

```bash
# Alle Tests sollten laufen
docker exec assixx-backend pnpm test
```

### ✅ Step 6: Performance-Check

```bash
# Zeit messen
time docker exec assixx-backend pnpm test

# Sollte < 60 Sekunden sein mit maxWorkers: 4
```

## 🎯 Erfolgs-Kriterien

- [ ] GitHub Actions nutzt current-schema-\*.sql
- [ ] Keine Schema-Drift Fehler mehr
- [ ] documents.test.ts läuft mit echter DB
- [ ] Alle Tests grün
- [ ] Tests laufen in < 60 Sekunden

## 🚨 Troubleshooting

**Problem**: "Table doesn't exist"
**Lösung**: Schema export neu machen

```bash
./scripts/export-current-schema.sh
```

**Problem**: "User not found or inactive"
**Lösung**: Test-User Status prüfen

```sql
UPDATE users SET status = 'active' WHERE id = ?;
```

**Problem**: Tests zu langsam
**Lösung**: maxWorkers erhöhen, afterEach optimieren

## 📝 Notizen für später

- Schema-Sync könnte als npm script: `"test:sync-schema"`
- GitHub Action könnte Schema cachen
- Test-DB Reset zwischen Test-Suites

## 🤔 Kritische Betrachtung (100% ehrlich)

### Was gut ist

- ✅ Keine Mock-Wartung mehr
- ✅ Test = Production garantiert
- ✅ Schema-Drift gelöst
- ✅ Einfacher zu verstehen

### Was problematisch ist

- ❌ CI wird langsamer (1-2 Min statt 30s)
- ❌ Race Conditions bei parallelen Tests möglich
- ❌ Echte Unit Tests (Utils) verlieren wir
- ❌ Mehr DB-Last bei Entwicklung

### Alternative die wir verworfen haben

**Hybrid-Ansatz**:

- `__tests__/unit/` für echte Unit Tests (5 Tests)
- `__tests__/integration/` für DB Tests (15 Tests)

**Warum verworfen**: Zu viel Overhead für nur 5 echte Unit Tests

### Langfristig die beste Entscheidung?

**JA, WENN**:

- Team klein bleibt (Mock-Wartung skaliert schlecht)
- Features wichtiger als CI-Speed
- Einfachheit > theoretische Perfektion

**NEIN, WENN**:

- CI-Speed kritisch wird
- Viele Entwickler parallel arbeiten
- Mehr Business Logic ohne DB entsteht

---

**Start**: Schema-Sync in GitHub Actions
**Ende**: Alle Tests mit echter DB
**Resultat**: Keine Mocks, keine Wartung, echte Tests!
