import { describe, expect, it } from 'vitest';

import type { ExportableEvent } from './calendar-export.utils.js';
import { generateCsvExport, generateIcsExport } from './calendar-export.utils.js';

// ============================================================================
// MOCK DATA
// ============================================================================

function createMockEvent(overrides?: Partial<ExportableEvent>): ExportableEvent {
  return {
    id: 1,
    title: 'Team Meeting',
    description: null,
    location: null,
    start_date: new Date('2025-06-15T09:00:00Z'),
    end_date: new Date('2025-06-15T10:00:00Z'),
    status: null,
    ...overrides,
  };
}

// ============================================================================
// ICS EXPORT
// ============================================================================

describe('generateIcsExport', () => {
  it('should generate valid ICS calendar with header and footer', () => {
    const result = generateIcsExport([]);
    expect(result).toContain('BEGIN:VCALENDAR');
    expect(result).toContain('VERSION:2.0');
    expect(result).toContain('PRODID:-//Assixx//Calendar//EN');
    expect(result).toContain('END:VCALENDAR');
  });

  it('should use CRLF line endings', () => {
    const result = generateIcsExport([]);
    expect(result).toContain('\r\n');
  });

  it('should include VEVENT block for each event', () => {
    const events = [createMockEvent(), createMockEvent({ id: 2, title: 'Standup' })];
    const result = generateIcsExport(events);

    const beginCount = (result.match(/BEGIN:VEVENT/g) ?? []).length;
    const endCount = (result.match(/END:VEVENT/g) ?? []).length;
    expect(beginCount).toBe(2);
    expect(endCount).toBe(2);
  });

  it('should include UID with event id', () => {
    const result = generateIcsExport([createMockEvent({ id: 42 })]);
    expect(result).toContain('UID:42@assixx');
  });

  it('should format dates in ICS format (YYYYMMDDTHHMMSSZ)', () => {
    const result = generateIcsExport([createMockEvent()]);
    // 2025-06-15T09:00:00.000Z → 20250615T090000Z
    expect(result).toContain('DTSTART:20250615T090000Z');
    expect(result).toContain('DTEND:20250615T100000Z');
  });

  it('should include SUMMARY with event title', () => {
    const result = generateIcsExport([createMockEvent({ title: 'Board Meeting' })]);
    expect(result).toContain('SUMMARY:Board Meeting');
  });

  it('should include DESCRIPTION when non-null and non-empty', () => {
    const result = generateIcsExport([createMockEvent({ description: 'Discuss Q3 goals' })]);
    expect(result).toContain('DESCRIPTION:Discuss Q3 goals');
  });

  it('should NOT include DESCRIPTION when null', () => {
    const result = generateIcsExport([createMockEvent({ description: null })]);
    expect(result).not.toContain('DESCRIPTION:');
  });

  it('should NOT include DESCRIPTION when empty string', () => {
    const result = generateIcsExport([createMockEvent({ description: '' })]);
    expect(result).not.toContain('DESCRIPTION:');
  });

  it('should include LOCATION when non-null and non-empty', () => {
    const result = generateIcsExport([createMockEvent({ location: 'Room 101' })]);
    expect(result).toContain('LOCATION:Room 101');
  });

  it('should NOT include LOCATION when null', () => {
    const result = generateIcsExport([createMockEvent({ location: null })]);
    expect(result).not.toContain('LOCATION:');
  });
});

// ============================================================================
// CSV EXPORT
// ============================================================================

describe('generateCsvExport', () => {
  it('should include CSV headers', () => {
    const result = generateCsvExport([]);
    expect(result).toBe('ID,Title,Start,End,Location,Description,Status');
  });

  it('should include event data rows', () => {
    const result = generateCsvExport([createMockEvent()]);
    const lines = result.split('\n');
    expect(lines).toHaveLength(2); // header + 1 data row
  });

  it('should include event ID as first column', () => {
    const result = generateCsvExport([createMockEvent({ id: 42 })]);
    const dataLine = result.split('\n')[1];
    expect(dataLine).toMatch(/^42,/);
  });

  it('should quote title and escape double quotes', () => {
    const event = createMockEvent({ title: 'Meeting "Important"' });
    const result = generateCsvExport([event]);
    expect(result).toContain('"Meeting ""Important"""');
  });

  it('should use ISO date format for start and end dates', () => {
    const result = generateCsvExport([createMockEvent()]);
    expect(result).toContain('2025-06-15T09:00:00.000Z');
    expect(result).toContain('2025-06-15T10:00:00.000Z');
  });

  it('should handle null location as empty string', () => {
    const result = generateCsvExport([createMockEvent({ location: null })]);
    const dataLine = result.split('\n')[1];
    expect(dataLine).toContain('""');
  });

  it('should handle null description as empty string', () => {
    const result = generateCsvExport([createMockEvent({ description: null })]);
    const dataLine = result.split('\n')[1];
    // Two consecutive quoted empty strings for location and description
    expect(dataLine).toContain('""');
  });

  it('should default status to confirmed when null', () => {
    const result = generateCsvExport([createMockEvent({ status: null })]);
    expect(result).toContain('confirmed');
  });

  it('should use actual status when provided', () => {
    const result = generateCsvExport([createMockEvent({ status: 'cancelled' })]);
    expect(result).toContain('cancelled');
  });

  it('should handle multiple events', () => {
    const events = [
      createMockEvent({ id: 1, title: 'Event A' }),
      createMockEvent({ id: 2, title: 'Event B' }),
      createMockEvent({ id: 3, title: 'Event C' }),
    ];
    const result = generateCsvExport(events);
    const lines = result.split('\n');
    expect(lines).toHaveLength(4); // header + 3 data rows
  });
});
