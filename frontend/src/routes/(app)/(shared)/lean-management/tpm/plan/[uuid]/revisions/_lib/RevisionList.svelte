<script lang="ts">
  /**
   * RevisionList — Expandable list of plan revisions with diff view.
   * Newest version at top, v1 at bottom. Click to expand diff.
   */
  import RevisionDiff from './RevisionDiff.svelte';

  import type { TpmPlanRevision } from './types';

  interface Props {
    revisions: TpmPlanRevision[];
    currentVersion: number;
  }

  const { revisions, currentVersion }: Props = $props();

  let expandedUuid = $state<string | null>(null);

  const FIELD_LABELS: Record<string, string> = {
    name: 'Name',
    base_weekday: 'Basistag',
    base_repeat_every: 'Wiederholung',
    base_time: 'Basiszeit',
    buffer_hours: 'Pufferzeit',
    notes: 'Notizen',
    asset_id: 'Anlage',
  };

  function toggleExpand(uuid: string): void {
    expandedUuid = expandedUuid === uuid ? null : uuid;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatChangedFields(fields: string[]): string {
    return fields.map((f: string) => FIELD_LABELS[f] ?? f).join(', ');
  }

  function getPreviousRevision(index: number): TpmPlanRevision | null {
    const nextIndex = index + 1;
    return nextIndex < revisions.length ? (revisions[nextIndex] ?? null) : null;
  }
</script>

{#if revisions.length === 0}
  <p class="revision-empty">Keine Versionen vorhanden.</p>
{:else}
  <div class="revision-list">
    {#each revisions as revision, i (revision.uuid)}
      {@const isFirst = revision.revisionNumber === 1}
      {@const isCurrent = revision.revisionNumber === currentVersion}
      {@const isExpanded = expandedUuid === revision.uuid}
      {@const previous = getPreviousRevision(i)}
      {@const hasChanges = revision.changedFields.length > 0}

      <button
        type="button"
        class="revision-entry"
        class:revision-entry--expanded={isExpanded}
        onclick={() => {
          if (hasChanges && previous !== null) {
            toggleExpand(revision.uuid);
          }
        }}
      >
        <!-- Header -->
        <div class="revision-header">
          <div class="revision-header__left">
            <span class="badge {isCurrent ? 'badge--primary' : 'badge--info'} badge--sm">
              v{revision.approvalVersion}.{revision.revisionMinor}
            </span>
            {#if isCurrent}
              <span class="badge badge--success badge--sm">aktuell</span>
            {/if}
            {#if isFirst}
              <span class="badge badge--info badge--sm">Erstversion</span>
            {/if}
          </div>
          <div class="revision-header__right">
            <span class="revision-date">{formatDate(revision.createdAt)}</span>
            <span class="revision-author">{revision.changedByName}</span>
            {#if hasChanges && previous !== null}
              <i class="fas fa-chevron-{isExpanded ? 'up' : 'down'} revision-chevron"></i>
            {/if}
          </div>
        </div>

        <!-- Meta -->
        {#if hasChanges}
          <div class="revision-meta">
            <span class="revision-changes">
              <i class="fas fa-pencil-alt"></i>
              {formatChangedFields(revision.changedFields)}
            </span>
          </div>
        {/if}

        {#if revision.changeReason !== null && revision.changeReason.length > 0}
          <div class="revision-reason">
            <i class="fas fa-comment-alt"></i>
            {revision.changeReason}
          </div>
        {/if}

        <!-- Expandable Diff -->
        {#if isExpanded && previous !== null}
          <div
            class="revision-diff-container"
            role="presentation"
            onclick={(e: MouseEvent) => {
              e.stopPropagation();
            }}
          >
            <RevisionDiff
              current={revision}
              {previous}
            />
          </div>
        {/if}
      </button>
    {/each}
  </div>
{/if}

<style>
  .revision-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .revision-empty {
    text-align: center;
    color: var(--color-text-muted);
    padding: 2rem;
    font-size: 0.875rem;
  }

  .revision-entry {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.875rem 1rem;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md, 0.5rem);
    background: var(--glass-bg);
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s;
    text-align: left;
    width: 100%;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
  }

  .revision-entry:hover {
    background: var(--glass-bg-hover);
  }

  .revision-entry--expanded {
    border-color: var(--color-primary);
  }

  .revision-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .revision-header__left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .revision-header__right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
  }

  .revision-date {
    white-space: nowrap;
  }

  .revision-author {
    font-weight: 500;
  }

  .revision-chevron {
    font-size: 0.75rem;
    transition: transform 0.15s;
  }

  .revision-meta {
    font-size: 0.8125rem;
  }

  .revision-changes {
    color: var(--color-text-secondary);
  }

  .revision-changes i {
    margin-right: 0.25rem;
    font-size: 0.6875rem;
    opacity: 60%;
  }

  .revision-reason {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    font-style: italic;
  }

  .revision-reason i {
    margin-right: 0.25rem;
    font-size: 0.6875rem;
    opacity: 60%;
  }

  .revision-diff-container {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--glass-border);
  }
</style>
