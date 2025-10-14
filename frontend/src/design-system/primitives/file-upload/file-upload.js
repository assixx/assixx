/**
 * File Upload JavaScript Helper
 *
 * Optional JavaScript for enhanced file upload functionality:
 * - Drag & drop support
 * - File validation (type, size)
 * - Image previews
 * - Upload progress simulation
 * - Multiple file handling
 *
 * USAGE:
 *   import { initFileUpload } from './file-upload.js';
 *
 *   const uploader = initFileUpload(document.querySelector('.file-upload-zone'), {
 *     maxSize: 5 * 1024 * 1024, // 5MB
 *     allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
 *     multiple: true,
 *     onFileAdd: (file) => console.log('File added:', file),
 *     onFileRemove: (file) => console.log('File removed:', file),
 *     onUpload: (file, progress) => console.log('Upload progress:', progress),
 *   });
 *
 * PROGRESSIVE ENHANCEMENT:
 *   Works without JavaScript - uses native file input.
 */

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // Clamp index to valid array bounds to prevent object injection
  const safeIndex = Math.min(Math.max(0, i), sizes.length - 1);

  // eslint-disable-next-line security/detect-object-injection -- safeIndex is clamped to [0, sizes.length-1], proven safe
  return `${Number.parseFloat((bytes / Math.pow(k, safeIndex)).toFixed(2))} ${sizes[safeIndex]}`;
}

/**
 * Get file icon based on MIME type
 */
function getFileIcon(mimeType) {
  if (mimeType.startsWith('image/')) return 'fa-file-image';
  if (mimeType.startsWith('video/')) return 'fa-file-video';
  if (mimeType.startsWith('audio/')) return 'fa-file-audio';
  if (mimeType === 'application/pdf') return 'fa-file-pdf';
  if (mimeType.includes('word') || mimeType.includes('document') || mimeType.includes('msword')) return 'fa-file-word';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'fa-file-excel';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'fa-file-powerpoint';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'fa-file-archive';
  if (mimeType.includes('text/')) return 'fa-file-alt';
  return 'fa-file';
}

/**
 * Get file type class for preview styling
 */
function getFileTypeClass(mimeType) {
  if (mimeType === 'application/pdf') return 'file-upload-item__preview--pdf';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'file-upload-item__preview--doc';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'file-upload-item__preview--xls';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'file-upload-item__preview--zip';
  return '';
}

/**
 * Create file list item element
 */
function createFileItem(file, fileId) {
  const item = document.createElement('div');
  item.className = 'file-upload-item file-upload-item--pending';
  item.dataset.fileId = fileId;

  // Preview (image or icon)
  const preview = document.createElement('div');
  preview.className = `file-upload-item__preview ${getFileTypeClass(file.type)}`;

  if (file.type.startsWith('image/')) {
    // Image preview
    const img = document.createElement('img');
    img.alt = file.name;

    // Read image file for preview
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    preview.appendChild(img);
  } else {
    // Icon fallback
    const icon = document.createElement('i');
    icon.className = `fas ${getFileIcon(file.type)}`;
    preview.appendChild(icon);
  }

  // File info
  const info = document.createElement('div');
  info.className = 'file-upload-item__info';

  const name = document.createElement('div');
  name.className = 'file-upload-item__name';
  name.textContent = file.name;
  name.title = file.name; // Tooltip for long names

  const meta = document.createElement('div');
  meta.className = 'file-upload-item__meta';
  meta.textContent = formatFileSize(file.size);

  info.appendChild(name);
  info.appendChild(meta);

  // Progress (initially hidden)
  const progressContainer = document.createElement('div');
  progressContainer.className = 'file-upload-item__progress';
  progressContainer.innerHTML = `
    <div class="progress progress--sm">
      <div class="progress__bar" style="width: 0%;"></div>
    </div>
  `;

  // Remove button
  const removeBtn = document.createElement('button');
  removeBtn.className = 'file-upload-item__remove';
  removeBtn.type = 'button';
  removeBtn.setAttribute('aria-label', `Remove ${file.name}`);
  removeBtn.innerHTML = '<i class="fas fa-times"></i>';

  // Assemble
  item.appendChild(preview);
  item.appendChild(info);
  item.appendChild(progressContainer);
  item.appendChild(removeBtn);

  return item;
}

/**
 * Initialize file upload
 */
export function initFileUpload(zoneElement, options = {}) {
  if (!zoneElement) {
    console.error('File upload zone element not found');
    return null;
  }

  // Default options
  const config = {
    maxSize: 10 * 1024 * 1024, // 10MB default
    allowedTypes: null, // null = all types allowed
    multiple: true,
    onFileAdd: null,
    onFileRemove: null,
    onUpload: null,
    ...options,
  };

  // Find or create elements
  const input =
    zoneElement.querySelector('.file-upload-zone__input') || zoneElement.querySelector('input[type="file"]');
  if (!input) {
    console.error('File input not found in zone');
    return null;
  }

  // Find or create file list
  let fileList = zoneElement.parentElement.querySelector('.file-upload-list');
  if (!fileList) {
    fileList = document.createElement('div');
    fileList.className = 'file-upload-list';
    zoneElement.parentElement.appendChild(fileList);
  }

  // State
  const files = new Map();
  let fileIdCounter = 0;

  /**
   * Validate file
   */
  function validateFile(file) {
    const errors = [];

    // Check size
    if (file.size > config.maxSize) {
      errors.push(`File too large (max ${formatFileSize(config.maxSize)})`);
    }

    // Check type
    if (config.allowedTypes !== null && config.allowedTypes.length > 0 && !config.allowedTypes.includes(file.type)) {
      errors.push(`File type not allowed`);
    }

    return errors;
  }

  /**
   * Add file to list
   */
  function addFile(file) {
    // Validate
    const errors = validateFile(file);
    if (errors.length > 0) {
      // Show error
      const errorItem = createFileItem(file, `error-${fileIdCounter++}`);
      errorItem.classList.add('file-upload-item--error');

      const errorMsg = document.createElement('div');
      errorMsg.className = 'file-upload-item__error';
      errorMsg.textContent = errors.join(', ');
      errorItem.appendChild(errorMsg);

      fileList.appendChild(errorItem);

      // Auto-remove after 5 seconds
      setTimeout(() => {
        errorItem.remove();
      }, 5000);

      return;
    }

    // Create file item
    const fileId = `file-${fileIdCounter++}`;
    const fileItem = createFileItem(file, fileId);

    // Store file reference
    files.set(fileId, { file, element: fileItem });

    // Add to list
    fileList.appendChild(fileItem);

    // Remove button handler
    const removeBtn = fileItem.querySelector('.file-upload-item__remove');
    removeBtn.addEventListener('click', () => {
      removeFile(fileId);
    });

    // Callback
    if (config.onFileAdd) {
      config.onFileAdd(file, fileId);
    }

    // Simulate upload (replace with real upload logic)
    setTimeout(() => {
      simulateUpload(fileId);
    }, 500);
  }

  /**
   * Remove file from list
   */
  function removeFile(fileId) {
    const fileData = files.get(fileId);
    if (!fileData) return;

    // Remove from DOM
    fileData.element.remove();

    // Remove from state
    files.delete(fileId);

    // Callback
    if (config.onFileRemove) {
      config.onFileRemove(fileData.file, fileId);
    }
  }

  /**
   * Simulate upload progress (replace with real upload)
   */
  function simulateUpload(fileId) {
    const fileData = files.get(fileId);
    if (!fileData) return;

    const { element } = fileData;
    element.classList.remove('file-upload-item--pending');
    element.classList.add('file-upload-item--uploading');

    const progressBar = element.querySelector('.progress__bar');
    let progress = 0;

    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        // Success state
        element.classList.remove('file-upload-item--uploading');
        element.classList.add('file-upload-item--success');

        // Hide progress bar
        setTimeout(() => {
          const progressContainer = element.querySelector('.file-upload-item__progress');
          if (progressContainer) {
            progressContainer.style.display = 'none';
          }
        }, 1000);
      }

      progressBar.style.width = `${progress}%`;

      // Callback
      if (config.onUpload) {
        config.onUpload(fileData.file, progress, fileId);
      }
    }, 300);
  }

  /**
   * Handle file input change
   */
  function handleInputChange(e) {
    const selectedFiles = Array.from(e.target.files);
    selectedFiles.forEach((file) => addFile(file));

    // Reset input
    e.target.value = '';
  }

  /**
   * Handle drag events
   */
  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    zoneElement.classList.add('file-upload-zone--dragover');
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    zoneElement.classList.remove('file-upload-zone--dragover');
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    zoneElement.classList.remove('file-upload-zone--dragover');

    const droppedFiles = Array.from(e.dataTransfer.files);
    droppedFiles.forEach((file) => addFile(file));
  }

  // Attach event listeners
  input.addEventListener('change', handleInputChange);

  zoneElement.addEventListener('dragenter', handleDragEnter);
  zoneElement.addEventListener('dragleave', handleDragLeave);
  zoneElement.addEventListener('dragover', handleDragOver);
  zoneElement.addEventListener('drop', handleDrop);

  // Public API
  return {
    addFile,
    removeFile,
    getFiles: () => Array.from(files.values()).map((fd) => fd.file),
    clear: () => {
      files.forEach((_, fileId) => removeFile(fileId));
    },
    destroy: () => {
      input.removeEventListener('change', handleInputChange);
      zoneElement.removeEventListener('dragenter', handleDragEnter);
      zoneElement.removeEventListener('dragleave', handleDragLeave);
      zoneElement.removeEventListener('dragover', handleDragOver);
      zoneElement.removeEventListener('drop', handleDrop);
    },
  };
}

export default initFileUpload;
