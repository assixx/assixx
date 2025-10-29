/**
 * File Upload – Drag & Drop File Upload
 *
 * Modern file upload with drag & drop, previews, and progress indicators.
 * Progressive enhancement - works without JavaScript.
 *
 * NOTE: This story demonstrates the CSS-only version.
 * JavaScript enhancement (initFileUpload) can be added later for:
 * - Drag & drop validation
 * - File type checking
 * - Upload progress tracking
 */

export default {
  title: 'Design System/File Upload',

  parameters: {
    layout: 'centered'
  },

  tags: ['autodocs'],

  globals: {
    backgrounds: {
      value: "assixx-dark"
    }
  }
};

/**
 * Basic Upload Zone
 *
 * Simple drag & drop zone with native file input.
 */
export const BasicZone = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '40px';
    wrapper.style.width = '600px';
    wrapper.innerHTML = `
      <div class="file-upload-zone">
        <input type="file" class="file-upload-zone__input" id="basicFile" multiple />
        <label for="basicFile" class="file-upload-zone__label">
          <div class="file-upload-zone__icon">
            <i class="fas fa-cloud-upload-alt"></i>
          </div>
          <div class="file-upload-zone__text">
            <p class="file-upload-zone__title">Drag & drop files here</p>
            <p class="file-upload-zone__subtitle">or click to browse</p>
          </div>
        </label>
      </div>
      <div class="file-upload-list"></div>
    `;

    return wrapper;
  },
};

/**
 * With File Restrictions
 *
 * Upload zone with file type and size restrictions.
 */
export const WithRestrictions = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '40px';
    wrapper.style.width = '600px';
    wrapper.innerHTML = `
      <div class="file-upload-zone">
        <input type="file" class="file-upload-zone__input" id="restrictedFile" multiple accept="image/*" />
        <label for="restrictedFile" class="file-upload-zone__label">
          <div class="file-upload-zone__icon">
            <i class="fas fa-images"></i>
          </div>
          <div class="file-upload-zone__text">
            <p class="file-upload-zone__title">Upload images only</p>
            <p class="file-upload-zone__subtitle">PNG, JPG, GIF (max 5MB each)</p>
          </div>
        </label>
        <p class="file-upload-zone__helper">
          Allowed: PNG, JPG, GIF • Max size: 5MB per file
        </p>
      </div>
      <div class="file-upload-list"></div>
    `;

    return wrapper;
  },
};

/**
 * Size Variants
 *
 * Compact and large upload zones.
 */
export const SizeVariants = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '40px';
    wrapper.style.width = '800px';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = 'var(--spacing-8)';
    wrapper.innerHTML = `
      <div>
        <h3 style="color: var(--color-text-secondary); margin-bottom: var(--spacing-3); font-size: 0.875rem;">
          Compact
        </h3>
        <div class="file-upload-zone file-upload-zone--compact">
          <input type="file" class="file-upload-zone__input" id="compactFile" />
          <label for="compactFile" class="file-upload-zone__label">
            <div class="file-upload-zone__icon">
              <i class="fas fa-upload"></i>
            </div>
            <div class="file-upload-zone__text">
              <p class="file-upload-zone__title">Quick upload</p>
              <p class="file-upload-zone__subtitle">Click to browse</p>
            </div>
          </label>
        </div>
      </div>

      <div>
        <h3 style="color: var(--color-text-secondary); margin-bottom: var(--spacing-3); font-size: 0.875rem;">
          Large
        </h3>
        <div class="file-upload-zone file-upload-zone--large">
          <input type="file" class="file-upload-zone__input" id="largeFile" multiple />
          <label for="largeFile" class="file-upload-zone__label">
            <div class="file-upload-zone__icon">
              <i class="fas fa-cloud-upload-alt"></i>
            </div>
            <div class="file-upload-zone__text">
              <p class="file-upload-zone__title">Drop your files here</p>
              <p class="file-upload-zone__subtitle">or click to select files from your device</p>
            </div>
          </label>
        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * With File List
 *
 * Upload zone with file list showing upload progress.
 */
export const WithFileList = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '40px';
    wrapper.style.width = '700px';
    wrapper.innerHTML = `
      <div class="file-upload-zone">
        <input type="file" class="file-upload-zone__input" id="listFile" multiple />
        <label for="listFile" class="file-upload-zone__label">
          <div class="file-upload-zone__icon">
            <i class="fas fa-file-upload"></i>
          </div>
          <div class="file-upload-zone__text">
            <p class="file-upload-zone__title">Upload documents</p>
            <p class="file-upload-zone__subtitle">PDF, Word, Excel files</p>
          </div>
        </label>
      </div>
      <div class="file-upload-list"></div>
    `;

    return wrapper;
  },
};

/**
 * States Demo
 *
 * Shows different upload states.
 */
export const States = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '40px';
    wrapper.style.width = '700px';
    wrapper.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: var(--spacing-6);">

        <!-- Pending -->
        <div>
          <h3 style="color: var(--color-text-secondary); margin-bottom: var(--spacing-3); font-size: 0.875rem;">
            Pending
          </h3>
          <div class="file-upload-list">
            <div class="file-upload-item file-upload-item--pending">
              <div class="file-upload-item__preview file-upload-item__preview--pdf">
                <i class="fas fa-file-pdf"></i>
              </div>
              <div class="file-upload-item__info">
                <div class="file-upload-item__name">report.pdf</div>
                <div class="file-upload-item__meta">2.5 MB</div>
              </div>
              <div class="file-upload-item__progress"></div>
              <button class="file-upload-item__remove"><i class="fas fa-times"></i></button>
            </div>
          </div>
        </div>

        <!-- Uploading -->
        <div>
          <h3 style="color: var(--color-text-secondary); margin-bottom: var(--spacing-3); font-size: 0.875rem;">
            Uploading
          </h3>
          <div class="file-upload-list">
            <div class="file-upload-item file-upload-item--uploading">
              <div class="file-upload-item__preview file-upload-item__preview--doc">
                <i class="fas fa-file-word"></i>
              </div>
              <div class="file-upload-item__info">
                <div class="file-upload-item__name">document.docx</div>
                <div class="file-upload-item__meta">1.8 MB • Uploading...</div>
              </div>
              <div class="file-upload-item__progress" style="display: block;">
                <div class="progress progress--sm">
                  <div class="progress__bar" style="width: 65%;"></div>
                </div>
              </div>
              <button class="file-upload-item__remove"><i class="fas fa-times"></i></button>
            </div>
          </div>
        </div>

        <!-- Success -->
        <div>
          <h3 style="color: var(--color-text-secondary); margin-bottom: var(--spacing-3); font-size: 0.875rem;">
            Success
          </h3>
          <div class="file-upload-list">
            <div class="file-upload-item file-upload-item--success">
              <div class="file-upload-item__preview file-upload-item__preview--xls">
                <i class="fas fa-file-excel"></i>
              </div>
              <div class="file-upload-item__info">
                <div class="file-upload-item__name">data.xlsx</div>
                <div class="file-upload-item__meta">3.2 MB</div>
              </div>
              <div class="file-upload-item__progress"></div>
              <button class="file-upload-item__remove"><i class="fas fa-times"></i></button>
            </div>
          </div>
        </div>

        <!-- Error -->
        <div>
          <h3 style="color: var(--color-text-secondary); margin-bottom: var(--spacing-3); font-size: 0.875rem;">
            Error
          </h3>
          <div class="file-upload-list">
            <div class="file-upload-item file-upload-item--error">
              <div class="file-upload-item__preview">
                <i class="fas fa-file"></i>
              </div>
              <div class="file-upload-item__info">
                <div class="file-upload-item__name">large_file.mp4</div>
                <div class="file-upload-item__meta">15.4 MB</div>
              </div>
              <div class="file-upload-item__error">
                File too large (max 10MB)
              </div>
              <button class="file-upload-item__remove"><i class="fas fa-times"></i></button>
            </div>
          </div>
        </div>

      </div>
    `;

    return wrapper;
  },
};

/**
 * Image Upload with Previews
 *
 * Upload images with automatic preview generation.
 */
export const ImageUpload = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '40px';
    wrapper.style.width = '700px';
    wrapper.innerHTML = `
      <div class="file-upload-zone">
        <input type="file" class="file-upload-zone__input" id="imageFile" multiple accept="image/*" />
        <label for="imageFile" class="file-upload-zone__label">
          <div class="file-upload-zone__icon">
            <i class="fas fa-images"></i>
          </div>
          <div class="file-upload-zone__text">
            <p class="file-upload-zone__title">Upload images</p>
            <p class="file-upload-zone__subtitle">PNG, JPG, GIF - with automatic previews</p>
          </div>
        </label>
      </div>
      <div class="file-upload-list"></div>
    `;

    return wrapper;
  },
};

/**
 * Profile Picture Upload
 *
 * Single file upload for profile pictures.
 */
export const ProfilePicture = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '40px';
    wrapper.style.width = '500px';
    wrapper.innerHTML = `
      <div class="card" style="max-width: 400px;">
        <div class="card__header">
          <h3 class="card__title">
            <i class="fas fa-user-circle"></i>
            Profile Picture
          </h3>
        </div>
        <div class="card__body">
          <div class="file-upload-zone file-upload-zone--compact">
            <input type="file" class="file-upload-zone__input" id="profilePic" accept="image/*" />
            <label for="profilePic" class="file-upload-zone__label">
              <div class="file-upload-zone__icon">
                <i class="fas fa-camera"></i>
              </div>
              <div class="file-upload-zone__text">
                <p class="file-upload-zone__title">Upload photo</p>
                <p class="file-upload-zone__subtitle">JPG, PNG (max 2MB)</p>
              </div>
            </label>
          </div>
          <div class="file-upload-list"></div>
        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * Document Upload Form
 *
 * Complete upload form with restrictions.
 */
export const DocumentUploadForm = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '40px';
    wrapper.style.width = '700px';
    wrapper.innerHTML = `
      <div class="card">
        <div class="card__header">
          <h3 class="card__title">
            <i class="fas fa-file-upload"></i>
            Upload Documents
          </h3>
        </div>
        <div class="card__body" style="display: flex; flex-direction: column; gap: var(--spacing-5);">

          <div class="form-field">
            <label class="form-field__label form-field__label--required">
              Document Title
            </label>
            <input type="text" class="form-field__control" placeholder="Enter document title" />
          </div>

          <div class="form-field">
            <label class="form-field__label">
              Category
            </label>
            <select class="form-field__control">
              <option>-- Select category --</option>
              <option>Reports</option>
              <option>Invoices</option>
              <option>Contracts</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label class="form-field__label form-field__label--required" style="margin-bottom: var(--spacing-3);">
              Files
            </label>
            <div class="file-upload-zone">
              <input type="file" class="file-upload-zone__input" id="docFile" multiple />
              <label for="docFile" class="file-upload-zone__label">
                <div class="file-upload-zone__icon">
                  <i class="fas fa-file-upload"></i>
                </div>
                <div class="file-upload-zone__text">
                  <p class="file-upload-zone__title">Drop files here</p>
                  <p class="file-upload-zone__subtitle">or click to browse</p>
                </div>
              </label>
              <p class="file-upload-zone__helper">
                Allowed: PDF, Word, Excel • Max 10MB per file
              </p>
            </div>
            <div class="file-upload-list"></div>
          </div>

        </div>
        <div class="card__footer">
          <button class="btn btn-secondary">Cancel</button>
          <button class="btn btn-primary">
            <i class="fas fa-upload"></i>
            Upload Documents
          </button>
        </div>
      </div>
    `;

    return wrapper;
  },
};

/**
 * All Variants Overview
 *
 * Complete showcase of all file upload patterns.
 */
export const AllVariants = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '40px';
    wrapper.style.display = 'grid';
    wrapper.style.gap = 'var(--spacing-8)';
    wrapper.style.maxWidth = '1200px';
    wrapper.innerHTML = `
      <div>
        <h2 style="color: var(--color-text-primary); margin-bottom: var(--spacing-4);">Upload Zones</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4);">
          <div class="file-upload-zone file-upload-zone--compact">
            <input type="file" class="file-upload-zone__input" id="allVariant1" />
            <label for="allVariant1" class="file-upload-zone__label">
              <div class="file-upload-zone__icon">
                <i class="fas fa-upload"></i>
              </div>
              <div class="file-upload-zone__text">
                <p class="file-upload-zone__title">Compact</p>
                <p class="file-upload-zone__subtitle">Click to upload</p>
              </div>
            </label>
          </div>
          <div class="file-upload-zone">
            <input type="file" class="file-upload-zone__input" id="allVariant2" />
            <label for="allVariant2" class="file-upload-zone__label">
              <div class="file-upload-zone__icon">
                <i class="fas fa-cloud-upload-alt"></i>
              </div>
              <div class="file-upload-zone__text">
                <p class="file-upload-zone__title">Default</p>
                <p class="file-upload-zone__subtitle">Drag & drop</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div>
        <h2 style="color: var(--color-text-primary); margin-bottom: var(--spacing-4);">File States</h2>
        <div class="file-upload-list">
          <div class="file-upload-item file-upload-item--pending">
            <div class="file-upload-item__preview">
              <i class="fas fa-file"></i>
            </div>
            <div class="file-upload-item__info">
              <div class="file-upload-item__name">pending.pdf</div>
              <div class="file-upload-item__meta">1.2 MB</div>
            </div>
            <div class="file-upload-item__progress"></div>
            <button class="file-upload-item__remove"><i class="fas fa-times"></i></button>
          </div>
          <div class="file-upload-item file-upload-item--uploading">
            <div class="file-upload-item__preview">
              <i class="fas fa-file"></i>
            </div>
            <div class="file-upload-item__info">
              <div class="file-upload-item__name">uploading.pdf</div>
              <div class="file-upload-item__meta">2.5 MB • Uploading...</div>
            </div>
            <div class="file-upload-item__progress" style="display: block;">
              <div class="progress progress--sm">
                <div class="progress__bar" style="width: 50%;"></div>
              </div>
            </div>
            <button class="file-upload-item__remove"><i class="fas fa-times"></i></button>
          </div>
          <div class="file-upload-item file-upload-item--success">
            <div class="file-upload-item__preview">
              <i class="fas fa-file"></i>
            </div>
            <div class="file-upload-item__info">
              <div class="file-upload-item__name">success.pdf</div>
              <div class="file-upload-item__meta">3.1 MB</div>
            </div>
            <div class="file-upload-item__progress"></div>
            <button class="file-upload-item__remove"><i class="fas fa-times"></i></button>
          </div>
          <div class="file-upload-item file-upload-item--error">
            <div class="file-upload-item__preview">
              <i class="fas fa-file"></i>
            </div>
            <div class="file-upload-item__info">
              <div class="file-upload-item__name">error.pdf</div>
              <div class="file-upload-item__meta">15 MB</div>
            </div>
            <div class="file-upload-item__error">File too large (max 10MB)</div>
            <button class="file-upload-item__remove"><i class="fas fa-times"></i></button>
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },
};
