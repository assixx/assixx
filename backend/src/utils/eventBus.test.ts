import { describe, expect, it, vi } from 'vitest';

import { eventBus } from './eventBus.js';

vi.mock('./logger.js', () => ({
  logger: {
    info: vi.fn(),
  },
}));

describe('eventBus', () => {
  it('should be a singleton instance', async () => {
    // Re-import to verify same instance
    const { eventBus: eventBus2 } = await import('./eventBus.js');
    expect(eventBus).toBe(eventBus2);
  });

  describe('emitSurveyCreated', () => {
    it('should emit survey.created event', () => {
      const handler = vi.fn();
      eventBus.on('survey.created', handler);
      eventBus.emitSurveyCreated(10, { id: 1, title: 'Q3 Survey' });
      expect(handler).toHaveBeenCalledWith({
        tenantId: 10,
        survey: { id: 1, title: 'Q3 Survey' },
      });
      eventBus.removeListener('survey.created', handler);
    });
  });

  describe('emitSurveyUpdated', () => {
    it('should emit survey.updated event', () => {
      const handler = vi.fn();
      eventBus.on('survey.updated', handler);
      eventBus.emitSurveyUpdated(10, { id: 1, title: 'Updated Survey' });
      expect(handler).toHaveBeenCalledWith({
        tenantId: 10,
        survey: { id: 1, title: 'Updated Survey' },
      });
      eventBus.removeListener('survey.updated', handler);
    });
  });

  describe('emitDocumentUploaded', () => {
    it('should emit document.uploaded event', () => {
      const handler = vi.fn();
      eventBus.on('document.uploaded', handler);
      eventBus.emitDocumentUploaded(10, { id: 1, filename: 'report.pdf' });
      expect(handler).toHaveBeenCalledWith({
        tenantId: 10,
        document: { id: 1, filename: 'report.pdf' },
      });
      eventBus.removeListener('document.uploaded', handler);
    });
  });

  describe('emitKvpSubmitted', () => {
    it('should emit kvp.submitted event', () => {
      const handler = vi.fn();
      eventBus.on('kvp.submitted', handler);
      eventBus.emitKvpSubmitted(10, { id: 1, title: 'Improvement Idea' });
      expect(handler).toHaveBeenCalledWith({
        tenantId: 10,
        kvp: { id: 1, title: 'Improvement Idea' },
      });
      eventBus.removeListener('kvp.submitted', handler);
    });
  });

  describe('emitNewMessage', () => {
    it('should emit message.created event', () => {
      const handler = vi.fn();
      eventBus.on('message.created', handler);
      const message = {
        id: 1,
        uuid: 'uuid-123',
        conversationId: 5,
        senderId: 2,
        recipientIds: [3, 4],
        preview: 'Hello!',
      };
      eventBus.emitNewMessage(10, message);
      expect(handler).toHaveBeenCalledWith({
        tenantId: 10,
        message,
      });
      eventBus.removeListener('message.created', handler);
    });
  });

  describe('getListenerCount', () => {
    it('should return 0 for events with no listeners', () => {
      expect(eventBus.getListenerCount('nonexistent.event')).toBe(0);
    });

    it('should return correct count for events with listeners', () => {
      const handler = vi.fn();
      eventBus.on('test.event', handler);
      expect(eventBus.getListenerCount('test.event')).toBe(1);
      eventBus.removeListener('test.event', handler);
    });
  });

  describe('getActiveEvents', () => {
    it('should return an array of strings', () => {
      const events = eventBus.getActiveEvents();
      expect(Array.isArray(events)).toBe(true);
    });
  });
});
