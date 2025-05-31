/**
 * Profile Picture Component for Employee Dashboard
 * Handles profile picture upload, preview, and removal
 */

import type { User } from '../types/api.types';
import { getAuthToken, showSuccess, showError } from './auth';

interface ProfilePictureElements {
  container: HTMLElement | null;
  form: HTMLFormElement | null;
  preview: HTMLElement | null;
  fileInput: HTMLInputElement | null;
  uploadButton: HTMLButtonElement | null;
  removeButton: HTMLButtonElement | null;
}

document.addEventListener('DOMContentLoaded', () => {
  // Profile picture elements
  const elements: ProfilePictureElements = {
    container: document.getElementById('profile-picture-container'),
    form: document.getElementById('profile-picture-form') as HTMLFormElement,
    preview: document.getElementById('profile-picture-preview'),
    fileInput: document.getElementById('profile-picture-input') as HTMLInputElement,
    uploadButton: document.getElementById('upload-picture-btn') as HTMLButtonElement,
    removeButton: document.getElementById('remove-picture-btn') as HTMLButtonElement,
  };

  // Load user's profile picture
  loadProfilePicture(elements);

  // Add event listeners
  if (elements.fileInput) {
    elements.fileInput.addEventListener('change', (e) => handleFileSelect(e, elements));
  }

  if (elements.form) {
    elements.form.addEventListener('submit', (e) => uploadProfilePicture(e, elements));
  }

  if (elements.removeButton) {
    elements.removeButton.addEventListener('click', () => removeProfilePicture(elements));
  }
});

/**
 * Load profile picture from server
 */
async function loadProfilePicture(elements: ProfilePictureElements): Promise<void> {
  if (!elements.container || !elements.preview) return;

  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch('/api/user/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const userData: User = await response.json();

      if (userData.profile_picture) {
        // Display the profile picture
        elements.preview.innerHTML = `
          <img src="${userData.profile_picture}" alt="Profile" class="profile-image">
        `;

        // Show remove button
        if (elements.removeButton) {
          elements.removeButton.style.display = 'inline-block';
        }
      } else {
        // Display initials if no profile picture
        const initials = getInitials(userData.first_name, userData.last_name);
        elements.preview.innerHTML = `
          <div class="profile-initials">${initials}</div>
        `;

        // Hide remove button
        if (elements.removeButton) {
          elements.removeButton.style.display = 'none';
        }
      }

      // Also update other profile images on the page
      updateAllProfileImages(userData.profile_picture || null);
    } else {
      console.error('Failed to load user data');
    }
  } catch (error) {
    console.error('Error loading profile picture:', error);
  }
}

/**
 * Get user's initials for profile placeholder
 */
function getInitials(firstName?: string, lastName?: string): string {
  const firstInitial = firstName ? firstName.charAt(0).toUpperCase() : '';
  const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : '';
  return `${firstInitial}${lastInitial}` || 'U';
}

/**
 * Handle file selection
 */
function handleFileSelect(e: Event, elements: ProfilePictureElements): void {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) {
    return;
  }

  // Check file type
  if (!file.type.match('image.*')) {
    // eslint-disable-next-line no-alert
    alert('Bitte wählen Sie eine Bilddatei aus (JPEG, PNG, GIF, etc.).');
    if (elements.fileInput) {
      elements.fileInput.value = '';
    }
    return;
  }

  // Check file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    // eslint-disable-next-line no-alert
    alert('Die Datei ist zu groß. Maximale Größe ist 5MB.');
    if (elements.fileInput) {
      elements.fileInput.value = '';
    }
    return;
  }

  // Show preview
  const reader = new FileReader();
  reader.onload = function (event: ProgressEvent<FileReader>) {
    if (elements.preview && event.target?.result) {
      elements.preview.innerHTML = `
        <img src="${event.target.result}" alt="Preview" class="profile-image">
      `;
    }
  };
  reader.readAsDataURL(file);

  // Enable upload button
  if (elements.uploadButton) {
    elements.uploadButton.disabled = false;
  }
}

/**
 * Upload profile picture
 */
async function uploadProfilePicture(e: Event, elements: ProfilePictureElements): Promise<void> {
  e.preventDefault();

  const token = getAuthToken();
  if (!token || !elements.form || !elements.fileInput) return;

  const file = elements.fileInput.files?.[0];
  if (!file) {
    // eslint-disable-next-line no-alert
    alert('Bitte wählen Sie eine Datei aus.');
    return;
  }

  const formData = new FormData();
  formData.append('profilePicture', file);

  // Disable upload button
  if (elements.uploadButton) {
    elements.uploadButton.disabled = true;
    elements.uploadButton.textContent = 'Wird hochgeladen...';
  }

  try {
    const response = await fetch('/api/user/profile-picture', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const result = await response.json();

    if (response.ok) {
      showSuccess('Profilbild erfolgreich aktualisiert!');

      // Clear file input
      if (elements.fileInput) {
        elements.fileInput.value = '';
      }

      // Show remove button
      if (elements.removeButton) {
        elements.removeButton.style.display = 'inline-block';
      }

      // Update all profile images on the page
      updateAllProfileImages(result.profile_picture || result.url);
    } else {
      showError(result.error || 'Fehler beim Hochladen des Profilbilds.');
    }
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    showError('Netzwerkfehler beim Hochladen des Profilbilds.');
  } finally {
    // Reset upload button
    if (elements.uploadButton) {
      elements.uploadButton.disabled = true;
      elements.uploadButton.textContent = 'Hochladen';
    }
  }
}

/**
 * Remove profile picture
 */
async function removeProfilePicture(elements: ProfilePictureElements): Promise<void> {
  // eslint-disable-next-line no-alert
  if (!confirm('Möchten Sie Ihr Profilbild wirklich entfernen?')) {
    return;
  }

  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch('/api/user/profile-picture', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      showSuccess('Profilbild erfolgreich entfernt!');

      // Reload profile to show initials
      loadProfilePicture(elements);

      // Update all profile images on the page
      updateAllProfileImages(null);
    } else {
      const result = await response.json();
      showError(result.error || 'Fehler beim Entfernen des Profilbilds.');
    }
  } catch (error) {
    console.error('Error removing profile picture:', error);
    showError('Netzwerkfehler beim Entfernen des Profilbilds.');
  }
}

/**
 * Update all profile images on the page
 */
function updateAllProfileImages(imageUrl: string | null): void {
  // Update navbar avatar
  const navbarAvatar = document.getElementById('user-avatar') as HTMLImageElement;
  if (navbarAvatar) {
    if (imageUrl) {
      navbarAvatar.src = imageUrl;
    } else {
      navbarAvatar.src = '/assets/images/default-avatar.svg';
    }
  }

  // Update sidebar avatar
  const sidebarAvatar = document.getElementById('sidebar-user-avatar') as HTMLImageElement;
  if (sidebarAvatar) {
    if (imageUrl) {
      sidebarAvatar.src = imageUrl;
    } else {
      sidebarAvatar.src = '/assets/images/default-avatar.svg';
    }
  }

  // Update any other profile images
  const allAvatars = document.querySelectorAll<HTMLImageElement>('.user-avatar, .profile-avatar');
  allAvatars.forEach((avatar) => {
    if (imageUrl) {
      avatar.src = imageUrl;
    } else {
      avatar.src = '/assets/images/default-avatar.svg';
    }
  });
}

// Export functions to window for backwards compatibility
if (typeof window !== 'undefined') {
  interface WindowWithProfilePictureFunctions extends Window {
    loadProfilePicture: typeof loadProfilePicture;
    uploadProfilePicture: typeof uploadProfilePicture;
    removeProfilePicture: typeof removeProfilePicture;
  }

  (window as unknown as WindowWithProfilePictureFunctions).loadProfilePicture = loadProfilePicture;
  (window as unknown as WindowWithProfilePictureFunctions).uploadProfilePicture = uploadProfilePicture;
  (window as unknown as WindowWithProfilePictureFunctions).removeProfilePicture = removeProfilePicture;
}
