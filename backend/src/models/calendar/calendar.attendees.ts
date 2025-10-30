/**
 * Calendar Attendee Operations
 * Handles attendee management for calendar events
 */
import { ResultSetHeader, query as executeQuery } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { DbCalendarEvent, DbEventAttendee } from './calendar.types.js';

/**
 * Add an attendee to a calendar event
 */
export async function addEventAttendee(
  eventId: number,
  userId: number,
  responseStatus: 'pending' | 'accepted' | 'declined' | 'tentative' = 'pending',
  tenantIdParam?: number,
): Promise<boolean> {
  try {
    // Check if already an attendee
    const [attendees] = await executeQuery<DbEventAttendee[]>(
      'SELECT * FROM calendar_attendees WHERE event_id = ? AND user_id = ?',
      [eventId, userId],
    );

    if (attendees.length > 0) {
      // Update existing attendee status
      await executeQuery(
        'UPDATE calendar_attendees SET response_status = ?, responded_at = NOW() WHERE event_id = ? AND user_id = ?',
        [responseStatus, eventId, userId],
      );
    } else {
      // Get tenant_id from event if not provided
      let finalTenantId = tenantIdParam;
      if (finalTenantId == null || finalTenantId === 0) {
        const [event] = await executeQuery<DbCalendarEvent[]>(
          'SELECT tenant_id FROM calendar_events WHERE id = ?',
          [eventId],
        );
        if (event.length > 0) {
          finalTenantId = event[0].tenant_id;
        }
      }

      // Add new attendee with tenant_id
      await executeQuery(
        'INSERT INTO calendar_attendees (event_id, user_id, response_status, responded_at, tenant_id) VALUES (?, ?, ?, NOW(), ?)',
        [eventId, userId, responseStatus, finalTenantId],
      );
    }

    return true;
  } catch (error: unknown) {
    logger.error('Error in addEventAttendee:', error);
    throw error;
  }
}

/**
 * Remove an attendee from a calendar event
 */
export async function removeEventAttendee(eventId: number, userId: number): Promise<boolean> {
  try {
    // Remove attendee
    const query = 'DELETE FROM calendar_attendees WHERE event_id = ? AND user_id = ?';
    const [result] = await executeQuery<ResultSetHeader>(query, [eventId, userId]);

    return result.affectedRows > 0;
  } catch (error: unknown) {
    logger.error('Error in removeEventAttendee:', error);
    throw error;
  }
}

/**
 * User responds to a calendar event
 */
export async function respondToEvent(
  eventId: number,
  userId: number,
  response: string,
): Promise<boolean> {
  try {
    // Validate response
    const validResponses = ['accepted', 'declined', 'tentative'];
    if (!validResponses.includes(response)) {
      throw new Error('Invalid response status');
    }

    // Update response
    return await addEventAttendee(
      eventId,
      userId,
      response as 'accepted' | 'declined' | 'tentative',
    );
  } catch (error: unknown) {
    logger.error('Error in respondToEvent:', error);
    throw error;
  }
}

/**
 * Get attendees for a calendar event
 */
export async function getEventAttendees(
  eventId: number,
  tenantId: number,
): Promise<DbEventAttendee[]> {
  try {
    const query = `
        SELECT a.user_id, a.response_status, a.responded_at,
               u.username, u.first_name, u.last_name, u.email, u.profile_picture
        FROM calendar_attendees a
        JOIN users u ON a.user_id = u.id
        JOIN calendar_events e ON a.event_id = e.id
        WHERE a.event_id = ? AND e.tenant_id = ?
        ORDER BY u.first_name, u.last_name
      `;

    const [attendees] = await executeQuery<DbEventAttendee[]>(query, [eventId, tenantId]);
    return attendees;
  } catch (error: unknown) {
    logger.error('Error in getEventAttendees:', error);
    throw error;
  }
}
