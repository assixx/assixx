/**
 * employee-deletion.ts
 * Erweiterte Funktionen für die Mitarbeiter-Löschung im Admin-Dashboard.
 * Bietet Optionen zum Archivieren oder vollständigem Löschen von Mitarbeitern,
 * inklusive der Verarbeitung von verknüpften Dokumenten und anderen Daten.
 */

import type { User, Document } from '../types/api.types';
import { getAuthToken } from './auth';

// Variablen für den aktuellen Mitarbeiter und dessen Dokumente
let selectedEmployeeId: number | null = null;
let selectedEmployeeName: string = '';
let documentCount: number = 0;

/**
 * Zeigt das Mitarbeiter-Löschdialog an mit optionalen Archivierungsoptionen
 * @param {number} employeeId - Die ID des zu löschenden Mitarbeiters
 */
function showDeleteEmployeeDialog(employeeId: number): void {
  selectedEmployeeId = employeeId;

  // Token abrufen
  const token = getAuthToken();
  if (!token) {
    alert('Keine Authentifizierung gefunden. Bitte melden Sie sich erneut an.');
    return;
  }

  // Mitarbeiter-Informationen abrufen für Anzeige im Dialog
  fetch(`/api/users/${employeeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error('Mitarbeiter konnte nicht abgerufen werden');
      }
      return response.json();
    })
    .then((employee: User) => {
      selectedEmployeeName = `${employee.first_name ?? ''} ${employee.last_name || ''}`.trim();

      // Prüfen, ob der Mitarbeiter Dokumente hat
      return fetch(`/api/documents?user_id=${employeeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    })
    .then(async (response) => {
      if (!response.ok) {
        // If documents endpoint fails, assume no documents
        console.warn('Dokumente konnten nicht abgerufen werden, fahre fort ohne Dokumentenzählung');
        return [];
      }
      try {
        const data = await response.json();
        return Array.isArray(data) ? data : (data.documents ?? []);
      } catch {
        // If JSON parsing fails, assume no documents
        return [];
      }
    })
    .then((documents: Document[]) => {
      documentCount = Array.isArray(documents) ? documents.length : 0;

      // Dialog-Inhalt zusammenstellen basierend auf den Dokumenten
      let dialogContent = `
      <div class="modal" id="delete-employee-modal" style="display: flex;">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">Mitarbeiter löschen: ${selectedEmployeeName}</h3>
            <button class="modal-close" onclick="hideModal('delete-employee-modal')">&times;</button>
          </div>
          <div class="modal-body">
            <p><strong>Möchten Sie den Mitarbeiter "${selectedEmployeeName}" wirklich löschen?</strong></p>`;

      // Warnung, wenn Dokumente vorhanden sind
      if (documentCount > 0) {
        dialogContent += `
            <div class="alert alert-warning">
              <p><i class="fas fa-exclamation-triangle"></i> <strong>Achtung:</strong> Dieser Mitarbeiter hat ${documentCount} Dokument${documentCount === 1 ? '' : 'e'} zugeordnet.</p>
              <p>Bitte wählen Sie, wie mit diesen Dokumenten verfahren werden soll:</p>
            </div>
            
            <div class="form-group">
              <label class="form-label">
                <input type="radio" name="deletion-option" value="archive" checked>
                Archivieren <small>(Empfohlen)</small>
              </label>
              <p class="option-description">
                Der Mitarbeiter wird als "archiviert" markiert und seine Dokumente werden beibehalten. Er erscheint nicht mehr in der
                regulären Mitarbeiterliste, aber Sie können bei Bedarf auf seine Daten zugreifen.
              </p>
            </div>
            
            <div class="form-group">
              <label class="form-label">
                <input type="radio" name="deletion-option" value="delete">
                Endgültig löschen
              </label>
              <p class="option-description">
                <strong>WARNUNG:</strong> Der Mitarbeiter und alle zugehörigen Dokumente werden dauerhaft gelöscht.
                Diese Aktion kann <strong>nicht</strong> rückgängig gemacht werden.
              </p>
            </div>`;
      } else {
        dialogContent += `
            <p>Für diesen Mitarbeiter sind keine Dokumente vorhanden. Der Mitarbeiter kann gefahrlos gelöscht werden.</p>
            
            <div class="form-group">
              <label class="form-label">
                <input type="radio" name="deletion-option" value="archive">
                Archivieren
              </label>
              <p class="option-description">
                Der Mitarbeiter wird als "archiviert" markiert. Er erscheint nicht mehr in der
                regulären Mitarbeiterliste, aber Sie können ihn später bei Bedarf wiederherstellen.
              </p>
            </div>
            
            <div class="form-group">
              <label class="form-label">
                <input type="radio" name="deletion-option" value="delete" checked>
                Löschen
              </label>
              <p class="option-description">
                Der Mitarbeiter wird aus der Datenbank entfernt.
              </p>
            </div>`;
      }

      dialogContent += `
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" onclick="processEmployeeDeletion()">Bestätigen</button>
            <button type="button" class="btn btn-secondary" onclick="hideModal('delete-employee-modal')">Abbrechen</button>
          </div>
        </div>
      </div>
    `;

      // Dialog zur Seite hinzufügen und anzeigen
      document.body.insertAdjacentHTML('beforeend', dialogContent);
    })
    .catch((error) => {
      console.error('Fehler bei der Anzeige des Lösch-Dialogs:', error);

      alert(`Fehler: ${error.message}`);
    });
}

/**
 * Verarbeitet die Mitarbeiter-Löschung basierend auf der gewählten Option
 */
function processEmployeeDeletion(): void {
  // Gewählte Option ermitteln
  const options = document.getElementsByName('deletion-option') as NodeListOf<HTMLInputElement>;
  let selectedOption = '';

  for (const option of options) {
    if (option.checked) {
      selectedOption = option.value;
      break;
    }
  }

  // Token abrufen
  const token = getAuthToken();
  if (!token) {
    alert('Keine Authentifizierung gefunden. Bitte melden Sie sich erneut an.');
    return;
  }

  // Basierend auf der gewählten Option unterschiedliche Aktionen ausführen
  if (selectedOption === 'archive') {
    // Archivierung ist derzeit nicht implementiert

    alert('Die Archivierungsfunktion ist derzeit nicht verfügbar. Bitte verwenden Sie die Lösch-Option.');
    return;
  } else if (selectedOption === 'delete') {
    // Zusätzliche Bestätigung einholen, wenn Dokumente vorhanden sind
    if (documentCount > 0) {
      const confirmDelete = confirm(
        `WARNUNG: ENDGÜLTIGES LÖSCHEN!\n\n` +
          `Sie sind dabei, den Mitarbeiter "${selectedEmployeeName}" und alle zugehörigen ${documentCount} Dokumente endgültig zu löschen!\n\n` +
          `Diese Aktion kann NICHT rückgängig gemacht werden!\n\n` +
          `Sind Sie absolut sicher, dass Sie fortfahren möchten?`,
      );

      if (!confirmDelete) {
        return; // Abbrechen, wenn der Benutzer nicht bestätigt
      }

      // Delete verwenden, um Mitarbeiter zu löschen
      fetch(`/api/users/${selectedEmployeeId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then(async (response) => {
          if (response.ok) {
            // Try to parse JSON response, but don't fail if it's not JSON
            try {
              const result = await response.json();
              if (result.message) {
                alert(result.message);
              } else {
                alert(
                  `Mitarbeiter "${selectedEmployeeName}" und alle zugehörigen Dokumente wurden endgültig gelöscht.`,
                );
              }
            } catch {
              alert(`Mitarbeiter "${selectedEmployeeName}" und alle zugehörigen Dokumente wurden endgültig gelöscht.`);
            }
            hideModal('delete-employee-modal');

            // Mitarbeiterliste aktualisieren
            interface WindowWithTables2 extends Window {
              loadEmployeesTable?: () => Promise<void>;
              loadDashboardStats?: () => Promise<void>;
            }
            const windowWithTables2 = window as unknown as WindowWithTables2;
            if (typeof windowWithTables2.loadEmployeesTable === 'function') {
              windowWithTables2.loadEmployeesTable();
            }

            // Dashboard-Statistiken aktualisieren
            if (typeof windowWithTables2.loadDashboardStats === 'function') {
              windowWithTables2.loadDashboardStats();
            }
          } else {
            // Handle error response
            try {
              const error = await response.json();

              alert(`Fehler: ${error.message ?? 'Unbekannter Fehler beim Löschen des Mitarbeiters'}`);
            } catch {
              alert('Fehler beim Löschen des Mitarbeiters');
            }
          }
        })
        .catch((error) => {
          console.error('Fehler beim endgültigen Löschen des Mitarbeiters:', error);

          alert(`Fehler: ${error.message}`);
        });
    } else {
      // Normales Löschen ohne Dokumente
      fetch(`/api/users/${selectedEmployeeId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then(async (response) => {
          if (response.ok) {
            // Try to parse JSON response, but don't fail if it's not JSON
            try {
              const result = await response.json();
              if (result.message) {
                alert(result.message);
              } else {
                alert(`Mitarbeiter "${selectedEmployeeName}" wurde erfolgreich gelöscht.`);
              }
            } catch {
              alert(`Mitarbeiter "${selectedEmployeeName}" wurde erfolgreich gelöscht.`);
            }
            hideModal('delete-employee-modal');

            // Mitarbeiterliste aktualisieren
            interface WindowWithTables2 extends Window {
              loadEmployeesTable?: () => Promise<void>;
              loadDashboardStats?: () => Promise<void>;
            }
            const windowWithTables2 = window as unknown as WindowWithTables2;
            if (typeof windowWithTables2.loadEmployeesTable === 'function') {
              windowWithTables2.loadEmployeesTable();
            }

            // Dashboard-Statistiken aktualisieren
            if (typeof windowWithTables2.loadDashboardStats === 'function') {
              windowWithTables2.loadDashboardStats();
            }
          } else {
            // Handle error response
            try {
              const error = await response.json();

              alert(`Fehler: ${error.message ?? 'Unbekannter Fehler beim Löschen des Mitarbeiters'}`);
            } catch {
              alert('Fehler beim Löschen des Mitarbeiters');
            }
          }
        })
        .catch((error) => {
          console.error('Fehler beim Löschen des Mitarbeiters:', error);

          alert(`Fehler: ${error.message}`);
        });
    }
  }
}

/**
 * Hide modal utility function
 */
function hideModal(modalId: string): void {
  const modal = document.getElementById(modalId) as HTMLElement;
  if (modal) {
    modal.remove();
  }
}

/**
 * Überschreibt die ursprüngliche deleteEmployee-Funktion mit der verbesserten Version
 */
function deleteEmployee(employeeId: number): void {
  showDeleteEmployeeDialog(employeeId);
}

// Export functions to window for backwards compatibility
if (typeof window !== 'undefined') {
  interface WindowWithDeletionFunctions extends Window {
    showDeleteEmployeeDialog: typeof showDeleteEmployeeDialog;
    processEmployeeDeletion: typeof processEmployeeDeletion;
    deleteEmployee: typeof deleteEmployee;
    hideModal: typeof hideModal;
  }
  const windowWithDeletion = window as unknown as WindowWithDeletionFunctions;
  windowWithDeletion.showDeleteEmployeeDialog = showDeleteEmployeeDialog;
  windowWithDeletion.processEmployeeDeletion = processEmployeeDeletion;
  windowWithDeletion.deleteEmployee = deleteEmployee;
  windowWithDeletion.hideModal = hideModal;
}

// Export for module usage
export { showDeleteEmployeeDialog, processEmployeeDeletion, deleteEmployee, hideModal };
