/**
 * Navigation Event Handlers
 * Event handling logic for navigation interactions
 */

import { $$ } from '../../../utils/dom-utils';
import { tokenManager } from '../../../utils/token-manager';
import { logout } from '../../auth/index';
import { CSS_CLASSES, SELECTORS, DASHBOARD_URLS } from './constants';
import type { Role, RoleSwitchMessage } from './types';
import { formatTokenTime } from './utils';
import { resetKvpBadge, markAllDocumentsAsRead } from './services';

/**
 * Event delegation handler registry
 */
interface NavigationWindow extends Window {
  toggleSubmenu: (event: Event, itemId: string) => void;
  dismissRoleSwitchBanner?: () => void;
}

/**
 * Handle badge-related actions for navigation item
 */
function handleNavBadgeActions(navId: string, currentRole: Role | null): void {
  // Mark documents as read when employee clicks on documents
  if (navId === 'documents' && currentRole === 'employee') {
    void markAllDocumentsAsRead();
  }

  // Reset KVP badge when admin/root clicks on KVP
  if (navId === 'kvp' && (currentRole === 'admin' || currentRole === 'root')) {
    void resetKvpBadge();
  }
}

/**
 * Handle navigation link click
 */
export function handleNavigationClick(
  link: HTMLElement,
  currentRole: Role | null,
  onNavigate?: (navId: string) => void,
): void {
  // Don't handle clicks on submenu toggle links
  if (link.getAttribute('href') === '#') {
    return;
  }

  // Update active state
  document.querySelectorAll(SELECTORS.sidebarItem).forEach((item) => {
    item.classList.remove('active');
  });
  link.closest(SELECTORS.sidebarItem)?.classList.add('active');

  // Store active navigation and handle badge actions
  const navId = link.dataset['navId'];
  if (navId !== undefined && navId !== '') {
    localStorage.setItem('activeNavigation', navId);
    handleNavBadgeActions(navId, currentRole);
    onNavigate?.(navId);
  }

  // Add ripple animation
  animateNavigation(link);
}

/**
 * Add ripple animation to navigation link
 */
export function animateNavigation(link: HTMLElement): void {
  const ripple = document.createElement('span');
  ripple.className = 'nav-ripple';
  link.append(ripple);

  setTimeout(() => {
    if (ripple.parentNode) {
      ripple.remove();
    }
  }, 600);
}

/**
 * Store parent submenu state when clicking submenu link
 */
export function storeParentSubmenuState(submenuLink: HTMLElement): void {
  const parentSubmenu = submenuLink.closest(SELECTORS.submenu);
  const parentItem = parentSubmenu?.closest(SELECTORS.sidebarItem);
  if (!parentItem) {
    return;
  }

  const parentLink = parentItem.querySelector<HTMLElement>('.sidebar-link');
  const parentId = parentLink?.dataset['navId'];
  if (parentId !== undefined) {
    localStorage.setItem('openSubmenu', parentId);
  }
}

/**
 * Check if KVP submenu was clicked and reset badge
 */
export function checkKvpSubmenuClick(submenuLink: HTMLElement, currentRole: Role | null): void {
  const submenuNavId = submenuLink.dataset['navId'];
  if (submenuNavId === 'kvp' && (currentRole === 'admin' || currentRole === 'root')) {
    void resetKvpBadge();
  }
}

/**
 * Handle logout with modal confirmation
 */
export async function handleLogout(): Promise<void> {
  const modal = $$('#logoutModal');

  if (modal) {
    modal.classList.add(CSS_CLASSES.modalActive);

    const confirmBtn = $$('#confirmLogout');
    const cancelBtn = $$('#cancelLogout');

    const closeModal = () => {
      modal.classList.remove(CSS_CLASSES.modalActive);
    };

    const performLogout = async () => {
      await logout();
    };

    if (confirmBtn) {
      const newConfirmBtn = confirmBtn.cloneNode(true) as HTMLElement;
      confirmBtn.parentNode?.replaceChild(newConfirmBtn, confirmBtn);
      newConfirmBtn.addEventListener('click', () => {
        void performLogout();
      });
    }

    if (cancelBtn) {
      const newCancelBtn = cancelBtn.cloneNode(true) as HTMLElement;
      cancelBtn.parentNode?.replaceChild(newCancelBtn, cancelBtn);
      newCancelBtn.addEventListener('click', closeModal);
    }

    // Click on backdrop closes modal
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  } else {
    await logout();
  }
}

/**
 * Setup BroadcastChannel listener for role switching
 */
export function setupRoleSwitchListener(onRoleSwitch: () => void): void {
  const roleChannel = new BroadcastChannel('role_switch_channel');
  roleChannel.onmessage = (event: MessageEvent<RoleSwitchMessage>) => {
    if (event.data.type === 'ROLE_SWITCHED') {
      if (event.data.newRole !== undefined) {
        localStorage.setItem('activeRole', event.data.newRole);
      }
      if (event.data.token !== undefined) {
        localStorage.setItem('token', event.data.token);
      }
      onRoleSwitch();
    }
  };
}

/**
 * Get dashboard path for role
 */
function getDashboardPath(role: string | null): string {
  switch (role) {
    case 'root':
      return DASHBOARD_URLS.root;
    case 'admin':
      return DASHBOARD_URLS.admin;
    case 'employee':
      return DASHBOARD_URLS.employee;
    default:
      return '/';
  }
}

/**
 * Handle role change redirect
 */
export function handleRoleChangeRedirect(
  newActiveRole: string | null,
  isRedirecting: boolean,
  onRefresh: () => void,
): void {
  if (isRedirecting) {
    return;
  }

  const currentPagePath = window.location.pathname;
  const userRole = localStorage.getItem('userRole');
  const targetPath = getDashboardPath(newActiveRole);

  // Only redirect if we're not already on the correct dashboard
  if (targetPath !== '' && !currentPagePath.includes(targetPath)) {
    // Check if user has permission for the target role
    if (newActiveRole === 'root' && userRole !== 'root') {
      return;
    }
    window.location.replace(targetPath);
  } else {
    onRefresh();
  }
}

/**
 * Setup storage event listener for cross-tab role changes
 */
export function setupStorageListener(onRefresh: () => void): void {
  let redirectTimeout: ReturnType<typeof setTimeout> | null = null;
  let isRedirecting = false;

  window.addEventListener('storage', (event) => {
    if (event.key === 'activeRole' && event.newValue !== event.oldValue) {
      if (redirectTimeout) {
        clearTimeout(redirectTimeout);
      }

      redirectTimeout = setTimeout(() => {
        handleRoleChangeRedirect(event.newValue, isRedirecting, onRefresh);
      }, 300);
    }
  });
}

/**
 * Setup token timer display
 */
export function setupTokenTimer(): void {
  tokenManager.onTimerUpdate((remainingSeconds: number) => {
    updateTokenDisplay(remainingSeconds);
  });
}

/**
 * Update token timer display
 */
export function updateTokenDisplay(remainingSeconds: number): void {
  const timerElement = $$('#token-timer');

  if (timerElement === null) {
    return;
  }

  timerElement.textContent = formatTokenTime(remainingSeconds);

  if (remainingSeconds === 0) {
    timerElement.classList.add('token-timer--expired');
    timerElement.classList.remove('token-timer--warning');
  } else if (remainingSeconds < 300) {
    timerElement.classList.add('token-timer--warning');
    timerElement.classList.remove('token-timer--expired');
  } else {
    timerElement.classList.remove('token-timer--warning');
    timerElement.classList.remove('token-timer--expired');
  }
}

/**
 * Initialize event delegation for all navigation actions
 */
export function initializeEventDelegation(): void {
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const actionElement = target.closest<HTMLElement>('[data-action]');

    if (actionElement !== null) {
      const action = actionElement.dataset['action'] ?? '';

      switch (action) {
        case 'dismiss-role-banner': {
          const dismissFn = (window as unknown as NavigationWindow).dismissRoleSwitchBanner;
          if (dismissFn !== undefined) {
            dismissFn();
          }
          break;
        }

        case 'navigate-storage-upgrade':
          window.location.href = '/storage-upgrade';
          break;

        case 'toggle-submenu': {
          e.preventDefault();
          const navId = actionElement.dataset['navId'] ?? '';
          if (navId !== '') {
            (window as unknown as NavigationWindow).toggleSubmenu(e, navId);
          }
          break;
        }

        case 'logout': {
          e.preventDefault();
          e.stopPropagation();
          void handleLogout();
          break;
        }
      }
    }
  });
}

/**
 * Setup global toggle submenu function
 */
export function setupGlobalToggleSubmenu(): void {
  (window as unknown as NavigationWindow).toggleSubmenu = function (event: Event, itemId: string) {
    event.preventDefault();
    event.stopPropagation();

    const submenu = document.querySelector(`#submenu-${itemId}`);
    const parentItem = submenu?.closest(SELECTORS.sidebarItem);

    if (submenu instanceof HTMLElement && parentItem) {
      const isOpen = submenu.classList.contains(CSS_CLASSES.submenuOpen);

      // Close all other submenus
      document.querySelectorAll(SELECTORS.submenu).forEach((menu) => {
        if (menu !== submenu) {
          menu.classList.add(CSS_CLASSES.hidden);
          menu.classList.remove(CSS_CLASSES.submenuOpen);
          menu.closest(SELECTORS.sidebarItem)?.classList.remove('open');
        }
      });

      // Toggle current submenu
      if (!isOpen) {
        submenu.classList.remove(CSS_CLASSES.hidden);
        submenu.classList.add(CSS_CLASSES.submenuOpen);
        parentItem.classList.add('open');
        localStorage.setItem('openSubmenu', itemId);
      } else {
        submenu.classList.add(CSS_CLASSES.hidden);
        submenu.classList.remove(CSS_CLASSES.submenuOpen);
        parentItem.classList.remove('open');
        localStorage.removeItem('openSubmenu');
      }
    }
  };
}

/**
 * Setup global dismiss role switch banner function
 */
export function setupGlobalDismissRoleBanner(): void {
  (window as unknown as NavigationWindow).dismissRoleSwitchBanner = function () {
    const banner = $$('#role-switch-warning-banner');
    if (banner) {
      banner.classList.add(CSS_CLASSES.hidden);

      const activeRole = localStorage.getItem('activeRole');
      if (activeRole !== null && activeRole !== '') {
        const bannerDismissedKey = `roleSwitchBannerDismissed_${activeRole}`;
        localStorage.setItem(bannerDismissedKey, 'true');
      }

      const sidebar = $$(SELECTORS.sidebar);
      if (sidebar) {
        sidebar.classList.add(CSS_CLASSES.bannerDismissed);
      }
    }
  };
}
