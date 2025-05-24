/**
 * Globale Header User Info Loading Funktion
 * Muss in allen Seiten mit Navigation eingebunden werden
 */

// Header User Info laden
async function loadHeaderUserInfo() {
    const token = localStorage.getItem('token');
    if (!token || token === 'test-mode') return;
    
    try {
        // Username aus Token für sofortige Anzeige
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userNameElement = document.getElementById('user-name');
        if (userNameElement) {
            userNameElement.textContent = payload.username || 'User';
        }
        
        // Vollständiges Profil laden
        const response = await fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const userData = await response.json();
            const user = userData.user || userData;
            
            // Update mit vollständigem Namen
            if (userNameElement && (user.first_name || user.last_name)) {
                const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
                userNameElement.textContent = fullName || user.username || payload.username;
            }
            
            // Avatar update
            const avatarElement = document.getElementById('user-avatar');
            if (avatarElement && user.profile_picture) {
                avatarElement.src = user.profile_picture;
            }
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// Automatisch beim Laden der Seite ausführen
document.addEventListener('DOMContentLoaded', () => {
    loadHeaderUserInfo();
});