/**
 * Admin Profile Script
 * Handles admin profile functionality with limited edit capabilities
 */

import { getAuthToken } from './auth';

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

interface PositionMap {
  [key: string]: string;
}

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
document.addEventListener('DOMContentLoaded', async () => {
  console.info('Admin profile script loaded');

  // Check authentication
  const token = getAuthToken();
  const userRole = localStorage.getItem('userRole');

  if (!token || userRole !== 'admin') {
    window.location.href = '/login';
    return;
  }

  // Load user profile
  await loadUserProfile();

  // Setup form handlers
  setupFormHandlers();
  setupProfilePictureHandlers();
});

/**
 * Load user profile data
 */
async function loadUserProfile(): Promise<void> {
  try {
    const token = getAuthToken();
    const response = await fetch('/api/user/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const profile = data.data || data.user || data;

      populateProfileForm(profile);

      // Try different possible field names for profile picture
      const pictureUrl =
        profile.profile_picture_url ||
        profile.profilePictureUrl ||
        profile.profile_picture ||
        profile.avatar ||
        profile.picture;

      updateProfilePicture(pictureUrl);
    } else {
      showMessage('Fehler beim Laden des Profils', 'error');
    }
  } catch (error) {
    console.error('Error loading profile:', error);
    showMessage('Netzwerkfehler beim Laden des Profils', 'error');
  }
}

/**
 * Populate form with profile data
 */
function populateProfileForm(profile: UserProfile): void {
  // Editable fields
  (document.getElementById('first_name') as HTMLInputElement).value = profile.first_name || '';
  (document.getElementById('last_name') as HTMLInputElement).value = profile.last_name || '';

  // Read-only fields
  (document.getElementById('email') as HTMLInputElement).value = profile.email || '';
  (document.getElementById('position') as HTMLInputElement).value = profile.position
    ? positionMap[profile.position] || profile.position
    : '-';
  (document.getElementById('company') as HTMLInputElement).value = profile.company_name || '-';
}

/**
 * Update profile picture display
 */
function updateProfilePicture(url?: string): void {
  const display = document.getElementById('profile-picture-display') as HTMLElement;
  const removeBtn = document.getElementById('remove-picture-btn') as HTMLButtonElement;

  if (!display) {
    console.error('Profile picture display element not found!');
    return;
  }

  if (url) {
    // Clear any existing content
    display.innerHTML = '';

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
      display.innerHTML = '<i class="fas fa-user"></i>';
    };

    display.appendChild(img);

    if (removeBtn) {
      removeBtn.style.display = 'inline-flex';
    }
  } else {
    display.innerHTML = '<i class="fas fa-user"></i>';
    if (removeBtn) {
      removeBtn.style.display = 'none';
    }
  }
}

/**
 * Setup form event handlers
 */
function setupFormHandlers(): void {
  // Profile form
  const profileForm = document.getElementById('profile-form') as HTMLFormElement;
  profileForm.addEventListener('submit', handleProfileUpdate);

  // Password form
  const passwordForm = document.getElementById('password-form') as HTMLFormElement;
  passwordForm.addEventListener('submit', handlePasswordChange);

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
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
  });
}

/**
 * Setup profile picture handlers
 */
function setupProfilePictureHandlers(): void {
  const fileInput = document.getElementById('profile-picture-input') as HTMLInputElement;
  const removeBtn = document.getElementById('remove-picture-btn') as HTMLButtonElement;

  // File upload
  fileInput.addEventListener('change', async (event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showMessage('Datei zu groß (max. 5MB)', 'error');
        return;
      }

      await uploadProfilePicture(file);
    }
  });

  // Remove picture
  removeBtn.addEventListener('click', async () => {
    if (confirm('Möchten Sie Ihr Profilbild wirklich entfernen?')) {
      await removeProfilePicture();
    }
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
    const token = getAuthToken();
    const response = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updateData),
    });

    if (response.ok) {
      showMessage('Profil erfolgreich aktualisiert', 'success');
      // Reload to update header info
      setTimeout(() => window.location.reload(), 1500);
    } else {
      const error = await response.json();
      showMessage(error.message || 'Fehler beim Aktualisieren des Profils', 'error');
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
  const currentPassword = (document.getElementById('current_password') as HTMLInputElement).value;
  const newPassword = (document.getElementById('new_password') as HTMLInputElement).value;
  const confirmPassword = (document.getElementById('confirm_password') as HTMLInputElement).value;

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
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        currentPassword: currentPassword,
        newPassword: newPassword,
      }),
    });

    if (response.ok) {
      showMessage('Passwort erfolgreich geändert', 'success');
      showSuccessOverlay('Passwort erfolgreich geändert!');
      form.reset();
    } else {
      const error = await response.json();
      showMessage(error.message || 'Fehler beim Ändern des Passworts', 'error');
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
    const token = getAuthToken();
    const response = await fetch('/api/user/profile-picture', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();
      // Check different possible response formats
      const pictureUrl =
        result.profilePictureUrl || result.profile_picture_url || result.url || result.data?.profile_picture_url;
      updateProfilePicture(pictureUrl);
      showMessage('Profilbild erfolgreich hochgeladen', 'success');
      // Reload profile to ensure we have the latest data
      setTimeout(() => loadUserProfile(), 500);
    } else {
      const error = await response.json();
      showMessage(error.message || 'Fehler beim Hochladen des Profilbilds', 'error');
    }
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    showMessage('Netzwerkfehler beim Hochladen', 'error');
  }
}

/**
 * Remove profile picture
 */
async function removeProfilePicture(): Promise<void> {
  try {
    const token = getAuthToken();
    const response = await fetch('/api/user/profile-picture', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      updateProfilePicture();
      showMessage('Profilbild erfolgreich entfernt', 'success');
    } else {
      const error = await response.json();
      showMessage(error.message || 'Fehler beim Entfernen des Profilbilds', 'error');
    }
  } catch (error) {
    console.error('Error removing profile picture:', error);
    showMessage('Netzwerkfehler beim Entfernen', 'error');
  }
}

/**
 * Show message to user
 */
function showMessage(message: string, type: 'success' | 'error'): void {
  const container = document.getElementById('message-container') as HTMLElement;
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
function showSuccessOverlay(text: string = 'Erfolgreich!'): void {
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
  document.body.appendChild(overlay);

  // Remove after animation
  setTimeout(() => {
    overlay.remove();
  }, 2000);
}
