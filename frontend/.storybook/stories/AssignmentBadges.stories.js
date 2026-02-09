/**
 * Assignment Badges – Unified Badge System for Table Assignments
 *
 * ASSIXX DESIGN STANDARD: All table assignment columns (Areas, Departments, Teams, Machines)
 * must use these consistent badge patterns for visual uniformity.
 *
 * Badge Types:
 * 1. FULL ACCESS (badge--primary + globe icon) - User has access to ALL items
 * 2. COUNT (badge--info) - Shows count with tooltip listing names
 * 3. INHERITED (badge--info + sitemap icon) - Access via parent hierarchy
 * 4. NONE (badge--secondary) - No assignments
 *
 * IMPORTANT: All badges MUST have native `title` attribute for tooltips!
 */

export default {
  title: 'Design System/Assignment Badges',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
## Unified Badge System for Table Assignments

This is the **official badge standard** for all assignment columns in manage tables.
All tables displaying Areas, Departments, Teams, or Machines MUST follow this pattern.

### Badge Categories

| Type | Class | Icon | Use Case |
|------|-------|------|----------|
| Full Access | \`badge--primary\` | fa-globe | User has access to ALL items |
| Count | \`badge--info\` | none | Shows count, tooltip lists names |
| Inherited | \`badge--info\` | fa-sitemap | Access via parent (Team→Dept→Area) |
| None | \`badge--secondary\` | none | No assignments |

### Required Attributes

- **title**: Native tooltip (MANDATORY for all badges)
- **class**: BEM notation \`badge badge--{variant}\`

### Inheritance Chain

\`\`\`
Employee → Team → Department → Area
                ↓
        Admin has direct access
\`\`\`
        `,
      },
    },
  },
};

/**
 * Helper: Create assignment badge HTML
 */
function createAssignmentBadge(type, options = {}) {
  const { count = 0, names = '', label = '', tooltip = '' } = options;

  switch (type) {
    case 'full-access':
      return `<span class="badge badge--primary" title="${tooltip || 'Voller Zugriff auf alle ' + label}"><i class="fas fa-globe mr-1"></i>Alle</span>`;

    case 'count':
      if (count === 0) {
        return `<span class="badge badge--secondary" title="${tooltip || 'Keine ' + label + ' zugewiesen'}">Keine</span>`;
      }
      const countLabel = count === 1 ? label.replace(/e$/, '') : label;
      return `<span class="badge badge--info" title="${names}">${count} ${countLabel}</span>`;

    case 'inherited':
      return `<span class="badge badge--info" title="${tooltip}"><i class="fas fa-sitemap mr-1"></i>Vererbt</span>`;

    case 'none':
      return `<span class="badge badge--secondary" title="${tooltip || 'Keine ' + label + ' zugewiesen'}">Keine</span>`;

    default:
      return `<span class="badge badge--secondary">-</span>`;
  }
}

/**
 * All Assignment Badge Types
 *
 * Overview of the four badge types used in assignment columns.
 */
export const AllBadgeTypes = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '32px';
    container.style.padding = '24px';

    const types = [
      {
        title: 'Full Access (Vollzugriff)',
        description: 'User has access to ALL items in this category',
        badge: createAssignmentBadge('full-access', {
          label: 'Bereiche',
          tooltip: 'Voller Zugriff auf alle Bereiche',
        }),
        usage: 'hasFullAccess === true',
        class: 'badge--primary',
      },
      {
        title: 'Count Badge (Anzahl)',
        description: 'Shows count of assigned items, tooltip lists all names',
        badge: createAssignmentBadge('count', {
          count: 3,
          names: 'Produktion, Lager, Verwaltung',
          label: 'Bereiche',
        }),
        usage: 'items.length > 0',
        class: 'badge--info',
      },
      {
        title: 'Inherited Badge (Vererbt)',
        description: 'Access inherited from parent (Team → Department → Area)',
        badge: createAssignmentBadge('inherited', {
          tooltip: 'Vererbt von: Team Alpha, Team Beta',
        }),
        usage: 'hasTeams && !hasDirectAssignments',
        class: 'badge--info + fa-sitemap',
      },
      {
        title: 'None Badge (Keine)',
        description: 'No items assigned to this user/entity',
        badge: createAssignmentBadge('none', { label: 'Bereiche' }),
        usage: 'items.length === 0 && !hasInheritance',
        class: 'badge--secondary',
      },
    ];

    types.forEach(({ title, description, badge, usage, class: badgeClass }) => {
      const section = document.createElement('div');
      section.style.display = 'grid';
      section.style.gridTemplateColumns = '200px 1fr';
      section.style.gap = '24px';
      section.style.alignItems = 'start';
      section.style.padding = '20px';
      section.style.background = 'rgba(255,255,255,0.02)';
      section.style.border = '1px solid rgba(255,255,255,0.1)';
      section.style.borderRadius = '8px';

      section.innerHTML = `
        <div>
          <div style="margin-bottom: 12px;">${badge}</div>
          <code style="font-size: 11px; color: var(--color-text-secondary); background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">${badgeClass}</code>
        </div>
        <div>
          <h4 style="color: #fff; margin: 0 0 8px 0; font-size: 16px;">${title}</h4>
          <p style="color: var(--color-text-secondary); margin: 0 0 12px 0; font-size: 14px;">${description}</p>
          <div style="font-size: 12px; color: var(--color-text-secondary);">
            <strong>When to use:</strong> <code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">${usage}</code>
          </div>
        </div>
      `;

      container.appendChild(section);
    });

    return container;
  },
};

/**
 * Areas Column Examples
 *
 * All possible badge states for the "Bereiche" (Areas) column.
 */
export const AreasColumnExamples = {
  render: () => {
    const container = document.createElement('div');
    container.style.padding = '24px';

    container.innerHTML = `
      <h3 style="color: #fff; margin-bottom: 24px;">Bereiche (Areas) Column</h3>
      <table class="data-table data-table--striped" style="width: 100%;">
        <thead>
          <tr>
            <th style="width: 200px;">Scenario</th>
            <th style="width: 150px;">Badge</th>
            <th>Tooltip (hover)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="color: var(--color-text-secondary);">Full Access</td>
            <td>${createAssignmentBadge('full-access', { label: 'Bereiche', tooltip: 'Voller Zugriff auf alle Bereiche' })}</td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"Voller Zugriff auf alle Bereiche"</td>
          </tr>
          <tr>
            <td style="color: var(--color-text-secondary);">1 Area assigned</td>
            <td>${createAssignmentBadge('count', { count: 1, names: 'Produktion', label: 'Bereich' })}</td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"Produktion"</td>
          </tr>
          <tr>
            <td style="color: var(--color-text-secondary);">3 Areas assigned</td>
            <td>${createAssignmentBadge('count', { count: 3, names: 'Produktion, Lager, Verwaltung', label: 'Bereiche' })}</td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"Produktion, Lager, Verwaltung"</td>
          </tr>
          <tr>
            <td style="color: var(--color-text-secondary);">Inherited via Team</td>
            <td>${createAssignmentBadge('inherited', { tooltip: 'Vererbt von: Team Alpha' })}</td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"Vererbt von: Team Alpha"</td>
          </tr>
          <tr>
            <td style="color: var(--color-text-secondary);">No Areas</td>
            <td>${createAssignmentBadge('none', { label: 'Bereiche', tooltip: 'Kein Bereich zugewiesen' })}</td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"Kein Bereich zugewiesen"</td>
          </tr>
        </tbody>
      </table>
    `;

    return container;
  },
};

/**
 * Departments Column Examples
 *
 * All possible badge states for the "Abteilungen" (Departments) column.
 */
export const DepartmentsColumnExamples = {
  render: () => {
    const container = document.createElement('div');
    container.style.padding = '24px';

    container.innerHTML = `
      <h3 style="color: #fff; margin-bottom: 24px;">Abteilungen (Departments) Column</h3>
      <table class="data-table data-table--striped" style="width: 100%;">
        <thead>
          <tr>
            <th style="width: 200px;">Scenario</th>
            <th style="width: 180px;">Badge</th>
            <th>Tooltip (hover)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="color: var(--color-text-secondary);">Full Access</td>
            <td>${createAssignmentBadge('full-access', { label: 'Abteilungen', tooltip: 'Voller Zugriff auf alle Abteilungen' })}</td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"Voller Zugriff auf alle Abteilungen"</td>
          </tr>
          <tr>
            <td style="color: var(--color-text-secondary);">1 Department</td>
            <td>${createAssignmentBadge('count', { count: 1, names: 'IT', label: 'Abteilung' })}</td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"IT"</td>
          </tr>
          <tr>
            <td style="color: var(--color-text-secondary);">2 Departments</td>
            <td>${createAssignmentBadge('count', { count: 2, names: 'IT, HR', label: 'Abteilungen' })}</td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"IT, HR"</td>
          </tr>
          <tr>
            <td style="color: var(--color-text-secondary);">Direct + Inherited</td>
            <td><span class="badge badge--info" title="Direkt: IT + Vererbt von 2 Bereichen">1 Abt. + Vererbt</span></td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"Direkt: IT + Vererbt von 2 Bereichen"</td>
          </tr>
          <tr>
            <td style="color: var(--color-text-secondary);">Inherited via Team</td>
            <td>${createAssignmentBadge('inherited', { tooltip: 'Vererbt von: Team Alpha' })}</td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"Vererbt von: Team Alpha"</td>
          </tr>
          <tr>
            <td style="color: var(--color-text-secondary);">No Departments</td>
            <td>${createAssignmentBadge('none', { label: 'Abteilungen', tooltip: 'Keine Abteilung zugewiesen' })}</td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"Keine Abteilung zugewiesen"</td>
          </tr>
        </tbody>
      </table>
    `;

    return container;
  },
};

/**
 * Teams Column Examples
 *
 * All possible badge states for the "Teams" column.
 */
export const TeamsColumnExamples = {
  render: () => {
    const container = document.createElement('div');
    container.style.padding = '24px';

    container.innerHTML = `
      <h3 style="color: #fff; margin-bottom: 24px;">Teams Column</h3>
      <table class="data-table data-table--striped" style="width: 100%;">
        <thead>
          <tr>
            <th style="width: 200px;">Scenario</th>
            <th style="width: 150px;">Badge</th>
            <th>Tooltip (hover)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="color: var(--color-text-secondary);">Full Access</td>
            <td>${createAssignmentBadge('full-access', { label: 'Teams', tooltip: 'Voller Zugriff auf alle Teams' })}</td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"Voller Zugriff auf alle Teams"</td>
          </tr>
          <tr>
            <td style="color: var(--color-text-secondary);">1 Team</td>
            <td>${createAssignmentBadge('count', { count: 1, names: 'Team Alpha', label: 'Team' })}</td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"Team Alpha"</td>
          </tr>
          <tr>
            <td style="color: var(--color-text-secondary);">3 Teams</td>
            <td>${createAssignmentBadge('count', { count: 3, names: 'Team Alpha, Team Beta, Team Gamma', label: 'Teams' })}</td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"Team Alpha, Team Beta, Team Gamma"</td>
          </tr>
          <tr>
            <td style="color: var(--color-text-secondary);">Inherited (Admin)</td>
            <td>${createAssignmentBadge('inherited', { tooltip: 'Teams werden von Bereichen/Abteilungen vererbt' })}</td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"Teams werden von Bereichen/Abteilungen vererbt"</td>
          </tr>
          <tr>
            <td style="color: var(--color-text-secondary);">No Teams</td>
            <td>${createAssignmentBadge('none', { label: 'Teams', tooltip: 'Kein Team zugewiesen' })}</td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"Kein Team zugewiesen"</td>
          </tr>
        </tbody>
      </table>
    `;

    return container;
  },
};

/**
 * Machines Column Examples (for Teams table)
 *
 * Badge states for the "Maschinen" (Machines) column.
 */
export const MachinesColumnExamples = {
  render: () => {
    const container = document.createElement('div');
    container.style.padding = '24px';

    container.innerHTML = `
      <h3 style="color: #fff; margin-bottom: 24px;">Maschinen (Machines) Column</h3>
      <table class="data-table data-table--striped" style="width: 100%;">
        <thead>
          <tr>
            <th style="width: 200px;">Scenario</th>
            <th style="width: 150px;">Badge</th>
            <th>Tooltip (hover)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="color: var(--color-text-secondary);">0 Machines</td>
            <td><span class="badge badge--secondary" title="Keine zugewiesen">0</span></td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"Keine zugewiesen"</td>
          </tr>
          <tr>
            <td style="color: var(--color-text-secondary);">1 Machine</td>
            <td><span class="badge badge--info" title="CNC-Fräse A1">1 Maschine</span></td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"CNC-Fräse A1"</td>
          </tr>
          <tr>
            <td style="color: var(--color-text-secondary);">5 Machines</td>
            <td><span class="badge badge--info" title="CNC-Fräse A1, Drehbank B2, Schweißroboter C3, Laser D4, Presse E5">5 Maschinen</span></td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"CNC-Fräse A1, Drehbank B2, ..."</td>
          </tr>
        </tbody>
      </table>
    `;

    return container;
  },
};

/**
 * Members Column Examples (for Teams/Departments table)
 *
 * Badge states for the "Mitglieder" (Members) column.
 */
export const MembersColumnExamples = {
  render: () => {
    const container = document.createElement('div');
    container.style.padding = '24px';

    container.innerHTML = `
      <h3 style="color: #fff; margin-bottom: 24px;">Mitglieder (Members) Column</h3>
      <table class="data-table data-table--striped" style="width: 100%;">
        <thead>
          <tr>
            <th style="width: 200px;">Scenario</th>
            <th style="width: 150px;">Badge</th>
            <th>Tooltip (hover)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="color: var(--color-text-secondary);">0 Members</td>
            <td><span class="badge badge--secondary" title="Keine zugewiesen">0</span></td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"Keine zugewiesen"</td>
          </tr>
          <tr>
            <td style="color: var(--color-text-secondary);">1 Member</td>
            <td><span class="badge badge--info" title="Max Mustermann">1 Mitglied</span></td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"Max Mustermann"</td>
          </tr>
          <tr>
            <td style="color: var(--color-text-secondary);">12 Members</td>
            <td><span class="badge badge--info" title="Max Mustermann, Anna Schmidt, Tom Weber, Lisa Müller, Peter Klein, Sarah Koch, Michael Braun, Julia Hoffmann, David Schulz, Maria Becker, Thomas Fischer, Laura Meyer">12 Mitglieder</span></td>
            <td style="color: var(--color-text-secondary); font-size: 13px;">"Max Mustermann, Anna Schmidt, ..."</td>
          </tr>
        </tbody>
      </table>
    `;

    return container;
  },
};

/**
 * Complete Table Example
 *
 * Shows a realistic manage-employees table with all badge types.
 */
export const CompleteTableExample = {
  render: () => {
    const container = document.createElement('div');
    container.style.padding = '24px';

    container.innerHTML = `
      <h3 style="color: #fff; margin-bottom: 8px;">Manage Employees - Complete Example</h3>
      <p style="color: var(--color-text-secondary); margin-bottom: 24px; font-size: 14px;">
        This demonstrates the unified badge system in a real table context.
        <strong>Hover over badges to see tooltips.</strong>
      </p>

      <div class="overflow-x-auto">
        <table class="data-table data-table--striped data-table--hover" style="width: 100%;">
          <thead>
            <tr>
              <th>Name</th>
              <th>Bereiche</th>
              <th>Abteilungen</th>
              <th>Teams</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="color: #fff;">Max Mustermann (Root)</td>
              <td>${createAssignmentBadge('full-access', { label: 'Bereiche', tooltip: 'Voller Zugriff auf alle Bereiche' })}</td>
              <td>${createAssignmentBadge('full-access', { label: 'Abteilungen', tooltip: 'Voller Zugriff auf alle Abteilungen' })}</td>
              <td>${createAssignmentBadge('full-access', { label: 'Teams', tooltip: 'Voller Zugriff auf alle Teams' })}</td>
              <td><span class="badge badge--success">Aktiv</span></td>
            </tr>
            <tr>
              <td style="color: #fff;">Anna Schmidt (Admin)</td>
              <td>${createAssignmentBadge('count', { count: 2, names: 'Produktion, Lager', label: 'Bereiche' })}</td>
              <td><span class="badge badge--info" title="Direkt: IT + Vererbt von 2 Bereichen">1 Abt. + Vererbt</span></td>
              <td>${createAssignmentBadge('inherited', { tooltip: 'Teams werden von Bereichen/Abteilungen vererbt' })}</td>
              <td><span class="badge badge--success">Aktiv</span></td>
            </tr>
            <tr>
              <td style="color: #fff;">Tom Weber (Employee)</td>
              <td>${createAssignmentBadge('inherited', { tooltip: 'Vererbt von: Team Alpha' })}</td>
              <td>${createAssignmentBadge('inherited', { tooltip: 'Vererbt von: Team Alpha' })}</td>
              <td>${createAssignmentBadge('count', { count: 1, names: 'Team Alpha', label: 'Team' })}</td>
              <td><span class="badge badge--success">Aktiv</span></td>
            </tr>
            <tr>
              <td style="color: #fff;">Lisa Müller (Employee)</td>
              <td>${createAssignmentBadge('inherited', { tooltip: 'Vererbt von: Team Beta, Team Gamma' })}</td>
              <td>${createAssignmentBadge('inherited', { tooltip: 'Vererbt von: Team Beta, Team Gamma' })}</td>
              <td>${createAssignmentBadge('count', { count: 2, names: 'Team Beta, Team Gamma', label: 'Teams' })}</td>
              <td><span class="badge badge--warning">Urlaub</span></td>
            </tr>
            <tr>
              <td style="color: #fff;">Peter Klein (New)</td>
              <td>${createAssignmentBadge('none', { label: 'Bereiche', tooltip: 'Kein Bereich zugewiesen' })}</td>
              <td>${createAssignmentBadge('none', { label: 'Abteilungen', tooltip: 'Keine Abteilung zugewiesen' })}</td>
              <td>${createAssignmentBadge('none', { label: 'Teams', tooltip: 'Kein Team zugewiesen' })}</td>
              <td><span class="badge badge--warning">Inaktiv</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    return container;
  },
};

/**
 * Implementation Code
 *
 * Copy-paste ready TypeScript code for badge functions.
 */
export const ImplementationCode = {
  render: () => {
    const container = document.createElement('div');
    container.style.padding = '24px';

    container.innerHTML = `
      <h3 style="color: #fff; margin-bottom: 16px;">Implementation Reference</h3>
      <p style="color: var(--color-text-secondary); margin-bottom: 24px; font-size: 14px;">
        Standard badge helper function for use in all manage-* UI files.
      </p>

      <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 20px; overflow-x: auto;">
        <pre style="color: #e0e0e0; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 13px; line-height: 1.6; margin: 0; white-space: pre-wrap;">
<span style="color: #7c8492;">/**
 * Create assignment badge for table columns
 * @param type - 'full-access' | 'count' | 'inherited' | 'none'
 * @param options - Badge configuration
 */</span>
<span style="color: #c792ea;">function</span> <span style="color: #82aaff;">createAssignmentBadge</span>(
  <span style="color: #ffcb6b;">type</span>: <span style="color: #c3e88d;">'full-access' | 'count' | 'inherited' | 'none'</span>,
  <span style="color: #ffcb6b;">options</span>: {
    <span style="color: #ffcb6b;">count</span>?: <span style="color: #ffcb6b;">number</span>;
    <span style="color: #ffcb6b;">names</span>?: <span style="color: #ffcb6b;">string</span>;
    <span style="color: #ffcb6b;">label</span>: <span style="color: #ffcb6b;">string</span>;      <span style="color: #7c8492;">// 'Bereiche', 'Abteilungen', 'Teams'</span>
    <span style="color: #ffcb6b;">labelSingular</span>?: <span style="color: #ffcb6b;">string</span>; <span style="color: #7c8492;">// 'Bereich', 'Abteilung', 'Team'</span>
    <span style="color: #ffcb6b;">tooltip</span>?: <span style="color: #ffcb6b;">string</span>;
  }
): <span style="color: #ffcb6b;">string</span> {
  <span style="color: #c792ea;">const</span> { count = <span style="color: #f78c6c;">0</span>, names = <span style="color: #c3e88d;">''</span>, label, labelSingular, tooltip } = options;

  <span style="color: #c792ea;">switch</span> (type) {
    <span style="color: #c792ea;">case</span> <span style="color: #c3e88d;">'full-access'</span>:
      <span style="color: #c792ea;">return</span> <span style="color: #c3e88d;">\`&lt;span class="badge badge--primary" title="\${tooltip ?? \`Voller Zugriff auf alle \${label}\`}"&gt;
        &lt;i class="fas fa-globe mr-1"&gt;&lt;/i&gt;Alle&lt;/span&gt;\`</span>;

    <span style="color: #c792ea;">case</span> <span style="color: #c3e88d;">'count'</span>:
      <span style="color: #c792ea;">const</span> displayLabel = count === <span style="color: #f78c6c;">1</span> ? (labelSingular ?? label) : label;
      <span style="color: #c792ea;">return</span> <span style="color: #c3e88d;">\`&lt;span class="badge badge--info" title="\${names}"&gt;
        \${count} \${displayLabel}&lt;/span&gt;\`</span>;

    <span style="color: #c792ea;">case</span> <span style="color: #c3e88d;">'inherited'</span>:
      <span style="color: #c792ea;">return</span> <span style="color: #c3e88d;">\`&lt;span class="badge badge--info" title="\${tooltip}"&gt;
        &lt;i class="fas fa-sitemap mr-1"&gt;&lt;/i&gt;Vererbt&lt;/span&gt;\`</span>;

    <span style="color: #c792ea;">case</span> <span style="color: #c3e88d;">'none'</span>:
      <span style="color: #c792ea;">return</span> <span style="color: #c3e88d;">\`&lt;span class="badge badge--secondary" title="\${tooltip ?? \`Keine \${label} zugewiesen\`}"&gt;
        Keine&lt;/span&gt;\`</span>;
  }
}</pre>
      </div>

      <div style="margin-top: 24px; padding: 16px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px;">
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <i class="fas fa-info-circle" style="color: #3b82f6; font-size: 20px; flex-shrink: 0; margin-top: 2px;"></i>
          <div>
            <h5 style="color: #3b82f6; margin-bottom: 8px; font-size: 14px; font-weight: 600;">Documentation</h5>
            <p style="color: var(--color-text-secondary); font-size: 14px; line-height: 1.5; margin: 0;">
              See <code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">docs/BADGE-ASSIGNMENT-SYSTEM.md</code>
              for the complete documentation including decision trees and edge cases.
            </p>
          </div>
        </div>
      </div>
    `;

    return container;
  },
};

/**
 * Decision Tree
 *
 * Visual guide for choosing the right badge type.
 */
export const DecisionTree = {
  render: () => {
    const container = document.createElement('div');
    container.style.padding = '24px';

    container.innerHTML = `
      <h3 style="color: #fff; margin-bottom: 24px;">Badge Selection Decision Tree</h3>

      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px;">
        <div style="font-family: monospace; font-size: 14px; line-height: 2; color: var(--color-text-secondary);">
          <div style="color: #fff; font-weight: bold; margin-bottom: 16px;">getAreasBadge(entity) / getDepartmentsBadge(entity) / getTeamsBadge(entity)</div>

          <div style="padding-left: 0;">
            <span style="color: #f78c6c;">if</span> (entity.hasFullAccess) <span style="color: #7c8492;">→</span> <span class="badge badge--primary" style="margin-left: 8px;"><i class="fas fa-globe mr-1"></i>Alle</span>
          </div>

          <div style="padding-left: 0; margin-top: 8px;">
            <span style="color: #f78c6c;">else if</span> (entity.items?.length > 0) <span style="color: #7c8492;">→</span> <span class="badge badge--info" style="margin-left: 8px;">N Items</span>
          </div>

          <div style="padding-left: 0; margin-top: 8px;">
            <span style="color: #f78c6c;">else if</span> (hasInheritance) <span style="color: #7c8492;">→</span> <span class="badge badge--info" style="margin-left: 8px;"><i class="fas fa-sitemap mr-1"></i>Vererbt</span>
          </div>

          <div style="padding-left: 0; margin-top: 8px;">
            <span style="color: #f78c6c;">else</span> <span style="color: #7c8492;">→</span> <span class="badge badge--secondary" style="margin-left: 8px;">Keine</span>
          </div>
        </div>
      </div>

      <div style="margin-top: 24px;">
        <h4 style="color: #fff; margin-bottom: 16px;">Inheritance Detection by Entity Type</h4>
        <table class="data-table" style="width: 100%;">
          <thead>
            <tr>
              <th>Entity</th>
              <th>Inherits From</th>
              <th>Detection Logic</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="color: #fff;">Employee</td>
              <td style="color: var(--color-text-secondary);">Team → Dept → Area</td>
              <td><code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; font-size: 12px;">entity.teams?.length > 0 || entity.teamId != null</code></td>
            </tr>
            <tr>
              <td style="color: #fff;">Admin</td>
              <td style="color: var(--color-text-secondary);">Area → Dept (for teams)</td>
              <td><code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; font-size: 12px;">entity.areas?.length > 0 || entity.departments?.length > 0</code></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    return container;
  },
};
