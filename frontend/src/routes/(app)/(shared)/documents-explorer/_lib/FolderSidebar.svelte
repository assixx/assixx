<script lang="ts">
  import { FOLDER_DEFINITIONS } from './constants';

  import type { DocumentCategory, CategoryCounts } from './types';

  interface Props {
    currentCategory: DocumentCategory;
    categoryCounts: CategoryCounts;
    chatFoldersTotalCount: number;
    onnavigate: (category: DocumentCategory) => void;
  }

  const {
    currentCategory,
    categoryCounts,
    chatFoldersTotalCount,
    onnavigate,
  }: Props = $props();
</script>

<div
  class="w-64 border-r border-[var(--border-color)] bg-[var(--background-secondary)]"
>
  <nav
    id="folder-tree"
    class="p-2"
  >
    <ul class="space-y-1">
      {#each FOLDER_DEFINITIONS as folder (folder.category)}
        {@const count =
          folder.category === 'chat' ?
            chatFoldersTotalCount
          : categoryCounts[folder.category]}
        {@const isActive = folder.category === currentCategory}
        <li>
          <button
            type="button"
            class="folder-item flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors {(
              isActive
            ) ?
              'bg-surface-3 text-primary-500'
            : 'text-content-primary hover:bg-surface-3'}"
            data-category={folder.category}
            onclick={() => {
              onnavigate(folder.category);
            }}
          >
            <span
              class={isActive ? 'text-primary-500' : 'text-content-secondary'}
            >
              <!-- eslint-disable-next-line svelte/no-at-html-tags -- Safe: icon from hardcoded folder config -->
              {@html folder.icon}
            </span>
            <span class="text-sm {isActive ? 'font-medium' : ''}"
              >{folder.label}</span
            >
            <span class="text-content-tertiary ml-auto text-xs">{count}</span>
          </button>
        </li>
      {/each}
    </ul>
  </nav>
</div>
