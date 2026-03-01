<script lang="ts">
  /**
   * TPM Card Defects (Mängelliste) — Page Component
   *
   * Displays all documented defects for a single Kamishibai card.
   * Expandable rows show defect description + execution context.
   * Pattern: mirrors history/+page.svelte structure.
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import {
    INTERVAL_LABELS,
    CARD_STATUS_LABELS,
    CARD_STATUS_BADGE_CLASSES,
    MESSAGES,
  } from '../../../_lib/constants';

  import type { PageData } from './$types';
  import type { ApprovalStatus } from '../../../_lib/types';

  // ===========================================================================
  // SSR DATA
  // ===========================================================================

  const { data }: { data: PageData } = $props();

  const card = $derived(data.card);
  const defects = $derived(data.defects);
  const total = $derived(data.total);
  const error = $derived(data.error);

  // ===========================================================================
  // EXPAND STATE
  // ===========================================================================

  let expandedUuid = $state<string | null>(null);

  function toggleExpand(uuid: string): void {
    expandedUuid = expandedUuid === uuid ? null : uuid;
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  function formatDate(dateStr: string | null): string {
    if (dateStr === null || dateStr === '') return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function getApprovalLabel(status: ApprovalStatus): string {
    const map: Record<ApprovalStatus, string> = {
      none: MESSAGES.APPROVAL_STATUS_NONE,
      pending: MESSAGES.APPROVAL_STATUS_PENDING,
      approved: MESSAGES.APPROVAL_STATUS_APPROVED,
      rejected: MESSAGES.APPROVAL_STATUS_REJECTED,
    };
    return map[status];
  }

  function getApprovalBadgeClass(status: ApprovalStatus): string {
    const map: Record<ApprovalStatus, string> = {
      none: 'badge--secondary',
      pending: 'badge--warning',
      approved: 'badge--success',
      rejected: 'badge--danger',
    };
    return map[status];
  }

  // ===========================================================================
  // NAVIGATION
  // ===========================================================================

  const resolvePath = resolve as (p: string) => string;

  function goBack(): void {
    if (card !== null) {
      void goto(resolvePath(`/lean-management/tpm/card/${card.uuid}`));
    } else {
      void goto(resolvePath('/lean-management/tpm/overview'));
    }
  }
</script>

<svelte:head>
  <title>
    {card !== null ?
      `${card.cardCode} — ${MESSAGES.DEFECTS_PAGE_TITLE}`
    : MESSAGES.DEFECTS_PAGE_TITLE} - Assixx
  </title>
</svelte:head>

<div class="container">
  <!-- Back Button -->
  <div class="mb-4">
    <button
      type="button"
      class="btn btn-light"
      onclick={goBack}
    >
      <i class="fas fa-arrow-left mr-2"></i>{MESSAGES.DEFECTS_BACK}
    </button>
  </div>

  <div class="card">
    <div class="card__header">
      <div>
        <h2 class="card__title">
          <i class="fas fa-exclamation-triangle mr-2"></i>
          {MESSAGES.DEFECTS_HEADING}
        </h2>
        {#if card !== null}
          <p class="mt-1 text-(--color-text-secondary)">
            <span class="font-semibold">{card.cardCode}</span>
            — {card.title}
            · {INTERVAL_LABELS[card.intervalType]}
            {#if card.machineName !== undefined}
              · {card.machineName}
            {/if}
          </p>
          <div class="mt-2 flex items-center gap-3">
            <span class="badge {CARD_STATUS_BADGE_CLASSES[card.status]}">
              {CARD_STATUS_LABELS[card.status]}
            </span>
            <span class="text-sm text-(--color-text-muted)">
              {total}
              {MESSAGES.DEFECTS_COUNT}
            </span>
          </div>
        {/if}
      </div>
    </div>

    <div class="card__body">
      {#if error !== null}
        <div class="p-6 text-center">
          <i
            class="fas fa-exclamation-triangle mb-4 text-4xl text-(--color-danger)"
          ></i>
          <p class="text-(--color-text-secondary)">{error}</p>
        </div>
      {:else if defects.length === 0}
        <div class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-check-circle"></i>
          </div>
          <h3 class="empty-state__title">{MESSAGES.DEFECTS_EMPTY_TITLE}</h3>
          <p class="empty-state__description">{MESSAGES.DEFECTS_EMPTY_DESC}</p>
          <button
            type="button"
            class="btn btn-primary mt-4"
            onclick={goBack}
          >
            <i class="fas fa-arrow-left mr-2"></i>
            {MESSAGES.DEFECTS_BACK}
          </button>
        </div>
      {:else}
        <div class="table-responsive">
          <table class="data-table data-table--hover data-table--striped">
            <thead>
              <tr>
                <th scope="col">{MESSAGES.DEFECTS_COL_TITLE}</th>
                <th scope="col">{MESSAGES.DEFECTS_COL_DATE}</th>
                <th scope="col">{MESSAGES.DEFECTS_COL_PERSON}</th>
                <th scope="col">{MESSAGES.DEFECTS_COL_STATUS}</th>
              </tr>
            </thead>
            <tbody>
              {#each defects as defect (defect.uuid)}
                <!-- Row -->
                <tr
                  class="defect-row"
                  class:defect-row--expanded={expandedUuid === defect.uuid}
                  onclick={() => {
                    toggleExpand(defect.uuid);
                  }}
                  role="button"
                  tabindex="0"
                  onkeydown={(e: KeyboardEvent) => {
                    if (e.key === 'Enter') toggleExpand(defect.uuid);
                  }}
                >
                  <td>
                    <div class="font-medium">{defect.title}</div>
                  </td>
                  <td>{formatDate(defect.executionDate)}</td>
                  <td>{defect.executedByName ?? '-'}</td>
                  <td>
                    <span
                      class="badge {getApprovalBadgeClass(
                        defect.approvalStatus,
                      )}"
                    >
                      {getApprovalLabel(defect.approvalStatus)}
                    </span>
                  </td>
                </tr>

                <!-- Expanded Details -->
                {#if expandedUuid === defect.uuid}
                  <tr class="defect-detail">
                    <td colspan="4">
                      <div class="defect-detail__content">
                        {#if defect.description !== null && defect.description.trim().length > 0}
                          <div class="defect-detail__section">
                            <h4 class="defect-detail__label">
                              <i class="fas fa-info-circle"></i>
                              {MESSAGES.DEFECT_DESC_LABEL}
                            </h4>
                            <p class="defect-detail__text">
                              {defect.description}
                            </p>
                          </div>
                        {:else}
                          <p
                            class="defect-detail__text defect-detail__text--empty"
                          >
                            {MESSAGES.DEFECTS_NO_DESC}
                          </p>
                        {/if}
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .defect-row {
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .defect-row--expanded {
    background: var(--glass-bg-hover);
  }

  .defect-detail {
    background: var(--glass-bg-hover);
  }

  .defect-detail__content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem 0.5rem;
    border-bottom: 1px solid var(--color-glass-border);
  }

  .defect-detail__section {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .defect-detail__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.813rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .defect-detail__text {
    font-size: 0.813rem;
    color: var(--color-text-primary);
    line-height: 1.5;
    margin: 0;
    white-space: pre-wrap;
  }

  .defect-detail__text--empty {
    color: var(--color-text-muted);
    font-style: italic;
  }
</style>
