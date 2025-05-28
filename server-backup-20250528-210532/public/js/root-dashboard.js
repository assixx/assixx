document.addEventListener('DOMContentLoaded', () => {
  console.log('Root dashboard script loaded');

  // Elemente aus dem DOM holen
  const createAdminForm = document.getElementById('create-admin-form');
  const adminTableBody = document.getElementById('admin-table-body');
  const logoutBtn = document.getElementById('logout-btn');
  const dashboardContent = document.getElementById('dashboard-data');

  // Event-Listener hinzufügen
  createAdminForm.addEventListener('submit', createAdmin);
  logoutBtn.addEventListener('click', logout);

  // Load user info in header
  loadHeaderUserInfo();

  // Daten laden
  loadDashboardData();
  loadAdmins();
  loadDashboardStats();

  // Admin erstellen
  async function createAdmin(e) {
    e.preventDefault();
    console.log('Creating admin...');
    const formData = new FormData(createAdminForm);
    const adminData = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('/root/create-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(adminData),
      });

      if (response.ok) {
        const result = await response.json();
        alert('Admin erfolgreich erstellt');
        createAdminForm.reset();
        loadAdmins();
      } else {
        const error = await response.json();
        alert(`Fehler: ${error.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Erstellen des Admins:', error);
      alert(
        'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
      );
    }
  }

  // Dashboard-Daten laden
  async function loadDashboardData() {
    console.log('Loading dashboard data...');
    try {
      const response = await fetch('/api/root-dashboard-data', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Dashboard data:', data);
        dashboardContent.innerHTML = `
    <div class="dashboard-stats">
        <div class="stat-box">
            <h3>Nutzerinformationen</h3>
            <p><strong>Benutzername:</strong> ${data.user.username}</p>
            <p><strong>Rolle:</strong> ${data.user.role}</p>
            <p><strong>Benutzer-ID:</strong> ${data.user.id}</p>
        </div>
        <div class="stat-box">
            <h3>Sitzungsinformationen</h3>
            <p><strong>Angemeldet seit:</strong> ${new Date(data.user.iat * 1000).toLocaleString()}</p>
            <p><strong>Sitzung gültig bis:</strong> ${new Date(data.user.exp * 1000).toLocaleString()}</p>
            <p><strong>Verbleibende Zeit:</strong> ${Math.floor((data.user.exp - Date.now() / 1000) / 60)} Minuten</p>
        </div>
    </div>
`;
      } else {
        console.error('Error loading dashboard:', response.status);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  }

  // Dashboard-Statistiken laden
  async function loadDashboardStats() {
    try {
      const [adminsResponse, usersResponse] = await Promise.all([
        fetch('/root/admins', {
          credentials: 'include'
        }),
        fetch('/api/users', {
          credentials: 'include'
        }),
      ]);

      if (adminsResponse.ok && usersResponse.ok) {
        const admins = await adminsResponse.json();
        const users = await usersResponse.json();

        // Update counters
        document.getElementById('admin-count').textContent = admins.length;
        document.getElementById('user-count').textContent = users.length;
        document.getElementById('tenant-count').textContent = '1'; // TODO: Implement tenant count
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }

  // Admin-Liste laden
  async function loadAdmins() {
    try {
      console.log('Loading admins...');
      const response = await fetch('/root/admins', {
        credentials: 'include'
      });

      if (response.ok) {
        const admins = await response.json();
        console.log('Loaded admins:', admins);
        displayAdmins(admins);
        // Update admin count
        document.getElementById('admin-count').textContent = admins.length;
      } else {
        console.error('Error loading admins:', response.status);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Admins:', error);
    }
  }

  // Admin-Liste anzeigen
  function displayAdmins(admins) {
    if (!adminTableBody) return;
    adminTableBody.innerHTML = '';
    admins.forEach((admin) => {
      const row = document.createElement('tr');
      row.innerHTML = `
            <td>${admin.username}</td>
            <td>${admin.email}</td>
            <td>${admin.company || '-'}</td>
            <td>
                <button 
                    class="config-btn btn btn-success btn-sm" 
                    data-id="${admin.id}" 
                    data-username="${admin.username}">
                    Konfigurieren
                </button>
                <button 
                    class="delete-btn btn btn-danger btn-sm" 
                    data-id="${admin.id}" 
                    data-username="${admin.username}">
                    Löschen
                </button>
            </td>
        `;
      adminTableBody.appendChild(row);
    });

    // Event-Listener für Lösch-Buttons hinzufügen
    document.querySelectorAll('.delete-btn').forEach((button) => {
      button.addEventListener('click', deleteAdmin);
    });

    // Event-Listener für Konfigurations-Buttons hinzufügen
    document.querySelectorAll('.config-btn').forEach((button) => {
      button.addEventListener('click', configureAdmin);
    });
  }

  // Funktion zum Navigieren zur Admin-Konfigurationsseite
  function configureAdmin(e) {
    const adminId = e.target.getAttribute('data-id');
    const adminUsername = e.target.getAttribute('data-username');

    // Zur Konfigurationsseite navigieren und die Admin-ID übergeben
    window.location.href = `/admin-config?id=${adminId}&username=${encodeURIComponent(adminUsername)}`;
  }

  async function deleteAdmin(e) {
    const adminId = e.target.getAttribute('data-id');
    const adminUsername = e.target.getAttribute('data-username');

    if (
      !confirm(
        `Sind Sie sicher, dass Sie den Admin "${adminUsername}" löschen möchten?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/root/delete-admin/${adminId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        alert(`Admin "${adminUsername}" wurde erfolgreich gelöscht.`);
        // Admin-Liste neu laden
        loadAdmins();
      } else {
        const error = await response.json();
        alert(`Fehler: ${error.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Löschen des Admins:', error);
      alert(
        'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
      );
    }
  }

  // Ausloggen
  async function logout() {
    console.log('Logging out...');
    if (confirm('Möchten Sie sich wirklich abmelden?')) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include'
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
      window.location.href = '/';
    }
  }

  // Load user info in header
  async function loadHeaderUserInfo() {
    try {
      const userNameElement = document.getElementById('user-name');
      const userAvatar = document.getElementById('user-avatar');

      if (!userNameElement) return;

      // Try to fetch full user profile
      const response = await fetch('/api/auth/user', {
        credentials: 'include'
      });

      if (response.ok) {
        const userData = await response.json();
        const user = userData.data || userData.user || userData;

        // Update username with full name if available
        if (user.first_name || user.last_name) {
          const fullName =
            `${user.first_name || ''} ${user.last_name || ''}`.trim();
          userNameElement.textContent = fullName || user.username || 'Root';
        } else {
          userNameElement.textContent = user.username || 'Root';
        }

        // Update avatar if available
        if (userAvatar && user.profile_picture_url) {
          userAvatar.src = user.profile_picture_url;
          userAvatar.onerror = function () {
            this.src = '/images/default-avatar.svg';
          };
        }
      } else if (response.status === 401) {
        // Not authenticated, redirect to login
        window.location.href = '/login.html';
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  }
});
