/**
 * employee-deletion.ts
 * Erweiterte Funktionen für die Mitarbeiter-Löschung im Admin-Dashboard.
 * Bietet Optionen zum Archivieren oder vollständigem Löschen von Mitarbeitern,
 * inklusive der Verarbeitung von verknüpften Dokumenten und anderen Daten.
 */

import type { User, Document } from '../types/api.types';

import { getAuthToken, showError, showSuccess } from './auth';

// Variablen für den aktuellen Mitarbeiter und dessen Dokumente
let selectedEmployeeId: number | null = null;
let selectedEmployeeName = '';
let documentCount = 0;

/**
 * Zeigt das Mitarbeiter-Löschdialog an mit optionalen Archivierungsoptionen
 * @param {number} employeeId - Die ID des zu löschenden Mitarbeiters
 */
function showDeleteEmployeeDialog(employeeId: number): void {
  selectedEmployeeId = employeeId;

  // Token abrufen
  const token = getAuthToken();
  if (token === null || token === '') {
    showError('Keine Authentifizierung gefunden. Bitte melden Sie sich erneut an.');
    return;
  }

  // Mitarbeiter-Informationen abrufen für Anzeige im Dialog
  fetch(`/api/users/${employeeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error('Mitarbeiter konnte nicht abgerufen werden');
      }
      return response.json() as Promise<User>;
    })
    .then(async (employee: User) => {
      selectedEmployeeName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();

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
        const data = (await response.json()) as Document[] | { documents?: Document[] };
        return Array.isArray(data) ? data : (data.documents ?? []);
      } catch {
        // If JSON parsing fails, assume no documents
        return [] as Document[];
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
    .catch((error: unknown) => {
      console.error('Fehler bei der Anzeige des Lösch-Dialogs:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      showError(`Fehler: ${errorMessage}`);
    });
}

/**
 * Verarbeitet die Mitarbeiter-Löschung basierend auf der gewählten Option
 */
function processEmployeeDeletion(): void {
  // Gewählte Option ermitteln
  const options = document.querySelectorAll('[name="deletion-option"]');
  let selectedOption = '';

  for (const option of options) {
    if (option.checked) {
      selectedOption = option.value;
      break;
    }
  }

  // Token abrufen
  const token = getAuthToken();
  if (token === null || token === '') {
    showError('Keine Authentifizierung gefunden. Bitte melden Sie sich erneut an.');
    return;
  }

  // Basierend auf der gewählten Option unterschiedliche Aktionen ausführen
  if (selectedOption === 'archive') {
    // Archivierung ist derzeit nicht implementiert

    showError('Die Archivierungsfunktion ist derzeit nicht verfügbar. Bitte verwenden Sie die Lösch-Option.');
  } else if (selectedOption === 'delete') {
    // Zusätzliche Bestätigung einholen, wenn Dokumente vorhanden sind
    if (documentCount > 0) {
      // Skip confirmation dialog for now - rely on UI confirmation
      // This should be replaced with a proper modal confirmation in production

      // Delete verwenden, um Mitarbeiter zu löschen
      fetch(`/api/users/${selectedEmployeeId ?? ''}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then(async (response) => {
          if (response.ok) {
            // Try to parse JSON response, but don't fail if it's not JSON
            try {
              const result = (await response.json()) as { message?: string };
              const message =
                result.message !== undefined && result.message !== ''
                  ? result.message
                  : `Mitarbeiter "${selectedEmployeeName}" und alle zugehörigen Dokumente wurden endgültig gelöscht.`;
              showSuccess(message);
            } catch {
              showSuccess(
                `Mitarbeiter "${selectedEmployeeName}" und alle zugehörigen Dokumente wurden endgültig gelöscht.`,
              );
            }
            hideModal('delete-employee-modal');

            // Mitarbeiterliste aktualisieren
            interface WindowWithTables2 extends Window {
              loadEmployeesTable?: () => Promise<void>;
              loadDashboardStats?: () => Promise<void>;
            }
            const windowWithTables2 = window as unknown as WindowWithTables2;
            if (typeof windowWithTables2.loadEmployeesTable === 'function') {
              void windowWithTables2.loadEmployeesTable();
            }

            // Dashboard-Statistiken aktualisieren
            if (typeof windowWithTables2.loadDashboardStats === 'function') {
              void windowWithTables2.loadDashboardStats();
            }
          } else {
            // Handle error response
            try {
              const error = (await response.json()) as { message?: string };
              const errorMessage = error.message ?? 'Unbekannter Fehler beim Löschen des Mitarbeiters';
              showError(`Fehler: ${errorMessage}`);
            } catch {
              showError('Fehler beim Löschen des Mitarbeiters');
            }
          }
        })
        .catch((error: unknown) => {
          console.error('Fehler beim endgültigen Löschen des Mitarbeiters:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
          showError(`Fehler: ${errorMessage}`);
        });
    } else {
      // Normales Löschen ohne Dokumente
      fetch(`/api/users/${selectedEmployeeId ?? ''}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then(async (response) => {
          if (response.ok) {
            // Try to parse JSON response, but don't fail if it's not JSON
            try {
              const result = (await response.json()) as { message?: string };
              const message =
                result.message !== undefined && result.message !== ''
                  ? result.message
                  : `Mitarbeiter "${selectedEmployeeName}" wurde erfolgreich gelöscht.`;
              showSuccess(message);
            } catch {
              showSuccess(`Mitarbeiter "${selectedEmployeeName}" wurde erfolgreich gelöscht.`);
            }
            hideModal('delete-employee-modal');

            // Mitarbeiterliste aktualisieren
            interface WindowWithTables2 extends Window {
              loadEmployeesTable?: () => Promise<void>;
              loadDashboardStats?: () => Promise<void>;
            }
            const windowWithTables2 = window as unknown as WindowWithTables2;
            if (typeof windowWithTables2.loadEmployeesTable === 'function') {
              void windowWithTables2.loadEmployeesTable();
            }

            // Dashboard-Statistiken aktualisieren
            if (typeof windowWithTables2.loadDashboardStats === 'function') {
              void windowWithTables2.loadDashboardStats();
            }
          } else {
            // Handle error response
            try {
              const error = (await response.json()) as { message?: string };
              const errorMessage = error.message ?? 'Unbekannter Fehler beim Löschen des Mitarbeiters';
              showError(`Fehler: ${errorMessage}`);
            } catch {
              showError('Fehler beim Löschen des Mitarbeiters');
            }
          }
        })
        .catch((error: unknown) => {
          console.error('Fehler beim Löschen des Mitarbeiters:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
          showError(`Fehler: ${errorMessage}`);
        });
    }
  }
}

/**
 * Hide modal utility function
 */
function hideModal(modalId: string): void {
  const modal = document.getElementById(modalId);
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
