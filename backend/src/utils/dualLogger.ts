/**
 * Dual Logger Utility
 * Logs to both activity_logs (for frontend) and root_logs (for audit)
 */
import RootLog from '../models/rootLog';
import { createLog } from '../routes/logs';

interface DualLogOptions {
  // Common fields
  tenantId: number;
  userId: number;
  action: string;
  entityType: string;
  entityId?: number;
  ipAddress?: string;
  userAgent?: string;

  // For activity_logs
  details?: string;

  // For root_logs
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  wasRoleSwitched?: boolean;
}

/**
 * Log to both activity_logs and root_logs
 */
export async function dualLog(options: DualLogOptions): Promise<void> {
  const {
    tenantId,
    userId,
    action,
    entityType,
    entityId,
    ipAddress,
    userAgent,
    details,
    oldValues,
    newValues,
    wasRoleSwitched = false,
  } = options;

  // 1. Log to activity_logs for frontend display
  await createLog(
    userId,
    tenantId,
    action,
    entityType,
    entityId,
    details ?? `${action} ${entityType}`,
    ipAddress,
    userAgent,
  );

  // 2. Log to root_logs for detailed audit
  await RootLog.create({
    tenant_id: tenantId,
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_values: oldValues,
    new_values: newValues,
    ip_address: ipAddress,
    user_agent: userAgent,
    was_role_switched: wasRoleSwitched,
  });
}

/**
 * Helper to generate action details in German
 */
export function getActionDetails(
  action: string,
  entityType: string,
  data?: Record<string, unknown>,
): string {
  const actionMap: Record<string, string> = {
    // Auth
    login: 'Angemeldet',
    logout: 'Abgemeldet',
    register: 'Registriert',

    // CRUD
    create: 'Erstellt',
    update: 'Aktualisiert',
    delete: 'Gelöscht',

    // Specific actions
    upload: 'Hochgeladen',
    download: 'Heruntergeladen',
    archive: 'Archiviert',
    unarchive: 'Wiederhergestellt',
    approve: 'Genehmigt',
    reject: 'Abgelehnt',
    assign: 'Zugewiesen',
    unassign: 'Zuweisung aufgehoben',

    // Team/Group
    add_member: 'Mitglied hinzugefügt',
    remove_member: 'Mitglied entfernt',

    // Messages
    send_message: 'Nachricht gesendet',

    // Events
    create_event: 'Termin erstellt',
    update_event: 'Termin aktualisiert',
    delete_event: 'Termin gelöscht',

    // Points
    award_points: 'Punkte vergeben',
  };

  const entityMap: Record<string, string> = {
    user: 'Benutzer',
    document: 'Dokument',
    department: 'Abteilung',
    team: 'Team',
    area: 'Bereich',
    blackboard_entry: 'Schwarzes Brett Eintrag',
    calendar_event: 'Kalenderereignis',
    kvp_suggestion: 'KVP-Vorschlag',
    kvp_comment: 'KVP-Kommentar',
    kvp_points: 'KVP-Punkte',
    chat_conversation: 'Chat-Unterhaltung',
    chat_message: 'Chat-Nachricht',
    tenant: 'Mandant',
  };

  const actionText = actionMap[action] ?? action;
  const entityText = entityMap[entityType] ?? entityType;

  // Build detail string
  let details = `${actionText}: ${entityText}`;

  // Add specific data if available
  if (data != null) {
    const name = data.name;
    const title = data.title;
    const email = data.email;
    const filename = data.filename;

    if (name != null && name !== '' && (typeof name === 'string' || typeof name === 'number'))
      details += ` - ${String(name)}`;
    else if (
      title != null &&
      title !== '' &&
      (typeof title === 'string' || typeof title === 'number')
    )
      details += ` - ${String(title)}`;
    else if (
      email != null &&
      email !== '' &&
      (typeof email === 'string' || typeof email === 'number')
    )
      details += ` - ${String(email)}`;
    else if (
      filename != null &&
      filename !== '' &&
      (typeof filename === 'string' || typeof filename === 'number')
    )
      details += ` - ${String(filename)}`;
  }

  return details;
}
