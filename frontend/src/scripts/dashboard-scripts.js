/**
 * Dashboard Scripts - gemeinsame Funktionalität für alle Dashboard-Seiten
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialisiere Modals
  initModals();

  // Initialisiere Tab Navigation
  initTabs();

  // Logging-Handler für User Info und Logout
  setupUserAndLogout();
});

/**
 * Modal-System Initialisierung
 */
function initModals() {
  // Close-Buttons für Modals
  document
    .querySelectorAll('.modal-close, [data-action="close"]')
    .forEach((button) => {
      button.addEventListener('click', function () {
        // Find closest modal-overlay
        const modalOverlay = this.closest('.modal-overlay');
        if (modalOverlay) {
          closeModal(modalOverlay.id);
        }
      });
    });

  // Click outside modal to close
  document.querySelectorAll('.modal-overlay').forEach((modal) => {
    modal.addEventListener('click', function (e) {
      if (e.target === this) {
        closeModal(this.id);
      }
    });
  });
}

/**
 * Öffnet ein Modal
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scrolling while modal is open
  }
}

/**
 * Schließt ein Modal
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.opacity = '0';
    modal.style.visibility = 'hidden';
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
  }
}

/**
 * Tab-Navigation Initialisierung
 */
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.addEventListener('click', function () {
      // Deactivate all tabs
      const parent = this.closest('.tab-navigation');
      if (!parent) return;

      parent.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.classList.remove('active');
      });

      // Activate clicked tab
      this.classList.add('active');

      // Trigger the tab click event for custom handlers
      const event = new CustomEvent('tabClick', {
        detail: {
          value: this.dataset.value,
          id: this.id,
        },
      });
      document.dispatchEvent(event);
    });
  });
}

/**
 * Benutzerdaten und Logout-Funktionalität
 */
function setupUserAndLogout() {
  const userInfo = document.getElementById('user-info');
  const logoutBtn = document.getElementById('logout-btn');

  if (userInfo) {
    // Lade Benutzerdaten
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/user/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((response) => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('Fehler beim Laden der Benutzerdaten');
        })
        .then((data) => {
          // Anzeigename setzen (Name oder Username)
          const displayName = data.first_name
            ? `${data.first_name} ${data.last_name || ''}`
            : data.username;
          userInfo.textContent = displayName;
        })
        .catch((error) => {
          console.error('Fehler beim Laden der Benutzerdaten:', error);
          // Bei Fehler zur Login-Seite weiterleiten
          window.location.href = '/pages/login.html';
        });
    } else {
      window.location.href = '/pages/login.html';
    }
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      window.location.href = '/pages/login.html';
    });
  }
}

/**
 * Hilfsfunktion zum Formatieren eines Datums
 */
function formatDate(dateString) {
  if (!dateString) return '-';

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
 * Toast-Benachrichtigung anzeigen
 */
function showToast(message, type = 'info') {
  // Create toast container if it doesn't exist
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type} fade-in`;
  toast.innerHTML = message;

  // Add to container
  toastContainer.appendChild(toast);

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// Expose global utilities
window.DashboardUI = {
  openModal,
  closeModal,
  showToast,
  formatDate,
};
