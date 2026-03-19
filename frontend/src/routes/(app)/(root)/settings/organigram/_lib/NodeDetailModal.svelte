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

  // TODO(human): Implement buildSubtitle — summarize key counts for the modal header
  function buildSubtitle(_d: OrgNodeDetail): string {
    return '';
  }

  const fields = $derived.by((): FieldConfig[] => {
    if (detail === null) return [];
    const result: FieldConfig[] = [];
    if (detail.lead !== undefined) {
      result.push({
        label: 'Leiter',
        icon: 'fas fa-user-tie',
        value: detail.lead.name,
      });
    }
    if (detail.deputyLead !== undefined) {
      result.push({
        label: 'Stellvertreter',
        icon: 'fas fa-user-shield',
        value: detail.deputyLead.name,
      });
    }
    if (detail.areaType !== undefined) {
      result.push({ label: 'Typ', icon: 'fas fa-tag', value: detail.areaType });
    }
    if (detail.assetStatus !== undefined) {
      result.push({
        label: 'Status',
        icon: 'fas fa-info-circle',
        value: detail.assetStatus,
      });
    }
    if (detail.assetType !== undefined) {
      result.push({
        label: 'Anlagentyp',
        icon: 'fas fa-cogs',
        value: detail.assetType,
      });
    }
    if (detail.parentArea !== undefined) {
      result.push({
        label: labels.area,
        icon: 'fas fa-building',
        value: detail.parentArea.name,
      });
    }
    if (detail.parentDepartment !== undefined) {
      result.push({
        label: labels.department,
        icon: 'fas fa-layer-group',
        value: detail.parentDepartment.name,
      });
    }
    return result;
  });

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
    return all.filter(
      (s): s is SectionConfig =>
        s.entries !== undefined && s.entries.length > 0,
    );
  });
</script>

{#if show}
  <div
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

      <div class="ds-modal__body detail-body">
        {#if isLoading}
          <div class="loading-state">
            <span class="spinner-ring"></span>
            <p>Lade Details…</p>
          </div>
        {:else if detail}
          <!-- Single-value fields (lead, parent, metadata) -->
          {#each fields as field (field.label)}
            <div class="detail-field">
              <span class="detail-field__label">
                <i class="{field.icon} detail-field__icon"></i>
                {field.label}
              </span>
              <span class="detail-field__value">{field.value}</span>
            </div>
          {/each}

          <!-- List sections (departments, teams, members, etc.) -->
          {#each sections as section (section.title)}
            <div class="detail-section">
              <h4 class="detail-section__title">
                <i class="{section.icon} detail-section__icon"></i>
                {section.title}
                <span class="detail-section__count"
                  >{section.entries.length}</span
                >
              </h4>
              <ul class="detail-section__list">
                {#each section.entries as entry (entry.uuid)}
                  <li class="detail-section__item">
                    <span class="detail-section__name">{entry.name}</span>
                    {#if entry.extra !== undefined}
                      <span class="detail-section__extra">{entry.extra}</span>
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
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .detail-body {
    gap: var(--spacing-2, 0.5rem);
  }

  .detail-field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--glass-border, rgb(255 255 255 / 8%));
  }

  .detail-field__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .detail-field__icon {
    width: 1rem;
    text-align: center;
    font-size: 0.75rem;
    opacity: 70%;
  }

  .detail-field__value {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .detail-section {
    margin-top: 0.5rem;
  }

  .detail-section__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin: 0 0 0.375rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .detail-section__icon {
    width: 1rem;
    text-align: center;
    font-size: 0.75rem;
    opacity: 70%;
  }

  .detail-section__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.25rem;
    border-radius: 999px;
    background: var(--glass-border, rgb(255 255 255 / 12%));
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    padding: 0 0.25rem;
  }

  .detail-section__list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .detail-section__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.375rem 0.5rem;
    border-radius: 6px;
    font-size: 0.8rem;
  }

  .detail-section__item:nth-child(odd) {
    background: var(--glass-border, rgb(255 255 255 / 4%));
  }

  .detail-section__name {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .detail-section__extra {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    opacity: 80%;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem 0;
    color: var(--color-text-secondary);
  }
</style>
