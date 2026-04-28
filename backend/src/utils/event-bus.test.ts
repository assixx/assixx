import { describe, expect, it, vi } from 'vitest';

import { eventBus } from './event-bus.js';

vi.mock('./logger.js', () => ({
  logger: {
    info: vi.fn(),
  },
}));

describe('eventBus', () => {
  it('should be a singleton instance', async () => {
    // Re-import to verify same instance
    const { eventBus: eventBus2 } = await import('./event-bus.js');
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

  // Root Self-Termination Events — Step 2.7 of FEAT_ROOT_ACCOUNT_PROTECTION.
  // 3 typed events that fan out to peer roots; expired remains untyped (cron only).
  describe('emitRootSelfTerminationRequested', () => {
    it('should emit root.self-termination.requested event with full payload', () => {
      const handler = vi.fn();
      eventBus.on('root.self-termination.requested', handler);
      const request = { id: 'req-uuid-1', requesterId: 42, requesterName: 'Alice Root' };
      const expiresAt = '2026-05-04T00:00:00.000Z';
      eventBus.emitRootSelfTerminationRequested(7, request, expiresAt);
      expect(handler).toHaveBeenCalledWith({
        tenantId: 7,
        request,
        expiresAt,
      });
      eventBus.removeListener('root.self-termination.requested', handler);
    });
  });

  describe('emitRootSelfTerminationApproved', () => {
    it('should emit root.self-termination.approved event with approver + comment', () => {
      const handler = vi.fn();
      eventBus.on('root.self-termination.approved', handler);
      const request = { id: 'req-uuid-2', requesterId: 42, requesterName: 'Alice Root' };
      eventBus.emitRootSelfTerminationApproved(7, request, 99, 'Bob Root', 'Approved.');
      expect(handler).toHaveBeenCalledWith({
        tenantId: 7,
        request,
        approverId: 99,
        approverName: 'Bob Root',
        comment: 'Approved.',
      });
      eventBus.removeListener('root.self-termination.approved', handler);
    });

    it('should pass null comment through unchanged', () => {
      const handler = vi.fn();
      eventBus.on('root.self-termination.approved', handler);
      const request = { id: 'req-uuid-3', requesterId: 42, requesterName: 'Alice Root' };
      eventBus.emitRootSelfTerminationApproved(7, request, 99, 'Bob Root', null);
      expect(handler).toHaveBeenCalledWith({
        tenantId: 7,
        request,
        approverId: 99,
        approverName: 'Bob Root',
        comment: null,
      });
      eventBus.removeListener('root.self-termination.approved', handler);
    });
  });

  describe('emitRootSelfTerminationRejected', () => {
    it('should emit root.self-termination.rejected event with reason + cooldown', () => {
      const handler = vi.fn();
      eventBus.on('root.self-termination.rejected', handler);
      const request = { id: 'req-uuid-4', requesterId: 42, requesterName: 'Alice Root' };
      const cooldownEndsAt = '2026-04-28T03:00:00.000Z';
      eventBus.emitRootSelfTerminationRejected(
        7,
        request,
        99,
        'Bob Root',
        'Insufficient justification.',
        cooldownEndsAt,
      );
      expect(handler).toHaveBeenCalledWith({
        tenantId: 7,
        request,
        approverId: 99,
        approverName: 'Bob Root',
        rejectionReason: 'Insufficient justification.',
        cooldownEndsAt,
      });
      eventBus.removeListener('root.self-termination.rejected', handler);
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
