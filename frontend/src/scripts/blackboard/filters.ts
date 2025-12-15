/**
 * Blackboard Filters & Search
 * Handles filter state, search, and pagination
 * Following MANAGE pattern
 */

import { $$id } from '../../utils/dom-utils';
import { blackboardState, loadEntries } from './data';
import { renderBlackboardGrid, renderPagination, showLoadingIndicator, hideLoadingIndicator } from './ui';
import type { EntryStatus, OrgLevel, Priority } from './types';

// ============================================================================
// Filter Management
// ============================================================================

/**
 * Load entries and render UI
 * Centralized function to ensure UI is always updated after data load
 */
async function loadEntriesAndRender(): Promise<void> {
  showLoadingIndicator();
  await loadEntries();
  hideLoadingIndicator();
  renderBlackboardGrid();
  renderPagination();
}

/**
 * Update filter button state
 */
function updateFilterButtonState(buttons: NodeListOf<Element>, activeButton: Element): void {
  buttons.forEach((btn) => {
    btn.classList.remove('active');
  });
  activeButton.classList.add('active');
}

/**
 * Handle status filter change
 */
export function handleStatusFilterChange(status: EntryStatus): void {
  const state = blackboardState;

  state.updateFilterState({ status });
  state.updatePaginationState({ currentPage: 1 }); // Reset to page 1

  console.info('[Filters] Status filter changed to:', status);

  void loadEntriesAndRender();
}

/**
 * Handle org level filter change
 */
export function handleOrgLevelFilterChange(filter: 'all' | OrgLevel): void {
  const state = blackboardState;

  state.updateFilterState({ filter });
  state.updatePaginationState({ currentPage: 1 }); // Reset to page 1

  console.info('[Filters] Org level filter changed to:', filter);

  void loadEntriesAndRender();
}

/**
 * Handle priority filter change
 */
export function handlePriorityFilterChange(priority: Priority | undefined): void {
  const state = blackboardState;

  state.updateFilterState({ priority });
  state.updatePaginationState({ currentPage: 1 }); // Reset to page 1

  console.info('[Filters] Priority filter changed to:', priority);

  void loadEntriesAndRender();
}

/**
 * Handle search
 */
export function handleSearch(searchQuery: string): void {
  const state = blackboardState;

  state.updateFilterState({ search: searchQuery });
  state.updatePaginationState({ currentPage: 1 }); // Reset to page 1

  console.info('[Filters] Search query:', searchQuery);

  void loadEntriesAndRender();
}

/**
 * Handle sort change
 */
export function handleSortChange(sortBy: string, sortDir: 'ASC' | 'DESC'): void {
  const state = blackboardState;

  state.updateFilterState({ sortBy, sortDir });

  console.info('[Filters] Sort changed to:', sortBy, sortDir);

  void loadEntriesAndRender();
}

// ============================================================================
// Pagination
// ============================================================================

/**
 * Handle page change
 */
export function handlePageChange(page: number): void {
  const state = blackboardState;
  const pagination = state.getPaginationState();

  if (page < 1 || page > pagination.totalPages) return;

  state.updatePaginationState({ currentPage: page });

  console.info('[Filters] Page changed to:', page);

  void loadEntriesAndRender();
}

// ============================================================================
// Filter UI Setup
// ============================================================================

/**
 * Setup level filter buttons (toggle group in #levelFilter)
 * Following calendar pattern for consistency
 */
export function setupLevelFilterButtons(): void {
  // Specifically target #levelFilter toggle buttons - same as calendar
  const levelFilterButtons = document.querySelectorAll<HTMLButtonElement>(
    '#levelFilter button.toggle-group__btn[data-value]',
  );

  if (levelFilterButtons.length === 0) {
    console.info('[Filters] No level filter buttons found in #levelFilter');
    return;
  }

  const currentFilter = blackboardState.getFilterState().filter;

  levelFilterButtons.forEach((button) => {
    // Set initial active state based on saved filter
    button.classList.toggle('active', button.dataset['value'] === currentFilter);

    button.addEventListener('click', function (this: HTMLButtonElement) {
      const value = this.dataset['value'] as 'all' | OrgLevel | undefined;
      if (value === undefined) return;

      // Update button states
      updateFilterButtonState(levelFilterButtons, this);

      // Update state and reload
      handleOrgLevelFilterChange(value);
    });
  });

  console.info('[Filters] Level filter buttons initialized, current filter:', currentFilter);
}

/**
 * Setup legacy filter pills (backwards compatibility)
 */
export function setupFilterPills(): void {
  const filterPills = document.querySelectorAll('.filter-pill[data-value]');

  if (filterPills.length === 0) {
    console.info('[Filters] No legacy filter pills found');
    return;
  }

  filterPills.forEach((pill) => {
    pill.addEventListener('click', function (this: HTMLElement) {
      const value = this.dataset['value'] as 'all' | OrgLevel | undefined;
      if (value === undefined) return;

      updateFilterButtonState(filterPills, this);
      handleOrgLevelFilterChange(value);
    });
  });

  console.info('[Filters] Legacy filter pills initialized');
}

/**
 * Setup search functionality
 */
export function setupSearch(): void {
  const searchButton = $$id('searchButton');
  const searchInput = $$id('searchInput') as HTMLInputElement | null;

  if (!searchButton || !searchInput) {
    console.info('[Filters] Search components not found');
    return;
  }

  // Search button click
  searchButton.addEventListener('click', () => {
    const searchQuery = searchInput.value.trim();
    handleSearch(searchQuery);
  });

  // Search on Enter key
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const searchQuery = searchInput.value.trim();
      handleSearch(searchQuery);
    }
  });

  console.info('[Filters] Search functionality initialized');
}

/**
 * Setup sort dropdown (Custom Dropdown Component)
 */
export function setupSortDropdown(): void {
  const sortInput = $$id('sortFilter') as HTMLInputElement | null;
  const trigger = $$id('sort-trigger');
  const menu = $$id('sort-menu');
  const options = menu?.querySelectorAll('.dropdown__option');

  if (!sortInput || !trigger || !menu || !options) {
    console.info('[Filters] Sort dropdown elements not found');
    return;
  }

  const OPEN_CLASS = 'active';

  // Toggle dropdown menu
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    trigger.classList.toggle(OPEN_CLASS);
    menu.classList.toggle(OPEN_CLASS);
  });

  // Handle option selection
  options.forEach((option) => {
    option.addEventListener('click', function (this: HTMLElement) {
      const value = this.dataset['value'];
      const text = this.textContent.trim();

      if (value === undefined || value === '') return;

      // Update hidden input
      sortInput.value = value;

      // Update trigger text
      const triggerSpan = trigger.querySelector('span');
      if (triggerSpan) {
        triggerSpan.textContent = text;
      }

      // Close menu
      menu.classList.remove(OPEN_CLASS);
      trigger.classList.remove(OPEN_CLASS);

      // Handle sort change
      const [sortBy, sortDir] = value.split('|');
      if (sortBy !== undefined) {
        handleSortChange(sortBy, (sortDir ?? 'ASC') as 'ASC' | 'DESC');
      }
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as Node;
    const dropdown = $$id('sort-dropdown');
    if (dropdown && !dropdown.contains(target)) {
      menu.classList.remove(OPEN_CLASS);
      trigger.classList.remove(OPEN_CLASS);
    }
  });

  console.info('[Filters] Sort dropdown initialized');
}

// ============================================================================
// Filter Toggle (Accordion)
// ============================================================================

/**
 * Setup filter toggle (collapse/expand)
 */
export function setupFilterToggle(): void {
  const filterToggle = $$id('filterToggle');
  const filterContent = $$id('filterContent');
  const filterToggleIcon = $$id('filterToggleIcon');

  if (!filterToggle || !filterContent || !filterToggleIcon) {
    console.warn('[Filters] Filter toggle elements not found');
    return;
  }

  filterToggle.addEventListener('click', () => {
    const isCollapsed = filterContent.classList.contains('collapsed');

    if (isCollapsed) {
      filterContent.classList.remove('collapsed');
      filterToggleIcon.style.transform = 'rotate(180deg)';
      filterToggleIcon.dataset['expanded'] = 'true';
    } else {
      filterContent.classList.add('collapsed');
      filterToggleIcon.style.transform = 'rotate(0deg)';
      filterToggleIcon.dataset['expanded'] = 'false';
    }
  });

  console.info('[Filters] Filter toggle initialized');
}

// ============================================================================
// Initialize All Filters
// ============================================================================

/**
 * Initialize all filter controls
 */
export function initializeFilters(): void {
  console.info('[Filters] Initializing all filter controls...');

  // Setup level filter buttons (v2 UI) - same as calendar
  setupLevelFilterButtons();

  // Legacy filter pills (v1 UI)
  setupFilterPills();

  // Other filters
  setupSearch();
  setupSortDropdown();
  setupFilterToggle();

  console.info('[Filters] All filter controls initialized');
}
