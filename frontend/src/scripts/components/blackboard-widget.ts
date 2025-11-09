/**
 * Blackboard Widget Component
 * Dashboard widget for displaying recent blackboard entries
 *
 * Migrated from common.ts as part of unified-navigation refactoring
 */

import type { BlackboardEntry } from '../../types/api.types';
import { apiClient } from '../../utils/api-client';
import { setHTML } from '../../utils/dom-utils';
import { formatDate } from '../../utils/date-helpers';
import { getAuthToken } from '../auth/index';

/**
 * Escape HTML to prevent XSS
 * Re-export from dom-utils for convenience
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Create blackboard preview widget HTML
 * Returns HTML string for dashboard widget
 *
 * @returns HTML string for blackboard widget
 */
export function createBlackboardWidget(): string {
  return `
    <div class="card shadow-sm">
      <div class="card-header bg-info text-white">
        <h5 class="mb-0">
          <i class="fas fa-clipboard-list me-2"></i>Schwarzes Brett
        </h5>
      </div>
      <div class="card-body">
        <div id="blackboard-items" class="list-group list-group-flush">
          <div class="text-center">
            <div class="spinner-border spinner-border-sm" role="status">
              <span class="visually-hidden">Lade...</span>
            </div>
          </div>
        </div>
        <div class="mt-3">
          <a href="/blackboard" class="btn btn-sm btn-primary">
            <i class="fas fa-list me-1"></i>Alle Einträge anzeigen
          </a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Load blackboard preview items
 * Fetches and displays recent blackboard entries
 *
 * @returns Promise that resolves when blackboard is loaded
 */
export async function loadBlackboardPreview(): Promise<void> {
  try {
    const token = getAuthToken();
    if (token === null || token === '') return;

    // Try v2 API first, fallback to v1 if needed
    try {
      // Use API client for v2
      const response = await apiClient.request<
        BlackboardEntry[] | { data?: BlackboardEntry[]; items?: BlackboardEntry[] }
      >('/blackboard?limit=5', {
        method: 'GET',
      });

      // v2 response might have different format, adapt if needed
      const entries = Array.isArray(response)
        ? response
        : ((response as { data?: BlackboardEntry[]; items?: BlackboardEntry[] }).data ??
          (response as { data?: BlackboardEntry[]; items?: BlackboardEntry[] }).items ??
          []);
      displayBlackboardItems(entries);
    } catch (error) {
      console.error('Error loading blackboard (v2):', error);
      // Fallback to v1 API
      try {
        const response = await fetch('/api/blackboard?limit=5', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const entries = (await response.json()) as BlackboardEntry[];
          displayBlackboardItems(entries);
        }
      } catch (fallbackError) {
        console.error('Error loading blackboard (v1):', fallbackError);
      }
    }
  } catch (error) {
    console.error('Error loading blackboard:', error);
  }
}

/**
 * Display blackboard items in the widget
 * Renders blackboard entries as list items
 *
 * @param entries - Array of blackboard entries
 */
function displayBlackboardItems(entries: BlackboardEntry[]): void {
  const container = document.querySelector('#blackboard-items');
  if (!container || !(container instanceof HTMLElement)) return;

  if (entries.length === 0) {
    setHTML(container, '<p class="text-muted">Keine Einträge vorhanden.</p>');
    return;
  }

  setHTML(
    container,
    entries
      .map(
        (entry) => `
        <a href="/blackboard.html#entry-${entry.id}" class="list-group-item list-group-item-action">
          <div class="d-flex w-100 justify-content-between">
            <h6 class="mb-1">${escapeHtml(entry.title)}</h6>
            <small class="text-muted">${formatDate(entry.created_at)}</small>
          </div>
          <p class="mb-1 text-truncate">${escapeHtml(entry.content)}</p>
          <small class="text-muted">von ${entry.created_by_name ?? 'Unbekannt'}</small>
        </a>
      `,
      )
      .join(''),
  );
}

// Make functions globally available for backwards compatibility
declare global {
  interface Window {
    createBlackboardWidget?: typeof createBlackboardWidget;
    loadBlackboardPreview?: typeof loadBlackboardPreview;
  }
}

if (typeof window !== 'undefined') {
  window.createBlackboardWidget = createBlackboardWidget;
  window.loadBlackboardPreview = loadBlackboardPreview;
}
