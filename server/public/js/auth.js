/**
 * Authentication utilities for Assixx
 */

// Get authentication token from localStorage (compatible with existing system)
function getAuthToken() {
    return localStorage.getItem('token') || localStorage.getItem('authToken');
}

// Set authentication token
function setAuthToken(token) {
    localStorage.setItem('token', token);
    localStorage.setItem('authToken', token);
}

// Remove authentication token
function removeAuthToken() {
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    localStorage.removeItem('role');
}

// Check if user is authenticated
function isAuthenticated() {
    const token = getAuthToken();
    return token && token.length > 0;
}

// Fetch with authentication
async function fetchWithAuth(url, options = {}) {
    const token = getAuthToken();
    
    if (!token) {
        window.location.href = '/login.html';
        throw new Error('No authentication token');
    }
    
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    // If unauthorized, redirect to login
    if (response.status === 401) {
        removeAuthToken();
        window.location.href = '/login.html';
        throw new Error('Unauthorized');
    }
    
    return response;
}

// Load user information
async function loadUserInfo() {
    try {
        console.log('loadUserInfo: Attempting to fetch user profile...');
        const response = await fetchWithAuth('/api/user/profile');
        console.log('loadUserInfo: Response status:', response.status);
        
        const data = await response.json();
        console.log('loadUserInfo: Response data:', data);
        
        if (response.ok) {
            // The API returns the user object directly, not wrapped in data.user
            const user = data.user || data;
            
            // Update user display
            const userName = document.getElementById('userName');
            if (userName) {
                const firstName = user.first_name || 'Admin';
                const lastName = user.last_name || '';
                userName.textContent = `${firstName} ${lastName}`.trim();
            }
            
            const userRole = document.getElementById('userRole');
            if (userRole) {
                userRole.textContent = user.role || 'Benutzer';
            }
            
            return user;
        } else {
            throw new Error(data.message || 'Fehler beim Laden der Benutzerdaten');
        }
    } catch (error) {
        console.error('Error loading user info:', error);
        
        // Fallback: Set default values if API fails
        const userName = document.getElementById('userName');
        if (userName) {
            userName.textContent = 'Benutzer';
        }
        
        const userRole = document.getElementById('userRole');
        if (userRole) {
            userRole.textContent = localStorage.getItem('role') || 'Benutzer';
        }
        
        // Don't throw error to prevent redirect loop
        return { first_name: 'Benutzer', role: localStorage.getItem('role') || 'admin' };
    }
}

// Logout function
function logout() {
    removeAuthToken();
    window.location.href = '/login.html';
}

// Show success message
function showSuccess(message) {
    // Simple alert for now, can be enhanced with toast notifications
    alert('✅ ' + message);
}

// Show error message
function showError(message) {
    // Simple alert for now, can be enhanced with toast notifications
    alert('❌ ' + message);
}

// Show info message
function showInfo(message) {
    // Simple alert for now, can be enhanced with toast notifications
    alert('ℹ️ ' + message);
}

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', function() {
    const token = getAuthToken();
    console.log('Auth check - Token found:', !!token);
    console.log('Auth check - Current path:', window.location.pathname);
    
    // Check if user is authenticated
    if (!isAuthenticated() && !window.location.pathname.includes('login.html')) {
        console.log('No authentication token found, redirecting to login');
        window.location.href = '/login.html';
        return;
    }
    
    // Load user info if on authenticated page
    if (isAuthenticated() && !window.location.pathname.includes('login.html')) {
        console.log('Loading user info...');
        loadUserInfo().catch(error => {
            console.error('Failed to load user info:', error);
            // Don't redirect immediately, let the user see the error
        });
    }
});

// Export functions for global use
window.getAuthToken = getAuthToken;
window.setAuthToken = setAuthToken;
window.removeAuthToken = removeAuthToken;
window.isAuthenticated = isAuthenticated;
window.fetchWithAuth = fetchWithAuth;
window.loadUserInfo = loadUserInfo;
window.logout = logout;
window.showSuccess = showSuccess;
window.showError = showError;
window.showInfo = showInfo;