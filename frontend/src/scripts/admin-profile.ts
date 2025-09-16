/**
 * Admin Profile Script
 * Handles admin profile functionality with limited edit capabilities
 */

import { ApiClient } from '../utils/api-client';
import { showError } from './auth';
import { $$ } from '../utils/dom-utils';
import { showSuccessAlert } from './utils/alerts';

// Initialize API client
const apiClient = ApiClient.getInstance();

interface UserProfile {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  company_name?: string;
  profile_picture_url?: string;
  role: string;
  tenant_id: number;
}

interface ExtendedUserProfile extends UserProfile {
  profilePictureUrl?: string;
  profilePicture?: string;
  profile_picture?: string;
  avatar?: string;
  picture?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
}

type PositionMap = Record<string, string>;

// Position display mapping
const positionMap: PositionMap = {
  bereichsleiter: 'Bereichsleiter',
  personalleiter: 'Personalleiter',
  geschaeftsfuehrer: 'Geschäftsführer',
  werksleiter: 'Werksleiter',
  produktionsleiter: 'Produktionsleiter',
  qualitaetsleiter: 'Qualitätsleiter',
  'it-leiter': 'IT-Leiter',
  vertriebsleiter: 'Vertriebsleiter',
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  void (async () => {
    console.info('Admin profile script loaded');

    // Check authentication
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (token === null || token === '' || userRole !== 'admin') {
      window.location.href = '/login';
      return;
    }

    // Set initial placeholder
    const display = document.querySelector('#profile-picture-display');
    if (display !== null && display.innerHTML.trim().length === 0) {
      display.innerHTML = '...';
    }

    // Load user profile
    await loadUserProfile();

    // Setup form handlers
    setupFormHandlers();
    setupProfilePictureHandlers();
  })();
});

/**
 * Load user profile data
 */
async function loadUserProfile(): Promise<void> {
  try {
    // Always use API v2 with apiClient - use /me endpoint
    const profile = await apiClient.get<UserProfile>('/users/me');

    populateProfileForm(profile);

    // Try different possible field names for profile picture
    // API v2 uses profilePictureUrl (not profilePicture!)
    const extProfile = profile as ExtendedUserProfile;
    const pictureUrl =
      extProfile.profilePictureUrl ??
      extProfile.profilePicture ??
      extProfile.profile_picture_url ??
      extProfile.profile_picture ??
      extProfile.avatar ??
      extProfile.picture;

    console.info('Profile picture URL:', pictureUrl);
    console.info('Full profile data:', profile);

    // Use camelCase for v2 API
    const firstName = extProfile.firstName ?? profile.first_name;
    const lastName = extProfile.lastName ?? profile.last_name;
    updateProfilePicture(pictureUrl, firstName, lastName);
  } catch (error) {
    console.error('Error loading profile:', error);
    showMessage('Fehler beim Laden des Profils', 'error');
  }
}

/**
 * Populate form with profile data
 */
function populateProfileForm(profile: UserProfile): void {
  // Handle both snake_case (v1) and camelCase (v2)
  const extProfile = profile as ExtendedUserProfile;
  const firstName = extProfile.firstName ?? profile.first_name;
  const lastName = extProfile.lastName ?? profile.last_name;
  const companyName = extProfile.companyName ?? profile.company_name;

  // Editable fields
  const firstNameInput = $$('#first_name');
  if (firstNameInput instanceof HTMLInputElement) {
    firstNameInput.value = firstName ?? '';
  }

  const lastNameInput = $$('#last_name');
  if (lastNameInput instanceof HTMLInputElement) {
    lastNameInput.value = lastName ?? '';
  }

  // Read-only fields
  const emailInput = $$('#email');
  if (emailInput instanceof HTMLInputElement) {
    emailInput.value = profile.email;
  }
  const positionInput = $$('#position');
  if (positionInput instanceof HTMLInputElement) {
    positionInput.value =
      profile.position !== undefined && profile.position.length > 0
        ? (positionMap[profile.position] ?? profile.position)
        : '-';
  }

  const companyInput = $$('#company');
  if (companyInput instanceof HTMLInputElement) {
    companyInput.value = companyName ?? '-';
  }
}

/**
 * Update profile picture display
 */
function updateProfilePicture(url?: string, firstName?: string, lastName?: string): void {
  const display = document.querySelector('#profile-picture-display');
  const removeBtn = document.querySelector('#remove-picture-btn');

  if (!display) {
    console.error('Profile picture display element not found!');
    return;
  }

  if (url !== undefined && url.length > 0) {
    // Clear any existing content
    display.innerHTML = '';
    display.classList.remove('avatar-initials');

    // Create image element
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Profilbild';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '50%';

    // Handle image load error
    img.onerror = () => {
      console.error('Failed to load profile picture:', url);
      // Show initials on error
      if (display instanceof HTMLElement) {
        showInitials(display, firstName, lastName);
      }
      // Hide remove button on error
      if (removeBtn instanceof HTMLElement) {
        removeBtn.style.display = 'none';
      }
    };

    display.append(img);

    // Show remove button when picture exists
    if (removeBtn instanceof HTMLElement) {
      removeBtn.style.display = 'inline-block';
      console.info('Remove button shown for picture:', url);
    }
  } else {
    // Show initials instead of icon
    if (display instanceof HTMLElement) {
      showInitials(display, firstName, lastName);
    }
    // Hide remove button when no picture
    if (removeBtn instanceof HTMLElement) {
      removeBtn.style.display = 'none';
      console.info('Remove button hidden - no picture');
    }
  }
}

/**
 * Show initials in the profile picture display
 */
function showInitials(display: HTMLElement, firstName?: string, lastName?: string): void {
  const firstInitial = (firstName ?? '').charAt(0).toUpperCase();
  const lastInitial = (lastName ?? '').charAt(0).toUpperCase();
  const initials = firstInitial.length > 0 || lastInitial.length > 0 ? `${firstInitial}${lastInitial}` : 'U';

  display.classList.add('avatar-initials');
  display.textContent = initials;
}

/**
 * Setup form event handlers
 */
function setupFormHandlers(): void {
  // Profile form
  const profileForm = $$('#profile-form');
  if (profileForm !== null) {
    profileForm.addEventListener('submit', (e) => {
      void handleProfileUpdate(e);
    });
  }

  // Password form
  const passwordForm = $$('#password-form');
  if (passwordForm !== null) {
    passwordForm.addEventListener('submit', (e) => {
      void handlePasswordChange(e);
    });
  }

  // Logout button
  const logoutBtn = document.querySelector('#logout-btn');
  logoutBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    // TODO: Implement proper confirmation modal
    showError('Abmeldebestätigung: Feature noch nicht implementiert');
    // Code below will be activated once confirmation modal is implemented
    /*
    void (async () => {
      if (confirm('Möchten Sie sich wirklich abmelden?')) {
        try {
          // Import and use the logout function from auth module
          const { logout } = await import('./auth.js');
          await logout();
        } catch (error) {
          console.error('Logout error:', error);
          // Fallback
          window.location.href = '/login';
        }
      }
    })();
    */
  });
}

/**
 * Setup profile picture handlers
 */
function setupProfilePictureHandlers(): void {
  const fileInput = $$('#profile-picture-input');
  const removeBtn = document.querySelector('#remove-picture-btn');

  // Event delegation for trigger file input button
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-action="trigger-file-input"]');

    if (button instanceof HTMLElement && fileInput !== null) {
      fileInput.click();
    }
  });

  // File upload
  if (fileInput !== null) {
    fileInput.addEventListener('change', (e) => {
      void (async () => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];

        if (file) {
          if (file.size > 5 * 1024 * 1024) {
            showMessage('Datei zu groß (max. 5MB)', 'error');
            return;
          }

          await uploadProfilePicture(file);
        }
      })();
    });
  }

  // Remove picture
  removeBtn?.addEventListener('click', () => {
    // TODO: Implement proper confirmation modal
    showError('Löschbestätigung für Profilbild: Feature noch nicht implementiert');
    // Code below will be activated once confirmation modal is implemented
    /*
    void (async () => {
      if (confirm('Möchten Sie Ihr Profilbild wirklich entfernen?')) {
        await removeProfilePicture();
      }
    })();
    */
  });
}

/**
 * Handle profile update
 */
async function handleProfileUpdate(event: Event): Promise<void> {
  event.preventDefault();

  const form = event.target as HTMLFormElement;
  const formData = new FormData(form);

  // Only send editable fields
  const updateData = {
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
  };

  try {
    // Always use API v2 with apiClient
    // Convert to camelCase for v2
    const v2UpdateData = {
      firstName: updateData.first_name,
      lastName: updateData.last_name,
    };

    await apiClient.put('/users/me/profile', v2UpdateData);
    showMessage('Profil erfolgreich aktualisiert', 'success');
    // Reload to update header info
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } catch (error) {
    console.error('Error updating profile:', error);
    showMessage('Netzwerkfehler beim Aktualisieren', 'error');
  }
}

/**
 * Handle password change
 */
async function handlePasswordChange(event: Event): Promise<void> {
  event.preventDefault();

  const form = event.target as HTMLFormElement;
  const currentPasswordInput = $$('#current_password');
  const newPasswordInput = $$('#new_password');
  const confirmPasswordInput = $$('#confirm_password');

  const currentPassword = currentPasswordInput instanceof HTMLInputElement ? currentPasswordInput.value : '';
  const newPassword = newPasswordInput instanceof HTMLInputElement ? newPasswordInput.value : '';
  const confirmPassword = confirmPasswordInput instanceof HTMLInputElement ? confirmPasswordInput.value : '';

  // Validate passwords match
  if (newPassword !== confirmPassword) {
    showMessage('Die neuen Passwörter stimmen nicht überein', 'error');
    return;
  }

  // Validate password strength
  if (newPassword.length < 8) {
    showMessage('Das neue Passwort muss mindestens 8 Zeichen lang sein', 'error');
    return;
  }

  try {
    // Use API v2 with apiClient
    await apiClient.put('/users/me/password', {
      currentPassword,
      newPassword,
    });

    showMessage('Passwort erfolgreich geändert', 'success');
    showSuccessAlert('Passwort erfolgreich geändert!');
    form.reset();
  } catch (error) {
    console.error('Error changing password:', error);
    showMessage('Netzwerkfehler beim Ändern des Passworts', 'error');
  }
}

/**
 * Upload profile picture
 */
async function uploadProfilePicture(file: File): Promise<void> {
  const formData = new FormData();
  formData.append('profilePicture', file); // v2 uses camelCase

  try {
    // Always use API v2 with apiClient
    // Note: apiClient.post supports FormData
    const result = await apiClient.post<{ profilePictureUrl?: string }>('/users/me/profile-picture', formData);

    const pictureUrl = result.profilePictureUrl;
    console.info('Upload response:', result);

    const firstNameInput = $$('#first_name');
    const lastNameInput = $$('#last_name');
    const firstName = firstNameInput instanceof HTMLInputElement ? firstNameInput.value : '';
    const lastName = lastNameInput instanceof HTMLInputElement ? lastNameInput.value : '';

    updateProfilePicture(pictureUrl ?? undefined, firstName, lastName);
    showMessage('Profilbild erfolgreich hochgeladen', 'success');

    // Reload page to update header
    setTimeout(() => {
      window.location.reload();
    }, 100);
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    showMessage('Netzwerkfehler beim Hochladen', 'error');
  }
}

// Function removed - will be implemented when confirmation modal is ready
// async function removeProfilePicture(): Promise<void> { ... }

/**
 * Show message to user
 */
function showMessage(message: string, type: 'success' | 'error'): void {
  const container = document.querySelector('#message-container');
  if (!container) return;

  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;

  const icon = document.createElement('i');
  icon.className = `fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}`;

  alertDiv.append(icon);
  alertDiv.append(document.createTextNode(' ' + message));

  container.textContent = '';
  container.append(alertDiv);

  // Auto-hide after 5 seconds
  setTimeout(() => {
    container.textContent = '';
  }, 5000);
}

// showSuccessOverlay removed - use showSuccessAlert from alerts.ts instead
