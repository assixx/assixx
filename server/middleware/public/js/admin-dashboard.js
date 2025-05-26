document.addEventListener('DOMContentLoaded', () => {
  const createEmployeeForm = document.getElementById('create-employee-form');
  const employeeTableBody = document.getElementById('employee-table-body');
  const uploadDocumentForm = document.getElementById('upload-document-form');
  const employeeSelect = document.getElementById('employee-select');
  const logoutBtn = document.getElementById('logout-btn');

  createEmployeeForm.addEventListener('submit', createEmployee);
  uploadDocumentForm.addEventListener('submit', uploadDocument);
  logoutBtn.addEventListener('click', logout);

  loadEmployees();

  async function createEmployee(e) {
    e.preventDefault();
    const formData = new FormData(createEmployeeForm);
    const employeeData = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('/admin/create-employee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(employeeData),
      });

      if (response.ok) {
        alert('Mitarbeiter erfolgreich erstellt');
        createEmployeeForm.reset();
        loadEmployees();
      } else {
        const error = await response.json();
        alert(`Fehler: ${error.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Erstellen des Mitarbeiters:', error);
      alert(
        'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
      );
    }
  }

  async function loadEmployees() {
    try {
      const response = await fetch('/admin/employees', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const employees = await response.json();
        displayEmployees(employees);
        populateEmployeeSelect(employees);
      } else {
        const error = await response.json();
        alert(`Fehler: ${error.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Mitarbeiter:', error);
      alert(
        'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
      );
    }
  }

  function displayEmployees(employees) {
    employeeTableBody.innerHTML = '';
    employees.forEach((employee) => {
      const row = document.createElement('tr');
      row.innerHTML = `
                <td>${employee.first_name} ${employee.last_name}</td>
                <td>${employee.email}</td>
                <td>${employee.employee_id}</td>
                <td><button onclick="uploadDocumentFor('${employee.id}')">Dokument hochladen</button></td>
            `;
      employeeTableBody.appendChild(row);
    });
  }

  function populateEmployeeSelect(employees) {
    employeeSelect.innerHTML =
      '<option value="">Mitarbeiter auswählen</option>';
    employees.forEach((employee) => {
      const option = document.createElement('option');
      option.value = employee.id;
      option.textContent = `${employee.first_name} ${employee.last_name}`;
      employeeSelect.appendChild(option);
    });
  }

  async function uploadDocument(e) {
    e.preventDefault();
    const formData = new FormData(uploadDocumentForm);

    try {
      const response = await fetch(
        `/admin/upload-document/${formData.get('employeeId')}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: formData,
        }
      );

      if (response.ok) {
        alert('Dokument erfolgreich hochgeladen');
        uploadDocumentForm.reset();
      } else {
        const error = await response.json();
        alert(`Fehler: ${error.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Hochladen des Dokuments:', error);
      alert(
        'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
      );
    }
  }

  // function uploadDocumentFor(employeeId) {
  //   employeeSelect.value = employeeId;
  //   uploadDocumentForm.scrollIntoView({ behavior: 'smooth' });
  // }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = '/';
  }
});
