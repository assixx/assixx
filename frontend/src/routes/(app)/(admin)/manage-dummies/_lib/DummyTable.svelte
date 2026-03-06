<script lang="ts">
  import { MESSAGES } from './constants';
  import DummyTableRow from './DummyTableRow.svelte';

  import type { DummyUser } from './types';

  interface Props {
    dummies: DummyUser[];
    onedit: (dummy: DummyUser) => void;
    ondelete: (dummy: DummyUser) => void;
  }

  const { dummies, onedit, ondelete }: Props = $props();
</script>

<div class="table-responsive">
  <table class="data-table data-table--hover data-table--striped">
    <thead>
      <tr>
        <th>{MESSAGES.COL_DESIGNATION}</th>
        <th>{MESSAGES.COL_EMAIL}</th>
        <th>{MESSAGES.COL_EMPLOYEE_NR}</th>
        <th>{MESSAGES.COL_TEAMS}</th>
        <th>{MESSAGES.COL_AREAS}</th>
        <th>{MESSAGES.COL_DEPARTMENTS}</th>
        <th>{MESSAGES.COL_STATUS}</th>
        <th>{MESSAGES.COL_ACTIONS}</th>
      </tr>
    </thead>
    <tbody>
      {#each dummies as dummy (dummy.uuid)}
        <DummyTableRow
          {dummy}
          {onedit}
          {ondelete}
        />
      {:else}
        <tr>
          <td colspan="8">
            <div class="empty-state empty-state--in-table">
              <div class="empty-state__icon">
                <i class="fas fa-desktop"></i>
              </div>
              <h3 class="empty-state__title">{MESSAGES.EMPTY_TITLE}</h3>
              <p class="empty-state__description">
                {MESSAGES.EMPTY_DESCRIPTION}
              </p>
            </div>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
