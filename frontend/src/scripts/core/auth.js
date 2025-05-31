/**
 * Authentication Core Module
 */

export function initAuth() {
  // Auth module initialized

  // Check if user is authenticated
  const token = localStorage.getItem('token');
  if (token) {
    // Verify token
    checkAuthStatus();
  }
}

async function checkAuthStatus() {
  try {
    const response = await window.Assixx.api.checkAuth();
    if (response.authenticated) {
      window.Assixx.user = response.user;
    } else {
      // Clear invalid token
      localStorage.removeItem('token');
      window.Assixx.user = null;
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    localStorage.removeItem('token');
  }
}
