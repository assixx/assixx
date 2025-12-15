/**
 * Pre-Login Check Module
 * Handles session cleanup and auto-redirect before login form is shown
 * This runs BEFORE the login form controller to prevent redirect loops
 */

/**
 * Clear all authentication data from storage and cookies
 */
function clearAuthData(): void {
  // Clear localStorage
  localStorage.removeItem('token');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('userRole');
  localStorage.removeItem('user');

  // Clear sessionStorage
  sessionStorage.clear();

  // Clear auth cookies
  document.cookie.split(';').forEach((cookie) => {
    const trimmedCookie = cookie.trim();
    if (trimmedCookie.includes('token') || trimmedCookie.includes('Token')) {
      const eqPos = trimmedCookie.indexOf('=');
      const name = eqPos > -1 ? trimmedCookie.substring(0, eqPos) : trimmedCookie;
      document.cookie = `${name}=;expires=${new Date(0).toUTCString()};path=/`;
    }
  });
}

/**
 * Check if user has valid token and redirect to dashboard
 */
function checkAndRedirect(): void {
  const token = localStorage.getItem('token') ?? localStorage.getItem('accessToken');
  const userRole = localStorage.getItem('userRole');

  if (token !== null && token !== '' && userRole !== null && userRole !== '') {
    // Hide login form immediately while we redirect
    document.documentElement.style.visibility = 'hidden';

    // Redirect based on role (validation happens in background after redirect)
    switch (userRole) {
      case 'root':
        window.location.replace('/root-dashboard');
        break;
      case 'admin':
        window.location.replace('/admin-dashboard');
        break;
      case 'employee':
        window.location.replace('/employee-dashboard');
        break;
      default:
        // Invalid role, show login
        document.documentElement.style.visibility = 'visible';
    }
  }
}

/**
 * Main pre-check function that runs on page load
 */
export function runPreLoginCheck(): void {
  const urlParams = new URLSearchParams(window.location.search);

  // Check if coming from session expired, timeout, or rate limit
  if (
    urlParams.get('session') === 'expired' ||
    urlParams.get('timeout') === 'true' ||
    urlParams.get('ratelimit') === 'expired'
  ) {
    // Clear all auth data immediately to prevent redirect loop
    clearAuthData();
  } else {
    // ONLY check for existing token if NOT coming from session expired
    checkAndRedirect();
  }
}

// Run immediately when module is imported
runPreLoginCheck();
