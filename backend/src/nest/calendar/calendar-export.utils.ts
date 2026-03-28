/**
 * Calendar Export Utilities
 *
 * Helper functions for exporting calendar events to ICS and CSV formats.
 */

/**
 * Database representation of a calendar event (minimal for export)
 */
export interface ExportableEvent {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  start_date: Date;
  end_date: Date;
  status: string | null;
}

/**
 * Format date for ICS format (YYYYMMDDTHHMMSSZ)
 */
function formatDateIcs(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Generate ICS format export
 */
export function generateIcsExport(events: ExportableEvent[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Assixx//Calendar//EN'];

  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id}@assixx`);
    lines.push(`DTSTART:${formatDateIcs(event.start_date)}`);
    lines.push(`DTEND:${formatDateIcs(event.end_date)}`);
    lines.push(`SUMMARY:${event.title}`);
    if (event.description !== null && event.description !== '') {
      lines.push(`DESCRIPTION:${event.description}`);
    }
    if (event.location !== null && event.location !== '') {
      lines.push(`LOCATION:${event.location}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Generate CSV format export
 */
export function generateCsvExport(events: ExportableEvent[]): string {
  const headers = ['ID', 'Title', 'Start', 'End', 'Location', 'Description', 'Status'];
  const rows = events.map((event: ExportableEvent) => {
    const desc = typeof event.description === 'string' ? event.description : '';
    return [
      event.id.toString(),
      `"${event.title.replace(/"/g, '""')}"`,
      event.start_date.toISOString(),
      event.end_date.toISOString(),
      `"${(event.location ?? '').replace(/"/g, '""')}"`,
      `"${desc.replace(/"/g, '""')}"`,
      event.status ?? 'confirmed',
    ];
  });

  return [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
}
