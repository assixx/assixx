document.addEventListener('DOMContentLoaded', () => {
  const createAdminForm = document.getElementById('create-admin-form');
  const adminTableBody = document.getElementById('admin-table-body');
  const logoutBtn = document.getElementById('logout-btn');

  createAdminForm.addEventListener('submit', createAdmin);
  logoutBtn.addEventListener('click', logout);

  loadAdmins();

  async function createAdmin(e) {
    e.preventDefault();
    const formData = new FormData(createAdminForm);
    const adminData = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('/root/create-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(adminData),
      });

      if (response.ok) {
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

  async function loadAdmins() {
    try {
      const response = await fetch('/root/admins', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const admins = await response.json();
        displayAdmins(admins);
      } else {
        const error = await response.json();
        alert(`Fehler: ${error.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Admins:', error);
      alert(
        'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
      );
    }
  }

  function displayAdmins(admins) {
    adminTableBody.innerHTML = '';
    admins.forEach((admin) => {
      const row = document.createElement('tr');
      row.innerHTML = `
                <td>${admin.username}</td>
                <td>${admin.email}</td>
                <td>${admin.company || '-'}</td>
            `;
      adminTableBody.appendChild(row);
    });
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = '/';
  }
});
