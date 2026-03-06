<script lang="ts">
  /**
   * TPM Gesamtansicht - Page Component
   * @module lean-management/tpm/gesamtansicht/+page
   *
   * Matrix overview of all TPM plans with projected dates per interval.
   */
  import { resolve } from '$app/paths';

  import { MESSAGES } from '../_lib/constants';

  import OverallViewTable from './_lib/OverallViewTable.svelte';

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }
</script>

<svelte:head>
  <title>{MESSAGES.GESAMTANSICHT_PAGE_TITLE}</title>
</svelte:head>

<div class="container">
  <div class="gv-header">
    <a
      href={resolvePath('/lean-management/tpm/overview')}
      class="btn btn-info btn-icon"
      title={MESSAGES.BTN_BACK_TO_OVERVIEW}
    >
      <i class="fas fa-arrow-left"></i>
    </a>
    <h1 class="gv-header__title">{MESSAGES.GESAMTANSICHT_TITLE}</h1>
  </div>

  <div class="card">
    <div class="card__body">
      <OverallViewTable />
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
