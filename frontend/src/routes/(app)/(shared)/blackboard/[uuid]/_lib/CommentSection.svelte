<script lang="ts">
  /**
   * CommentSection - YouTube-Style Threaded Comments with Lazy Loading
   *
   * Features:
   * - Flat design (no card borders per comment)
   * - Reply threading with visual thread line
   * - Reply count with expand/collapse
   * - Lazy loading: initial batch via SSR, load more on scroll
   * - Inline reply form
   */
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';

  import { invalidateAll } from '$app/navigation';

  import { showErrorAlert, showSuccessAlert } from '$lib/utils';
  import { getProfilePictureUrl } from '$lib/utils/avatar-helpers';

  import { addComment, fetchComments, fetchReplies } from './api';
  import { formatDateTime, getAvatarColor } from './utils';

  import type { Comment } from './types';

  interface Props {
    comments: Comment[];
    total: number;
    hasMore: boolean;
    isArchived: boolean;
    uuid: string;
  }

  const {
    comments,
    total,
    hasMore: propHasMore,
    isArchived,
    uuid,
  }: Props = $props();

  // ── State ──────────────────────────────────────────────────────────

  /**
   * Local overrides for SSR data (null = use prop, non-null = use local).
   * Props provide correct SSR output via $derived. Local overrides track
   * lazy-loaded additions and reply count mutations.
   */
  let localComments = $state<Comment[] | null>(null);
  let localHasMore = $state<boolean | null>(null);
  let loadingMore = $state(false);

  /** Combined view: local overrides take priority, SSR props as fallback */
  const allComments = $derived(localComments ?? comments);
  const hasMore = $derived(localHasMore ?? propHasMore);

  /** Per-comment reply state */
  const expandedReplies = new SvelteMap<number, Comment[]>();
  const loadingReplies = new SvelteSet<number>();
  let replyingTo = $state<number | null>(null);
  let replyText = $state('');
  let submittingReply = $state(false);

  /** Top-level comment form */
  let newComment = $state('');
  let submittingComment = $state(false);

  /** IntersectionObserver sentinel */
  let sentinelEl: HTMLDivElement | undefined = $state();

  // Reset local overrides when SSR data refreshes (e.g. after invalidateAll)
  $effect.pre(() => {
    void comments;
    localComments = null;
    localHasMore = null;
  });

  // ── IntersectionObserver for Lazy Loading ──────────────────────────

  $effect(() => {
    if (sentinelEl === undefined || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore) {
          void loadMoreComments();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinelEl);
    return () => {
      observer.disconnect();
    };
  });

  // ── Actions ────────────────────────────────────────────────────────

  async function loadMoreComments(): Promise<void> {
    if (loadingMore || !hasMore) return;
    loadingMore = true;
    const result = await fetchComments(uuid, 10, allComments.length);
    localComments = [...allComments, ...result.comments];
    localHasMore = result.hasMore;
    // eslint-disable-next-line require-atomic-updates -- Constant assignment, guard prevents concurrent calls.
    loadingMore = false;
  }

  async function toggleReplies(commentId: number): Promise<void> {
    if (expandedReplies.has(commentId)) {
      expandedReplies.delete(commentId);
      return;
    }

    loadingReplies.add(commentId);
    const replies = await fetchReplies(commentId);
    expandedReplies.set(commentId, replies);
    loadingReplies.delete(commentId);
  }

  function startReply(commentId: number): void {
    replyingTo = commentId;
    replyText = '';
  }

  function cancelReply(): void {
    replyingTo = null;
    replyText = '';
  }

  async function handleSubmitReply(parentId: number): Promise<void> {
    const text = replyText.trim();
    if (text === '') return;
    submittingReply = true;
    const success = await addComment(uuid, text, parentId);
    if (success) {
      // eslint-disable-next-line require-atomic-updates -- Constant assignment, input disabled via submittingReply guard.
      replyText = '';
      replyingTo = null;
      showSuccessAlert('Antwort hinzugefügt');
      // Refresh replies for this comment
      const replies = await fetchReplies(parentId);
      expandedReplies.set(parentId, replies);
      // Update reply count in the comment list
      localComments = allComments.map((c) =>
        c.id === parentId ? { ...c, replyCount: replies.length } : c,
      );
    } else {
      showErrorAlert('Fehler beim Hinzufügen der Antwort');
    }
    submittingReply = false;
  }

  async function handleSubmitComment(e: Event): Promise<void> {
    e.preventDefault();
    const text = newComment.trim();
    if (text === '') return;
    submittingComment = true;
    const success = await addComment(uuid, text);
    if (success) {
      // eslint-disable-next-line require-atomic-updates -- Setting to constant '', not using previous value. Input disabled via submittingComment.
      newComment = '';
      showSuccessAlert('Kommentar hinzugefügt');
      await invalidateAll();
    } else {
      showErrorAlert('Fehler beim Hinzufügen des Kommentars');
    }
    submittingComment = false;
  }

  // ── Helpers ────────────────────────────────────────────────────────

  function avatarColorClass(
    profilePicture: string | null | undefined,
    userId: number,
  ): string {
    const has =
      profilePicture !== null &&
      profilePicture !== undefined &&
      profilePicture !== '';
    return has ? '' : `avatar--color-${getAvatarColor(userId)}`;
  }

  function hasProfilePic(value: string | null | undefined): value is string {
    return value !== null && value !== undefined && value !== '';
  }

  function getInitials(first?: string, last?: string): string {
    return `${(first?.[0] ?? 'U').toUpperCase()}${(last?.[0] ?? 'N').toUpperCase()}`;
  }
</script>

<div class="comments-section">
  <h3 class="section-title">
    <i class="fas fa-comments"></i> Kommentare
    <span class="badge badge--count ml-2">{total}</span>
  </h3>

  <!-- Top-Level Comment Form -->
  {#if !isArchived}
    <form
      class="comment-form"
      onsubmit={handleSubmitComment}
    >
      <div class="form-field flex-1">
        <textarea
          class="form-field__control"
          placeholder="Kommentar hinzufügen..."
          rows="2"
          required
          bind:value={newComment}
        ></textarea>
      </div>
      <button
        type="submit"
        class="btn btn-primary btn--sm"
        disabled={submittingComment}
      >
        {#if submittingComment}
          <span class="spinner-ring spinner-ring--sm mr-1"></span>
        {:else}
          <i class="fas fa-paper-plane mr-1"></i>
        {/if}
        Senden
      </button>
    </form>
  {/if}

  <!-- Comment List -->
  <div class="thread-list">
    {#if allComments.length === 0 && !hasMore}
      <p class="text-muted">Keine Kommentare vorhanden.</p>
    {:else}
      {#each allComments as comment (comment.id)}
        <!-- Top-Level Comment -->
        <div
          class="thread-item"
          class:thread-item--internal={comment.isInternal}
        >
          <div class="thread-item__main">
            <div
              class="avatar avatar--sm {avatarColorClass(
                comment.profilePicture,
                comment.userId,
              )}"
            >
              {#if hasProfilePic(comment.profilePicture)}
                <img
                  src={getProfilePictureUrl(comment.profilePicture)}
                  alt="{comment.firstName} {comment.lastName}"
                  class="avatar__image"
                />
              {:else}
                <span class="avatar__initials"
                  >{getInitials(comment.firstName, comment.lastName)}</span
                >
              {/if}
            </div>
            <div class="thread-item__content">
              <div class="thread-item__meta">
                <span class="thread-item__author">
                  {comment.firstName ?? 'Unbekannt'}
                  {comment.lastName ?? ''}
                </span>
                <span class="thread-item__date"
                  >{formatDateTime(comment.createdAt)}</span
                >
                {#if comment.isInternal}
                  <span class="internal-badge">Intern</span>
                {/if}
              </div>
              <p class="thread-item__text">{comment.comment}</p>
              <div class="thread-item__actions">
                {#if !isArchived}
                  <button
                    type="button"
                    class="thread-action-btn"
                    onclick={() => {
                      startReply(comment.id);
                    }}
                  >
                    <i class="fas fa-reply"></i> Antworten
                  </button>
                {/if}
                {#if comment.replyCount > 0}
                  <button
                    type="button"
                    class="thread-action-btn thread-action-btn--replies"
                    onclick={() => {
                      void toggleReplies(comment.id);
                    }}
                  >
                    {#if expandedReplies.has(comment.id)}
                      <i class="fas fa-chevron-up"></i>
                    {:else}
                      <i class="fas fa-chevron-down"></i>
                    {/if}
                    {comment.replyCount}
                    {comment.replyCount === 1 ? 'Antwort' : 'Antworten'}
                  </button>
                {/if}
              </div>
            </div>
          </div>

          <!-- Inline Reply Form -->
          {#if replyingTo === comment.id}
            <div class="reply-form-wrapper">
              <div class="thread-line"></div>
              <div class="reply-form">
                <textarea
                  class="form-field__control form-field__control--sm"
                  placeholder="Antwort schreiben..."
                  rows="2"
                  bind:value={replyText}
                ></textarea>
                <div class="reply-form__actions">
                  <button
                    class="btn btn--sm btn-ghost"
                    type="button"
                    onclick={cancelReply}>Abbrechen</button
                  >
                  <button
                    class="btn btn--sm btn-primary"
                    type="button"
                    disabled={submittingReply || replyText.trim() === ''}
                    onclick={() => {
                      void handleSubmitReply(comment.id);
                    }}
                  >
                    {#if submittingReply}
                      <span class="spinner-ring spinner-ring--xs mr-1"></span>
                    {/if}
                    Antworten
                  </button>
                </div>
              </div>
            </div>
          {/if}

          <!-- Replies Thread -->
          {#if expandedReplies.has(comment.id)}
            {@const replies = expandedReplies.get(comment.id) ?? []}
            <div class="replies-thread">
              {#each replies as reply (reply.id)}
                <div
                  class="reply-item"
                  class:thread-item--internal={reply.isInternal}
                >
                  <div class="thread-line"></div>
                  <div class="reply-item__main">
                    <div
                      class="avatar avatar--xs {avatarColorClass(
                        reply.profilePicture,
                        reply.userId,
                      )}"
                    >
                      {#if hasProfilePic(reply.profilePicture)}
                        <img
                          src={getProfilePictureUrl(reply.profilePicture)}
                          alt="{reply.firstName} {reply.lastName}"
                          class="avatar__image"
                        />
                      {:else}
                        <span class="avatar__initials"
                          >{getInitials(reply.firstName, reply.lastName)}</span
                        >
                      {/if}
                    </div>
                    <div class="thread-item__content">
                      <div class="thread-item__meta">
                        <span class="thread-item__author">
                          {reply.firstName ?? 'Unbekannt'}
                          {reply.lastName ?? ''}
                        </span>
                        <span class="thread-item__date"
                          >{formatDateTime(reply.createdAt)}</span
                        >
                        {#if reply.isInternal}
                          <span class="internal-badge">Intern</span>
                        {/if}
                      </div>
                      <p class="thread-item__text">{reply.comment}</p>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}

      <!-- Lazy Load Sentinel -->
      {#if hasMore}
        <div
          class="load-more-sentinel"
          bind:this={sentinelEl}
        >
          {#if loadingMore}
            <div class="load-more-spinner">
              <span class="spinner-ring spinner-ring--sm"></span>
              <span class="text-muted">Weitere Kommentare laden...</span>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  /* ─── Section ──────── */

  .comment-form {
    display: flex;
    gap: var(--spacing-3);
    align-items: flex-start;
    margin-bottom: var(--spacing-6);
  }

  /* ─── Thread List (flat, no card borders) ──────── */

  .thread-list {
    display: flex;
    flex-direction: column;
  }

  .thread-item {
    padding: var(--spacing-3) 0;
    border-bottom: 1px solid var(--color-glass-border);
  }

  .thread-item:last-child {
    border-bottom: none;
  }

  .thread-item--internal {
    background: rgb(255 182 107 / 5%);
    padding-left: var(--spacing-3);
    padding-right: var(--spacing-3);
    margin-left: calc(var(--spacing-3) * -1);
    margin-right: calc(var(--spacing-3) * -1);
    border-radius: var(--radius-lg);
  }

  .thread-item__main {
    display: flex;
    gap: var(--spacing-3);
    align-items: flex-start;
  }

  .thread-item__content {
    flex: 1;
    min-width: 0;
  }

  .thread-item__meta {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    flex-wrap: wrap;
  }

  .thread-item__author {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .thread-item__date {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .thread-item__text {
    margin: var(--spacing-1) 0 0;
    font-size: 0.9rem;
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }

  .thread-item__actions {
    display: flex;
    gap: var(--spacing-3);
    margin-top: var(--spacing-1);
  }

  /* ─── Action Buttons (Reply, Expand) ──────── */

  .thread-action-btn {
    background: none;
    border: none;
    padding: var(--spacing-1) 0;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: color var(--transition-fast);
  }

  .thread-action-btn:hover {
    color: var(--color-primary);
  }

  .thread-action-btn--replies {
    color: var(--color-primary);
  }

  /* ─── Reply Form ──────── */

  .reply-form-wrapper {
    display: flex;
    gap: var(--spacing-3);
    margin-top: var(--spacing-2);
    padding-left: calc(32px + var(--spacing-3));
  }

  .reply-form {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .reply-form__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-2);
  }

  :global(.form-field__control--sm) {
    font-size: 0.85rem;
    padding: var(--spacing-2);
  }

  /* ─── Replies Thread ──────── */

  .replies-thread {
    margin-top: var(--spacing-2);
    padding-left: calc(32px + var(--spacing-3));
  }

  .reply-item {
    display: flex;
    gap: 0;
    padding: var(--spacing-2) 0;
    position: relative;
  }

  .reply-item__main {
    display: flex;
    gap: var(--spacing-2);
    align-items: flex-start;
    flex: 1;
  }

  /* ─── Thread Line (vertical connector) ──────── */

  .thread-line {
    width: 2px;
    min-height: 100%;
    background: var(--color-glass-border);
    margin-right: var(--spacing-3);
    flex-shrink: 0;
    border-radius: 1px;
  }

  /* ─── Internal Badge ──────── */

  .internal-badge {
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 0.65rem;
    font-weight: 600;
    color: #ff6b6b;
    background: rgb(255 182 107 / 20%);
  }

  /* ─── Load More ──────── */

  .load-more-sentinel {
    min-height: 40px;
  }

  .load-more-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
    padding: var(--spacing-4);
  }
</style>
