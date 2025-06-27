# 🗑️ Delete Tenant - Die BESTE Lösung für Assixx

## 🎯 Executive Summary

Die beste Lösung für Assixx ist ein **Intelligent Deletion Service** mit Background Processing - ähnlich wie Microsoft/Google es machen, aber angepasst an unsere bestehende Codebasis.

**Warum diese Lösung?**
- ✅ Keine Änderung an 500+ Queries nötig
- ✅ Professionell wie bei Microsoft/Google
- ✅ In 1 Woche implementierbar
- ✅ Skalierbar und fehlerresistent

## 🏢 Wie machen es die Großen?

### Microsoft Azure/Office 365
- **Two-Phase Delete**: Erst deaktivieren (sofort), dann löschen (Background Job)
- **Grace Period**: 30 Tage Wiederherstellung möglich
- **Async Processing**: Deletion Queue mit Retry-Logic
- **Status Updates**: User sieht Fortschritt

### Google Workspace
- **Staged Deletion**: ACTIVE → SUSPENDED → DELETING → DELETED
- **Background Workers**: Löschen läuft asynchron
- **Data Export**: Automatischer Export vor Löschung
- **Audit Trail**: Jeder Schritt wird geloggt

### Was wir davon lernen
1. **NIEMALS** synchron löschen bei komplexen Datenstrukturen
2. **IMMER** Status-Tracking für User Experience
3. **IMMER** Background Processing für große Operationen

## 🚀 Die BESTE Lösung für Assixx

### Architektur Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   User klickt   │     │  Deletion Queue  │     │ Background Job  │
│    "Löschen"    │────▶│   (Database)     │────▶│   (Worker)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                        │                         │
         ▼                        ▼                         ▼
   Status: suspended        Status: queued            Status: deleting
   "Wird gelöscht..."      Wartet auf Worker         Löscht Schritt
                                                      für Schritt
```

### Implementierung

#### 1. Database Schema (Neue Tabellen)

```sql
-- Deletion Queue für asynchrone Verarbeitung
CREATE TABLE tenant_deletion_queue (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  status ENUM('queued', 'processing', 'completed', 'failed') DEFAULT 'queued',
  progress INT DEFAULT 0, -- 0-100%
  current_step VARCHAR(100),
  total_steps INT DEFAULT 0,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_by INT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
);

-- Deletion Log für Audit Trail
CREATE TABLE tenant_deletion_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  queue_id INT NOT NULL,
  step_name VARCHAR(100),
  table_name VARCHAR(100),
  records_deleted INT DEFAULT 0,
  duration_ms INT,
  status ENUM('success', 'failed', 'skipped'),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (queue_id) REFERENCES tenant_deletion_queue(id)
);

-- Status zu Tenants hinzufügen
ALTER TABLE tenants 
  ADD COLUMN deletion_status ENUM('active', 'suspended', 'deleting') DEFAULT 'active',
  ADD COLUMN deletion_requested_at TIMESTAMP NULL,
  ADD INDEX idx_deletion_status (deletion_status);
```

#### 2. Deletion Service (TypeScript)

```typescript
// backend/src/services/TenantDeletionService.ts
import { db } from '../database';
import { logger } from '../utils/logger';

interface DeletionStep {
  name: string;
  description: string;
  handler: (tenantId: number, connection: any) => Promise<number>;
  critical: boolean; // If true, failure stops entire process
}

export class TenantDeletionService {
  private steps: DeletionStep[] = [
    // Level 1: Session & Cache Data (Unkritisch)
    {
      name: 'user_sessions',
      description: 'Lösche User Sessions',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'user_chat_status',
      description: 'Lösche Chat Status',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM user_chat_status WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },

    // Level 2: Notifications & Temp Data
    {
      name: 'chat_notifications',
      description: 'Lösche Chat Benachrichtigungen',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM chat_notifications WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },

    // Level 3: Activity & Logs (Wichtig für Audit, aber löschbar)
    {
      name: 'activity_logs',
      description: 'Lösche Activity Logs',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM activity_logs WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'api_logs',
      description: 'Lösche API Logs',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM api_logs WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'security_logs',
      description: 'Lösche Security Logs',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM security_logs WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'admin_logs',
      description: 'Lösche Admin Logs',
      critical: true,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM admin_logs WHERE tenant_id = ?',
          [tenantId]
        );
        return result.affectedRows;
      }
    },

    // Level 4: Messages & Communication
    {
      name: 'message_read_receipts',
      description: 'Lösche Message Read Receipts',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM message_read_receipts WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'message_status',
      description: 'Lösche Message Status',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM message_status WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'messages',
      description: 'Lösche Messages',
      critical: true,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM messages WHERE sender_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'conversation_participants',
      description: 'Lösche Conversation Participants',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM conversation_participants WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'conversations',
      description: 'Lösche Conversations',
      critical: true,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM conversations WHERE tenant_id = ?',
          [tenantId]
        );
        return result.affectedRows;
      }
    },

    // Level 5: Documents
    {
      name: 'document_read_status',
      description: 'Lösche Document Read Status',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM document_read_status WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'documents',
      description: 'Lösche Documents',
      critical: true,
      handler: async (tenantId, conn) => {
        // TODO: Dateien vom Filesystem löschen!
        const result = await conn.query(
          'DELETE FROM documents WHERE tenant_id = ?',
          [tenantId]
        );
        return result.affectedRows;
      }
    },

    // Level 6: KVP System
    {
      name: 'kvp_comments',
      description: 'Lösche KVP Comments',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM kvp_comments WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'kvp_ratings',
      description: 'Lösche KVP Ratings',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM kvp_ratings WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'kvp_points',
      description: 'Lösche KVP Points',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM kvp_points WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'kvp_status_history',
      description: 'Lösche KVP Status History',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM kvp_status_history WHERE changed_by IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'kvp_attachments',
      description: 'Lösche KVP Attachments',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM kvp_attachments WHERE uploaded_by IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'kvp_suggestions',
      description: 'Lösche KVP Suggestions',
      critical: true,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM kvp_suggestions WHERE tenant_id = ?',
          [tenantId]
        );
        return result.affectedRows;
      }
    },

    // Level 7: Calendar
    {
      name: 'calendar_attendees',
      description: 'Lösche Calendar Attendees',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM calendar_attendees WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'calendar_participants',
      description: 'Lösche Calendar Participants',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM calendar_participants WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'calendar_reminders',
      description: 'Lösche Calendar Reminders',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM calendar_reminders WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'calendar_shares',
      description: 'Lösche Calendar Shares',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM calendar_shares WHERE calendar_owner_id IN (SELECT id FROM users WHERE tenant_id = ?) OR shared_with_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId, tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'calendar_events',
      description: 'Lösche Calendar Events',
      critical: true,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM calendar_events WHERE tenant_id = ?',
          [tenantId]
        );
        return result.affectedRows;
      }
    },

    // Level 8: Shifts
    {
      name: 'shift_assignments',
      description: 'Lösche Shift Assignments',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM shift_assignments WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'shift_notes',
      description: 'Lösche Shift Notes',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM shift_notes WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'weekly_shift_notes',
      description: 'Lösche Weekly Shift Notes',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM weekly_shift_notes WHERE department_id IN (SELECT id FROM departments WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'shifts',
      description: 'Lösche Shifts',
      critical: true,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM shifts WHERE tenant_id = ?',
          [tenantId]
        );
        return result.affectedRows;
      }
    },

    // Level 9: Blackboard
    {
      name: 'blackboard_confirmations',
      description: 'Lösche Blackboard Confirmations',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM blackboard_confirmations WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'blackboard_attachments',
      description: 'Lösche Blackboard Attachments',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM blackboard_attachments WHERE uploaded_by IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'blackboard_entries',
      description: 'Lösche Blackboard Entries',
      critical: true,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM blackboard_entries WHERE tenant_id = ?',
          [tenantId]
        );
        return result.affectedRows;
      }
    },

    // Level 10: Surveys
    {
      name: 'survey_comments',
      description: 'Lösche Survey Comments',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM survey_comments WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'survey_responses',
      description: 'Lösche Survey Responses',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM survey_responses WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'survey_participants',
      description: 'Lösche Survey Participants',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM survey_participants WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'survey_assignments',
      description: 'Lösche Survey Assignments',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM survey_assignments WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'survey_questions',
      description: 'Lösche Survey Questions',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM survey_questions WHERE survey_id IN (SELECT id FROM surveys WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'surveys',
      description: 'Lösche Surveys',
      critical: true,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM surveys WHERE tenant_id = ?',
          [tenantId]
        );
        return result.affectedRows;
      }
    },

    // Level 11: User Settings & Preferences
    {
      name: 'user_settings',
      description: 'Lösche User Settings',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM user_settings WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'notification_preferences',
      description: 'Lösche Notification Preferences',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM notification_preferences WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },

    // Level 12: Employee & Features
    {
      name: 'employee_availability',
      description: 'Lösche Employee Availability',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM employee_availability WHERE employee_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'feature_usage_logs',
      description: 'Lösche Feature Usage Logs',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM feature_usage_logs WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },

    // Level 13: Admin Permissions (WICHTIG: Vor Users!)
    {
      name: 'admin_permission_logs',
      description: 'Lösche Admin Permission Logs',
      critical: true,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM admin_permission_logs WHERE admin_user_id IN (SELECT id FROM users WHERE tenant_id = ?) OR changed_by IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId, tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'admin_department_permissions',
      description: 'Lösche Admin Department Permissions',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM admin_department_permissions WHERE admin_user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'admin_group_permissions',
      description: 'Lösche Admin Group Permissions',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM admin_group_permissions WHERE admin_user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },

    // Level 14: Teams & User Relations
    {
      name: 'user_teams',
      description: 'Lösche User Teams',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM user_teams WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'department_group_members',
      description: 'Lösche Department Group Members',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM department_group_members WHERE added_by IN (SELECT id FROM users WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'tenant_admins',
      description: 'Lösche Tenant Admins',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM tenant_admins WHERE tenant_id = ?',
          [tenantId]
        );
        return result.affectedRows;
      }
    },

    // Level 15: Nullify Foreign Keys
    {
      name: 'nullify_foreign_keys',
      description: 'Setze Foreign Keys auf NULL',
      critical: true,
      handler: async (tenantId, conn) => {
        // Teams
        await conn.query('UPDATE teams SET team_lead_id = NULL WHERE tenant_id = ?', [tenantId]);
        await conn.query('UPDATE teams SET created_by = NULL WHERE tenant_id = ?', [tenantId]);
        
        // Departments
        await conn.query('UPDATE departments SET manager_id = NULL WHERE tenant_id = ?', [tenantId]);
        await conn.query('UPDATE departments SET created_by = NULL WHERE tenant_id = ?', [tenantId]);
        
        // Department Groups
        await conn.query('UPDATE department_groups SET created_by = NULL WHERE department_id IN (SELECT id FROM departments WHERE tenant_id = ?)', [tenantId]);
        
        // Tenant Features
        await conn.query('UPDATE tenant_features SET activated_by = NULL WHERE tenant_id = ?', [tenantId]);
        
        // Tenants
        await conn.query('UPDATE tenants SET created_by = NULL WHERE id = ?', [tenantId]);
        
        return 0; // Kein affected rows count nötig
      }
    },

    // Level 16: Core Entities
    {
      name: 'department_groups',
      description: 'Lösche Department Groups',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM department_groups WHERE department_id IN (SELECT id FROM departments WHERE tenant_id = ?)',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'teams',
      description: 'Lösche Teams',
      critical: true,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM teams WHERE tenant_id = ?',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'departments',
      description: 'Lösche Departments',
      critical: true,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM departments WHERE tenant_id = ?',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'users',
      description: 'Lösche Users',
      critical: true,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM users WHERE tenant_id = ?',
          [tenantId]
        );
        return result.affectedRows;
      }
    },

    // Level 17: Tenant Features & Plans
    {
      name: 'tenant_features',
      description: 'Lösche Tenant Features',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM tenant_features WHERE tenant_id = ?',
          [tenantId]
        );
        return result.affectedRows;
      }
    },
    {
      name: 'tenant_plans',
      description: 'Lösche Tenant Plans',
      critical: false,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM tenant_plans WHERE tenant_id = ?',
          [tenantId]
        );
        return result.affectedRows;
      }
    },

    // Level 18: Final - Tenant selbst
    {
      name: 'tenant',
      description: 'Lösche Tenant',
      critical: true,
      handler: async (tenantId, conn) => {
        const result = await conn.query(
          'DELETE FROM tenants WHERE id = ?',
          [tenantId]
        );
        return result.affectedRows;
      }
    }
  ];

  /**
   * Queue tenant for deletion (called from API)
   */
  async queueTenantDeletion(tenantId: number, requestedBy: number): Promise<number> {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 1. Check if tenant exists and is active
      const [tenant] = await connection.query(
        'SELECT id, deletion_status FROM tenants WHERE id = ?',
        [tenantId]
      );
      
      if (!tenant) {
        throw new Error('Tenant not found');
      }
      
      if (tenant.deletion_status !== 'active') {
        throw new Error('Tenant is already being deleted');
      }
      
      // 2. Mark tenant as suspended
      await connection.query(
        'UPDATE tenants SET deletion_status = ?, deletion_requested_at = NOW() WHERE id = ?',
        ['suspended', tenantId]
      );
      
      // 3. Create queue entry
      const result = await connection.query(
        'INSERT INTO tenant_deletion_queue (tenant_id, created_by, total_steps) VALUES (?, ?, ?)',
        [tenantId, requestedBy, this.steps.length]
      );
      
      // 4. Log out all users of this tenant
      await connection.query(
        'DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)',
        [tenantId]
      );
      
      await connection.commit();
      
      logger.warn(`Tenant ${tenantId} queued for deletion by user ${requestedBy}`);
      
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Process deletion queue (called by cron job)
   */
  async processQueue(): Promise<void> {
    const connection = await db.getConnection();
    
    try {
      // Get next queued item
      const [queueItem] = await connection.query(
        `SELECT * FROM tenant_deletion_queue 
         WHERE status = 'queued' 
         ORDER BY created_at ASC 
         LIMIT 1`
      );
      
      if (!queueItem) {
        return; // Nothing to process
      }
      
      await this.processTenantDeletion(queueItem.id);
    } catch (error) {
      logger.error('Error processing deletion queue:', error);
    } finally {
      connection.release();
    }
  }

  /**
   * Process single tenant deletion
   */
  private async processTenantDeletion(queueId: number): Promise<void> {
    const connection = await db.getConnection();
    
    try {
      // 1. Mark as processing
      await connection.query(
        'UPDATE tenant_deletion_queue SET status = ?, started_at = NOW() WHERE id = ?',
        ['processing', queueId]
      );
      
      // 2. Get tenant info
      const [queueItem] = await connection.query(
        'SELECT * FROM tenant_deletion_queue WHERE id = ?',
        [queueId]
      );
      
      const tenantId = queueItem.tenant_id;
      
      // 3. Update tenant status
      await connection.query(
        'UPDATE tenants SET deletion_status = ? WHERE id = ?',
        ['deleting', tenantId]
      );
      
      // 4. Process each step
      let completedSteps = 0;
      
      for (const step of this.steps) {
        const startTime = Date.now();
        
        try {
          logger.info(`Processing deletion step: ${step.name} for tenant ${tenantId}`);
          
          // Update current step
          await connection.query(
            'UPDATE tenant_deletion_queue SET current_step = ?, progress = ? WHERE id = ?',
            [step.description, Math.round((completedSteps / this.steps.length) * 100), queueId]
          );
          
          // Execute step
          const recordsDeleted = await step.handler(tenantId, connection);
          
          // Log success
          await connection.query(
            `INSERT INTO tenant_deletion_log 
             (queue_id, step_name, table_name, records_deleted, duration_ms, status) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [queueId, step.name, step.name, recordsDeleted, Date.now() - startTime, 'success']
          );
          
          completedSteps++;
          
        } catch (error: any) {
          logger.error(`Error in deletion step ${step.name}:`, error);
          
          // Log failure
          await connection.query(
            `INSERT INTO tenant_deletion_log 
             (queue_id, step_name, table_name, duration_ms, status, error_message) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [queueId, step.name, step.name, Date.now() - startTime, 'failed', error.message]
          );
          
          if (step.critical) {
            throw new Error(`Critical step ${step.name} failed: ${error.message}`);
          }
        }
      }
      
      // 5. Mark as completed
      await connection.query(
        'UPDATE tenant_deletion_queue SET status = ?, completed_at = NOW(), progress = 100 WHERE id = ?',
        ['completed', queueId]
      );
      
      logger.info(`Tenant ${tenantId} deletion completed successfully`);
      
    } catch (error: any) {
      logger.error('Tenant deletion failed:', error);
      
      // Mark as failed
      await connection.query(
        'UPDATE tenant_deletion_queue SET status = ?, error_message = ? WHERE id = ?',
        ['failed', error.message, queueId]
      );
      
      // Revert tenant status
      const [queueItem] = await connection.query(
        'SELECT tenant_id FROM tenant_deletion_queue WHERE id = ?',
        [queueId]
      );
      
      if (queueItem) {
        await connection.query(
          'UPDATE tenants SET deletion_status = ? WHERE id = ?',
          ['active', queueItem.tenant_id]
        );
      }
      
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get deletion status
   */
  async getDeletionStatus(tenantId: number): Promise<any> {
    const [status] = await db.query(
      `SELECT 
        q.*,
        t.deletion_status,
        t.deletion_requested_at,
        (SELECT COUNT(*) FROM tenant_deletion_log WHERE queue_id = q.id) as completed_steps
       FROM tenant_deletion_queue q
       JOIN tenants t ON t.id = q.tenant_id
       WHERE q.tenant_id = ?
       ORDER BY q.created_at DESC
       LIMIT 1`,
      [tenantId]
    );
    
    return status;
  }

  /**
   * Retry failed deletion
   */
  async retryDeletion(queueId: number): Promise<void> {
    await db.query(
      'UPDATE tenant_deletion_queue SET status = ?, retry_count = retry_count + 1 WHERE id = ? AND status = ?',
      ['queued', queueId, 'failed']
    );
  }
}

export const tenantDeletionService = new TenantDeletionService();
```

#### 3. API Endpoints

```typescript
// backend/src/routes/root.ts

// Request tenant deletion
router.delete('/tenants/:id', auth, requireRole('root'), async (req, res) => {
  try {
    const tenantId = parseInt(req.params.id);
    const queueId = await tenantDeletionService.queueTenantDeletion(
      tenantId,
      req.user.id
    );
    
    res.json({
      success: true,
      message: 'Tenant wurde zur Löschung eingeplant',
      queueId,
      estimatedTime: '10-15 Minuten'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get deletion status
router.get('/tenants/:id/deletion-status', auth, requireRole('root'), async (req, res) => {
  try {
    const status = await tenantDeletionService.getDeletionStatus(
      parseInt(req.params.id)
    );
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Retry failed deletion
router.post('/deletion-queue/:id/retry', auth, requireRole('root'), async (req, res) => {
  try {
    await tenantDeletionService.retryDeletion(parseInt(req.params.id));
    
    res.json({
      success: true,
      message: 'Löschung wird erneut versucht'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

#### 4. Cron Job (Background Worker)

```typescript
// backend/src/jobs/deletionWorker.ts
import cron from 'node-cron';
import { tenantDeletionService } from '../services/TenantDeletionService';
import { logger } from '../utils/logger';

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    logger.info('Running tenant deletion worker...');
    await tenantDeletionService.processQueue();
  } catch (error) {
    logger.error('Deletion worker error:', error);
  }
});

// Alternativ: Eigener Worker Process
// backend/src/workers/deletionWorker.ts
import { tenantDeletionService } from '../services/TenantDeletionService';

async function run() {
  while (true) {
    try {
      await tenantDeletionService.processQueue();
      // Wait 30 seconds between runs
      await new Promise(resolve => setTimeout(resolve, 30000));
    } catch (error) {
      console.error('Worker error:', error);
      // Wait 1 minute on error
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  }
}

run();
```

#### 5. Frontend Updates

```typescript
// frontend/src/pages/root-profile.html - deleteTenant function
async function deleteTenant() {
  const confirmBtn = document.getElementById('confirmDeleteBtn');
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Lösche...';

  try {
    const response = await fetch('/api/root/tenants/' + currentTenantId, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      
      // Show status modal instead of success overlay
      showDeletionStatusModal(data.queueId);
      
      // Close delete confirmation modal
      closeDeleteModal();
      
    } else {
      const error = await response.json();
      showMessage(error.message || 'Fehler beim Löschen des Tenants', 'error');
      confirmBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Endgültig löschen';
      confirmBtn.disabled = false;
    }
  } catch (error) {
    console.error('Error deleting tenant:', error);
    showMessage('Fehler beim Löschen des Tenants', 'error');
    confirmBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Endgültig löschen';
    confirmBtn.disabled = false;
  }
}

// New function to show deletion progress
function showDeletionStatusModal(queueId) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <i class="fas fa-hourglass-half"></i>
        <h3>Tenant wird gelöscht...</h3>
      </div>
      <div class="modal-body">
        <div class="progress-container">
          <div class="progress-bar" id="deletion-progress" style="width: 0%"></div>
        </div>
        <p id="deletion-status">Initialisiere Löschvorgang...</p>
        <p class="text-muted">Geschätzte Zeit: 10-15 Minuten</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Poll status every 5 seconds
  const statusInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/root/tenants/${currentTenantId}/deletion-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await response.json();
      const status = data.data;
      
      if (status) {
        document.getElementById('deletion-progress').style.width = status.progress + '%';
        document.getElementById('deletion-status').textContent = status.current_step || 'Verarbeite...';
        
        if (status.status === 'completed') {
          clearInterval(statusInterval);
          modal.remove();
          showSuccessOverlay('Tenant wurde erfolgreich gelöscht!');
          localStorage.clear();
          setTimeout(() => window.location.href = '/login', 2000);
        } else if (status.status === 'failed') {
          clearInterval(statusInterval);
          modal.remove();
          showMessage('Fehler beim Löschen: ' + status.error_message, 'error');
        }
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  }, 5000);
}
```

## 📊 Implementierungsplan

### Woche 1: Backend-Basis

**Tag 1-2: Database Schema**
- [ ] Migration für neue Tabellen erstellen
- [ ] Indexes optimieren
- [ ] Test-Daten erstellen

**Tag 3-4: Deletion Service**
- [ ] TenantDeletionService implementieren
- [ ] Unit Tests schreiben
- [ ] Integration Tests

**Tag 5: API & Worker**
- [ ] API Endpoints implementieren
- [ ] Cron Job / Worker einrichten
- [ ] Logging & Monitoring

### Woche 2: Frontend & Testing

**Tag 1-2: Frontend Updates**
- [ ] Status Modal implementieren
- [ ] Progress Tracking
- [ ] Error Handling

**Tag 3-4: End-to-End Testing**
- [ ] Test mit kleinem Tenant
- [ ] Test mit großem Tenant (viele Daten)
- [ ] Fehlerszenarien testen

**Tag 5: Deployment**
- [ ] Docker Config für Worker
- [ ] Monitoring Dashboard
- [ ] Dokumentation

## 🚀 Deployment

### Docker Compose Update

```yaml
# docker-compose.yml
services:
  # ... existing services ...
  
  deletion-worker:
    build: 
      context: ../
      dockerfile: docker/Dockerfile.worker
    environment:
      - NODE_ENV=production
      - DB_HOST=mysql
    depends_on:
      - mysql
      - redis
    restart: unless-stopped
    command: node backend/dist/workers/deletionWorker.js
```

### Monitoring

```sql
-- Dashboard Query für Root User
SELECT 
  q.id,
  t.company_name,
  q.status,
  q.progress,
  q.current_step,
  q.created_at,
  q.started_at,
  q.completed_at,
  TIMESTAMPDIFF(MINUTE, q.started_at, IFNULL(q.completed_at, NOW())) as duration_minutes,
  u.username as requested_by
FROM tenant_deletion_queue q
JOIN tenants t ON t.id = q.tenant_id
JOIN users u ON u.id = q.created_by
ORDER BY q.created_at DESC;
```

## ✅ Vorteile dieser Lösung

1. **Keine Änderung an bestehenden Queries** - Alles funktioniert weiter wie bisher
2. **Professionelle User Experience** - User sieht Progress, kann Status checken
3. **Fehlerresistent** - Retry-Mechanismus, kritische vs. unkritische Steps
4. **Skalierbar** - Queue-basiert, kann parallel laufen
5. **Audit Trail** - Jeder Schritt wird geloggt
6. **Wiederherstellbar** - Bei Fehler wird Tenant wieder aktiviert
7. **Performance** - Läuft im Hintergrund, blockiert nichts

## 🎯 Zusammenfassung

Diese Lösung kombiniert das Beste aus der Enterprise-Welt (Microsoft/Google) mit der Realität von Assixx:

- ✅ **Two-Phase Delete** wie Microsoft (suspend → delete)
- ✅ **Background Processing** wie Google
- ✅ **Status Tracking** für User Experience
- ✅ **Audit Trail** für Compliance
- ✅ **Keine Änderung** an 500+ Queries
- ✅ **In 1-2 Wochen** implementierbar

Das ist die BESTE Lösung für ein professionelles Multi-Tenant SaaS System!