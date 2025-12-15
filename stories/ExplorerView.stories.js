/**
 * Documents Explorer View - Storybook Stories
 *
 * Complete Google Drive-like interface for document management
 * Shows role-based UI differences (admin vs employee)
 * Two view modes: List (default, Windows Details view) and Grid (card view)
 *
 * @requires Design System components
 * @requires Tailwind CSS v4 with design tokens
 */

export default {
  title: 'Pages/Documents Explorer',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Unified Documents Explorer View - replaces 9 separate pages with single SPA interface. Features folder tree navigation, list/grid views, upload integration (admin/root only), and smart filtering.'
      }
    }
  }
};

/**
 * Helper: Create Document Card Element (Grid View)
 */
function createDocumentCard(category, month, isNew, showActions) {
  const card = document.createElement('div');
  card.className = 'document-card bg-surface-2 border border-border-subtle rounded-lg p-4 hover:shadow-lg cursor-pointer transition-all duration-200';

  card.innerHTML = `
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-3">
        <svg class="w-10 h-10 text-error-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"></path>
          <path fill="#fff" d="M14 2v6h6"></path>
        </svg>
        ${isNew ? '<span class="px-2 py-0.5 bg-success-100 text-success-700 text-xs font-medium rounded">Neu</span>' : ''}
      </div>
      ${showActions ? `
        <button class="text-content-tertiary hover:text-content-primary transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
          </svg>
        </button>
      ` : ''}
    </div>
    <div class="mb-3">
      <h3 class="text-sm font-medium text-content-primary truncate mb-1">${category}</h3>
      <p class="text-xs text-content-secondary">${month} 2025</p>
    </div>
    <div class="flex items-center justify-between text-xs text-content-tertiary">
      <span>2.4 MB</span>
      <span>vor 2 Tagen</span>
    </div>
  `;

  return card;
}

/**
 * Helper: Create Document Row Element (List View - Windows Details Style)
 */
function createDocumentRow(name, category, date, size, isNew, showActions) {
  const row = document.createElement('div');
  row.className = 'document-row group flex items-center gap-4 px-4 py-3 border-b border-border-subtle hover:bg-surface-2 cursor-pointer transition-colors';

  row.innerHTML = `
    <!-- Icon & Name Column -->
    <div class="flex items-center gap-3 flex-1 min-w-0">
      <svg class="w-6 h-6 text-error-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"></path>
        <path fill="#fff" d="M14 2v6h6"></path>
      </svg>
      <div class="flex-1 min-w-0 flex items-center gap-2">
        <span class="text-sm font-medium text-content-primary truncate">${name}</span>
        ${isNew ? '<span class="px-1.5 py-0.5 bg-success-100 text-success-700 text-xs font-medium rounded flex-shrink-0">Neu</span>' : ''}
      </div>
    </div>

    <!-- Category Column -->
    <div class="w-40 flex-shrink-0">
      <span class="text-sm text-content-secondary">${category}</span>
    </div>

    <!-- Date Modified Column -->
    <div class="w-32 flex-shrink-0">
      <span class="text-sm text-content-tertiary">${date}</span>
    </div>

    <!-- Size Column -->
    <div class="w-24 flex-shrink-0 text-right">
      <span class="text-sm text-content-tertiary">${size}</span>
    </div>

    <!-- Actions Column -->
    ${showActions ? `
      <div class="w-10 flex-shrink-0">
        <button class="opacity-0 group-hover:opacity-100 text-content-tertiary hover:text-content-primary transition-all">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
          </svg>
        </button>
      </div>
    ` : '<div class="w-10 flex-shrink-0"></div>'}
  `;

  return row;
}

/**
 * Helper: Create Folder Item
 */
function createFolderItem(icon, label, count, isActive = false) {
  const button = document.createElement('button');
  button.className = `folder-item w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-3 transition-colors text-left ${isActive ? 'active bg-surface-3' : ''}`;

  button.innerHTML = `
    ${icon}
    <span class="text-sm ${isActive ? 'font-medium text-primary-500' : 'text-content-primary'}">${label}</span>
    <span class="ml-auto text-xs text-content-tertiary">${count}</span>
  `;

  return button;
}

/**
 * Helper: Create Sidebar
 */
function createSidebar() {
  const sidebar = document.createElement('aside');
  sidebar.className = 'w-64 bg-surface-2 border-r border-border-subtle flex flex-col';
  sidebar.innerHTML = `
    <div class="p-4 border-b border-border-subtle">
      <h2 class="text-lg font-semibold text-content-primary">Dokumente</h2>
      <p class="text-sm text-content-secondary mt-1">Alle Dateien</p>
    </div>
  `;

  const nav = document.createElement('nav');
  nav.className = 'flex-1 overflow-y-auto p-4';
  const folderList = document.createElement('ul');
  folderList.className = 'space-y-1';

  const allDocsIcon = '<svg class="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>';
  const personalIcon = '<svg class="w-5 h-5 text-content-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';
  const teamIcon = '<svg class="w-5 h-5 text-content-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>';
  const deptIcon = '<svg class="w-5 h-5 text-content-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>';
  const companyIcon = '<svg class="w-5 h-5 text-content-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>';

  folderList.appendChild(createFolderItem(allDocsIcon, 'Alle Dokumente', '156', true));
  folderList.appendChild(createFolderItem(personalIcon, 'Persönlich', '42'));
  folderList.appendChild(createFolderItem(teamIcon, 'Team Dokumente', '38'));
  folderList.appendChild(createFolderItem(deptIcon, 'Abteilung', '51'));
  folderList.appendChild(createFolderItem(companyIcon, 'Firma', '25'));

  nav.appendChild(folderList);
  sidebar.appendChild(nav);

  const footer = document.createElement('div');
  footer.className = 'p-4 border-t border-border-subtle';
  footer.innerHTML = `
    <div class="text-xs text-content-tertiary mb-2">Speicherplatz</div>
    <div class="w-full bg-surface-3 rounded-full h-2 mb-2">
      <div class="bg-primary-500 h-2 rounded-full" style="width: 68%"></div>
    </div>
    <div class="text-xs text-content-secondary">156 von 230 Dokumenten</div>
  `;
  sidebar.appendChild(footer);

  return sidebar;
}

/**
 * Helper: Create Header
 */
function createHeader() {
  const header = document.createElement('header');
  header.className = 'bg-surface-2 border-b border-border-subtle px-6 py-4';
  header.innerHTML = `
    <div class="flex items-center justify-between">
      <nav class="flex items-center gap-2 text-sm">
        <a href="#" class="text-content-secondary hover:text-content-primary transition-colors">Dokumente</a>
        <svg class="w-4 h-4 text-content-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
        <span class="text-content-primary font-medium">Alle Dokumente</span>
      </nav>
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <span class="text-sm text-content-secondary">156 Dokumente</span>
        </div>
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span class="text-sm text-content-secondary">12 Neu</span>
        </div>
      </div>
    </div>
  `;
  return header;
}

/**
 * Helper: Create Toolbar
 */
function createToolbar(showUploadButton, viewMode = 'list') {
  const toolbar = document.createElement('div');
  toolbar.className = 'bg-surface-1 border-b border-border-subtle px-6 py-3';
  toolbar.innerHTML = `
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3 flex-1">
        <div class="flex-1 max-w-md relative">
          <input
            type="text"
            placeholder="Dokumente durchsuchen..."
            class="w-full pl-10 pr-4 py-2 bg-surface-2 border border-border-subtle rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
        ${showUploadButton ? `
          <button id="upload-btn" class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2 shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
            Dokument hochladen
          </button>
        ` : ''}
      </div>
      <div class="flex items-center gap-2">
        <button class="px-3 py-2 bg-surface-2 border border-border-subtle rounded-md text-sm font-medium text-content-primary hover:bg-surface-3 transition-colors flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
          </svg>
          Filter
        </button>
        <button class="px-3 py-2 bg-surface-2 border border-border-subtle rounded-md text-sm font-medium text-content-primary hover:bg-surface-3 transition-colors flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"></path>
          </svg>
          Sortieren: Neueste
        </button>
        <div class="flex bg-surface-2 border border-border-subtle rounded-md p-1">
          <button class="p-1.5 rounded ${viewMode === 'list' ? 'text-primary-500 bg-primary-100' : 'text-content-tertiary hover:text-content-primary'} transition-colors" title="Listenansicht">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
            </svg>
          </button>
          <button class="p-1.5 rounded ${viewMode === 'grid' ? 'text-primary-500 bg-primary-100' : 'text-content-tertiary hover:text-content-primary'} transition-colors" title="Kachelansicht">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
  return toolbar;
}

/**
 * EMPLOYEE VIEW - LIST MODE (DEFAULT)
 * Windows Explorer Details view - table-like layout
 */
export const EmployeeListView = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'flex h-screen bg-surface-1';

    const sidebar = createSidebar();
    const main = document.createElement('main');
    main.className = 'flex-1 flex flex-col overflow-hidden';

    main.appendChild(createHeader());
    main.appendChild(createToolbar(false, 'list'));

    // List View Container
    const listContainer = document.createElement('div');
    listContainer.className = 'flex-1 overflow-y-auto';

    // Column Headers
    const headers = document.createElement('div');
    headers.className = 'sticky top-0 bg-surface-2 border-b border-border-subtle px-4 py-2 flex items-center gap-4 text-xs font-medium text-content-tertiary uppercase tracking-wide z-10';
    headers.innerHTML = `
      <div class="flex-1 min-w-0">Name</div>
      <div class="w-40 flex-shrink-0">Kategorie</div>
      <div class="w-32 flex-shrink-0">Geändert am</div>
      <div class="w-24 flex-shrink-0 text-right">Größe</div>
      <div class="w-10 flex-shrink-0"></div>
    `;
    listContainer.appendChild(headers);

    // Document Rows
    const rowsContainer = document.createElement('div');
    const documents = [
      { name: 'Gehaltsabrechnung_Januar_2025.pdf', category: 'Gehaltsabrechnung', date: '08.01.2025', size: '2.4 MB', isNew: true },
      { name: 'Gehaltsabrechnung_Februar_2025.pdf', category: 'Gehaltsabrechnung', date: '07.01.2025', size: '2.3 MB', isNew: true },
      { name: 'Vertrag_Arbeitsvertrag.pdf', category: 'Vertrag', date: '05.01.2025', size: '1.8 MB', isNew: true },
      { name: 'Arbeitsnachweis_Dezember_2024.pdf', category: 'Arbeitsnachweis', date: '02.01.2025', size: '890 KB', isNew: false },
      { name: 'Sonstiges_Dokument.pdf', category: 'Sonstiges', date: '28.12.2024', size: '1.2 MB', isNew: false },
      { name: 'Gehaltsabrechnung_Dezember_2024.pdf', category: 'Gehaltsabrechnung', date: '20.12.2024', size: '2.5 MB', isNew: false },
      { name: 'Vertrag_Zusatzvereinbarung.pdf', category: 'Vertrag', date: '15.12.2024', size: '456 KB', isNew: false },
      { name: 'Arbeitsnachweis_November_2024.pdf', category: 'Arbeitsnachweis', date: '10.12.2024', size: '920 KB', isNew: false },
      { name: 'Gehaltsabrechnung_November_2024.pdf', category: 'Gehaltsabrechnung', date: '05.12.2024', size: '2.4 MB', isNew: false },
      { name: 'Sonstiges_Bescheinigung.pdf', category: 'Sonstiges', date: '01.12.2024', size: '680 KB', isNew: false },
      { name: 'Arbeitsnachweis_Oktober_2024.pdf', category: 'Arbeitsnachweis', date: '25.11.2024', size: '910 KB', isNew: false },
      { name: 'Gehaltsabrechnung_Oktober_2024.pdf', category: 'Gehaltsabrechnung', date: '20.11.2024', size: '2.3 MB', isNew: false },
    ];

    documents.forEach(doc => {
      rowsContainer.appendChild(createDocumentRow(doc.name, doc.category, doc.date, doc.size, doc.isNew, false));
    });

    listContainer.appendChild(rowsContainer);
    main.appendChild(listContainer);

    container.appendChild(sidebar);
    container.appendChild(main);

    return container;
  }
};

/**
 * EMPLOYEE VIEW - GRID MODE
 * Card-based grid view like Google Drive
 */
export const EmployeeGridView = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'flex h-screen bg-surface-1';

    const sidebar = createSidebar();
    const main = document.createElement('main');
    main.className = 'flex-1 flex flex-col overflow-hidden';

    main.appendChild(createHeader());
    main.appendChild(createToolbar(false, 'grid'));

    // Grid View Container
    const gridContainer = document.createElement('div');
    gridContainer.className = 'flex-1 overflow-y-auto p-6';
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';

    const categories = ['Gehaltsabrechnung', 'Vertrag', 'Arbeitsnachweis', 'Sonstiges'];
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni'];

    for (let i = 0; i < 12; i++) {
      const category = categories[i % categories.length];
      const month = months[i % months.length];
      const isNew = i < 3;
      grid.appendChild(createDocumentCard(category, month, isNew, false));
    }

    gridContainer.appendChild(grid);
    main.appendChild(gridContainer);

    container.appendChild(sidebar);
    container.appendChild(main);

    return container;
  }
};

/**
 * ADMIN VIEW - LIST MODE (DEFAULT)
 * Same as employee but with upload button and action menu on rows
 */
export const AdminListView = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'flex h-screen bg-surface-1';

    const sidebar = createSidebar();
    const main = document.createElement('main');
    main.className = 'flex-1 flex flex-col overflow-hidden';

    main.appendChild(createHeader());
    main.appendChild(createToolbar(true, 'list'));

    // List View Container
    const listContainer = document.createElement('div');
    listContainer.className = 'flex-1 overflow-y-auto';

    // Column Headers
    const headers = document.createElement('div');
    headers.className = 'sticky top-0 bg-surface-2 border-b border-border-subtle px-4 py-2 flex items-center gap-4 text-xs font-medium text-content-tertiary uppercase tracking-wide z-10';
    headers.innerHTML = `
      <div class="flex-1 min-w-0">Name</div>
      <div class="w-40 flex-shrink-0">Kategorie</div>
      <div class="w-32 flex-shrink-0">Geändert am</div>
      <div class="w-24 flex-shrink-0 text-right">Größe</div>
      <div class="w-10 flex-shrink-0"></div>
    `;
    listContainer.appendChild(headers);

    // Document Rows
    const rowsContainer = document.createElement('div');
    const documents = [
      { name: 'Gehaltsabrechnung_Januar_2025.pdf', category: 'Gehaltsabrechnung', date: '08.01.2025', size: '2.4 MB', isNew: true },
      { name: 'Gehaltsabrechnung_Februar_2025.pdf', category: 'Gehaltsabrechnung', date: '07.01.2025', size: '2.3 MB', isNew: true },
      { name: 'Vertrag_Arbeitsvertrag.pdf', category: 'Vertrag', date: '05.01.2025', size: '1.8 MB', isNew: true },
      { name: 'Arbeitsnachweis_Dezember_2024.pdf', category: 'Arbeitsnachweis', date: '02.01.2025', size: '890 KB', isNew: false },
      { name: 'Sonstiges_Dokument.pdf', category: 'Sonstiges', date: '28.12.2024', size: '1.2 MB', isNew: false },
      { name: 'Gehaltsabrechnung_Dezember_2024.pdf', category: 'Gehaltsabrechnung', date: '20.12.2024', size: '2.5 MB', isNew: false },
      { name: 'Vertrag_Zusatzvereinbarung.pdf', category: 'Vertrag', date: '15.12.2024', size: '456 KB', isNew: false },
      { name: 'Arbeitsnachweis_November_2024.pdf', category: 'Arbeitsnachweis', date: '10.12.2024', size: '920 KB', isNew: false },
      { name: 'Gehaltsabrechnung_November_2024.pdf', category: 'Gehaltsabrechnung', date: '05.12.2024', size: '2.4 MB', isNew: false },
      { name: 'Sonstiges_Bescheinigung.pdf', category: 'Sonstiges', date: '01.12.2024', size: '680 KB', isNew: false },
      { name: 'Arbeitsnachweis_Oktober_2024.pdf', category: 'Arbeitsnachweis', date: '25.11.2024', size: '910 KB', isNew: false },
      { name: 'Gehaltsabrechnung_Oktober_2024.pdf', category: 'Gehaltsabrechnung', date: '20.11.2024', size: '2.3 MB', isNew: false },
    ];

    documents.forEach(doc => {
      rowsContainer.appendChild(createDocumentRow(doc.name, doc.category, doc.date, doc.size, doc.isNew, true));
    });

    listContainer.appendChild(rowsContainer);
    main.appendChild(listContainer);

    container.appendChild(sidebar);
    container.appendChild(main);

    return container;
  }
};

/**
 * ADMIN VIEW - GRID MODE
 * Card-based grid view with action menus
 */
export const AdminGridView = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'flex h-screen bg-surface-1';

    const sidebar = createSidebar();
    const main = document.createElement('main');
    main.className = 'flex-1 flex flex-col overflow-hidden';

    main.appendChild(createHeader());
    main.appendChild(createToolbar(true, 'grid'));

    // Grid View Container
    const gridContainer = document.createElement('div');
    gridContainer.className = 'flex-1 overflow-y-auto p-6';
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';

    const categories = ['Gehaltsabrechnung', 'Vertrag', 'Arbeitsnachweis', 'Sonstiges'];
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni'];

    for (let i = 0; i < 12; i++) {
      const category = categories[i % categories.length];
      const month = months[i % months.length];
      const isNew = i < 3;
      grid.appendChild(createDocumentCard(category, month, isNew, true));
    }

    gridContainer.appendChild(grid);
    main.appendChild(gridContainer);

    container.appendChild(sidebar);
    container.appendChild(main);

    return container;
  }
};
