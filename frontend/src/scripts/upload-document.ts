/**
 * Document Upload Script
 * Handles file uploads for employees
 */

import type { User } from '../types/api.types';
import { getAuthToken } from './auth';

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
  loadEmployees();

  // Register form events
  const uploadForm = document.getElementById('upload-form') as UploadForm;
  if (uploadForm) {
    console.info('Upload form found');
    uploadForm.addEventListener('submit', uploadDocument);
  } else {
    console.error('Upload form not found');
  }

  // File selection event
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const fileNameSpan = document.getElementById('file-name') as HTMLSpanElement;

  if (fileInput && fileNameSpan) {
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

  if (!token) {
    console.error('No authentication token');
    return;
  }

  try {
    const response = await fetch('/api/users', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const employees: User[] = await response.json();
      const userSelect = document.getElementById('user-select') as HTMLSelectElement;

      if (userSelect) {
        // Add employees to dropdown
        userSelect.innerHTML = '<option value="">-- Mitarbeiter auswählen --</option>';

        employees.forEach((employee: User) => {
          const option = document.createElement('option');
          option.value = employee.id.toString();
          option.textContent = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.username;
          userSelect.appendChild(option);
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

  if (!token) {
    // eslint-disable-next-line no-alert
    alert('Bitte melden Sie sich erneut an');
    return;
  }

  // Check critical fields
  const userId = formData.get('userId') as string;
  const file = formData.get('document') as File;

  if (!userId) {
    // eslint-disable-next-line no-alert
    alert('Bitte wählen Sie einen Mitarbeiter aus');
    return;
  }

  if (!file || file.size === 0) {
    // eslint-disable-next-line no-alert
    alert('Bitte wählen Sie eine Datei aus');
    return;
  }

  // Success and error elements
  const successElem = document.getElementById('upload-success') as HTMLElement;
  const errorElem = document.getElementById('upload-error') as HTMLElement;

  // Hide previous messages
  if (successElem) successElem.style.display = 'none';
  if (errorElem) errorElem.style.display = 'none';

  // Show loading state
  const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
  const originalText = submitButton?.textContent || 'Hochladen';
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Wird hochgeladen...';
  }

  try {
    console.info('Sending upload request');
    const response = await fetch('/api/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const result = await response.json();

    if (response.ok) {
      console.info('Upload successful:', result);

      // Show success message
      if (successElem) {
        successElem.textContent = result.message || 'Dokument erfolgreich hochgeladen!';
        successElem.style.display = 'block';
      }

      // Reset form
      form.reset();

      // Reset file name display
      const fileNameSpan = document.getElementById('file-name') as HTMLSpanElement;
      if (fileNameSpan) {
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
        errorElem.textContent = result.error || 'Fehler beim Hochladen des Dokuments';
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
      submitButton.disabled = false;
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
