<!--
  NodeDetailModal — Zeigt alle Abhängigkeiten einer Org-Entität
  Wird durch Doppelklick auf einen OrgNode geöffnet.
-->
<script lang="ts">
  import { ENTITY_COLORS } from './constants.js';

  import type {
    HierarchyLabels,
    OrgEntityType,
    OrgNodeDetail,
    OrgNodeDetailEntry,
    OrgNodeDetailPerson,
  } from './types.js';

  interface Props {
    show: boolean;
    detail: OrgNodeDetail | null;
    isLoading: boolean;
    labels: HierarchyLabels;
    onclose: () => void;
  }

  const { show, detail, isLoading, labels, onclose }: Props = $props();

  interface FieldConfig {
    label: string;
    icon: string;
    value: string;
  }

  interface SectionConfig {
    title: string;
    icon: string;
    entries: OrgNodeDetailEntry[];
  }

  function getEntityLabel(entityType: OrgEntityType): string {
    return (
      {
        area: labels.area,
        department: labels.department,
        team: labels.team,
        asset: labels.asset,
      } satisfies Record<OrgEntityType, string>
    )[entityType];
  }

  // Learning exercise: implement buildSubtitle — summarize key counts for the modal header
  function buildSubtitle(_d: OrgNodeDetail): string {
    return '';
  }

  const AREA_TYPE_LABELS: Record<string, string> = {
    building: 'Gebäude',
    warehouse: 'Lager',
    office: 'Büro',
    production: 'Produktion',
    outdoor: 'Außenbereich',
    other: 'Sonstiges',
  };

  const ASSET_STATUS_LABELS: Record<string, string> = {
    operational: 'Betriebsbereit',
    maintenance: 'In Wartung',
    repair: 'In Reparatur',
    standby: 'Standby',
    decommissioned: 'Außer Betrieb',
  };

  const ASSET_TYPE_LABELS: Record<string, string> = {
    production: 'Produktion',
    packaging: 'Verpackung',
    quality_control: 'Qualitätskontrolle',
    logistics: 'Logistik',
    utility: 'Versorgung',
    other: 'Sonstiges',
  };

  /** Translate raw DB enum values that arrive via `extra` */
  function translateExtra(raw: string): string {
    if (raw === 'lead') return `${labels.teamLeadPrefix}leiter`;
    if (raw === 'member') return 'Mitglied';
    return ASSET_STATUS_LABELS[raw] ?? raw;
  }

  function resolveDeputyLead(d: OrgNodeDetail): OrgNodeDetailPerson | undefined {
    return d.areaDeputyLead ?? d.departmentDeputyLead ?? d.teamDeputyLead;
  }

  function buildField(
    value: string | undefined,
    label: string,
    icon: string,
    translate?: Record<string, string>,
  ): FieldConfig | undefined {
    if (value === undefined) return undefined;
    return { label, icon, value: translate !== undefined ? (translate[value] ?? value) : value };
  }

  function buildFields(d: OrgNodeDetail): FieldConfig[] {
    const deputy = resolveDeputyLead(d);
    const candidates: (FieldConfig | undefined)[] = [
      buildField(d.lead?.name, 'Leiter', 'fas fa-user-tie'),
      buildField(deputy?.name, 'Stellvertreter', 'fas fa-user-shield'),
      buildField(d.areaType, 'Typ', 'fas fa-tag', AREA_TYPE_LABELS),
      buildField(d.assetStatus, 'Status', 'fas fa-info-circle', ASSET_STATUS_LABELS),
      buildField(d.assetType, 'Anlagentyp', 'fas fa-cogs', ASSET_TYPE_LABELS),
      buildField(d.parentArea?.name, labels.area, 'fas fa-building'),
      buildField(d.parentDepartment?.name, labels.department, 'fas fa-layer-group'),
    ];
    return candidates.filter((c): c is FieldConfig => c !== undefined);
  }

  const fields = $derived(detail !== null ? buildFields(detail) : []);

  const sections = $derived.by((): SectionConfig[] => {
    if (detail === null) return [];
    const all: {
      title: string;
      icon: string;
      entries: OrgNodeDetailEntry[] | undefined;
    }[] = [
      { title: labels.hall, icon: 'fas fa-warehouse', entries: detail.halls },
      {
        title: labels.department,
        icon: 'fas fa-layer-group',
        entries: detail.departments,
      },
      { title: labels.team, icon: 'fas fa-users', entries: detail.teams },
      {
        title: 'Mitglieder',
        icon: 'fas fa-user-friends',
        entries: detail.members,
      },
      {
        title: 'Mitarbeiter',
        icon: 'fas fa-id-badge',
        entries: detail.employees,
      },
      { title: labels.asset, icon: 'fas fa-cog', entries: detail.assets },
      {
        title: `Zugewiesene ${labels.team}`,
        icon: 'fas fa-users',
        entries: detail.assignedTeams,
      },
    ];
    return all.filter((s): s is SectionConfig => s.entries !== undefined && s.entries.length > 0);
  });
</script>

{#if show}
  <div
    id="organigram-node-detail-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="node-detail-title"
    tabindex="-1"
  >
    <div
      class="ds-modal ds-modal--sm"
      role="document"
    >
      <div class="ds-modal__header">
        {#if detail}
          {@const subtitle = buildSubtitle(detail)}
          <div class="detail-header">
            <span
              class="entity-badge"
              style="background: {ENTITY_COLORS[detail.entityType].bg};
                     border-color: {ENTITY_COLORS[detail.entityType].border};
                     color: {ENTITY_COLORS[detail.entityType].text}"
            >
              <i class={ENTITY_COLORS[detail.entityType].icon}></i>
              {getEntityLabel(detail.entityType)}
            </span>
            <h3
              class="ds-modal__title"
              id="node-detail-title"
            >
              {detail.name}
            </h3>
            {#if subtitle !== ''}
              <p class="detail-subtitle">{subtitle}</p>
            {/if}
          </div>
        {:else}
          <h3
            class="ds-modal__title"
            id="node-detail-title"
          >
            Details
          </h3>
        {/if}
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={onclose}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        {#if isLoading}
          <div class="loading-state">
            <span class="spinner-ring"></span>
            <p>Lade Details…</p>
          </div>
        {:else if detail}
          <!-- Single-value fields (lead, parent, metadata) -->
          {#if fields.length > 0}
            <div class="detail-fields">
              {#each fields as field (field.label)}
                <div class="detail-field">
                  <i class="{field.icon} detail-field__icon"></i>
                  <span class="detail-field__label">{field.label}:</span>
                  <span class="detail-field__value">{field.value}</span>
                </div>
              {/each}
            </div>
          {/if}

          <!-- List sections (departments, teams, members, etc.) -->
          {#each sections as section (section.title)}
            <div class="detail-section">
              <h4 class="detail-section__title">
                <i class="{section.icon} detail-section__icon"></i>
                {section.title}
                <span class="detail-section__count">{section.entries.length}</span>
              </h4>
              <ul class="detail-section__list">
                {#each section.entries as entry (entry.uuid)}
                  <li class="detail-section__item">
                    <span class="detail-section__name">{entry.name}</span>
                    {#if entry.extra !== undefined}
                      <span class="detail-section__extra">{translateExtra(entry.extra)}</span>
                    {/if}
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        {/if}
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={onclose}
        >
          Schließen
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ─── Header ──────── */

  .detail-header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .entity-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.125rem 0.625rem;
    border-radius: 999px;
    border: 1.5px solid;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    width: fit-content;
  }

  .detail-subtitle {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
  }

  /* ─── Fields Grid (glass container) ──────── */

  .detail-fields {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0;
    padding: 16px 20px;
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
  }

  .detail-field {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--color-glass-border);
  }

  .detail-field:last-child {
    border-bottom: none;
  }

  .detail-field:hover {
    margin: 0 -10px;
    padding-right: 10px;
    padding-left: 10px;
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
  }

  .detail-field__icon {
    flex-shrink: 0;
    width: 20px;
    font-size: 0.85rem;
    color: var(--color-primary);
    text-align: center;
  }

  .detail-field__label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .detail-field__value {
    margin-left: auto;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  /* ─── List Sections ──────── */

  .detail-section {
    margin-top: 16px;
  }

  .detail-section__title {
    display: flex;
    gap: 10px;
    align-items: center;
    margin: 0 0 10px;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .detail-section__title::before {
    content: '';
    width: 4px;
    height: 18px;
    border-radius: 2px;
    background: var(--color-primary);
  }

  .detail-section__icon {
    width: 18px;
    font-size: 0.8rem;
    color: var(--color-primary);
    text-align: center;
  }

  .detail-section__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 0.25rem;
    border-radius: 999px;
    background: color-mix(in oklch, var(--color-primary) 15%, transparent);
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--color-primary);
  }

  .detail-section__list {
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .detail-section__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-lg);
    background: color-mix(in oklch, var(--color-white) 3%, transparent);
    font-size: 0.8rem;
  }

  .detail-section__item:hover {
    border-color: color-mix(in oklch, var(--color-white) 12%, transparent);
    background: color-mix(in oklch, var(--color-white) 5%, transparent);
  }

  .detail-section__name {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .detail-section__extra {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  /* ─── Loading ──────── */

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem 0;
    color: var(--color-text-secondary);
  }
</style>
