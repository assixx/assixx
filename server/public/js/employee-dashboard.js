document.addEventListener('DOMContentLoaded', () => {
    const employeeDetails = document.getElementById('employee-details');
    const documentTableBody = document.getElementById('document-table-body');
    const logoutBtn = document.getElementById('logout-btn');
    const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (query) {
    try {
      const response = await fetch(`/employee/search-documents?query=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const documents = await response.json();
        displayDocuments(documents);
      } else {
        const error = await response.json();
        alert(`Fehler: ${error.message}`);
      }
    } catch (error) {
      console.error('Fehler bei der Dokumentensuche:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    }
  }
});

    logoutBtn.addEventListener('click', logout);

    loadEmployeeInfo();
    loadDocuments();

    async function loadEmployeeInfo() {
        try {
            const response = await fetch('/employee/info', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const employeeInfo = await response.json();
                displayEmployeeInfo(employeeInfo);
            } else {
                const error = await response.json();
                alert(`Fehler: ${error.message}`);
            }
        } catch (error) {
            console.error('Fehler beim Laden der Mitarbeiterinformationen:', error);
            alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
        }
    }

    function displayEmployeeInfo(info) {
        employeeDetails.innerHTML = `
            <p><strong>Name:</strong> ${info.first_name} ${info.last_name}</p>
            <p><strong>E-Mail:</strong> ${info.email}</p>
            <p><strong>Mitarbeiter-ID:</strong> ${info.employee_id}</p>
            <p><strong>Firma:</strong> ${info.company}</p>
        `;
    }

    async function loadDocuments() {
        try {
            const response = await fetch('/employee/documents', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const documents = await response.json();
                displayDocuments(documents);
            } else {
                const error = await response.json();
                alert(`Fehler: ${error.message}`);
            }
        } catch (error) {
            console.error('Fehler beim Laden der Dokumente:', error);
            alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
        }
    }

    function displayDocuments(documents) {
        documentTableBody.innerHTML = '';
        documents.forEach(doc => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${doc.file_name}</td>
                <td>${new Date(doc.upload_date).toLocaleString()}</td>
                <td><button onclick="downloadDocument('${doc.id}')">Herunterladen</button></td>
            `;
            documentTableBody.appendChild(row);
        });
    }

    window.downloadDocument = async function(documentId) {
        try {
            const response = await fetch(`/employee/documents/${documentId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = response.headers.get('Content-Disposition').split('filename=')[1];
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                const error = await response.json();
                alert(`Fehler: ${error.message}`);
            }
        } catch (error) {
            console.error('Fehler beim Herunterladen des Dokuments:', error);
            alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
        }
    }

    function logout() {
        if (confirm('Möchten Sie sich wirklich abmelden?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            window.location.href = '/';
        }
    }
});