/**
 * Sidebar Module
 * Sidebar toggle, collapse/expand, and tooltip management
 */

import { $$ } from '../../../utils/dom-utils';
import { SELECTORS, CSS_CLASSES } from './constants';

/**
 * Update toggle button icon
 */
export function updateToggleIcon(): void {
  const iconPath = document.querySelector('.toggle-icon-path');
  if (iconPath) {
    iconPath.setAttribute('d', 'M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z');
  }
}

/**
 * Apply saved collapsed state to sidebar
 */
export function applySavedCollapsedState(
  sidebar: Element,
  mainContent: Element | null,
  chatPageMain: Element | null,
): void {
  const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (isCollapsed) {
    sidebar.classList.add('collapsed');
    mainContent?.classList.add(CSS_CLASSES.sidebarCollapsed);
    chatPageMain?.classList.add(CSS_CLASSES.sidebarCollapsed);
    updateToggleIcon();
  }
}

/**
 * Setup toggle button click handler
 */
export function setupToggleClickHandler(
  toggleBtn: Element,
  sidebar: Element,
  mainContent: Element | null,
  chatPageMain: Element | null,
  onToggle?: (isCollapsed: boolean) => void,
): void {
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const isCurrentlyCollapsed = sidebar.classList.contains('collapsed');
    const newState = !isCurrentlyCollapsed;

    // Remove any inline width styles - let CSS handle it
    (sidebar as HTMLElement).style.removeProperty('width');

    sidebar.classList.toggle('collapsed');
    mainContent?.classList.toggle(CSS_CLASSES.sidebarCollapsed);
    chatPageMain?.classList.toggle(CSS_CLASSES.sidebarCollapsed);

    // Force browser to recalculate styles
    void (sidebar as HTMLElement).offsetWidth;

    // Save state
    localStorage.setItem('sidebarCollapsed', newState.toString());

    // Update icon
    updateToggleIcon();

    // Update logo based on collapsed state
    const headerLogo = $$('#header-logo') as HTMLImageElement | null;
    if (headerLogo !== null) {
      headerLogo.src = newState ? '/assets/images/logo_collapsed.png' : '/assets/images/logo.png';
    }

    if (onToggle) {
      onToggle(newState);
    }
  });
}

/**
 * Setup hover effects for toggle button
 */
export function setupHoverEffects(toggleBtn: Element, sidebar: Element): void {
  toggleBtn.addEventListener('mouseenter', () => {
    const isSidebarCollapsed = sidebar.classList.contains('collapsed');
    const iconPath = toggleBtn.querySelector('.toggle-icon-path');
    if (iconPath) {
      if (isSidebarCollapsed) {
        // Show menu-close icon (menu with arrow right) when collapsed
        iconPath.setAttribute(
          'd',
          'M3 6H13V8H3V6M3 16H13V18H3V16M3 11H15V13H3V11M16 7L14.58 8.39L18.14 12L14.58 15.61L16 17L21 12L16 7Z',
        );
      } else {
        // Show menu-open icon (menu with arrow left) when expanded
        iconPath.setAttribute(
          'd',
          'M21,15.61L19.59,17L14.58,12L19.59,7L21,8.39L17.44,12L21,15.61M3,6H16V8H3V6M3,13V11H13V13H3M3,18V16H16V18H3Z',
        );
      }
    }
  });

  toggleBtn.addEventListener('mouseleave', () => {
    const iconPath = toggleBtn.querySelector('.toggle-icon-path');
    if (iconPath) {
      // Reset to hamburger menu
      iconPath.setAttribute('d', 'M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z');
    }
  });
}

/**
 * Add tooltips to navigation items when sidebar is collapsed
 */
export function addCollapsedTooltips(): void {
  const sidebar = document.querySelector(SELECTORS.sidebar);
  if (!sidebar) return;

  const navItems = sidebar.querySelectorAll('.sidebar-link');
  navItems.forEach((item) => {
    const labelElement = item.querySelector('.label');
    if (labelElement !== null && labelElement.textContent !== '') {
      const label = labelElement.textContent;
      item.setAttribute('title', '');

      // Show tooltip only when sidebar is collapsed
      item.addEventListener('mouseenter', () => {
        if (sidebar.classList.contains('collapsed')) {
          item.setAttribute('title', label);
        } else {
          item.setAttribute('title', '');
        }
      });
    }
  });
}

/**
 * Attach sidebar toggle event listener
 */
export function attachSidebarToggle(onToggle?: (isCollapsed: boolean) => void): void {
  const toggleBtn = $$('#sidebar-toggle');
  const sidebar = $$('.layout-container .sidebar') ?? $$(SELECTORS.sidebar);
  const mainContent = $$(SELECTORS.mainContent);
  const chatPageMain = $$('.chat-page-main');

  if (!toggleBtn || !sidebar) {
    return;
  }

  applySavedCollapsedState(sidebar, mainContent, chatPageMain);
  setupToggleClickHandler(toggleBtn, sidebar, mainContent, chatPageMain, onToggle);
  setupHoverEffects(toggleBtn, sidebar);
  addCollapsedTooltips();
}

/**
 * Get current collapsed state
 */
export function isCollapsed(): boolean {
  return localStorage.getItem('sidebarCollapsed') === 'true';
}

/**
 * Restore sidebar state after refresh
 */
export function restoreSidebarState(): void {
  const savedIsCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (savedIsCollapsed) {
    const sidebar = document.querySelector('.layout-container .sidebar');
    const mainContent = document.querySelector(SELECTORS.mainContent);
    sidebar?.classList.add('collapsed');
    mainContent?.classList.add(CSS_CLASSES.sidebarCollapsed);
  }
}

/**
 * Fix logo navigation based on user role
 */
export function fixLogoNavigation(currentRole: string | null): void {
  const userRole = localStorage.getItem('userRole');
  const activeRole = localStorage.getItem('activeRole');

  // For root users, ALWAYS use root role regardless of activeRole
  const effectiveRole = userRole === 'root' ? 'root' : (activeRole ?? userRole ?? currentRole);

  // Find all logo containers
  const logoContainers = document.querySelectorAll('.logo-container, a.logo-container, div.logo-container');

  logoContainers.forEach((container) => {
    let dashboardUrl = 'employee-dashboard';
    switch (effectiveRole) {
      case 'employee':
        dashboardUrl = 'employee-dashboard';
        break;
      case 'admin':
        dashboardUrl = 'admin-dashboard';
        break;
      case 'root':
        dashboardUrl = 'root-dashboard';
        break;
      default:
        console.warn('No user role found for logo navigation, defaulting to employee dashboard');
    }

    if (container instanceof HTMLAnchorElement) {
      container.href = dashboardUrl;
      container.onclick = null;
      if (container.getAttribute('href') === '#' || container.getAttribute('href') === '') {
        container.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = dashboardUrl;
        });
      }
    } else {
      container.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = dashboardUrl;
      });
      (container as HTMLElement).classList.add(CSS_CLASSES.logoClickable);
    }
  });
}

/**
 * Setup visibility change listener for logo navigation
 */
export function setupLogoVisibilityListener(currentRole: string | null): void {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      fixLogoNavigation(currentRole);
    }
  });
}
