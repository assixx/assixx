/**
 * Document Upload Script
 * Handles file uploads for employees
 */

import type { User } from '../types/api.types';

import { getAuthToken } from './auth';
import notificationService from './services/notification.service';

interface UploadFormElements extends HTMLFormControlsCollection {
  userId: HTMLSelectElement;
  category: HTMLSelectElement;
  document: HTMLInputElement;
  description?: HTMLTextAreaElement;
  tags?: HTMLInputElement;
}

interface UploadForm extends HTMLFormElement {
  readonly elements: UploadFormElements;
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  console.info('Upload document script loaded');

  // Load employees for dropdown
  void loadEmployees();

  // Register form events
  const uploadForm = document.querySelector('#upload-form');
  if (uploadForm !== null) {
    console.info('Upload form found');
    uploadForm.addEventListener('submit', (e) => {
      void uploadDocument(e);
    });
  } else {
    console.error('Upload form not found');
  }

  // File selection event
  const fileInput = document.querySelector('#file-input');
  const fileNameSpan = document.querySelector('#file-name');

  if (fileInput !== null && fileNameSpan !== null) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        fileNameSpan.textContent = fileInput.files[0].name;
      } else {
        fileNameSpan.textContent = 'Keine Datei ausgewählt';
      }
    });
  }
});

/**
 * Load employees for dropdown
 */
async function loadEmployees(): Promise<void> {
  console.info('Loading employees');
  const token = getAuthToken();

  if (token === null || token === '') {
    console.error('No authentication token');
    return;
  }

  try {
    const useV2Users = window.FEATURE_FLAGS?.USE_API_V2_USERS === true;
    const endpoint = useV2Users ? '/api/v2/users' : '/api/users';
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const employees = (await response.json()) as User[];
      const userSelect = document.querySelector('#user-select');

      if (userSelect !== null) {
        // Add employees to dropdown
        userSelect.innerHTML = '<option value="">-- Mitarbeiter auswählen --</option>';

        employees.forEach((employee: User) => {
          const option = document.createElement('option');
          option.value = employee.id.toString();
          const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
          option.textContent = fullName !== '' ? fullName : employee.username;
          userSelect.append(option);
        });

        console.info(`Loaded ${employees.length} employees for select`);
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

/**
 * Upload document
 */
async function uploadDocument(e: Event): Promise<void> {
  e.preventDefault();
  console.info('Uploading document');

  const form = e.target as UploadForm;
  const formData = new FormData(form);
  const token = getAuthToken();

  if (token === null || token === '') {
    notificationService.error('Authentifizierung erforderlich', 'Bitte melden Sie sich erneut an');
    return;
  }

  // Check critical fields
  const userId = formData.get('userId') as string;
  const file = formData.get('document') as File | null;

  if (userId === '') {
    notificationService.error('Fehler', 'Bitte wählen Sie einen Mitarbeiter aus');
    return;
  }

  if (file === null || file.size === 0) {
    notificationService.error('Fehler', 'Bitte wählen Sie eine Datei aus');
    return;
  }

  // Success and error elements
  const successElem = document.querySelector('#upload-success');
  const errorElem = document.querySelector('#upload-error');

  // Hide previous messages
  if (successElem) successElem.style.display = 'none';
  if (errorElem) errorElem.style.display = 'none';

  // Show loading state
  const submitButton = form.querySelector('button[type="submit"]');
  const originalText = submitButton?.textContent ?? 'Hochladen';
  if (submitButton) {
    (submitButton as HTMLButtonElement).disabled = true;
    submitButton.textContent = 'Wird hochgeladen...';
  }

  try {
    console.info('Sending upload request');
    const useV2Documents = window.FEATURE_FLAGS?.USE_API_V2_DOCUMENTS === true;
    const endpoint = useV2Documents ? '/api/v2/documents' : '/api/documents';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const result = (await response.json()) as { message?: string; error?: string };

    if (response.ok) {
      console.info('Upload successful:', result);

      // Show success message
      if (successElem) {
        successElem.textContent = result.message ?? 'Dokument erfolgreich hochgeladen!';
        successElem.style.display = 'block';
      }

      // Reset form
      form.reset();

      // Reset file name display
      const fileNameSpan = document.querySelector('#file-name');
      if (fileNameSpan !== null) {
        fileNameSpan.textContent = 'Keine Datei ausgewählt';
      }

      // Reload document list if exists
      interface WindowWithLoadDocuments extends Window {
        loadDocuments?: () => void;
      }
      const windowWithDocs = window as unknown as WindowWithLoadDocuments;
      if (typeof windowWithDocs.loadDocuments === 'function') {
        windowWithDocs.loadDocuments();
      }
    } else {
      console.error('Upload failed:', result);
      if (errorElem) {
        errorElem.textContent = result.error ?? 'Fehler beim Hochladen des Dokuments';
        errorElem.style.display = 'block';
      }
    }
  } catch (error) {
    console.error('Error uploading document:', error);
    if (errorElem) {
      errorElem.textContent = 'Netzwerkfehler beim Hochladen des Dokuments';
      errorElem.style.display = 'block';
    }
  } finally {
    // Reset button state
    if (submitButton) {
      (submitButton as HTMLButtonElement).disabled = false;
      submitButton.textContent = originalText;
    }
  }
}

// Export functions to window for backwards compatibility
if (typeof window !== 'undefined') {
  interface WindowWithUploadFunctions extends Window {
    loadEmployees: typeof loadEmployees;
    uploadDocument: typeof uploadDocument;
  }
  (window as unknown as WindowWithUploadFunctions).loadEmployees = loadEmployees;
  (window as unknown as WindowWithUploadFunctions).uploadDocument = uploadDocument;
}
