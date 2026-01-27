<script lang="ts">
  import { MESSAGES, MIN_LIST_ROWS } from './constants';

  import type { ChatFolder } from './types';

  interface Props {
    folders: ChatFolder[];
    showBackToAll?: boolean;
    onfolderClick: (conversationId: number) => void;
    onbackToAll?: () => void;
  }

  const {
    folders,
    showBackToAll = false,
    onfolderClick,
    onbackToAll,
  }: Props = $props();

  const placeholderRowCount = $derived(
    Math.max(
      0,
      MIN_LIST_ROWS - folders.length - (folders.length === 0 ? 1 : 0),
    ),
  );
</script>

<div class="overflow-x-auto">
  <table
    class="data-table data-table--striped data-table--hover data-table--bordered"
  >
    <thead>
      <tr>
        <th>{MESSAGES.TH_NAME}</th>
        <th>{MESSAGES.TH_CATEGORY}</th>
        <th>{MESSAGES.TH_TAGS}</th>
        <th>{MESSAGES.TH_SIZE}</th>
        <th>{MESSAGES.TH_DATE}</th>
        <th>{MESSAGES.TH_ACTIONS}</th>
      </tr>
    </thead>
    <tbody id="list-rows">
      {#if showBackToAll && onbackToAll !== undefined}
        <tr
          class="back-to-folders-row cursor-pointer"
          onclick={() => {
            onbackToAll();
          }}
        >
          <td>
            <div class="flex items-center gap-3">
              <i
                class="fas fa-level-up-alt"
                style="font-size: 24px; color: var(--color-content-secondary);"
              ></i>
              <span class="font-medium text-content-secondary">..</span>
            </div>
          </td>
          <td class="text-content-tertiary">Übergeordneter Ordner</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      {/if}
      {#each folders as folder (folder.conversationId)}
        {@const displayName =
          folder.isGroup ?
            (folder.groupName ?? 'Gruppenname')
          : folder.participantName}
        {@const icon =
          folder.isGroup ?
            '<i class="fas fa-users" style="font-size: 16px; color: var(--color-content-secondary); margin-left: 4px;"></i>'
          : '<i class="fas fa-user" style="font-size: 16px; color: var(--color-content-secondary); margin-left: 4px;"></i>'}
        <tr
          class="chat-folder-row cursor-pointer hover:bg-surface-2"
          onclick={() => {
            onfolderClick(folder.conversationId);
          }}
        >
          <td>
            <div class="flex items-center gap-3">
              <svg
                class="w-6 h-6 text-amber-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                ></path>
              </svg>
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="font-medium"
                  title={displayName}>{displayName}</span
                >
                <!-- eslint-disable-next-line svelte/no-at-html-tags -- Safe: icon from hardcoded folder config -->
                {@html icon}
              </div>
            </div>
          </td>
          <td>{MESSAGES.CHAT_CONVERSATION}</td>
          <td><span class="text-content-tertiary">-</span></td>
          <td>{folder.attachmentCount} {MESSAGES.CHAT_FILES_COUNT}</td>
          <td>-</td>
          <td></td>
        </tr>
      {/each}

      {#if folders.length === 0}
        <tr>
          <td
            colspan="6"
            class="text-center text-content-secondary py-8"
          >
            {MESSAGES.EMPTY_DESCRIPTION}
          </td>
        </tr>
      {/if}

      <!-- Placeholder rows -->
      {#each Array(placeholderRowCount) as _, i (i)}
        <tr class="placeholder-row">
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
