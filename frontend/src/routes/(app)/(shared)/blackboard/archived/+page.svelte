<script lang="ts">
  /**
   * Blackboard Archived - Page Component
   * @module blackboard/archived/+page
   *
   * Displays archived blackboard entries in a table.
   * Click on row navigates to detail page (read-only).
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';

  import { createOrgLevelLabels } from '../_lib/constants';

  import type { PageData } from './$types';

  // =============================================================================
  // SSR DATA
  // =============================================================================

  const { data }: { data: PageData } = $props();

  const labels = $derived(
    ((data as Record<string, unknown>).hierarchyLabels as HierarchyLabels | undefined) ??
      DEFAULT_HIERARCHY_LABELS,
  );

  const permissionDenied = $derived(data.permissionDenied);

  const entries = $derived(data.entries);
  const error = $derived(data.error);

  // =============================================================================
  // HELPERS
  // =============================================================================

  function formatDate(dateStr: string | null): string {
    if (dateStr === null || dateStr === '') return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  function getPriorityText(priority: string): string {
    const map: Record<string, string> = {
      low: 'Niedrig',
      medium: 'Normal',
      high: 'Hoch',
      urgent: 'Dringend',
    };
    return map[priority] ?? priority;
  }

  function getPriorityClass(priority: string): string {
    const map: Record<string, string> = {
      low: 'badge--info',
      medium: 'badge--secondary',
      high: 'badge--warning',
      urgent: 'badge--danger',
    };
    return map[priority] ?? 'badge--secondary';
  }

  const orgLevelLabels = $derived(createOrgLevelLabels(labels));

  function getOrgLevelText(orgLevel: string): string {
    const key = orgLevel as keyof typeof orgLevelLabels;
    if (key in orgLevelLabels) return orgLevelLabels[key];
    return orgLevel;
  }

  // =============================================================================
  // NAVIGATION
  // =============================================================================

  function navigateToEntry(uuid: string): void {
    void goto(resolve(`/blackboard/${uuid}`));
  }

  function goBack(): void {
    void goto(resolve('/blackboard'));
  }
</script>

<svelte:head>
  <title>Archivierte Einträge - Schwarzes Brett - Assixx</title>
</svelte:head>

{#if permissionDenied}
  <PermissionDenied addonName="das Schwarze Brett" />
{:else}
  <div class="container">
    <!-- Back Button -->
    <div class="mb-4">
      <button
        type="button"
        class="btn btn-light"
        onclick={goBack}
      >
        <i class="fas fa-arrow-left mr-2"></i>Zurück zur Übersicht
      </button>
    </div>

    <div class="card">
      <div class="card__header">
        <div>
          <h2 class="card__title">
            <i class="fas fa-archive mr-2"></i>
            Archivierte Einträge
          </h2>
          <p class="mt-1 text-(--color-text-secondary)">
            Schwarzes Brett - Archiv ({entries.length} Einträge)
          </p>
        </div>
      </div>

      <div class="card__body">
        {#if error}
          <div class="p-6 text-center">
            <i class="fas fa-exclamation-triangle mb-4 text-4xl text-(--color-danger)"></i>
            <p class="text-(--color-text-secondary)">{error}</p>
          </div>
        {:else if entries.length === 0}
          <div class="empty-state">
            <div class="empty-state__icon">
              <i class="fas fa-archive"></i>
            </div>
            <h3 class="empty-state__title">Keine archivierten Einträge</h3>
            <p class="empty-state__description">Es wurden noch keine Einträge archiviert.</p>
            <button
              type="button"
              class="btn btn-primary mt-4"
              onclick={goBack}
            >
              <i class="fas fa-arrow-left mr-2"></i>
              Zurück zum Schwarzen Brett
            </button>
          </div>
        {:else}
          <div class="table-responsive">
            <table
              class="data-table data-table--hover data-table--striped data-table--actions-hover"
            >
              <thead>
                <tr>
                  <th scope="col">Titel</th>
                  <th scope="col">Autor</th>
                  <th scope="col">Sichtbarkeit</th>
                  <th scope="col">Priorität</th>
                  <th scope="col">Erstellt am</th>
                  <th scope="col">Abgelaufen am</th>
                </tr>
              </thead>
              <tbody>
                {#each entries as entry (entry.uuid)}
                  <tr
                    class="cursor-pointer"
                    onclick={() => {
                      navigateToEntry(entry.uuid);
                    }}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => {
                      if (e.key === 'Enter') navigateToEntry(entry.uuid);
                    }}
                  >
                    <td>
                      <div class="font-medium">
                        {truncateText(entry.title, 50)}
                      </div>
                      <div class="text-sm text-(--color-text-secondary)">
                        {truncateText(entry.content.replace(/<[^>]*>/g, ''), 60)}
                      </div>
                    </td>
                    <td>{entry.authorFullName ?? entry.authorName ?? '-'}</td>
                    <td>
                      <span class="badge badge--secondary">{getOrgLevelText(entry.orgLevel)}</span>
                    </td>
                    <td>
                      <span class="badge {getPriorityClass(entry.priority)}">
                        {getPriorityText(entry.priority)}
                      </span>
                    </td>
                    <td>{formatDate(entry.createdAt)}</td>
                    <td>{formatDate(entry.expiresAt)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .cursor-pointer {
    cursor: pointer;
  }

  .cursor-pointer:hover {
    background: color-mix(in oklch, var(--color-white) 5%, transparent);
  }
</style>
