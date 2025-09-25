/**
 * Blackboard Module
 * Re-exports functionality from split modules for backward compatibility
 */

// Re-export all types
export * from './types';

// Re-export UI helpers
export {
  openModal,
  closeModal,
  previewAttachment,
  setupCloseButtons,
  openDirectAttachModal,
  setupDirectAttachHandlers,
  handleDirectAttachFile,
  clearDirectAttachment,
  saveDirectAttachment,
  setupZoomControls,
  setupFullscreenControls,
  openPdfInNewTab,
  buildAttachmentItem,
  buildAttachmentsSection,
  setupAttachmentHandlers,
  formatFileSize,
  formatDate,
  directAttachHandlers,
  exitFullscreen,
} from './ui-helpers';

// Import and initialize core functionality
import './core';
