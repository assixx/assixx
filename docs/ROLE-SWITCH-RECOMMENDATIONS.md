# 🚨 Role-Switch Sicherheits-Empfehlungen

## 1️⃣ SOFORT umsetzen - Visueller Indikator

### Frontend: Role-Switch Banner

```typescript
// In unified-navigation.ts ergänzen
private showRoleSwitchIndicator(): void {
  const token = localStorage.getItem('token');
  if (!token) return;

  const payload = JSON.parse(atob(token.split('.')[1]));

  if (payload.isRoleSwitched) {
    const banner = document.createElement('div');
    banner.className = 'role-switch-banner';
    banner.innerHTML = `
      <div class="role-switch-warning">
        <i class="fas fa-exclamation-triangle"></i>
        <span>Sie agieren als: <strong>${payload.activeRole.toUpperCase()}</strong></span>
        <button on click(depcreated.itsnow eventhandler)="UnifiedNav.switchBackToOriginalRole()">
          Zurück zu ${payload.role.toUpperCase()}
        </button>
      </div>
    `;
    document.body.prepend(banner);
  }
}
```

### CSS für den Banner

```css
.role-switch-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(255, 193, 7, 0.95);
  color: #000;
  padding: 10px;
  text-align: center;
  z-index: 9999;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.role-switch-warning {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
}

.role-switch-warning i {
  font-size: 20px;
  color: #d32f2f;
}

.role-switch-warning button {
  background: #333;
  color: #fff;
  border: none;
  padding: 5px 15px;
  border-radius: 20px;
  cursor: pointer;
}
```

## 2️⃣ Backend Restrictions für Employee-View

### In sensitiven Routes ergänzen

```typescript
// z.B. in /backend/src/routes/users.ts
router.get(
  '/api/users/:id/private-data',
  ...security.user(),
  typed.params<{ id: string }>(async (req, res) => {
    // NEU: Check für Role-Switch
    if (req.user.isRoleSwitched && req.user.activeRole === 'employee') {
      // Nur eigene Daten erlauben
      if (parseInt(req.params.id) !== req.user.id) {
        return res.status(403).json({
          message: 'Im Employee-Modus können Sie nur Ihre eigenen Daten einsehen',
        });
      }
    }

    // Normale Logik...
  }),
);
```

## 3️⃣ Auto-Timeout nach Inaktivität

### Backend Middleware

```typescript
// Neue Datei: /backend/src/middleware/roleSwitchTimeout.ts
export function checkRoleSwitchTimeout(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isRoleSwitched) {
    return next();
  }

  const TIMEOUT = 30 * 60 * 1000; // 30 Minuten
  const lastActivity = req.session?.lastActivity || Date.now();

  if (Date.now() - lastActivity > TIMEOUT) {
    // Force revert to original role
    const originalToken = jwt.sign(
      {
        ...req.user,
        activeRole: req.user.role,
        isRoleSwitched: false,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '8h' },
    );

    res.cookie('token', originalToken);
    return res.status(401).json({
      message: 'Role-Switch Timeout - Sie wurden zur Original-Rolle zurückgesetzt',
      newToken: originalToken,
    });
  }

  // Update last activity
  req.session.lastActivity = Date.now();
  next();
}
```

## 4️⃣ Erweiterte Audit-Logs

### SQL Migration

```sql
-- Neue Felder für besseres Tracking
ALTER TABLE admin_logs
ADD COLUMN was_role_switched BOOLEAN DEFAULT FALSE,
ADD COLUMN switched_from_role VARCHAR(50),
ADD COLUMN viewed_sensitive_data JSON;

-- Index für Performance
CREATE INDEX idx_role_switch_logs ON admin_logs(was_role_switched, created_at);
```

### Im Code

```typescript
// Bei jedem sensitiven Zugriff loggen
if (req.user.isRoleSwitched) {
  await AdminLog.create({
    user_id: req.user.id,
    tenant_id: req.user.tenant_id,
    action: 'viewed_employee_data',
    entity_type: 'user',
    entity_id: targetUserId,
    was_role_switched: true,
    switched_from_role: req.user.role,
    viewed_sensitive_data: {
      dataType: 'salary',
      timestamp: new Date(),
    },
  });
}
```

## 5️⃣ Multi-Tab Sync

### Frontend BroadcastChannel

```typescript
// Role-Switch Event Broadcasting
const channel = new BroadcastChannel('role_switch_channel');

// Beim Rollenwechsel
function notifyRoleSwitch(newRole: string) {
  channel.postMessage({
    type: 'ROLE_SWITCHED',
    newRole: newRole,
    timestamp: Date.now(),
  });
}

// In allen Tabs lauschen
channel.onmessage = (event) => {
  if (event.data.type === 'ROLE_SWITCHED') {
    // UI aktualisieren
    location.reload(); // Oder eleganter mit State Update
  }
};
```

## 🚀 Implementierungs-Prioritäten

### Phase 1 (Diese Woche)

1. ✅ Visueller Banner für Role-Switch
2. ✅ Basis-Restrictions für Employee View
3. ✅ Erweiterte Logs mit was_role_switched Flag

### Phase 2 (Nächste Woche)

1. Auto-Timeout Middleware
2. Multi-Tab Synchronisation
3. Audit-Dashboard (Read-only für Betriebsrat)

### Phase 3 (Später)

1. Delegation System
2. Emergency Access
3. Training Mode

## ⚠️ Wichtige Überlegungen

1. **DSGVO/Compliance**: Alle Zugriffe im Role-Switch Modus müssen geloggt werden
2. **Betriebsrat**: Muss Audit-Logs einsehen können
3. **Performance**: Zusätzliche Checks dürfen System nicht verlangsamen
4. **UX**: User muss IMMER wissen in welcher Rolle er agiert
