<script lang="ts">
  import type { DocumentCategory, CategoryCounts } from './types';
  import { FOLDER_DEFINITIONS } from './constants';

  interface Props {
    currentCategory: DocumentCategory;
    categoryCounts: CategoryCounts;
    chatFoldersTotalCount: number;
    onnavigate: (category: DocumentCategory) => void;
  }

  const { currentCategory, categoryCounts, chatFoldersTotalCount, onnavigate }: Props = $props();
</script>

<div class="w-64 bg-[var(--background-secondary)] border-r border-[var(--border-color)]">
  <nav id="folder-tree" class="p-2">
    <ul class="space-y-1">
      {#each FOLDER_DEFINITIONS as folder (folder.category)}
        {@const count =
          folder.category === 'chat'
            ? chatFoldersTotalCount
            : (categoryCounts[folder.category] ?? 0)}
        {@const isActive = folder.category === currentCategory}
        <li>
          <button
            class="folder-item w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-left {isActive
              ? 'bg-surface-3 text-primary-500'
              : 'text-content-primary hover:bg-surface-3'}"
            data-category={folder.category}
            onclick={() => onnavigate(folder.category)}
          >
            <span class={isActive ? 'text-primary-500' : 'text-content-secondary'}>
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html folder.icon}
            </span>
            <span class="text-sm {isActive ? 'font-medium' : ''}">{folder.label}</span>
            <span class="ml-auto text-xs text-content-tertiary">{count}</span>
          </button>
        </li>
      {/each}
    </ul>
  </nav>
</div>
