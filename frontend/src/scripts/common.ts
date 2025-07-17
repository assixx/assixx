/**
 * Common functionality for Assixx
 * Includes navigation, helpers, and shared functionality
 */

import type { User, BlackboardEntry } from '../types/api.types';
import { getAuthToken, removeAuthToken, parseJwt } from './auth';
import { initPageProtection } from './pageProtection';

// Navigation initialization
document.addEventListener('DOMContentLoaded', () => {
  // Initialize page protection first
  initPageProtection();

  loadNavigation();
  setupEventListeners();
  checkTokenExpiry();
});

/**
 * Setup global event listeners
 */
function setupEventListeners(): void {
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target && target.id === 'logoutBtn') {
      logout();
    }
  });
}

/**
 * Load navigation based on user role
 */
async function loadNavigation(): Promise<void> {
  try {
    const navPlaceholder = document.getElementById('navigation-placeholder');
    if (!navPlaceholder) return;

    const token = getAuthToken();
    let userRole: string | null = null;
    let userData: User | null = null;

    if (token) {
      const userResponse = await fetch('/api/user/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (userResponse.ok) {
        userData = await userResponse.json();
        userRole = userData?.role ?? 'employee';
      } else {
        navPlaceholder.innerHTML = createGuestNavigation();
        return;
      }
    } else {
      navPlaceholder.innerHTML = createGuestNavigation();
      return;
    }

    // Load proper navigation based on role
    if (userData && (userRole === 'admin' || userRole === 'root')) {
      navPlaceholder.innerHTML = createAdminNavigation(userData);
    } else if (userData) {
      navPlaceholder.innerHTML = createEmployeeNavigation(userData);
    }

    // Initialize Bootstrap components
    initializeBootstrapComponents();

    // Check for unread notifications
    checkUnreadNotifications();
  } catch (error) {
    console.error('Error loading navigation:', error);
  }
}

/**
 * Create navigation for admin/root users
 */
function createAdminNavigation(user: User): string {
  return `
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary sticky-top">
      <div class="container-fluid">
        <a class="navbar-brand" href="/admin-dashboard">
          <img src="/img/logo.png" alt="Assixx" height="30" class="d-inline-block align-text-top me-2">
          Assixx
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav me-auto">
            <li class="nav-item">
              <a class="nav-link" href="/admin-dashboard">
                <i class="fas fa-tachometer-alt me-1"></i> Dashboard
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/blackboard">
                <i class="fas fa-clipboard-list me-1"></i> Blackboard
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/documents">
                <i class="fas fa-file-alt me-1"></i> Dokumente
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/departments">
                <i class="fas fa-building me-1"></i> Abteilungen
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/employees">
                <i class="fas fa-users me-1"></i> Mitarbeiter
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/feature-management">
                <i class="fas fa-cogs me-1"></i> Features
              </a>
            </li>
          </ul>
          <ul class="navbar-nav">
            <li class="nav-item">
              <a class="nav-link" href="#" id="notificationBell">
                <i class="fas fa-bell"></i>
                <span class="badge bg-danger ms-1" id="notificationCount" style="display: none;">0</span>
              </a>
            </li>
            <li class="nav-item dropdown">
              <a class="nav-link dropdown-toggle" href="#" id="navbarDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="fas fa-user-circle me-1"></i> ${user.first_name ?? user.username}
              </a>
              <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="navbarDropdown">
                <li><a class="dropdown-item" href="/profile"><i class="fas fa-user me-2"></i> Profil</a></li>
                <li><a class="dropdown-item" href="/settings"><i class="fas fa-cog me-2"></i> Einstellungen</a></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item" href="#" id="logoutBtn"><i class="fas fa-sign-out-alt me-2"></i> Abmelden</a></li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  `;
}

/**
 * Create navigation for employee users
 */
function createEmployeeNavigation(user: User): string {
  return `
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary sticky-top">
      <div class="container-fluid">
        <a class="navbar-brand" href="/employee-dashboard">
          <img src="/img/logo.png" alt="Assixx" height="30" class="d-inline-block align-text-top me-2">
          Assixx
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav me-auto">
            <li class="nav-item">
              <a class="nav-link" href="/employee-dashboard">
                <i class="fas fa-home me-1"></i> Dashboard
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/blackboard">
                <i class="fas fa-clipboard-list me-1"></i> Blackboard
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/documents">
                <i class="fas fa-file-alt me-1"></i> Dokumente
              </a>
            </li>
          </ul>
          <ul class="navbar-nav">
            <li class="nav-item">
              <a class="nav-link" href="#" id="notificationBell">
                <i class="fas fa-bell"></i>
                <span class="badge bg-danger ms-1" id="notificationCount" style="display: none;">0</span>
              </a>
            </li>
            <li class="nav-item dropdown">
              <a class="nav-link dropdown-toggle" href="#" id="navbarDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="fas fa-user-circle me-1"></i> ${user.first_name ?? user.username}
              </a>
              <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="navbarDropdown">
                <li><a class="dropdown-item" href="/profile"><i class="fas fa-user me-2"></i> Profil</a></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item" href="#" id="logoutBtn"><i class="fas fa-sign-out-alt me-2"></i> Abmelden</a></li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  `;
}

/**
 * Create guest navigation (not logged in)
 */
function createGuestNavigation(): string {
  return `
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary sticky-top">
      <div class="container-fluid">
        <a class="navbar-brand" href="/index">
          <img src="/img/logo.png" alt="Assixx" height="30" class="d-inline-block align-text-top me-2">
          Assixx
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav me-auto">
            <li class="nav-item">
              <a class="nav-link" href="/login">
                <i class="fas fa-sign-in-alt me-1"></i> Anmelden
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  `;
}

/**
 * Check for unread notifications
 */
async function checkUnreadNotifications(): Promise<void> {
  try {
    const token = getAuthToken();
    if (!token) return;

    const response = await fetch('/api/notifications/unread-count', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const count = data.count ?? 0;
      updateNotificationBadge(count);
    }
  } catch (error) {
    console.error('Error checking notifications:', error);
  }
}

/**
 * Update notification badge
 */
function updateNotificationBadge(count: number): void {
  const badge = document.getElementById('notificationCount');
  if (badge) {
    if (count > 0) {
      badge.textContent = count.toString();
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
}

/**
 * Initialize Bootstrap components
 */
function initializeBootstrapComponents(): void {
  // Bootstrap type declaration
  interface BootstrapTooltip {
    new (element: Element): unknown;
  }

  interface WindowWithBootstrap extends Window {
    bootstrap?: {
      Tooltip: BootstrapTooltip;
    };
  }

  // Initialize tooltips if Bootstrap is available
  if (typeof (window as WindowWithBootstrap).bootstrap !== 'undefined') {
    const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.forEach((tooltipTriggerEl) => {
      const bootstrap = (window as WindowWithBootstrap).bootstrap;
      if (bootstrap?.Tooltip) {
        new bootstrap.Tooltip(tooltipTriggerEl);
      }
    });
  }
}

/**
 * Create blackboard preview widget
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
 */
export async function loadBlackboardPreview(): Promise<void> {
  try {
    const token = getAuthToken();
    if (!token) return;

    const response = await fetch('/api/blackboard?limit=5', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const entries = await response.json();
      displayBlackboardItems(entries);
    }
  } catch (error) {
    console.error('Error loading blackboard:', error);
  }
}

/**
 * Display blackboard items
 */
function displayBlackboardItems(entries: BlackboardEntry[]): void {
  const container = document.getElementById('blackboard-items');
  if (!container) return;

  if (entries.length === 0) {
    container.innerHTML = '<p class="text-muted">Keine Einträge vorhanden.</p>';
    return;
  }

  container.innerHTML = entries
    .map(
      (entry) => `
        <a href="/pages/blackboard.html#entry-${entry.id}" class="list-group-item list-group-item-action">
          <div class="d-flex w-100 justify-content-between">
            <h6 class="mb-1">${escapeHtml(entry.title)}</h6>
            <small class="text-muted">${formatDate(entry.created_at)}</small>
          </div>
          <p class="mb-1 text-truncate">${escapeHtml(entry.content)}</p>
          <small class="text-muted">von ${entry.created_by_name ?? 'Unbekannt'}</small>
        </a>
      `,
    )
    .join('');
}

/**
 * Check if token is expired
 */
function checkTokenExpiry(): void {
  const token = getAuthToken();
  if (!token) return;

  try {
    const payload = parseJwt(token);
    if (!payload) return;

    const expiryTime = payload.exp * 1000;
    const currentTime = Date.now();

    if (currentTime >= expiryTime) {
      console.info('Token expired, logging out...');
      logout();
    }
  } catch (error) {
    console.error('Error checking token expiry:', error);
  }
}

/**
 * Format date to German locale
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format datetime to German locale
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Show section by ID
 */
export function showSection(sectionId: string): void {
  // Hide all sections
  document.querySelectorAll('.content-section').forEach((section) => {
    (section as HTMLElement).style.display = 'none';
  });

  // Show selected section
  const selectedSection = document.getElementById(sectionId);
  if (selectedSection) {
    selectedSection.style.display = 'block';
  }

  // Update active navigation
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.remove('active');
  });

  const activeLink = document.querySelector(`[data-section="${sectionId}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  removeAuthToken();
  window.location.href = '/login';
}

// Extend window for common functions
declare global {
  interface Window {
    loadNavigation: typeof loadNavigation;
    createBlackboardWidget: typeof createBlackboardWidget;
    loadBlackboardPreview: typeof loadBlackboardPreview;
    formatDate: typeof formatDate;
    formatDateTime: typeof formatDateTime;
    escapeHtml: typeof escapeHtml;
    showSection: typeof showSection;
    logout: typeof logout;
  }
}

// Export functions to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.loadNavigation = loadNavigation;
  window.createBlackboardWidget = createBlackboardWidget;
  window.loadBlackboardPreview = loadBlackboardPreview;
  window.formatDate = formatDate;
  window.formatDateTime = formatDateTime;
  window.escapeHtml = escapeHtml;
  window.showSection = showSection;
  window.logout = logout;
}
