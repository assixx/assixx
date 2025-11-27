/**
 * Zoom Controls for Blackboard
 * Handles zoom functionality, filter toggle, and keyboard shortcuts
 */

import { $$id } from '../../utils/dom-utils';

// Zoom configuration constants
const ZOOM_DEFAULT = 100; // Default zoom level (100%)
const ZOOM_STEP = 10; // Zoom increment (10%)
const ZOOM_MAX = 120; // Maximum zoom (120%)
const ZOOM_MIN = 10; // Minimum zoom (10%)
const STORAGE_KEY = 'blackboard-zoom';
const FULLSCREEN_MODE_CLASS = 'fullscreen-mode'; // CSS class for fullscreen mode

/**
 * Zoom Controls Manager
 * Manages zoom level, filter toggle, and keyboard shortcuts
 */
class ZoomControls {
  private currentZoom: number = ZOOM_DEFAULT;
  private zoomLevelElement: HTMLElement | null = null;
  private containerElement: HTMLElement | null = null;
  private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

  /**
   * Initialize zoom controls
   */
  public init(): void {
    this.zoomLevelElement = $$id('zoomLevel');
    this.containerElement = $$id('blackboardContainer');

    if (!this.zoomLevelElement || !this.containerElement) {
      console.warn('[ZoomControls] Required elements not found');
      return;
    }

    // Initialize zoom from localStorage or use default
    const savedZoom = localStorage.getItem(STORAGE_KEY);
    if (savedZoom !== null && savedZoom !== '') {
      this.updateZoom(Number.parseInt(savedZoom, 10));
    } else {
      // Apply default zoom on first load
      this.updateZoom(ZOOM_DEFAULT);
    }

    // Setup event listeners
    this.setupZoomButtons();
    this.setupFilterToggle();
    this.setupFullscreenButton();
    this.setupKeyboardShortcuts();

    console.info('[ZoomControls] Initialized');
  }

  /**
   * Setup zoom button event listeners
   */
  private setupZoomButtons(): void {
    const zoomInBtn = $$id('zoomInBtn');
    const zoomOutBtn = $$id('zoomOutBtn');

    if (zoomInBtn !== null) {
      zoomInBtn.addEventListener('click', () => {
        this.updateZoom(this.currentZoom + ZOOM_STEP);
      });
    }

    if (zoomOutBtn !== null) {
      zoomOutBtn.addEventListener('click', () => {
        this.updateZoom(this.currentZoom - ZOOM_STEP);
      });
    }
  }

  /**
   * Setup filter toggle functionality
   */
  private setupFilterToggle(): void {
    const filterToggle = $$id('filterToggle');
    const filterContent = $$id('filterContent');
    const filterToggleIcon = $$id('filterToggleIcon');

    if (!filterToggle || !filterContent || !filterToggleIcon) {
      console.warn('[ZoomControls] Filter toggle elements not found');
      return;
    }

    filterToggle.addEventListener('click', () => {
      const isHidden = filterContent.style.display === 'none' || filterContent.style.display === '';

      if (isHidden) {
        filterContent.style.display = 'block';
        filterToggleIcon.style.transform = 'rotate(180deg)';
      } else {
        filterContent.style.display = 'none';
        filterToggleIcon.style.transform = 'rotate(0deg)';
      }
    });
  }

  /**
   * Setup fullscreen button
   * Pattern from calendar.html - Native Browser Fullscreen API
   */
  private setupFullscreenButton(): void {
    const fullscreenBtn = $$id('fullscreenBtn');

    if (fullscreenBtn !== null) {
      fullscreenBtn.addEventListener('click', () => {
        void this.requestFullscreenMode();
      });
      console.info('[ZoomControls] Fullscreen button handler attached');
    }

    // Handle native fullscreen change events (e.g., ESC key)
    document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
    document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange.bind(this));
    document.addEventListener('mozfullscreenchange', this.handleFullscreenChange.bind(this));
    document.addEventListener('MSFullscreenChange', this.handleFullscreenChange.bind(this));

    console.info('[ZoomControls] Fullscreen handlers attached');
  }

  /**
   * Request native browser fullscreen mode
   * Pattern from calendar.html - Shows ESC hint via browser UI
   */
  private async requestFullscreenMode(): Promise<void> {
    try {
      // Add CSS class for fullscreen styling
      document.body.classList.add(FULLSCREEN_MODE_CLASS);

      // Request native browser fullscreen (shows ESC hint)
      const elem = document.documentElement as Document['documentElement'] & {
        webkitRequestFullscreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
      };

      if ('requestFullscreen' in document.documentElement) {
        await document.documentElement.requestFullscreen();
      } else if (elem.webkitRequestFullscreen !== undefined) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen !== undefined) {
        await elem.msRequestFullscreen();
      }

      console.info('[ZoomControls] Native fullscreen mode activated');
    } catch (error) {
      console.error('[ZoomControls] Error entering fullscreen:', error);
      document.body.classList.remove(FULLSCREEN_MODE_CLASS);
    }
  }

  /**
   * Handle native fullscreen change events (e.g., ESC key)
   */
  private handleFullscreenChange(): void {
    const isFullscreen = !!(
      document.fullscreenElement ??
      (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ??
      (document as Document & { mozFullScreenElement?: Element }).mozFullScreenElement ??
      (document as Document & { msFullscreenElement?: Element }).msFullscreenElement
    );

    if (!isFullscreen) {
      // User exited fullscreen (via ESC or browser controls)
      document.body.classList.remove(FULLSCREEN_MODE_CLASS);
      console.info('[ZoomControls] Fullscreen mode exited');
    }
  }

  /**
   * Setup keyboard shortcuts for zoom
   */
  private setupKeyboardShortcuts(): void {
    this.keyboardHandler = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return;

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        this.updateZoom(this.currentZoom + ZOOM_STEP);
      } else if (e.key === '-') {
        e.preventDefault();
        this.updateZoom(this.currentZoom - ZOOM_STEP);
      } else if (e.key === '0') {
        e.preventDefault();
        this.updateZoom(ZOOM_DEFAULT); // Reset to default (70%)
      }
    };

    document.addEventListener('keydown', this.keyboardHandler);
  }

  /**
   * Update zoom level
   * @param newZoom - New zoom level (will be clamped between min and max)
   */
  private updateZoom(newZoom: number): void {
    // Clamp zoom between min and max
    this.currentZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));

    // Update display
    if (this.zoomLevelElement !== null) {
      this.zoomLevelElement.textContent = `${this.currentZoom}%`;
    }

    // Apply CSS zoom property
    if (this.containerElement !== null) {
      this.containerElement.style.zoom = `${this.currentZoom}%`;
    }

    // Store in localStorage
    localStorage.setItem(STORAGE_KEY, this.currentZoom.toString());

    console.info(`[ZoomControls] Zoom updated to ${this.currentZoom}%`);
  }

  /**
   * Get current zoom level
   */
  public getCurrentZoom(): number {
    return this.currentZoom;
  }

  /**
   * Reset zoom to default
   */
  public resetZoom(): void {
    this.updateZoom(ZOOM_DEFAULT);
  }

  /**
   * Cleanup event listeners
   */
  public cleanup(): void {
    if (this.keyboardHandler !== null) {
      document.removeEventListener('keydown', this.keyboardHandler);
      this.keyboardHandler = null;
    }
    console.info('[ZoomControls] Cleaned up');
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const zoomControls = new ZoomControls();
  zoomControls.init();
});
