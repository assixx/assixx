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

  if (fileInput instanceof HTMLInputElement && fileNameSpan !== null) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files !== null && fileInput.files.length > 0) {
        fileNameSpan.textContent = fileInput.files[0].name;
      } else {
        fileNameSpan.textContent = 'Keine Datei ausgewählt';
      }
    });
  }
});

/**
 * Get employee display name
 */
function getEmployeeDisplayName(employee: User): string {
  const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
  return fullName !== '' ? fullName : employee.username;
}

/**
 * Populate employee select dropdown
 */
function populateEmployeeSelect(userSelect: Element, employees: User[]): void {
  // Clear existing options
  while (userSelect.firstChild !== null) {
    userSelect.firstChild.remove();
  }

  // Add default option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '-- Mitarbeiter auswählen --';
  userSelect.append(defaultOption);

  // Add employee options
  employees.forEach((employee: User) => {
    const option = document.createElement('option');
    option.value = employee.id.toString();
    option.textContent = getEmployeeDisplayName(employee);
    userSelect.append(option);
  });

  console.info(`Loaded ${employees.length} employees for select`);
}

/**
 * Fetch employees from API
 */
async function fetchEmployees(token: string): Promise<User[] | null> {
  const useV2Users = window.FEATURE_FLAGS?.USE_API_V2_USERS === true;
  const endpoint = useV2Users ? '/api/v2/users' : '/api/users';

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    console.error('Failed to load employees');
    return null;
  }

  return (await response.json()) as User[];
}

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
    const employees = await fetchEmployees(token);
    if (employees === null) {
      return;
    }

    const userSelect = document.querySelector('#user-select');
    if (userSelect === null) {
      console.error('User select element not found');
      return;
    }

    populateEmployeeSelect(userSelect, employees);
  } catch (error) {
    console.error('Error loading employees:', error);
  }
}

/**
 * Validate upload form data
 */
function validateUploadForm(formData: FormData, token: string | null): token is string {
  if (token === null || token === '') {
    notificationService.error('Authentifizierung erforderlich', 'Bitte melden Sie sich erneut an');
    return false;
  }

  const userId = formData.get('userId') as string;
  const file = formData.get('document') as File | null;

  if (userId === '') {
    notificationService.error('Fehler', 'Bitte wählen Sie einen Mitarbeiter aus');
    return false;
  }

  if (file === null || file.size === 0) {
    notificationService.error('Fehler', 'Bitte wählen Sie eine Datei aus');
    return false;
  }

  return true;
}

/**
 * Update upload UI state
 */
interface UploadUIElements {
  successElem: HTMLElement | null;
  errorElem: HTMLElement | null;
  submitButton: HTMLElement | null;
  originalText: string;
}

function getUploadUIElements(form: HTMLFormElement): UploadUIElements {
  const buttonElement = form.querySelector('button[type="submit"]');
  const submitButton = buttonElement instanceof HTMLElement ? buttonElement : null;
  return {
    successElem: document.querySelector('#upload-success'),
    errorElem: document.querySelector('#upload-error'),
    submitButton,
    originalText: submitButton?.textContent ?? 'Hochladen',
  };
}

function hideUploadMessages(ui: UploadUIElements): void {
  if (ui.successElem instanceof HTMLElement) ui.successElem.style.display = 'none';
  if (ui.errorElem instanceof HTMLElement) ui.errorElem.style.display = 'none';
}

function setUploadButtonLoading(ui: UploadUIElements, loading: boolean): void {
  if (ui.submitButton instanceof HTMLButtonElement) {
    ui.submitButton.disabled = loading;
    ui.submitButton.textContent = loading ? 'Wird hochgeladen...' : ui.originalText;
  }
}

/**
 * Reset upload form after success
 */
function resetUploadForm(form: HTMLFormElement): void {
  form.reset();

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
}

/**
 * Handle upload success
 */
function handleUploadSuccess(
  ui: UploadUIElements,
  form: HTMLFormElement,
  result: { message?: string; error?: string },
): void {
  console.info('Upload successful:', result);

  if (ui.successElem instanceof HTMLElement) {
    ui.successElem.textContent = result.message ?? 'Dokument erfolgreich hochgeladen!';
    ui.successElem.style.display = 'block';
  }

  resetUploadForm(form);
}

/**
 * Handle upload error
 */
function handleUploadError(ui: UploadUIElements, errorMessage: string): void {
  if (ui.errorElem instanceof HTMLElement) {
    ui.errorElem.textContent = errorMessage;
    ui.errorElem.style.display = 'block';
  }
}

/**
 * Perform the upload request
 */
async function performUploadRequest(
  formData: FormData,
  token: string,
): Promise<{ ok: boolean; result: { message?: string; error?: string } }> {
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
  return { ok: response.ok, result };
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

  if (!validateUploadForm(formData, token)) {
    return;
  }

  const ui = getUploadUIElements(form);
  hideUploadMessages(ui);
  setUploadButtonLoading(ui, true);

  try {
    console.info('Sending upload request');
    const { ok, result } = await performUploadRequest(formData, token);

    if (ok) {
      handleUploadSuccess(ui, form, result);
    } else {
      console.error('Upload failed:', result);
      handleUploadError(ui, result.error ?? 'Fehler beim Hochladen des Dokuments');
    }
  } catch (error) {
    console.error('Error uploading document:', error);
    handleUploadError(ui, 'Netzwerkfehler beim Hochladen des Dokuments');
  } finally {
    setUploadButtonLoading(ui, false);
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
