<script lang="ts">
  import SearchResultUser from '$lib/components/SearchResultUser.svelte';

  import { MESSAGES } from './constants';

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

<div
  class="search-input__results"
  id="employee-search-results"
>
  {#if searchQuery !== '' && employees.length === 0}
    <div class="search-input__no-results">
      {MESSAGES.SEARCH_NO_RESULTS} "{searchQuery}"
    </div>
  {:else if searchQuery !== ''}
    {#each employees.slice(0, 5) as employee (employee.id)}
      <SearchResultUser
        id={employee.id}
        firstName={employee.firstName}
        lastName={employee.lastName}
        email={employee.email}
        employeeNumber={employee.employeeNumber}
        role="employee"
        position={employee.position}
        query={searchQuery}
        onclick={() => {
          onresultclick(employee.id);
        }}
      />
    {/each}
    {#if employees.length > 5}
      <div class="search-input__result-item search-input__result-more">
        {employees.length - 5}
        {MESSAGES.SEARCH_MORE_RESULTS}
      </div>
    {/if}
  {/if}
</div>
