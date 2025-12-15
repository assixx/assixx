/**
 * Documents Explorer - Sidebar Module
 *
 * Manages folder tree navigation
 * Subscribes to state changes for reactive updates
 * NEW 2025-12-04: Added chat subfolder support
 *
 * @module explorer/sidebar
 */

import type { DocumentCategory, FolderItem } from './types';
import { stateManager } from './state';
import { router } from './router';
import { setHTML } from '../../../utils/dom-utils';
import { documentAPI, type ChatFolder } from './api';

/**
 * Sidebar Manager
 * Handles folder tree rendering
 * NEW 2025-12-04: Added chat subfolder support
 */
class SidebarManager {
  private folderTreeEl: HTMLElement | null = null;
  private chatFolders: ChatFolder[] = [];
  private chatFoldersLoaded = false;
  private selectedConversationId: number | null = null;

  /**
   * Folder definitions with icons
   */
  private readonly folders: Omit<FolderItem, 'count' | 'isActive'>[] = [
    {
      category: 'all',
      label: 'Alle Dokumente',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
      </svg>`,
    },
    {
      category: 'personal',
      label: 'Persönlich',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
      </svg>`,
    },
    {
      category: 'team',
      label: 'Team Dokumente',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
      </svg>`,
    },
    {
      category: 'department',
      label: 'Abteilung',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
      </svg>`,
    },
    {
      category: 'company',
      label: 'Firma',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
      </svg>`,
    },
    {
      category: 'payroll',
      label: 'Gehaltsabrechnungen',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>`,
    },
    // NEW 2025-11-24: Blackboard attachments folder
    {
      category: 'blackboard',
      label: 'Schwarzes Brett',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
      </svg>`,
    },
    // NEW 2025-12-04: Chat attachments folder
    {
      category: 'chat',
      label: 'Chat Anhänge',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
      </svg>`,
    },
  ];

  /**
   * Initialize sidebar
   * NEW 2025-12-04: Pre-loads chat folders for accurate count display
   */
  public init(): void {
    this.folderTreeEl = document.getElementById('folder-tree');

    if (!this.folderTreeEl) {
      console.error('Sidebar folder tree container not found');
      return;
    }

    // Subscribe to state changes
    stateManager.subscribe((state) => {
      this.render(state.currentCategory);
    });

    // Pre-load chat folders for accurate count in sidebar
    void this.preloadChatFolderCount();

    // Initial render
    const state = stateManager.getState();
    this.render(state.currentCategory);
  }

  /**
   * Pre-load chat folders to show accurate count in sidebar
   * NEW 2025-12-04: Runs on init without expanding chat category
   */
  private async preloadChatFolderCount(): Promise<void> {
    try {
      this.chatFolders = await documentAPI.fetchChatFolders();
      this.chatFoldersLoaded = true;
      // Re-render to update chat attachment count
      const state = stateManager.getState();
      this.render(state.currentCategory);
    } catch (error) {
      console.error('[Sidebar] Failed to preload chat folders:', error);
      // Don't block UI - count will show 0 until user clicks
    }
  }

  /**
   * Render folder tree
   */
  private render(activeCategory: DocumentCategory): void {
    if (!this.folderTreeEl) return;

    const state = stateManager.getState();
    const categoryCounts = this.calculateCategoryCounts(state.documents);

    // Override chat count with actual chat folders count (since chat docs are excluded from main fetch)
    categoryCounts.chat = this.getChatFoldersCount();

    const foldersHTML = this.folders
      .map((folder) => {
        // Use Object.hasOwnProperty to avoid object injection
        const count = Object.prototype.hasOwnProperty.call(categoryCounts, folder.category)
          ? categoryCounts[folder.category]
          : 0;
        const isActive = folder.category === activeCategory;

        return this.createFolderItem({
          ...folder,
          count,
          isActive,
        });
      })
      .join('');

    const folderTreeContent = `
      <ul class="space-y-1">
        ${foldersHTML}
      </ul>
    `;

    // Use safe HTML setter
    setHTML(this.folderTreeEl, folderTreeContent);

    // Attach click handlers
    this.attachFolderClickHandlers();
  }

  /**
   * Create folder item HTML
   * UPDATED 2025-12-04: Removed chat subfolders - now shown in main list view
   */
  private createFolderItem(folder: FolderItem): string {
    const activeClasses = folder.isActive ? 'bg-surface-3 text-primary-500' : 'text-content-primary hover:bg-surface-3';
    const iconColor = folder.isActive ? 'text-primary-500' : 'text-content-secondary';

    return `
      <li>
        <button
          class="folder-item w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-left ${activeClasses}"
          data-category="${folder.category}"
        >
          <span class="${iconColor}">${folder.icon}</span>
          <span class="text-sm ${folder.isActive ? 'font-medium' : ''}">${folder.label}</span>
          <span class="ml-auto text-xs text-content-tertiary">${folder.count}</span>
        </button>
      </li>
    `;
  }

  /**
   * Attach click handlers to folder items
   * UPDATED 2025-12-04: Simplified - chat folders now shown in main list view
   */
  private attachFolderClickHandlers(): void {
    if (!this.folderTreeEl) return;

    // Main folder buttons
    const folderButtons = this.folderTreeEl.querySelectorAll('.folder-item');
    folderButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const category = button.getAttribute('data-category') as DocumentCategory;

        // Reset conversation selection when clicking main folder
        this.selectedConversationId = null;

        // For chat category, ensure folders are loaded (for main list view)
        if (category === 'chat' && !this.chatFoldersLoaded) {
          void this.loadChatFolders();
        }

        router.navigateToCategory(category);
      });
    });
  }

  /**
   * Load chat folders from API
   * NEW 2025-12-04
   */
  private async loadChatFolders(): Promise<void> {
    try {
      this.chatFolders = await documentAPI.fetchChatFolders();
      this.chatFoldersLoaded = true;

      // Re-render to show loaded folders
      const state = stateManager.getState();
      this.render(state.currentCategory);
    } catch (error) {
      console.error('[Sidebar] Failed to load chat folders:', error);
      this.chatFoldersLoaded = true; // Mark as loaded to show "no folders" message
    }
  }

  /**
   * Select a chat conversation and load its attachments
   * UPDATED 2025-12-04: Made public for ListView access
   */
  public async selectChatConversation(conversationId: number): Promise<void> {
    this.selectedConversationId = conversationId;

    try {
      // Load attachments for this conversation
      const attachments = await documentAPI.fetchChatAttachments(conversationId);

      // Update state with chat attachments using individual setters
      stateManager.setDocuments(attachments);
      stateManager.setCategory('chat');
      stateManager.setSelectedDocument(null);

      // Re-render sidebar to update count
      this.render('chat');
    } catch (error) {
      console.error('[Sidebar] Failed to load chat attachments:', error);
    }
  }

  /**
   * Reset conversation selection (back to folder view)
   * NEW 2025-12-04: For back navigation from attachments to folders
   */
  public resetConversationSelection(): void {
    this.selectedConversationId = null;
    // Clear documents to show folder view
    stateManager.setDocuments([]);
    // Re-render
    const state = stateManager.getState();
    this.render(state.currentCategory);
  }

  /**
   * Get selected conversation ID
   * NEW 2025-12-04: For external use
   */
  public getSelectedConversationId(): number | null {
    return this.selectedConversationId;
  }

  /**
   * Get chat folders for main list view
   * NEW 2025-12-04: Returns loaded chat folders for ListView
   */
  public getChatFolders(): ChatFolder[] {
    return this.chatFolders;
  }

  /**
   * Check if chat folders are loaded
   * NEW 2025-12-04
   */
  public isChatFoldersLoaded(): boolean {
    return this.chatFoldersLoaded;
  }

  /**
   * Get chat folders count for sidebar display
   * NEW 2025-12-04
   */
  public getChatFoldersCount(): number {
    return this.chatFolders.reduce((sum, f) => sum + f.attachmentCount, 0);
  }

  /**
   * Calculate document counts per category (NEW: clean structure, refactored 2025-01-10)
   * Direct 1:1 mapping with accessScope!
   * Updated 2025-11-24: Added blackboard support
   */
  private calculateCategoryCounts(
    documents: { accessScope: string; category: string }[],
  ): Record<DocumentCategory, number> {
    const counts: Record<DocumentCategory, number> = {
      all: documents.length,
      personal: 0,
      team: 0,
      department: 0,
      company: 0,
      payroll: 0,
      blackboard: 0,
      chat: 0,
    };

    documents.forEach((doc) => {
      // NEW: Direct mapping with accessScope - perfect 1:1!
      switch (doc.accessScope) {
        case 'personal':
          counts.personal++;
          break;
        case 'team':
          counts.team++;
          break;
        case 'department':
          counts.department++;
          break;
        case 'company':
          counts.company++;
          break;
        case 'payroll':
          counts.payroll++;
          break;
        case 'blackboard':
          counts.blackboard++;
          break;
        case 'chat':
          counts.chat++;
          break;
      }
    });

    // REMOVED: No more broken payroll string matching!
    // accessScope='payroll' is already counted above
    return counts;
  }
}

// Singleton instance
export const sidebarManager = new SidebarManager();

// Export type for testing/mocking
export type { SidebarManager };
