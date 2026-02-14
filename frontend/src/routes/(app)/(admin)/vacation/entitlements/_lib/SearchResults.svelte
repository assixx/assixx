<script lang="ts">
  /**
   * SearchResults — Entitlements employee search dropdown
   * Uses SearchResultUser for consistent design system rendering.
   */
  import SearchResultUser from '$lib/components/SearchResultUser.svelte';

  import type { EmployeeListItem } from './types';

  interface Props {
    searchQuery: string;
    employees: EmployeeListItem[];
    onresultclick: (employee: EmployeeListItem) => void;
  }

  const { searchQuery, employees, onresultclick }: Props = $props();
</script>

<div
  class="search-input__results"
  id="entitlement-search-results"
>
  {#if searchQuery !== '' && employees.length === 0}
    <div class="search-input__no-results">
      Keine Ergebnisse für "{searchQuery}"
    </div>
  {:else if searchQuery !== ''}
    {#each employees.slice(0, 5) as employee (employee.id)}
      <SearchResultUser
        id={employee.id}
        firstName={employee.firstName ?? undefined}
        lastName={employee.lastName ?? undefined}
        email={employee.email}
        employeeNumber={employee.employeeNumber}
        role={employee.role}
        position={employee.position ?? undefined}
        query={searchQuery}
        onclick={() => {
          onresultclick(employee);
        }}
      />
    {/each}
    {#if employees.length > 5}
      <div class="search-input__result-item search-input__result-more">
        {employees.length - 5} weitere Ergebnisse
      </div>
    {/if}
  {/if}
</div>
