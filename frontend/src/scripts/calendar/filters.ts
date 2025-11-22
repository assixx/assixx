/**
 * Calendar Filters Module
 * Handles event filtering, search, and calendar view switching
 * Integrates with state management and calendar instance
 */

import type { Calendar } from '@fullcalendar/core';
import { $$, $all, $$id } from '../../utils/dom-utils';
import { state } from './state';
import type { FilterLevel, ViewMode } from './types';

// ============================================================================
// Filter Management
// ============================================================================

/**
 * Update filter button active state
 * Removes 'active' from all buttons, adds to selected button
 */
function updateFilterButtonState(buttons: NodeListOf<Element>, activeButton: Element): void {
  buttons.forEach((btn) => {
    btn.classList.remove('active');
  });
  activeButton.classList.add('active');
}

/**
 * Handle filter change
 * Updates state, localStorage, and refetches calendar events
 */
function handleFilterChange(value: string, calendar: Calendar): void {
  state.currentFilter = value as FilterLevel;
  localStorage.setItem('calendarFilter', state.currentFilter);
  console.info('[CALENDAR FILTERS] Filter changed to:', state.currentFilter);
  calendar.refetchEvents();
}

/**
 * Setup level filter buttons (v2 UI)
 * Modern toggle-style buttons for filtering by organization level
 */
export function setupLevelFilterButtons(calendar: Calendar): void {
  // IMPORTANT: Exclude the Schichten button - it's not a filter, it's an overlay toggle
  const levelFilterButtons = $all(
    '#levelFilter button.toggle-group__btn:not(#showShiftsToggle)',
  ) as NodeListOf<HTMLButtonElement>;

  if (levelFilterButtons.length === 0) {
    console.info('[CALENDAR FILTERS] No level filter buttons found (v2 UI)');
    return;
  }

  levelFilterButtons.forEach((button) => {
    // Set initial active state based on saved filter
    button.classList.toggle('active', button.dataset.value === state.currentFilter);

    button.addEventListener('click', function (this: HTMLButtonElement) {
      // Only update state for organization filter buttons, not the shifts toggle
      updateFilterButtonState(levelFilterButtons, this);
      handleFilterChange(this.dataset.value ?? 'all', calendar);
    });
  });

  console.info('[CALENDAR FILTERS] Level filter buttons initialized (excluding Schichten toggle)');
}

/**
 * Setup legacy filter pills (v1 UI)
 * For backward compatibility with older calendar pages
 */
export function setupLegacyFilterPills(calendar: Calendar): void {
  const filterPills = $all('.filter-pill[data-value]');

  if (filterPills.length === 0) {
    console.info('[CALENDAR FILTERS] No legacy filter pills found (v1 UI)');
    return;
  }

  filterPills.forEach((button) => {
    button.addEventListener('click', function (this: HTMLElement) {
      updateFilterButtonState(filterPills, this);
      handleFilterChange(this.dataset.value ?? 'all', calendar);
    });
  });

  console.info('[CALENDAR FILTERS] Legacy filter pills initialized');
}

// ============================================================================
// View Switching
// ============================================================================

/**
 * Update view button states
 * Applies active styling to selected view button
 */
function updateViewButtonStates(activeButton: HTMLElement): void {
  // For toggle-group buttons, only handle 'active' class
  const viewSelector = $$id('view-selector');
  if (viewSelector?.classList.contains('toggle-group') === true) {
    $all('#view-selector .toggle-group__btn').forEach((btn) => {
      btn.classList.remove('active');
    });
    activeButton.classList.add('active');
  } else {
    // Legacy behavior for old view-selector
    $all('.view-selector button').forEach((btn) => {
      btn.classList.remove('active', 'btn-primary');
      btn.classList.add('btn-outline-primary');
    });
    activeButton.classList.add('active', 'btn-primary');
    activeButton.classList.remove('btn-outline-primary');
  }
}

/**
 * Setup view buttons (v2 UI)
 * Modern button group for switching calendar views
 */
export function setupViewButtons(calendar: Calendar): void {
  const viewButtons = [
    { id: 'monthView', view: 'dayGridMonth' as ViewMode },
    { id: 'weekView', view: 'timeGridWeek' as ViewMode },
    { id: 'dayView', view: 'timeGridDay' as ViewMode },
    { id: 'listView', view: 'listWeek' as ViewMode },
  ];

  let foundButtons = 0;

  viewButtons.forEach(({ id, view }) => {
    const button = $$id(id);
    if (button === null) return;

    foundButtons++;

    button.addEventListener('click', () => {
      console.info('[CALENDAR FILTERS] Changing view to:', view);
      state.calendarView = view;
      calendar.changeView(view);
      updateViewButtonStates(button);
    });
  });

  if (foundButtons === 0) {
    console.info('[CALENDAR FILTERS] No view buttons found (v2 UI)');
  } else {
    console.info(`[CALENDAR FILTERS] ${foundButtons} view buttons initialized`);
  }
}

/**
 * Setup legacy view buttons (v1 UI)
 * For backward compatibility with older calendar pages
 */
export function setupLegacyViewButtons(calendar: Calendar): void {
  const viewButtons = $all('.view-btn');

  if (viewButtons.length === 0) {
    console.info('[CALENDAR FILTERS] No legacy view buttons found (v1 UI)');
    return;
  }

  viewButtons.forEach((button) => {
    button.addEventListener('click', function (this: HTMLElement) {
      const view = this.dataset.view;
      if (view === undefined || view === '') return;

      state.calendarView = view as ViewMode;
      calendar.changeView(view);
      updateFilterButtonState($all('.view-btn'), this);
    });
  });

  console.info(`[CALENDAR FILTERS] ${viewButtons.length} legacy view buttons initialized`);
}

// ============================================================================
// Search Functionality
// ============================================================================

/**
 * Setup search functionality
 * Allows searching calendar events by title/description
 */
export function setupSearchFunctionality(calendar: Calendar): void {
  const searchButton = $$('#searchButton');
  const searchInput = $$('#searchInput') as HTMLInputElement | null;

  if (searchButton === null || searchInput === null) {
    console.info('[CALENDAR FILTERS] Search components not found');
    return;
  }

  // Search button click handler
  searchButton.addEventListener('click', () => {
    const searchQuery = searchInput.value.trim();
    console.info('[CALENDAR FILTERS] Search triggered:', searchQuery);
    state.currentSearch = searchQuery;
    calendar.refetchEvents();
  });

  // Search input Enter key handler
  searchInput.addEventListener('keypress', function (this: HTMLInputElement, e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    const searchQuery = this.value.trim();
    console.info('[CALENDAR FILTERS] Search triggered (Enter key):', searchQuery);
    state.currentSearch = searchQuery;
    calendar.refetchEvents();
  });

  console.info('[CALENDAR FILTERS] Search functionality initialized');
}

// ============================================================================
// Initialize All Filters
// ============================================================================

/**
 * Initialize all filter, view, and search controls
 * Call this after calendar is initialized
 */
export function initializeFilters(calendar: Calendar): void {
  console.info('[CALENDAR FILTERS] Initializing all filter controls...');

  // Setup filter buttons (try both v1 and v2 UI)
  setupLevelFilterButtons(calendar);
  setupLegacyFilterPills(calendar);

  // Setup view buttons (try both v1 and v2 UI)
  setupViewButtons(calendar);
  setupLegacyViewButtons(calendar);

  // Setup search
  setupSearchFunctionality(calendar);

  console.info('[CALENDAR FILTERS] All filter controls initialized');
}
