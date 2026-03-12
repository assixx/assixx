<script lang="ts">
  /**
   * TPM Gesamtansicht - Page Component
   * @module lean-management/tpm/gesamtansicht/+page
   *
   * Matrix overview of all TPM plans with projected dates per interval.
   */
  import { resolve } from '$app/paths';

  import { createTpmMessages } from '../_lib/constants';

  import OverallViewTable from './_lib/OverallViewTable.svelte';

  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  // Hierarchy labels from layout data inheritance (A6)
  const labels = $derived(data.hierarchyLabels);
  const messages = $derived(createTpmMessages(labels));
</script>

<svelte:head>
  <title>{messages.GESAMTANSICHT_PAGE_TITLE}</title>
</svelte:head>

<div class="container">
  <div class="gv-header">
    <a
      href={resolve('/lean-management/tpm/overview')}
      class="btn btn-info btn-icon"
      title={messages.BTN_BACK_TO_OVERVIEW}
    >
      <i class="fas fa-arrow-left"></i>
    </a>
    <h1 class="gv-header__title">{messages.GESAMTANSICHT_TITLE}</h1>
  </div>

  <div class="card">
    <div class="card__body">
      <OverallViewTable {messages} />
    </div>
  </div>
</div>

<style>
  .gv-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .gv-header__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
  }
</style>
