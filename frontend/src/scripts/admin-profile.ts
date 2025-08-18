/**
 * Admin Profile Script
 * Handles admin profile functionality with limited edit capabilities
 */

import { getAuthToken, showError } from './auth';
import { apiClient } from '../utils/api-client';

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
    const token = getAuthToken();
    const userRole = localStorage.getItem('userRole');

    if (token === null || token.length === 0 || userRole !== 'admin') {
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
    const useV2Users = window.FEATURE_FLAGS?.USE_API_V2_USERS;
    let profile: UserProfile;

    if (useV2Users === true) {
      // Use API v2 with apiClient - use /me endpoint
      profile = await apiClient.get<UserProfile>('/users/me');
    } else {
      // Use API v1 with fetch
      const token = getAuthToken();
      const response = await fetch('/api/user/profile', {
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load profile');
      }

      const data = (await response.json()) as { data?: UserProfile; user?: UserProfile } & UserProfile;
      profile = data.data ?? data.user ?? data;
    }

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
  document.querySelector('#first_name')!.value = firstName ?? '';
  document.querySelector('#last_name')!.value = lastName ?? '';

  // Read-only fields
  document.querySelector('#email')!.value = profile.email;
  document.querySelector('#position')!.value =
    profile.position !== undefined && profile.position.length > 0
      ? (positionMap[profile.position] ?? profile.position)
      : '-';
  document.querySelector('#company')!.value = companyName ?? '-';
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
      showInitials(display, firstName, lastName);
      // Hide remove button on error
      if (removeBtn) {
        removeBtn.style.display = 'none';
      }
    };

    display.append(img);

    // Show remove button when picture exists
    if (removeBtn) {
      removeBtn.style.display = 'inline-block';
      console.info('Remove button shown for picture:', url);
    }
  } else {
    // Show initials instead of icon
    showInitials(display, firstName, lastName);
    // Hide remove button when no picture
    if (removeBtn) {
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
  display.innerHTML = initials;
}

/**
 * Setup form event handlers
 */
function setupFormHandlers(): void {
  // Profile form
  const profileForm = document.querySelector('#profile-form')!;
  profileForm.addEventListener('submit', (e) => {
    void handleProfileUpdate(e);
  });

  // Password form
  const passwordForm = document.querySelector('#password-form')!;
  passwordForm.addEventListener('submit', (e) => {
    void handlePasswordChange(e);
  });

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
  const fileInput = document.querySelector('#profile-picture-input')!;
  const removeBtn = document.querySelector('#remove-picture-btn');

  // File upload
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
    const useV2Users = window.FEATURE_FLAGS?.USE_API_V2_USERS;

    if (useV2Users === true) {
      // Use API v2 with apiClient
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
    } else {
      // Use API v1 with fetch
      const token = getAuthToken();
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        showMessage('Profil erfolgreich aktualisiert', 'success');
        // Reload to update header info
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        const error = (await response.json()) as { message?: string };
        showMessage(error.message ?? 'Fehler beim Aktualisieren des Profils', 'error');
      }
    }
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
  const currentPassword = document.querySelector('#current_password')!.value;
  const newPassword = document.querySelector('#new_password')!.value;
  const confirmPassword = document.querySelector('#confirm_password')!.value;

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
    const token = getAuthToken();
    const response = await fetch('/api/users/profile/password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token ?? ''}`,
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    });

    if (response.ok) {
      showMessage('Passwort erfolgreich geändert', 'success');
      showSuccessOverlay('Passwort erfolgreich geändert!');
      form.reset();
    } else {
      const error = (await response.json()) as { message?: string };
      showMessage(error.message ?? 'Fehler beim Ändern des Passworts', 'error');
    }
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
  formData.append('profilePicture', file);

  try {
    const useV2Users = window.FEATURE_FLAGS?.USE_API_V2_USERS;

    if (useV2Users === true) {
      // Use API v2 - Note: apiClient doesn't support FormData directly, use fetch
      const token = getAuthToken();
      const response = await fetch('/api/v2/users/me/profile-picture', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = (await response.json()) as {
          data?: { profilePictureUrl?: string; profilePicture?: string; profile_picture?: string };
        };
        // API v2 returns the user object with profilePictureUrl field
        const pictureUrl =
          result.data?.profilePictureUrl ?? result.data?.profilePicture ?? result.data?.profile_picture;
        console.info('Upload response:', result);
        const firstName = document.querySelector('#first_name')!.value;
        const lastName = document.querySelector('#last_name')!.value;
        updateProfilePicture(pictureUrl ?? undefined, firstName, lastName);
        showMessage('Profilbild erfolgreich hochgeladen', 'success');
        // Reload page to update header
        setTimeout(() => {
          window.location.reload();
        }, 100);
      } else {
        const error = (await response.json()) as { error?: { message?: string } };
        showMessage(error.error?.message ?? 'Fehler beim Hochladen des Profilbilds', 'error');
      }
    } else {
      // Use API v1 with fetch
      const token = getAuthToken();
      const response = await fetch('/api/user/profile-picture', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = (await response.json()) as {
          profilePictureUrl?: string;
          profile_picture_url?: string;
          url?: string;
          data?: { profile_picture_url?: string };
        };
        const pictureUrl =
          result.profilePictureUrl ?? result.profile_picture_url ?? result.url ?? result.data?.profile_picture_url;
        const firstName = document.querySelector('#first_name')!.value;
        const lastName = document.querySelector('#last_name')!.value;
        updateProfilePicture(pictureUrl ?? undefined, firstName, lastName);
        showMessage('Profilbild erfolgreich hochgeladen', 'success');
        // Reload page to update header
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        const error = (await response.json()) as { message?: string };
        showMessage(error.message ?? 'Fehler beim Hochladen des Profilbilds', 'error');
      }
    }
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
  container.innerHTML = `
    <div class="alert alert-${type}">
      <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
      ${message}
    </div>
  `;

  // Auto-hide after 5 seconds
  setTimeout(() => {
    container.innerHTML = '';
  }, 5000);
}

/**
 * Show success overlay animation
 */
function showSuccessOverlay(text = 'Erfolgreich!'): void {
  const overlay = document.createElement('div');
  overlay.className = 'success-overlay';
  overlay.innerHTML = `
    <div class="success-message">
      <div class="success-icon">
        <i class="fas fa-check-circle"></i>
      </div>
      <div class="success-text">
        ${text}
      </div>
    </div>
  `;
  document.body.append(overlay);

  // Remove after animation
  setTimeout(() => {
    overlay.remove();
  }, 2000);
}
