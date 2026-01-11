<script lang="ts">
  import { MESSAGES } from './constants';
  import { highlightMatch } from './utils';

  import type { Employee } from './types';

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    searchQuery: string;
    employees: Employee[];
    onresultclick: (employeeId: number) => void;
  }

  const { searchQuery, employees, onresultclick }: Props = $props();
</script>

<div class="search-input__results" id="employee-search-results">
  {#if searchQuery !== '' && employees.length === 0}
    <div class="search-input__no-results">
      {MESSAGES.SEARCH_NO_RESULTS} "{searchQuery}"
    </div>
  {:else if searchQuery !== ''}
    {#each employees.slice(0, 5) as employee (employee.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="search-input__result-item"
        onclick={() => {
          onresultclick(employee.id);
        }}
      >
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div style="font-weight: 500; color: var(--color-text-primary);">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html highlightMatch(`${employee.firstName} ${employee.lastName}`, searchQuery)}
          </div>
          <div style="font-size: 0.813rem; color: var(--color-text-secondary);">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html highlightMatch(employee.email, searchQuery)}
          </div>
          <div style="font-size: 0.75rem; color: var(--color-text-muted); display: flex; gap: 8px;">
            <span>
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html highlightMatch(employee.position ?? '', searchQuery)}
            </span>
            {#if employee.employeeNumber}
              <span>
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                • {@html highlightMatch(employee.employeeNumber, searchQuery)}
              </span>
            {/if}
          </div>
        </div>
      </div>
    {/each}
    {#if employees.length > 5}
      <div
        class="search-input__result-item"
        style="
          font-size: 0.813rem;
          color: var(--color-primary);
          text-align: center;
          border-top: 1px solid rgb(255 255 255 / 5%);
        "
      >
        {employees.length - 5}
        {MESSAGES.SEARCH_MORE_RESULTS}
      </div>
    {/if}
  {/if}
</div>
