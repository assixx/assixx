/**
 * Common JS functions for Assixx
 * Includes navigation, helpers, and shared functionality
 */

document.addEventListener('DOMContentLoaded', () => {
  // Load navigation
  loadNavigation();

  // Setup logout button listener
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'logoutBtn') {
      logout();
    }
  });

  // Check if token is expired on each page load
  checkTokenExpiry();
});

/**
 * Load navigation based on user role
 */
async function loadNavigation() {
  try {
    // Get navigation placeholder
    const navPlaceholder = document.getElementById('navigation-placeholder');
    if (!navPlaceholder) return;

    let userRole = null;
    let userData = null;

    // Check if user is logged in and get role
    const userResponse = await fetch('/api/auth/user', {
      credentials: 'include'
    });

    if (userResponse.ok) {
      userData = await userResponse.json();
      const user = userData.user || userData;
      userRole = user.role;
      
      // Load proper navigation based on role
      if (userRole === 'admin' || userRole === 'root') {
        navPlaceholder.innerHTML = createAdminNavigation(user);
      } else {
        navPlaceholder.innerHTML = createEmployeeNavigation(user);
      }

      // Initialize Bootstrap components
      initializeBootstrapComponents();

      // Check for unread notifications
      checkUnreadNotifications();
    } else {
      // Not logged in, show guest navigation
      navPlaceholder.innerHTML = createGuestNavigation();
    }
  } catch (error) {
    console.error('Error loading navigation:', error);
    // Show guest navigation on error
    const navPlaceholder = document.getElementById('navigation-placeholder');
    if (navPlaceholder) {
      navPlaceholder.innerHTML = createGuestNavigation();
    }
  }
}

/**
 * Create navigation for admin/root users
 */
function createAdminNavigation(user) {
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
                <i class="fas fa-toggle-on me-1"></i> Features
              </a>
            </li>
          </ul>
          <ul class="navbar-nav">
            <li class="nav-item dropdown">
              <a class="nav-link dropdown-toggle" href="#" id="notificationsDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="fas fa-bell me-1"></i>
                <span class="notification-badge d-none">0</span>
              </a>
              <ul class="dropdown-menu dropdown-menu-end notification-dropdown" aria-labelledby="notificationsDropdown">
                <li><h6 class="dropdown-header">Benachrichtigungen</h6></li>
                <li><hr class="dropdown-divider"></li>
                <li class="notification-list">
                  <div class="text-center p-3">
                    <small class="text-muted">Keine neuen Benachrichtigungen</small>
                  </div>
                </li>
              </ul>
            </li>
            <li class="nav-item dropdown">
              <a class="nav-link dropdown-toggle" href="#" id="userDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="fas fa-user-circle me-1"></i> ${user.username || 'Benutzer'}
              </a>
              <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
                <li><a class="dropdown-item" href="/profile"><i class="fas fa-id-card me-2"></i>Profil</a></li>
                <li><a class="dropdown-item" href="/settings"><i class="fas fa-cog me-2"></i>Einstellungen</a></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item" href="#" id="logoutBtn"><i class="fas fa-sign-out-alt me-2"></i>Abmelden</a></li>
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
function createEmployeeNavigation(user) {
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
                <i class="fas fa-tachometer-alt me-1"></i> Dashboard
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/blackboard">
                <i class="fas fa-clipboard-list me-1"></i> Blackboard
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/my-documents">
                <i class="fas fa-file-alt me-1"></i> Meine Dokumente
              </a>
            </li>
          </ul>
          <ul class="navbar-nav">
            <li class="nav-item dropdown">
              <a class="nav-link dropdown-toggle" href="#" id="notificationsDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="fas fa-bell me-1"></i>
                <span class="notification-badge d-none">0</span>
              </a>
              <ul class="dropdown-menu dropdown-menu-end notification-dropdown" aria-labelledby="notificationsDropdown">
                <li><h6 class="dropdown-header">Benachrichtigungen</h6></li>
                <li><hr class="dropdown-divider"></li>
                <li class="notification-list">
                  <div class="text-center p-3">
                    <small class="text-muted">Keine neuen Benachrichtigungen</small>
                  </div>
                </li>
              </ul>
            </li>
            <li class="nav-item dropdown">
              <a class="nav-link dropdown-toggle" href="#" id="userDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="fas fa-user-circle me-1"></i> ${user.username || 'Mitarbeiter'}
              </a>
              <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
                <li><a class="dropdown-item" href="/profile"><i class="fas fa-id-card me-2"></i>Profil</a></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item" href="#" id="logoutBtn"><i class="fas fa-sign-out-alt me-2"></i>Abmelden</a></li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  `;
}

/**
 * Create navigation for guests (not logged in)
 */
function createGuestNavigation() {
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
          <ul class="navbar-nav ms-auto">
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
 * Initialize Bootstrap components
 */
function initializeBootstrapComponents() {
  // Initialize tooltips
  const tooltipTriggerList = document.querySelectorAll(
    '[data-bs-toggle="tooltip"]'
  );
  [...tooltipTriggerList].map(
    (tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
  );

  // Initialize popovers
  const popoverTriggerList = document.querySelectorAll(
    '[data-bs-toggle="popover"]'
  );
  [...popoverTriggerList].map(
    (popoverTriggerEl) => new bootstrap.Popover(popoverTriggerEl)
  );
}

/**
 * Check for unread notifications and update badge
 */
async function checkUnreadNotifications() {
  try {
    // Check if we have unread blackboard entries that require confirmation
    const response = await fetch(
      '/api/blackboard?requires_confirmation=true&unread=true&limit=1',
      {
        credentials: 'include'
      }
    );

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const unreadCount = data.pagination.total;

    if (unreadCount > 0) {
      // Update badge
      const badge = document.querySelector('.notification-badge');
      if (badge) {
        badge.textContent = unreadCount;
        badge.classList.remove('d-none');
      }

      // Update dropdown content
      const notificationList = document.querySelector('.notification-list');
      if (notificationList) {
        // Clear existing content
        notificationList.innerHTML = '';

        // Add unread blackboard entries
        data.entries.forEach((entry) => {
          const item = document.createElement('div');
          item.className = 'dropdown-item notification-item';
          item.innerHTML = `
            <div class="d-flex">
              <div class="me-3">
                <i class="fas fa-clipboard-list text-primary notification-icon"></i>
              </div>
              <div>
                <p class="mb-0"><strong>${entry.title}</strong></p>
                <small class="text-muted">Erfordert Lesebestätigung</small>
                <a href="/blackboard" class="stretched-link"></a>
              </div>
            </div>
          `;
          notificationList.appendChild(item);
        });

        // Add link to see all
        if (unreadCount > 1) {
          const seeAllItem = document.createElement('div');
          seeAllItem.className = 'dropdown-item text-center border-top pt-2';
          seeAllItem.innerHTML = `
            <a href="/blackboard" class="text-primary">
              Alle ${unreadCount} Benachrichtigungen anzeigen
            </a>
          `;
          notificationList.appendChild(seeAllItem);
        }
      }
    }
  } catch (error) {
    console.error('Error checking notifications:', error);
  }
}

/**
 * Logout user
 */
async function logout() {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });

    if (!response.ok) {
      console.error('Logout failed');
    }
  } catch (error) {
    console.error('Error during logout:', error);
  }
  
  // Always redirect to login page
  window.location.href = '/login.html';
}

/**
 * Check if token is expired
 */
function checkTokenExpiry() {
  // Token expiry is now handled server-side with cookies
  // This function is kept for compatibility but does nothing
}
