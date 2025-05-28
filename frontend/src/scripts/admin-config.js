document.addEventListener('DOMContentLoaded', () => {
  // DOM-Elemente
  const updateAdminForm = document.getElementById('update-admin-form');
  const adminDetailsContainer = document.getElementById('admin-details');
  const adminUsernameTitle = document.getElementById('admin-username');
  const backBtn = document.getElementById('back-btn');
  const tabButtons = document.querySelectorAll('.tab-btn');

  // URL-Parameter abrufen
  const urlParams = new URLSearchParams(window.location.search);
  const adminId = urlParams.get('id');
  const adminUsername = urlParams.get('username');

  // Admin-ID im Formular speichern
  document.getElementById('admin-id').value = adminId;

  // Admin-Username im Titel anzeigen
  if (adminUsername) {
    adminUsernameTitle.textContent = `Admin bearbeiten: ${adminUsername}`;
  }

  // Tab-Wechsel-Funktionalität
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      // Aktiven Tab-Button setzen
      tabButtons.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');

      // Aktiven Tab-Inhalt setzen
      const tabId = button.getAttribute('data-tab');
      document.querySelectorAll('.tab-content').forEach((tab) => {
        tab.classList.remove('active');
      });
      document.getElementById(tabId).classList.add('active');

      // Logs laden
      const days =
        tabId === 'logs-3days'
          ? 3
          : tabId === 'logs-10days'
            ? 10
            : tabId === 'logs-30days'
              ? 30
              : 0; // 0 für "alle"
      loadAdminLogs(adminId, days);
    });
  });

  // Event-Listener
  updateAdminForm.addEventListener('submit', updateAdmin);
  backBtn.addEventListener('click', () => {
    window.location.href = '/root-dashboard';
  });

  // Daten laden
  loadAdminDetails(adminId);
  loadAdminLogs(adminId, 3); // Standardmäßig die letzten 3 Tage laden

  // Funktionen
  async function loadAdminDetails(adminId) {
    try {
      const response = await fetch(`/root/admin/${adminId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const admin = await response.json();
        displayAdminDetails(admin);
        populateAdminForm(admin);
      } else {
        const error = await response.json();
        alert(`Fehler: ${error.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Admin-Details:', error);
      alert(
        'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
      );
    }
  }

  function displayAdminDetails(admin) {
    const createdAt = new Date(admin.created_at).toLocaleString();

    adminDetailsContainer.innerHTML = `
            <p><strong>Benutzer-ID:</strong> ${admin.id}</p>
            <p><strong>Registriert am:</strong> ${createdAt}</p>
            ${admin.last_login ? `<p><strong>Letzter Login:</strong> ${new Date(admin.last_login).toLocaleString()}</p>` : ''}
        `;
  }

  function populateAdminForm(admin) {
    document.getElementById('username').value = admin.username || '';
    document.getElementById('email').value = admin.email || '';
    document.getElementById('company').value = admin.company || '';
    document.getElementById('notes').value = admin.notes || '';
    // Passwort wird nicht ausgefüllt, da es nicht im Klartext gespeichert wird
  }

  async function updateAdmin(e) {
    e.preventDefault();

    const formData = new FormData(updateAdminForm);
    const adminData = Object.fromEntries(formData.entries());

    // Leere Passwort-Felder entfernen, damit das Passwort nicht geändert wird
    if (!adminData.new_password) {
      delete adminData.new_password;
    }

    try {
      const response = await fetch(`/root/admin/${adminId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(adminData),
      });

      if (response.ok) {
        alert('Admin-Daten erfolgreich aktualisiert');
        // Admin-Details neu laden
        loadAdminDetails(adminId);
      } else {
        const error = await response.json();
        alert(`Fehler: ${error.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Admins:', error);
      alert(
        'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
      );
    }
  }

  async function loadAdminLogs(adminId, days) {
    try {
      let url = `/root/admin/${adminId}/logs`;
      if (days > 0) {
        url += `?days=${days}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const logs = await response.json();
        displayAdminLogs(logs, days);
      } else {
        const error = await response.json();
        console.error(`Fehler beim Laden der Logs: ${error.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Admin-Logs:', error);
    }
  }

  function displayAdminLogs(logs, days) {
    const tableId =
      days === 3
        ? 'logs-3days-body'
        : days === 10
          ? 'logs-10days-body'
          : days === 30
            ? 'logs-30days-body'
            : 'logs-all-body';

    const tableBody = document.getElementById(tableId);

    if (!logs || logs.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Keine Logs gefunden</td></tr>`;
      return;
    }

    tableBody.innerHTML = '';

    logs.forEach((log) => {
      const row = document.createElement('tr');

      const timestamp = new Date(log.timestamp).toLocaleString();
      const action = log.action || 'Login';
      const ipAddress = log.ip_address || '-';
      const status =
        log.status === 'success'
          ? '<span style="color: green;">Erfolgreich</span>'
          : '<span style="color: red;">Fehlgeschlagen</span>';

      row.innerHTML = `
                <td>${timestamp}</td>
                <td>${action}</td>
                <td>${ipAddress}</td>
                <td>${status}</td>
            `;

      tableBody.appendChild(row);
    });
  }
});
