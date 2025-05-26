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

    // Get token from localStorage
    const token = localStorage.getItem('token');
    let userRole = null;
    let userData = null;

    if (token) {
      // Check if user is logged in and get role
      const userResponse = await fetch('/api/user/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (userResponse.ok) {
        userData = await userResponse.json();
        userRole = userData.role;
      } else {
        // Token invalid or expired, show guest navigation
        navPlaceholder.innerHTML = createGuestNavigation();
        return;
      }
    } else {
      // No token, show guest navigation
      navPlaceholder.innerHTML = createGuestNavigation();
      return;
    }

    // Load proper navigation based on role
    if (userRole === 'admin' || userRole === 'root') {
      navPlaceholder.innerHTML = createAdminNavigation(userData);
    } else {
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
function createAdminNavigation(user) {
  return `
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary sticky-top">
      <div class="container-fluid">
        <a class="navbar-brand" href="/admin-dashboard.html">
          <img src="/img/logo.png" alt="Assixx" height="30" class="d-inline-block align-text-top me-2">
          Assixx
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav me-auto">
            <li class="nav-item">
              <a class="nav-link" href="/admin-dashboard.html">
                <i class="fas fa-tachometer-alt me-1"></i> Dashboard
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/blackboard.html">
                <i class="fas fa-clipboard-list me-1"></i> Blackboard
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/documents.html">
                <i class="fas fa-file-alt me-1"></i> Dokumente
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/departments.html">
                <i class="fas fa-building me-1"></i> Abteilungen
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/employees.html">
                <i class="fas fa-users me-1"></i> Mitarbeiter
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/feature-management.html">
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
                <li><a class="dropdown-item" href="/profile.html"><i class="fas fa-id-card me-2"></i>Profil</a></li>
                <li><a class="dropdown-item" href="/settings.html"><i class="fas fa-cog me-2"></i>Einstellungen</a></li>
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
        <a class="navbar-brand" href="/employee-dashboard.html">
          <img src="/img/logo.png" alt="Assixx" height="30" class="d-inline-block align-text-top me-2">
          Assixx
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav me-auto">
            <li class="nav-item">
              <a class="nav-link" href="/employee-dashboard.html">
                <i class="fas fa-tachometer-alt me-1"></i> Dashboard
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/blackboard.html">
                <i class="fas fa-clipboard-list me-1"></i> Blackboard
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/my-documents.html">
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
                <li><a class="dropdown-item" href="/profile.html"><i class="fas fa-id-card me-2"></i>Profil</a></li>
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
        <a class="navbar-brand" href="/index.html">
          <img src="/img/logo.png" alt="Assixx" height="30" class="d-inline-block align-text-top me-2">
          Assixx
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav ms-auto">
            <li class="nav-item">
              <a class="nav-link" href="/login.html">
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
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return;

    // Check if we have unread blackboard entries that require confirmation
    const response = await fetch(
      '/api/blackboard?requires_confirmation=true&unread=true&limit=1',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
                <a href="/blackboard.html" class="stretched-link"></a>
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
            <a href="/blackboard.html" class="text-primary">
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
    // Get token from localStorage
    const token = localStorage.getItem('token');

    if (token) {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Clear token and redirect to login page
        localStorage.removeItem('token');
        window.location.href = '/login.html';
      } else {
        console.error('Logout failed');
      }
    } else {
      // No token, just redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login.html';
    }
  } catch (error) {
    console.error('Error during logout:', error);
  }
}

/**
 * Check if token is expired
 */
function checkTokenExpiry() {
  const token = localStorage.getItem('token');

  if (!token) return;

  try {
    // Parse token to get expiry time
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiryTime = payload.exp * 1000; // Convert to milliseconds

    // If token is expired or about to expire (less than 5 minutes), redirect to login
    if (Date.now() >= expiryTime - 5 * 60 * 1000) {
      logout();
    }
  } catch (error) {
    console.error('Error checking token expiry:', error);
  }
}
