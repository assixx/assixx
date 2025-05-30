/**
 * Download a document
 * @param {string} docId - Document ID
 */
function downloadDocument(docId) {
  const token = localStorage.getItem('token');
  if (!token) return;

  // Create a download link and trigger it
  const link = document.createElement('a');
  link.href = `/api/documents/${docId}/download`;
  link.download = '';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

document.addEventListener('DOMContentLoaded', () => {
  // Verwenden stattdessen die einzelnen Elemente direkt
  const documentTableBody = document.getElementById('recent-documents');
  const logoutBtn = document.getElementById('logout-btn');
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');

  // Suchfunktion nur hinzufügen, wenn ein Suchformular vorhanden ist
  if (searchForm && searchInput) {
    searchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = searchInput.value.trim();
      if (query) {
        try {
          const response = await fetch(
            `/employee/search-documents?query=${encodeURIComponent(query)}`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`,
              },
            }
          );
          if (response.ok) {
            const documents = await response.json();
            displayDocuments(documents);
          } else {
            const error = await response.json();
            alert(`Fehler: ${error.message}`);
          }
        } catch (error) {
          console.error('Fehler bei der Dokumentensuche:', error);
          alert(
            'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
          );
        }
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Möchten Sie sich wirklich abmelden?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        window.location.href = '/pages/login.html'; // Umleitung zur Login-Seite
      }
    });
  } else {
    console.error('Logout-Button nicht gefunden');
  }

  loadEmployeeInfo();
  loadDocuments();

  async function loadEmployeeInfo() {
    try {
      const response = await fetch('/employee/info', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
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
      alert(
        'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
      );
    }
  }

  function displayEmployeeInfo(info) {
    // Statt employeeDetails zu verwenden, aktualisieren wir einzelne Elemente
    try {
      // Aktualisiere den Benutzernamen in der Überschrift
      const employeeName = document.getElementById('employee-name');
      if (employeeName) {
        employeeName.textContent = `${info.first_name} ${info.last_name}`;
      }

      // Aktualisiere die Mitarbeiter-ID
      const employeeId = document.getElementById('employee-id');
      if (employeeId) {
        employeeId.textContent = info.employee_id || '-';
      }

      // Aktualisiere die Abteilung, falls vorhanden
      const employeeDepartment = document.getElementById('employee-department');
      if (employeeDepartment) {
        employeeDepartment.textContent = info.department || '-';
      }

      // Aktualisiere die Position, falls vorhanden
      const employeePosition = document.getElementById('employee-position');
      if (employeePosition) {
        employeePosition.textContent = info.position || '-';
      }

      // Aktualisiere den Benutzerinfo-Text in der Kopfzeile
      const userInfo = document.getElementById('user-info');
      if (userInfo) {
        userInfo.textContent = `${info.first_name} ${info.last_name}`;
      }
    } catch (error) {
      console.error(
        'Fehler beim Aktualisieren der Mitarbeiterinformationen:',
        error
      );
      // Kein Alert anzeigen, um nervige Meldungen zu vermeiden
    }
  }

  async function loadDocuments() {
    try {
      const response = await fetch('/employee/documents', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const documents = await response.json();

        // No-documents Bereich anzeigen/ausblenden
        const noDocumentsElement = document.getElementById('no-documents');
        if (noDocumentsElement) {
          noDocumentsElement.style.display =
            documents.length === 0 ? 'block' : 'none';
        }

        // Aktualisiere den Dokumentenzähler
        const documentCount = document.getElementById('document-count');
        if (documentCount) {
          documentCount.textContent = documents.length;
        }

        displayDocuments(documents);
      } else {
        const error = await response.json();
        alert(`Fehler: ${error.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Dokumente:', error);
      alert(
        'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
      );
    }
  }

  function displayDocuments(documents) {
    const recentDocs = documentTableBody; // Verwende die bereits definierte Referenz
    if (!recentDocs) {
      console.error('Element für Dokumente nicht gefunden');
      return;
    }

    // Debug-Informationen

    // Zeige Nachricht, wenn keine Dokumente vorhanden sind
    if (!documents || documents.length === 0) {
      recentDocs.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 20px;">
                        <div style="color: var(--text-secondary);">
                            <p>Keine Dokumente vorhanden</p>
                        </div>
                    </td>
                </tr>
            `;

      // Zeige den no-documents Bereich an
      const noDocumentsElement = document.getElementById('no-documents');
      if (noDocumentsElement) {
        noDocumentsElement.style.display = 'block';
      }

      return;
    }

    // Elemente sortieren (neueste zuerst)
    const sortedDocuments = [...documents].sort(
      (a, b) => new Date(b.upload_date) - new Date(a.upload_date)
    );

    // Beschränke die Anzeige auf das neueste Dokument
    const maxDocumentsToShow = Math.min(sortedDocuments.length, 1);
    const recentDocuments = sortedDocuments.slice(0, maxDocumentsToShow);

    recentDocs.innerHTML = '';
    recentDocuments.forEach((doc) => {
      const row = document.createElement('tr');
      const formattedDate = new Date(doc.upload_date).toLocaleString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      row.innerHTML = `
                <td>
                    <div>${doc.file_name}</div>
                    <div class="text-secondary" style="font-size: 0.85em">${doc.category || 'Allgemein'}</div>
                </td>
                <td>${formattedDate}</td>
                <td>
                    <button class="btn btn-sm btn-primary download-btn" data-document-id="${doc.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Herunterladen
                    </button>
                </td>
            `;
      recentDocs.appendChild(row);
    });

    // Event-Listener für Dokument-Download-Buttons hinzufügen
    document.querySelectorAll('.download-btn').forEach((button) => {
      // Event-Listener nur hinzufügen, wenn noch keiner existiert
      if (!button.hasAttribute('data-has-click-listener')) {
        button.setAttribute('data-has-click-listener', 'true');
        button.addEventListener('click', function (e) {
          // Verhindere Standardaktion und Bubbling
          e.preventDefault();
          e.stopPropagation();

          const docId = this.getAttribute('data-document-id');
          if (docId) {
            // Verwende die downloadDocument-Funktion
            downloadDocument(docId);
          }
        });
      }
    });
  }

  // Verbesserte Download-Funktion
  window.downloadDocument = function (documentId) {
    try {
      // Den Token aus dem localStorage holen
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Sie müssen angemeldet sein, um Dokumente herunterzuladen.');
        return;
      }

      // Einen Lade-Indikator anzeigen
      const downloadBtn = document.querySelector(
        `button[data-document-id="${documentId}"]`
      );
      if (downloadBtn) {
        const originalText = downloadBtn.textContent;
        downloadBtn.textContent = 'Wird geladen...';
        downloadBtn.disabled = true;

        // Nach Abschluss wieder aktivieren
        setTimeout(() => {
          downloadBtn.textContent = originalText;
          downloadBtn.disabled = false;
        }, 3000);
      }

      // Fetch API mit Auth-Header verwenden
      fetch(`/employee/documents/${documentId}?inline=true`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((response) => {
          if (!response.ok) {
            if (response.status === 401) {
              throw new Error(
                'Authentifizierungsfehler. Bitte melden Sie sich erneut an.'
              );
            }
            throw new Error(`HTTP Fehler: ${response.status}`);
          }
          return response.blob();
        })
        .then((blob) => {
          // URL zum Blob erstellen
          const url = URL.createObjectURL(blob);

          // Das Dokument in einem neuen Tab öffnen
          const newWindow = window.open(url, '_blank');

          // Fallback wenn popup blockiert
          if (
            !newWindow ||
            newWindow.closed ||
            typeof newWindow.closed === 'undefined'
          ) {
            alert(
              'Pop-up wurde blockiert. Bitte erlauben Sie Pop-ups für diese Seite.'
            );

            // Alternativ einen unsichtbaren Link erstellen und klicken
            const a = document.createElement('a');
            a.href = url;
            a.download = `dokument-${documentId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }

          // URL-Objekt später freigeben
          setTimeout(() => {
            URL.revokeObjectURL(url);
          }, 100);
        })
        .catch((error) => {
          console.error('Fehler beim Herunterladen des Dokuments:', error);
          alert(error.message || 'Fehler beim Herunterladen des Dokuments');

          // Button wieder aktivieren, wenn ein Fehler auftritt
          if (downloadBtn) {
            downloadBtn.textContent = 'Download';
            downloadBtn.disabled = false;
          }
        });
    } catch (error) {
      console.error('Fehler beim Herunterladen des Dokuments:', error);
      alert(
        'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
      );
    }
  };

  // Logout-Funktion ist in den Event-Listener integriert
});
