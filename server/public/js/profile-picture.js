// Profile Picture Component for Employee Dashboard

document.addEventListener('DOMContentLoaded', () => {
  // Profile picture elements
  const profilePictureContainer = document.getElementById('profile-picture-container');
  const uploadForm = document.getElementById('profile-picture-form');
  const picturePreview = document.getElementById('profile-picture-preview');
  const fileInput = document.getElementById('profile-picture-input');
  const uploadButton = document.getElementById('upload-picture-btn');
  const removeButton = document.getElementById('remove-picture-btn');
  
  // Load user's profile picture
  loadProfilePicture();
  
  // Add event listeners
  if (fileInput) {
    fileInput.addEventListener('change', handleFileSelect);
  }
  
  if (uploadForm) {
    uploadForm.addEventListener('submit', uploadProfilePicture);
  }
  
  if (removeButton) {
    removeButton.addEventListener('click', removeProfilePicture);
  }
  
  // Load profile picture from server
  async function loadProfilePicture() {
    if (!profilePictureContainer) return;
    
    try {
      const response = await fetch('/users/current', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        
        if (userData.profile_picture) {
          // Display the profile picture
          picturePreview.innerHTML = `
            <img src="/${userData.profile_picture}" alt="Profile" class="profile-image">
          `;
          
          // Show remove button
          if (removeButton) {
            removeButton.style.display = 'inline-block';
          }
        } else {
          // Display initials if no profile picture
          const initials = getInitials(userData.first_name, userData.last_name);
          picturePreview.innerHTML = `
            <div class="profile-initials">${initials}</div>
          `;
          
          // Hide remove button
          if (removeButton) {
            removeButton.style.display = 'none';
          }
        }
      } else {
        console.error('Failed to load user data');
      }
    } catch (error) {
      console.error('Error loading profile picture:', error);
    }
  }
  
  // Get user's initials for profile placeholder
  function getInitials(firstName = '', lastName = '') {
    const firstInitial = firstName ? firstName.charAt(0).toUpperCase() : '';
    const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : '';
    return `${firstInitial}${lastInitial}`;
  }
  
  // Handle file selection
  function handleFileSelect(e) {
    const file = e.target.files[0];
    
    if (!file) {
      return;
    }
    
    // Check file type
    if (!file.type.match('image.*')) {
      alert('Bitte wählen Sie eine Bilddatei aus (JPEG, PNG, GIF, etc.).');
      fileInput.value = '';
      return;
    }
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Die Datei ist zu groß. Maximale Größe ist 5MB.');
      fileInput.value = '';
      return;
    }
    
    // Display preview
    const reader = new FileReader();
    
    reader.onload = function(e) {
      picturePreview.innerHTML = `
        <img src="${e.target.result}" alt="Preview" class="profile-image">
      `;
      
      // Enable upload button
      if (uploadButton) {
        uploadButton.disabled = false;
      }
    };
    
    reader.readAsDataURL(file);
  }
  
  // Upload profile picture
  async function uploadProfilePicture(e) {
    e.preventDefault();
    
    if (!fileInput || !fileInput.files[0]) {
      return;
    }
    
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('profile_picture', file);
    
    try {
      // Show loading indicator
      picturePreview.innerHTML = `
        <div class="upload-loading">
          <div class="spinner"></div>
          <div>Wird hochgeladen...</div>
        </div>
      `;
      
      const response = await fetch('/users/profile/upload-picture', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Reset form
        fileInput.value = '';
        
        // Reload profile picture
        loadProfilePicture();
        
        // Disable upload button
        if (uploadButton) {
          uploadButton.disabled = true;
        }
        
        // Show success message
        alert('Profilbild erfolgreich hochgeladen!');
      } else {
        const error = await response.json();
        alert(`Fehler: ${error.message}`);
        
        // Reload profile picture
        loadProfilePicture();
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
      
      // Reload profile picture
      loadProfilePicture();
    }
  }
  
  // Remove profile picture
  async function removeProfilePicture() {
    if (!confirm('Sind Sie sicher, dass Sie Ihr Profilbild entfernen möchten?')) {
      return;
    }
    
    try {
      // Show loading indicator
      picturePreview.innerHTML = `
        <div class="upload-loading">
          <div class="spinner"></div>
          <div>Wird entfernt...</div>
        </div>
      `;
      
      const response = await fetch('/users/profile/picture', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Reload profile picture
        loadProfilePicture();
        
        // Show success message
        alert('Profilbild erfolgreich entfernt!');
      } else {
        const error = await response.json();
        alert(`Fehler: ${error.message}`);
        
        // Reload profile picture
        loadProfilePicture();
      }
    } catch (error) {
      console.error('Error removing profile picture:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
      
      // Reload profile picture
      loadProfilePicture();
    }
  }
});