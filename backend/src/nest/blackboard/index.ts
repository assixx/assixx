/**
 * Blackboard Module Barrel Export
 */

// Module
export { BlackboardModule } from './blackboard.module.js';

// Controller
export { BlackboardController } from './blackboard.controller.js';

// Main Service (Facade)
export { BlackboardService } from './blackboard.service.js';

// Sub-Services (for testing or advanced use cases)
export { BlackboardAccessService } from './blackboard-access.service.js';
export { BlackboardAttachmentsService } from './blackboard-attachments.service.js';
export { BlackboardCommentsService } from './blackboard-comments.service.js';
export { BlackboardConfirmationsService } from './blackboard-confirmations.service.js';
export { BlackboardEntriesService } from './blackboard-entries.service.js';
export { BlackboardArchiveService } from './blackboard-archive.service.js';

// Types
export type {
  BlackboardComment,
  BlackboardEntryResponse,
  EntryFilters,
  PaginatedEntriesResult,
} from './blackboard.types.js';

// DTOs
export * from './dto/index.js';
