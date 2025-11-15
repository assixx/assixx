/**
 * Data Display Components - Storybook Stories
 *
 * Components:
 * - Tables (striped, hover, bordered, compact)
 * - Empty States
 * - Data Lists (key-value pairs)
 */

export default {
  title: 'Design System/Data Display',

  parameters: {
    layout: 'padded',
  },

  tags: ['autodocs'],

  globals: {
    backgrounds: {
      value: 'assixx-dark',
    },
  },
};

/* ========== TABLES ========== */

export const BasicTable = () => {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.minHeight = '500px';
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Basic Table</h3>
      <div class="overflow-x-auto">
        <table class="data-table ">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Position</th>
              <th>Abteilung</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Max Mustermann</td>
              <td>max.mustermann@assixx.de</td>
              <td>Senior Entwickler</td>
              <td>IT Development</td>
              <td><span class="badge badge--success">Aktiv</span></td>
            </tr>
            <tr>
              <td>Anna Schmidt</td>
              <td>anna.schmidt@assixx.de</td>
              <td>Projektmanagerin</td>
              <td>Management</td>
              <td><span class="badge badge--success">Aktiv</span></td>
            </tr>
            <tr>
              <td>Thomas Müller</td>
              <td>thomas.mueller@assixx.de</td>
              <td>UX Designer</td>
              <td>Design</td>
              <td><span class="badge badge--warning">Urlaub</span></td>
            </tr>
            <tr>
              <td>Lisa Weber</td>
              <td>lisa.weber@assixx.de</td>
              <td>Backend Entwicklerin</td>
              <td>IT Development</td>
              <td><span class="badge badge--success">Aktiv</span></td>
            </tr>
            <tr>
              <td>Peter Klein</td>
              <td>peter.klein@assixx.de</td>
              <td>DevOps Engineer</td>
              <td>IT Operations</td>
              <td><span class="badge badge--danger">Krank</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Floating Action Button -->
      <button class="btn-float" aria-label="Add employee">
        <i class="fas fa-user-plus"></i>
      </button>
    </div>
  `;
  return wrapper;
};

export const StripedTable = () => {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.minHeight = '500px';
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Striped Table</h3>
      <div class="overflow-x-auto">
        <table class="data-table data-table--striped min-w-[1100px]">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Rolle</th>
              <th>Team</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Max Mustermann</td>
              <td>max@assixx.de</td>
              <td><span class="badge badge--role-admin">Admin</span></td>
              <td>Frontend Team</td>
              <td>
                <button class="btn btn-cancel" style="padding: 4px 12px; font-size: 13px;">Bearbeiten</button>
              </td>
            </tr>
            <tr>
              <td>Anna Schmidt</td>
              <td>anna@assixx.de</td>
              <td><span class="badge badge--role-employee">Employee</span></td>
              <td>Backend Team</td>
              <td>
                <button class="btn btn-cancel" style="padding: 4px 12px; font-size: 13px;">Bearbeiten</button>
              </td>
            </tr>
            <tr>
              <td>Thomas Müller</td>
              <td>thomas@assixx.de</td>
              <td><span class="badge badge--role-employee">Employee</span></td>
              <td>Design Team</td>
              <td>
                <button class="btn btn-cancel" style="padding: 4px 12px; font-size: 13px;">Bearbeiten</button>
              </td>
            </tr>
            <tr>
              <td>Lisa Weber</td>
              <td>lisa@assixx.de</td>
              <td><span class="badge badge--role-admin">Admin</span></td>
              <td>DevOps Team</td>
              <td>
                <button class="btn btn-cancel" style="padding: 4px 12px; font-size: 13px;">Bearbeiten</button>
              </td>
            </tr>
            <tr>
              <td>Peter Klein</td>
              <td>peter@assixx.de</td>
              <td><span class="badge badge--role-root">Root</span></td>
              <td>Management</td>
              <td>
                <button class="btn btn-cancel" style="padding: 4px 12px; font-size: 13px;">Bearbeiten</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Floating Action Button -->
      <button class="btn-float" aria-label="Add user">
        <i class="fas fa-user-plus"></i>
      </button>
    </div>
  `;
  return wrapper;
};

export const HoverTable = () => {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.minHeight = '500px';
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Hover Table (Clickable Rows)</h3>
      <div class="overflow-x-auto">
        <table class="data-table data-table--hover ">
          <thead>
            <tr>
              <th>ID</th>
              <th>Benutzer</th>
              <th>Aktion</th>
              <th>Zeitstempel</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>#1234</td>
              <td>max.mustermann</td>
              <td><span class="badge badge--login">Login</span></td>
              <td>2025-10-04 14:23:45</td>
              <td><span class="badge badge--success">Erfolg</span></td>
            </tr>
            <tr>
              <td>#1235</td>
              <td>anna.schmidt</td>
              <td><span class="badge badge--create">Create</span></td>
              <td>2025-10-04 14:25:12</td>
              <td><span class="badge badge--success">Erfolg</span></td>
            </tr>
            <tr>
              <td>#1236</td>
              <td>thomas.mueller</td>
              <td><span class="badge badge--update">Update</span></td>
              <td>2025-10-04 14:27:33</td>
              <td><span class="badge badge--success">Erfolg</span></td>
            </tr>
            <tr class="is-active">
              <td>#1237</td>
              <td>lisa.weber</td>
              <td><span class="badge badge--delete">Delete</span></td>
              <td>2025-10-04 14:30:01</td>
              <td><span class="badge badge--warning">Ausstehend</span></td>
            </tr>
            <tr>
              <td>#1238</td>
              <td>peter.klein</td>
              <td><span class="badge badge--login">Login</span></td>
              <td>2025-10-04 14:32:15</td>
              <td><span class="badge badge--danger">Fehler</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style="color: var(--color-text-secondary); font-size: 13px; margin-top: 12px;">
        <i class="fas fa-info-circle"></i> Hover über Zeilen. Eine Zeile ist als aktiv markiert (.is-active).
      </p>

      <!-- Floating Action Button -->
      <button class="btn-float" aria-label="Add log entry">
        <i class="fas fa-plus"></i>
      </button>
    </div>
  `;
  return wrapper;
};

export const CompactTable = () => {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.minHeight = '500px';
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Compact Table (.data-table--sm)</h3>
      <div class="overflow-x-auto">
        <table class="data-table data-table--sm data-table--striped ">
          <thead>
            <tr>
              <th>Schicht-ID</th>
              <th>Datum</th>
              <th>Start</th>
              <th>Ende</th>
              <th>Mitarbeiter</th>
              <th>Maschine</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>S-001</td>
              <td>04.10.2025</td>
              <td>06:00</td>
              <td>14:00</td>
              <td>Max Mustermann</td>
              <td>Maschine A1</td>
              <td><span class="badge badge--success" style="font-size: 11px; padding: 2px 8px;">Aktiv</span></td>
            </tr>
            <tr>
              <td>S-002</td>
              <td>04.10.2025</td>
              <td>14:00</td>
              <td>22:00</td>
              <td>Anna Schmidt</td>
              <td>Maschine A2</td>
              <td><span class="badge badge--warning" style="font-size: 11px; padding: 2px 8px;">Geplant</span></td>
            </tr>
            <tr>
              <td>S-003</td>
              <td>04.10.2025</td>
              <td>22:00</td>
              <td>06:00</td>
              <td>Thomas Müller</td>
              <td>Maschine B1</td>
              <td><span class="badge badge--info" style="font-size: 11px; padding: 2px 8px;">Geplant</span></td>
            </tr>
            <tr>
              <td>S-004</td>
              <td>05.10.2025</td>
              <td>06:00</td>
              <td>14:00</td>
              <td>Lisa Weber</td>
              <td>Maschine A1</td>
              <td><span class="badge badge--info" style="font-size: 11px; padding: 2px 8px;">Geplant</span></td>
            </tr>
            <tr>
              <td>S-005</td>
              <td>05.10.2025</td>
              <td>14:00</td>
              <td>22:00</td>
              <td>Peter Klein</td>
              <td>Maschine C1</td>
              <td><span class="badge badge--info" style="font-size: 11px; padding: 2px 8px;">Geplant</span></td>
            </tr>
            <tr>
              <td>S-006</td>
              <td>05.10.2025</td>
              <td>22:00</td>
              <td>06:00</td>
              <td>Max Mustermann</td>
              <td>Maschine B2</td>
              <td><span class="badge badge--info" style="font-size: 11px; padding: 2px 8px;">Geplant</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Floating Action Button -->
      <button class="btn-float" aria-label="Add shift">
        <i class="fas fa-plus"></i>
      </button>
    </div>
  `;
  return wrapper;
};

export const BorderedTable = () => {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.minHeight = '500px';
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Bordered Table</h3>
      <div class="overflow-x-auto">
        <table class="data-table data-table--bordered ">
          <thead>
            <tr>
              <th>Abteilung</th>
              <th>Mitarbeiter</th>
              <th>Teams</th>
              <th>Budget</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>IT Development</td>
              <td>24</td>
              <td>3</td>
              <td>€450,000</td>
            </tr>
            <tr>
              <td>IT Operations</td>
              <td>12</td>
              <td>2</td>
              <td>€280,000</td>
            </tr>
            <tr>
              <td>Design</td>
              <td>8</td>
              <td>1</td>
              <td>€180,000</td>
            </tr>
            <tr>
              <td>Management</td>
              <td>6</td>
              <td>1</td>
              <td>€320,000</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Floating Action Button -->
      <button class="btn-float" aria-label="Add department">
        <i class="fas fa-plus"></i>
      </button>
    </div>
  `;
  return wrapper;
};

export const AllVariantsCombined = () => {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.minHeight = '500px';
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">All Variants Combined</h3>
      <p style="color: var(--color-text-secondary); margin-bottom: 16px;">
        Striped + Hover + Compact + Bordered
      </p>
      <div class="overflow-x-auto">
        <table class="data-table data-table--striped data-table--hover data-table--sm data-table--bordered ">
          <thead>
            <tr>
              <th>KVP-ID</th>
              <th>Titel</th>
              <th>Ersteller</th>
              <th>Status</th>
              <th>Kategorie</th>
              <th>Erstellt</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>KVP-042</td>
              <td>Optimierung der Lagerverwaltung</td>
              <td>Max Mustermann</td>
              <td><span class="badge badge--kvp-pending" style="font-size: 11px;">Ausstehend</span></td>
              <td>Prozess</td>
              <td>02.10.2025</td>
            </tr>
            <tr>
              <td>KVP-043</td>
              <td>Verbesserung der Arbeitssicherheit</td>
              <td>Anna Schmidt</td>
              <td><span class="badge badge--kvp-in-progress" style="font-size: 11px;">In Bearbeitung</span></td>
              <td>Sicherheit</td>
              <td>03.10.2025</td>
            </tr>
            <tr>
              <td>KVP-044</td>
              <td>Automatisierung der Bestellungen</td>
              <td>Thomas Müller</td>
              <td><span class="badge badge--kvp-approved" style="font-size: 11px;">Genehmigt</span></td>
              <td>Digitalisierung</td>
              <td>04.10.2025</td>
            </tr>
            <tr>
              <td>KVP-045</td>
              <td>Schulung neuer Mitarbeiter</td>
              <td>Lisa Weber</td>
              <td><span class="badge badge--kvp-in-progress" style="font-size: 11px;">In Bearbeitung</span></td>
              <td>Personal</td>
              <td>04.10.2025</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Floating Action Button -->
      <button class="btn-float" aria-label="Add KVP suggestion">
        <i class="fas fa-plus"></i>
      </button>
    </div>
  `;
  return wrapper;
};

/* ========== EMPTY STATES ========== */

export const EmptyStateBasic = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Basic Empty State</h3>
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;">
        <div class="empty-state">
          <div class="empty-state__icon">👥</div>
          <div class="empty-state__title">Keine Mitarbeiter gefunden</div>
          <div class="empty-state__description">
            Fügen Sie Ihren ersten Mitarbeiter hinzu, um loszulegen
          </div>
          <button class="btn btn-primary empty-state__action">
            <i class="fas fa-plus"></i>
            Mitarbeiter hinzufügen
          </button>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

export const EmptyStateWithIcon = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Empty State with FontAwesome Icon</h3>
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;">
        <div class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-search"></i>
          </div>
          <div class="empty-state__title">Keine Suchergebnisse</div>
          <div class="empty-state__description">
            Versuchen Sie, Ihre Filter anzupassen oder andere Suchbegriffe zu verwenden
          </div>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

export const EmptyStateVariants = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;">
      <div>
        <h4 style="color: #fff; margin-bottom: 12px;">Small</h4>
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;">
          <div class="empty-state empty-state--sm">
            <div class="empty-state__icon">
              <i class="fas fa-inbox"></i>
            </div>
            <div class="empty-state__title">Keine Daten</div>
            <div class="empty-state__description">Noch nichts hier</div>
          </div>
        </div>
      </div>

      <div>
        <h4 style="color: #fff; margin-bottom: 12px;">Default</h4>
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;">
          <div class="empty-state">
            <div class="empty-state__icon">
              <i class="fas fa-folder-open"></i>
            </div>
            <div class="empty-state__title">Keine Dokumente</div>
            <div class="empty-state__description">Laden Sie Ihr erstes Dokument hoch</div>
          </div>
        </div>
      </div>

      <div>
        <h4 style="color: #fff; margin-bottom: 12px;">Large</h4>
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;">
          <div class="empty-state empty-state--lg">
            <div class="empty-state__icon">
              <i class="fas fa-chart-line"></i>
            </div>
            <div class="empty-state__title">Keine Daten verfügbar</div>
            <div class="empty-state__description">Warten auf erste Einträge</div>
          </div>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

/* ========== DATA LISTS ========== */

export const DataListBasic = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; max-width: 600px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Basic Data List</h3>
      <dl class="data-list">
        <div class="data-list__item">
          <dt class="data-list__label">Vorname</dt>
          <dd class="data-list__value">Max</dd>
        </div>
        <div class="data-list__item">
          <dt class="data-list__label">Nachname</dt>
          <dd class="data-list__value">Mustermann</dd>
        </div>
        <div class="data-list__item">
          <dt class="data-list__label">Email</dt>
          <dd class="data-list__value">max.mustermann@assixx.de</dd>
        </div>
        <div class="data-list__item">
          <dt class="data-list__label">Telefon</dt>
          <dd class="data-list__value">+49 123 456789</dd>
        </div>
        <div class="data-list__item">
          <dt class="data-list__label">Position</dt>
          <dd class="data-list__value">Senior Entwickler</dd>
        </div>
        <div class="data-list__item">
          <dt class="data-list__label">Rolle</dt>
          <dd class="data-list__value">
            <span class="badge badge--role-admin">Administrator</span>
          </dd>
        </div>
        <div class="data-list__item">
          <dt class="data-list__label">Notiz</dt>
          <dd class="data-list__value data-list__value--empty"></dd>
        </div>
      </dl>
    </div>
  `;
  return wrapper;
};

export const DataListGrid = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Grid Layout (2 Columns)</h3>
      <dl class="data-list data-list--grid">
        <div class="data-list__item">
          <dt class="data-list__label">Vorname</dt>
          <dd class="data-list__value">Max</dd>
        </div>
        <div class="data-list__item">
          <dt class="data-list__label">Nachname</dt>
          <dd class="data-list__value">Mustermann</dd>
        </div>
        <div class="data-list__item">
          <dt class="data-list__label">Email</dt>
          <dd class="data-list__value">max@assixx.de</dd>
        </div>
        <div class="data-list__item">
          <dt class="data-list__label">Telefon</dt>
          <dd class="data-list__value">+49 123 456789</dd>
        </div>
        <div class="data-list__item">
          <dt class="data-list__label">Position</dt>
          <dd class="data-list__value">Senior Entwickler</dd>
        </div>
        <div class="data-list__item">
          <dt class="data-list__label">Abteilung</dt>
          <dd class="data-list__value">IT Development</dd>
        </div>
        <div class="data-list__item">
          <dt class="data-list__label">Team</dt>
          <dd class="data-list__value">Frontend Team</dd>
        </div>
        <div class="data-list__item">
          <dt class="data-list__label">Status</dt>
          <dd class="data-list__value">
            <span class="badge badge--success">Aktiv</span>
          </dd>
        </div>
      </dl>
    </div>
  `;
  return wrapper;
};

export const DataListVariants = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px;">
      <div>
        <h4 style="color: #fff; margin-bottom: 12px;">Stacked Layout</h4>
        <dl class="data-list data-list--stacked">
          <div class="data-list__item">
            <dt class="data-list__label">Email</dt>
            <dd class="data-list__value">max@assixx.de</dd>
          </div>
          <div class="data-list__item">
            <dt class="data-list__label">Telefon</dt>
            <dd class="data-list__value">+49 123 456789</dd>
          </div>
          <div class="data-list__item">
            <dt class="data-list__label">Rolle</dt>
            <dd class="data-list__value">
              <span class="badge badge--role-admin">Admin</span>
            </dd>
          </div>
        </dl>
      </div>

      <div>
        <h4 style="color: #fff; margin-bottom: 12px;">Compact + Borderless</h4>
        <dl class="data-list data-list--compact data-list--borderless">
          <div class="data-list__item">
            <dt class="data-list__label">Email</dt>
            <dd class="data-list__value">max@assixx.de</dd>
          </div>
          <div class="data-list__item">
            <dt class="data-list__label">Telefon</dt>
            <dd class="data-list__value">+49 123 456789</dd>
          </div>
          <div class="data-list__item">
            <dt class="data-list__label">Rolle</dt>
            <dd class="data-list__value">
              <span class="badge badge--role-admin">Admin</span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  `;
  return wrapper;
};

/* ========== COMBINED EXAMPLE ========== */

export const CompleteExample = () => {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.minHeight = '600px';
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 24px;">Complete Example: Employee Management</h3>

      <!-- Table with data -->
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h4 style="color: #fff; margin: 0;">Mitarbeiterliste</h4>
          <button class="btn btn-cancel" style="padding: 8px 16px;">
            <i class="fas fa-filter"></i>
            Filter
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="data-table data-table--striped data-table--hover ">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Rolle</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Max Mustermann</td>
                <td>max@assixx.de</td>
                <td><span class="badge badge--role-admin">Admin</span></td>
                <td><span class="badge badge--success">Aktiv</span></td>
                <td>
                  <button class="btn btn-cancel" style="padding: 4px 12px; font-size: 13px;">Details</button>
                </td>
              </tr>
              <tr>
                <td>Anna Schmidt</td>
                <td>anna@assixx.de</td>
                <td><span class="badge badge--role-employee">Employee</span></td>
                <td><span class="badge badge--success">Aktiv</span></td>
                <td>
                  <button class="btn btn-cancel" style="padding: 4px 12px; font-size: 13px;">Details</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Employee Details (Data List) -->
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h4 style="color: #fff; margin-bottom: 16px;">Mitarbeiterdetails</h4>
        <dl class="data-list data-list--grid">
          <div class="data-list__item">
            <dt class="data-list__label">Vorname</dt>
            <dd class="data-list__value">Max</dd>
          </div>
          <div class="data-list__item">
            <dt class="data-list__label">Nachname</dt>
            <dd class="data-list__value">Mustermann</dd>
          </div>
          <div class="data-list__item">
            <dt class="data-list__label">Email</dt>
            <dd class="data-list__value">max.mustermann@assixx.de</dd>
          </div>
          <div class="data-list__item">
            <dt class="data-list__label">Telefon</dt>
            <dd class="data-list__value">+49 123 456789</dd>
          </div>
          <div class="data-list__item">
            <dt class="data-list__label">Position</dt>
            <dd class="data-list__value">Senior Entwickler</dd>
          </div>
          <div class="data-list__item">
            <dt class="data-list__label">Team</dt>
            <dd class="data-list__value">Frontend Team</dd>
          </div>
          <div class="data-list__item">
            <dt class="data-list__label">Rolle</dt>
            <dd class="data-list__value">
              <span class="badge badge--role-admin">Administrator</span>
            </dd>
          </div>
          <div class="data-list__item">
            <dt class="data-list__label">Status</dt>
            <dd class="data-list__value">
              <span class="badge badge--success">Aktiv</span>
            </dd>
          </div>
        </dl>
      </div>

      <!-- Empty State (No Data) -->
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;">
        <div class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-search"></i>
          </div>
          <div class="empty-state__title">Keine Ergebnisse gefunden</div>
          <div class="empty-state__description">
            Versuchen Sie, Ihre Suchkriterien anzupassen
          </div>
          <button class="btn btn-cancel empty-state__action">
            Filter zurücksetzen
          </button>
        </div>
      </div>

      <!-- Floating Action Button -->
      <button class="btn-float" aria-label="Add employee">
        <i class="fas fa-user-plus"></i>
      </button>
    </div>
  `;
  return wrapper;
};

/* ========== TABLE WITH FAB ========== */

export const TableWithFloatingButton = () => {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.minHeight = '500px';
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Data Table with Floating Add Button</h3>
      <p style="color: var(--color-text-secondary); margin-bottom: 24px; font-size: 14px;">
        Standard pattern: Table for data display + FAB in bottom-right for "Add new" action
      </p>

      <div class="overflow-x-auto">
        <table class="data-table data-table--striped data-table--hover ">
          <thead>
            <tr>
              <th>Name</th>
              <th>Department</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Max Mustermann</td>
              <td>IT Development</td>
              <td><span class="badge badge--role-admin">Admin</span></td>
              <td><span class="badge badge--success">Aktiv</span></td>
            </tr>
            <tr>
              <td>Anna Schmidt</td>
              <td>HR</td>
              <td><span class="badge badge--role-employee">Employee</span></td>
              <td><span class="badge badge--success">Aktiv</span></td>
            </tr>
            <tr>
              <td>Thomas Müller</td>
              <td>Design</td>
              <td><span class="badge badge--role-employee">Employee</span></td>
              <td><span class="badge badge--warning">Urlaub</span></td>
            </tr>
            <tr>
              <td>Lisa Weber</td>
              <td>IT Operations</td>
              <td><span class="badge badge--role-admin">Admin</span></td>
              <td><span class="badge badge--success">Aktiv</span></td>
            </tr>
            <tr>
              <td>Peter Klein</td>
              <td>Management</td>
              <td><span class="badge badge--role-root">Root</span></td>
              <td><span class="badge badge--success">Aktiv</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Floating Action Button (bottom-right) -->
      <button class="btn-float" aria-label="Add employee">
        <i class="fas fa-user-plus"></i>
      </button>
    </div>
  `;
  return wrapper;
};
