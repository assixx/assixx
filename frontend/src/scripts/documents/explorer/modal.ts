/**
 * Documents Explorer - Preview Modal Module
 *
 * Handles document preview modal with PDF viewer
 * Shows document metadata and download button
 *
 * @module explorer/modal
 */

import type { Document } from './types';
import { stateManager } from './state';
import { tokenManager } from '../../../utils/token-manager';

/**
 * Preview Modal Manager
 * Manages document preview modal interactions
 */
class PreviewModalManager {
  private modalEl: HTMLElement | null = null;
  private closeBtn: HTMLButtonElement | null = null;
  private cancelBtn: HTMLButtonElement | null = null;
  private iframeEl: HTMLIFrameElement | null = null;
  private titleEl: HTMLElement | null = null;
  private sizeEl: HTMLElement | null = null;
  private dateEl: HTMLElement | null = null;
  private uploaderEl: HTMLElement | null = null;
  private downloadBtn: HTMLButtonElement | null = null;

  /**
   * Initialize preview modal
   */
  public init(): void {
    this.modalEl = document.getElementById('preview-modal');
    this.closeBtn = document.getElementById('preview-close') as HTMLButtonElement;
    this.cancelBtn = document.getElementById('preview-cancel') as HTMLButtonElement;
    this.iframeEl = document.getElementById('preview-iframe') as HTMLIFrameElement;
    this.titleEl = document.getElementById('preview-title');
    this.sizeEl = document.getElementById('preview-size');
    this.dateEl = document.getElementById('preview-date');
    this.uploaderEl = document.getElementById('preview-uploader');
    this.downloadBtn = document.getElementById('preview-download') as HTMLButtonElement;

    if (!this.modalEl) {
      console.error('Preview modal not found');
      return;
    }

    // Attach event listeners
    this.attachEventListeners();

    // Subscribe to state changes
    stateManager.subscribe((state) => {
      if (state.selectedDocument) {
        this.show(state.selectedDocument);
      } else {
        this.hide();
      }
    });
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Close button
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => {
        this.close();
      });
    }

    // Cancel button
    if (this.cancelBtn) {
      this.cancelBtn.addEventListener('click', () => {
        this.close();
      });
    }

    // Close on overlay click
    if (this.modalEl) {
      this.modalEl.addEventListener('click', (e) => {
        if (e.target === this.modalEl) {
          this.close();
        }
      });
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalEl?.classList.contains('modal-overlay--active') === true) {
        this.close();
      }
    });

    // Download button
    if (this.downloadBtn) {
      this.downloadBtn.addEventListener('click', () => {
        const state = stateManager.getState();
        if (state.selectedDocument) {
          this.downloadDocument(state.selectedDocument);
        }
      });
    }
  }

  /**
   * Show modal with document
   */
  private show(doc: Document): void {
    if (!this.modalEl) return;

    // Update modal content
    this.updateModalContent(doc);

    // Load PDF in iframe
    this.loadPDF(doc);

    // Show modal using Design System pattern
    this.modalEl.classList.add('modal-overlay--active');

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  /**
   * Hide modal
   */
  private hide(): void {
    if (!this.modalEl) return;

    // Hide modal using Design System pattern
    this.modalEl.classList.remove('modal-overlay--active');

    // Clear iframe
    if (this.iframeEl) {
      this.iframeEl.src = '';
    }

    // Restore body scroll
    document.body.style.overflow = '';
  }

  /**
   * Close modal and clear selected document
   */
  private close(): void {
    stateManager.setSelectedDocument(null);
  }

  /**
   * Update modal content with document data
   */
  private updateModalContent(doc: Document): void {
    // Title
    if (this.titleEl) {
      this.titleEl.textContent = doc.filename;
    }

    // Size (update inner span)
    if (this.sizeEl) {
      const textSpan = this.sizeEl.querySelector('span');
      if (textSpan) {
        textSpan.textContent = this.formatFileSize(doc.size);
      }
    }

    // Date (update inner span)
    if (this.dateEl) {
      const textSpan = this.dateEl.querySelector('span');
      if (textSpan) {
        textSpan.textContent = this.formatDate(doc.uploadedAt);
      }
    }

    // Uploader (update inner span)
    if (this.uploaderEl) {
      const textSpan = this.uploaderEl.querySelector('span');
      if (textSpan) {
        textSpan.textContent = doc.uploaderName;
      }
    }
  }

  /**
   * Load PDF in iframe
   */
  private loadPDF(doc: Document): void {
    if (!this.iframeEl) return;

    // Use preview URL if available, otherwise download URL
    const baseUrl = doc.previewUrl ?? doc.downloadUrl;

    // Append access token as query parameter for iframe auth
    // (iframes cannot send Authorization headers)
    const token = tokenManager.getAccessToken();
    const pdfUrl = token !== null ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl;

    // Load PDF with viewer
    // Most browsers will use their built-in PDF viewer
    this.iframeEl.src = pdfUrl;

    // Handle load errors
    this.iframeEl.onerror = () => {
      console.error('Failed to load PDF preview');
      // Could show error message in modal
    };
  }

  /**
   * Download document
   */
  private downloadDocument(doc: Document): void {
    // Append access token as query parameter (link href can't send headers)
    const token = tokenManager.getAccessToken();
    const downloadUrl = token !== null ? `${doc.downloadUrl}?token=${encodeURIComponent(token)}` : doc.downloadUrl;

    // Create temporary link and trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = doc.filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // Safe: i is bounded by sizes array length
    // eslint-disable-next-line security/detect-object-injection
    const sizeLabel = sizes[i] ?? 'Bytes';
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizeLabel}`;
  }

  /**
   * Format date for display
   */
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

// Singleton instance
export const previewModalManager = new PreviewModalManager();

// Export type for testing/mocking
export type { PreviewModalManager };
