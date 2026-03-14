<script lang="ts">
  import { type createDummyMessages } from './constants';
  import DummyTableRow from './DummyTableRow.svelte';

  import type { DummyUser } from './types';

  interface Props {
    messages: ReturnType<typeof createDummyMessages>;
    dummies: DummyUser[];
    onedit: (dummy: DummyUser) => void;
    ondelete: (dummy: DummyUser) => void;
  }

  const { messages, dummies, onedit, ondelete }: Props = $props();
</script>

<div class="table-responsive">
  <table class="data-table data-table--hover data-table--striped">
    <thead>
      <tr>
        <th>{messages.COL_DESIGNATION}</th>
        <th>{messages.COL_EMAIL}</th>
        <th>{messages.COL_EMPLOYEE_NR}</th>
        <th>{messages.COL_TEAMS}</th>
        <th>{messages.COL_AREAS}</th>
        <th>{messages.COL_DEPARTMENTS}</th>
        <th>{messages.COL_STATUS}</th>
        <th>{messages.COL_ACTIONS}</th>
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
              <h3 class="empty-state__title">{messages.EMPTY_TITLE}</h3>
              <p class="empty-state__description">
                {messages.EMPTY_DESCRIPTION}
              </p>
            </div>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
