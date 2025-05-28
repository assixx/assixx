// Dokument-Upload-Skript
document.addEventListener('DOMContentLoaded', () => {
  console.log('Upload document script loaded');

  // Lade Mitarbeiter für das Dropdown
  loadEmployees();

  // Formular-Events registrieren
  const uploadForm = document.getElementById('upload-form');
  if (uploadForm) {
    console.log('Upload form found');
    uploadForm.addEventListener('submit', uploadDocument);
  } else {
    console.error('Upload form not found');
  }

  // Datei-Auswahl-Event
  const fileInput = document.getElementById('file-input');
  const fileNameSpan = document.getElementById('file-name');
  if (fileInput && fileNameSpan) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        fileNameSpan.textContent = fileInput.files[0].name;
      } else {
        fileNameSpan.textContent = 'Keine Datei ausgewählt';
      }
    });
  }
});

// Mitarbeiter für Dropdown laden
async function loadEmployees() {
  console.log('Loading employees');
  const token = localStorage.getItem('token');
  try {
    const response = await fetch('/admin/employees', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const employees = await response.json();
      const userSelect = document.getElementById('user-select');

      if (userSelect) {
        // Mitarbeiter zum Dropdown hinzufügen
        userSelect.innerHTML =
          '<option value="">-- Mitarbeiter auswählen --</option>';
        employees.forEach((employee) => {
          const option = document.createElement('option');
          option.value = employee.id;
          option.textContent = `${employee.first_name} ${employee.last_name}`;
          userSelect.appendChild(option);
        });
        console.log(`Loaded ${employees.length} employees for select`);
      } else {
        console.error('User select element not found');
      }
    } else {
      console.error('Failed to load employees');
    }
  } catch (error) {
    console.error('Error loading employees:', error);
  }
}

// Dokument hochladen
async function uploadDocument(e) {
  e.preventDefault();
  console.log('Uploading document');

  const form = e.target;
  const formData = new FormData(form);
  const token = localStorage.getItem('token');

  // Überprüfe kritische Felder
  const userId = formData.get('userId');
  const file = formData.get('document');

  if (!userId) {
    alert('Bitte wählen Sie einen Mitarbeiter aus');
    return;
  }

  if (!file || file.size === 0) {
    alert('Bitte wählen Sie eine Datei aus');
    return;
  }

  // Erfolgs- und Fehlerelemente
  const successElem = document.getElementById('upload-success');
  const errorElem = document.getElementById('upload-error');

  try {
    console.log('Sending upload request');
    const response = await fetch('/documents/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const result = await response.json();

    if (response.ok) {
      console.log('Upload successful:', result);
      if (successElem) {
        successElem.textContent = 'Dokument wurde erfolgreich hochgeladen!';
        successElem.style.display = 'block';

        if (errorElem) {
          errorElem.style.display = 'none';
        }
      }
      form.reset();
      if (fileNameSpan) {
        fileNameSpan.textContent = 'Keine Datei ausgewählt';
      }

      // Nach 3 Sekunden Erfolgsmeldung ausblenden
      setTimeout(() => {
        if (successElem) {
          successElem.style.display = 'none';
        }
      }, 3000);
    } else {
      console.error('Upload failed:', result);
      if (errorElem) {
        errorElem.textContent = `Fehler: ${result.message || 'Unbekannter Fehler'}`;
        errorElem.style.display = 'block';

        if (successElem) {
          successElem.style.display = 'none';
        }
      }
    }
  } catch (error) {
    console.error('Error uploading document:', error);
    if (errorElem) {
      errorElem.textContent = `Fehler: ${error.message || 'Unbekannter Fehler'}`;
      errorElem.style.display = 'block';

      if (successElem) {
        successElem.style.display = 'none';
      }
    }
  }
}
