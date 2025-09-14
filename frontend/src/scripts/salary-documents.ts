import { setHTML, $$, $all } from '../utils/dom-utils';

// Types
interface SalaryDocument {
  id: string;
  file_name: string;
  description?: string;
  month?: string;
  year?: string;
  upload_date: string;
  download_count?: number;
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  initializeLogoutButton();
  initializeTabs();
  void loadSalaryDocuments(false); // Aktuelle Gehaltsabrechnungen
  void loadSalaryDocuments(true); // Archivierte Gehaltsabrechnungen
  setupEventDelegation();
});

function initializeLogoutButton(): void {
  const logoutBtn = $$('#logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      if (confirm('Möchten Sie sich wirklich abmelden?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        window.location.href = '/';
      }
    });
  }
}

function initializeTabs(): void {
  $all('.tab').forEach((tab) => {
    tab.addEventListener('click', function (this: HTMLElement) {
      const tabId = this.dataset.tab;
      if (tabId !== undefined && tabId !== '') {
        showTab(tabId);
      }
    });
  });
}

function showTab(tabId: string): void {
  // Alle Tabs und Inhalte zurücksetzen
  $all('.tab').forEach((tab) => {
    tab.classList.remove('active');
  });
  $all('.tab-content').forEach((content) => {
    content.classList.remove('active');
  });

  // Aktiven Tab und Inhalt setzen
  const activeTab = $$(`.tab[data-tab="${tabId}"]`);
  const activeContent = $$(`#${tabId}`);

  if (activeTab) {
    activeTab.classList.add('active');
  }
  if (activeContent) {
    activeContent.classList.add('active');
  }
}

function setupEventDelegation(): void {
  // Event Delegation für Download/View Buttons
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Download button
    const downloadBtn = target.closest('.download-btn');
    if (downloadBtn instanceof HTMLElement) {
      e.preventDefault();
      const docId = downloadBtn.dataset.documentId;
      if (docId !== undefined && docId !== '') {
        void downloadDocument(docId, false, downloadBtn as HTMLButtonElement);
      }
    }

    // View button
    const viewBtn = target.closest('.view-btn');
    if (viewBtn instanceof HTMLElement) {
      e.preventDefault();
      const docId = viewBtn.dataset.documentId;
      if (docId !== undefined && docId !== '') {
        void downloadDocument(docId, true, viewBtn as HTMLButtonElement);
      }
    }
  });
}

async function loadSalaryDocuments(archived: boolean): Promise<void> {
  const token = localStorage.getItem('token');
  if (token === null || token === '') {
    window.location.href = '/';
    return;
  }

  const container = archived ? $$('#archived-documents') : $$('#current-documents');

  if (!container) {
    console.error('Container nicht gefunden');
    return;
  }

  try {
    const response = await fetch(
      '/api/salary-documents?' +
        new URLSearchParams({
          archived: archived.toString(),
        }).toString(),
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
      },
    );

    if (response.ok) {
      const documents = (await response.json()) as SalaryDocument[];

      if (documents.length === 0) {
        // Keine Dokumente vorhanden
        const emptyStateHTML = `
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              ${
                archived
                  ? `<polyline points="21 8 21 21 3 21 3 8"></polyline>
                   <rect x="1" y="3" width="22" height="5"></rect>
                   <line x1="10" y1="12" x2="14" y2="12"></line>`
                  : `<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                   <polyline points="13 2 13 9 20 9"></polyline>`
              }
            </svg>
            <h3>${archived ? 'Kein Archiv vorhanden' : 'Keine aktuellen Gehaltsabrechnungen'}</h3>
            <p>${
              archived
                ? 'Hier werden ältere Gehaltsabrechnungen angezeigt, die archiviert wurden.'
                : 'Hier werden Ihre aktuellen Gehaltsabrechnungen angezeigt, sobald sie verfügbar sind.'
            }</p>
          </div>
        `;
        setHTML(container, emptyStateHTML);
        return;
      }

      // Dokumente anzeigen - alle Cards sammeln
      let allCardsHTML = '';

      documents.forEach((doc) => {
        const dateInfo =
          doc.month !== undefined && doc.month !== '' && doc.year !== undefined && doc.year !== ''
            ? `${doc.month} ${doc.year}`
            : new Date(doc.upload_date).toLocaleDateString('de-DE', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              });

        // Card HTML zur Sammlung hinzufügen
        allCardsHTML += `
          <div class="document-card">
            <div class="document-header">
              <h3 class="document-title">${doc.file_name}</h3>
              <span class="document-date">${dateInfo}</span>
            </div>
            <div class="document-body">
              <div class="document-description">${doc.description ?? 'Lohnabrechnung'}</div>
              <div class="document-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <path d="M16 13H8"></path>
                  <path d="M16 17H8"></path>
                  <path d="M10 9H8"></path>
                </svg>
              </div>
            </div>
            <div class="document-footer">
              <div class="document-actions">
                <button class="download-btn" data-document-id="${doc.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Herunterladen
                </button>
                <button class="view-btn" data-document-id="${doc.id}" data-view-mode="true">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  Anzeigen
                </button>
              </div>
              <div class="download-info">
                ${doc.download_count !== undefined && doc.download_count > 0 ? `${doc.download_count}x heruntergeladen` : 'Noch nicht heruntergeladen'}
              </div>
              <div class="download-progress-container" id="progress-${doc.id}">
                <div class="download-progress-bar"></div>
              </div>
            </div>
          </div>
        `;
      });

      // Einmal innerHTML setzen mit allen Cards
      setHTML(container, allCardsHTML);
    } else {
      // Fehler beim Laden
      const errorHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3>Fehler beim Laden</h3>
          <p>Die Dokumente konnten nicht geladen werden. Bitte versuchen Sie es später erneut.</p>
        </div>
      `;
      setHTML(container, errorHTML);
    }
  } catch (error) {
    console.error('Fehler beim Laden der Gehaltsabrechnungen:', error);

    // Fehler anzeigen
    const catchErrorHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h3>Fehler beim Laden</h3>
        <p>Die Dokumente konnten nicht geladen werden. Bitte versuchen Sie es später erneut.</p>
      </div>
    `;
    setHTML(container, catchErrorHTML);
  }
}

async function downloadDocument(
  documentId: string,
  viewInBrowser: boolean,
  buttonEl: HTMLButtonElement,
): Promise<void> {
  // Den Token aus dem localStorage holen
  const token = localStorage.getItem('token');
  if (token === null || token === '') {
    alert('Sie müssen angemeldet sein, um Dokumente herunterzuladen.');
    return;
  }

  // Progress-Container finden
  const progressContainer = $$(`#progress-${documentId}`);
  const progressBar = progressContainer ? $$('.download-progress-bar', progressContainer) : null;

  // Button-Text und Zustand speichern
  const buttonContent = buttonEl.innerHTML;
  const isViewMode = buttonEl.classList.contains('view-btn');

  try {
    // Button Zustand aktualisieren
    buttonEl.disabled = true;
    const loadingHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="loading-spinner">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 6v6l4 2"></path>
      </svg>
      ${isViewMode ? 'Wird geladen...' : 'Wird vorbereitet...'}
    `;
    setHTML(buttonEl, loadingHTML);

    // Progress-Container anzeigen
    if (progressContainer) {
      progressContainer.style.display = 'block';
      if (progressBar) {
        progressBar.style.width = '5%';
      }
    }

    // Simulierte Progress-Updates
    const progressIntervals = [
      { delay: 100, width: '25%' },
      { delay: 200, width: '50%' },
      { delay: 300, width: '75%' },
    ];

    progressIntervals.forEach(({ delay, width }) => {
      setTimeout(() => {
        if (progressBar) {
          progressBar.style.width = width;
        }
      }, delay);
    });

    // API-Aufruf zum Dokument herunterladen
    const response = await fetch(`/api/salary-documents/${documentId}/download`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
      },
    });

    if (!response.ok) {
      throw new Error('Download fehlgeschlagen');
    }

    // Fortschritt auf 100% setzen
    if (progressBar) {
      progressBar.style.width = '100%';
    }

    // Erfolgreiche Antwort verarbeiten
    const blob = await response.blob();
    const contentDisposition = response.headers.get('Content-Disposition');
    const fileNameMatch = contentDisposition?.match(/filename="(.+)"/);
    const fileName = fileNameMatch ? fileNameMatch[1] : `dokument_${documentId}.pdf`;

    // Datei herunterladen oder anzeigen
    const url = window.URL.createObjectURL(blob);

    if (viewInBrowser) {
      // In neuem Tab öffnen
      window.open(url, '_blank');
    } else {
      // Download starten
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.append(a);
      a.click();
      a.remove();
    }

    // Aufräumen
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 100);

    // UI zurücksetzen
    setTimeout(() => {
      buttonEl.disabled = false;
      setHTML(buttonEl, buttonContent);
      if (progressContainer) {
        progressContainer.style.display = 'none';
      }
      if (progressBar) {
        progressBar.style.width = '0';
      }
    }, 500);
  } catch (error) {
    console.error('Fehler beim Download:', error);
    alert('Der Download konnte nicht gestartet werden. Bitte versuchen Sie es später erneut.');

    // UI bei Fehler zurücksetzen
    const currentButton = buttonEl;
    currentButton.disabled = false;
    setHTML(currentButton, buttonContent);
    if (progressContainer) {
      progressContainer.style.display = 'none';
    }
    if (progressBar) {
      progressBar.style.width = '0';
    }
  }
}
