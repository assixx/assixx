<script lang="ts">
  /**
   * CommentSection — YouTube-Style Threaded Comments with Lazy Loading
   *
   * Features:
   * - Flat design (no card borders per comment)
   * - Reply threading with visual thread line (one level deep)
   * - Reply count with expand/collapse
   * - Lazy loading: initial batch via SSR, load more on scroll
   * - Inline reply form
   * - Avatars with profile picture or initials fallback + color classes
   * - Status-change entries (unique to work orders)
   *
   * Pattern: matches Blackboard/KVP CommentSection exactly.
   */
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';

  import { invalidateAll } from '$app/navigation';

  import { showErrorAlert, showSuccessAlert } from '$lib/utils';
  import { getProfilePictureUrl } from '$lib/utils/avatar-helpers';

  import { addComment, fetchComments, fetchReplies } from '../../_lib/api';
  import { MESSAGES } from '../../_lib/constants';

  import type { WorkOrderComment } from '../../_lib/types';

  interface Props {
    comments: WorkOrderComment[];
    total: number;
    hasMore: boolean;
    uuid: string;
  }

  const { comments, total, hasMore: propHasMore, uuid }: Props = $props();

  // ── State ──────────────────────────────────────────────────────────

  let localComments = $state<WorkOrderComment[] | null>(null);
  let localHasMore = $state<boolean | null>(null);
  let loadingMore = $state(false);

  const allComments = $derived(localComments ?? comments);
  const hasMore = $derived(localHasMore ?? propHasMore);

  /** Per-comment reply state */
  const expandedReplies = new SvelteMap<number, WorkOrderComment[]>();
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
      (entries: IntersectionObserverEntry[]) => {
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
    const replies = await fetchReplies(uuid, commentId);
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
      showSuccessAlert(MESSAGES.COMMENTS_REPLY_SUCCESS);
      const replies = await fetchReplies(uuid, parentId);
      expandedReplies.set(parentId, replies);
      localComments = allComments.map((c: WorkOrderComment) =>
        c.id === parentId ? { ...c, replyCount: replies.length } : c,
      );
    } else {
      showErrorAlert(MESSAGES.COMMENTS_REPLY_ERROR);
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
      showSuccessAlert(MESSAGES.COMMENTS_SUCCESS);
      await invalidateAll();
    } else {
      showErrorAlert(MESSAGES.COMMENTS_ERROR);
    }
    submittingComment = false;
  }

  // ── Helpers ────────────────────────────────────────────────────────

  function getAvatarColor(id: number): number {
    return id % 10;
  }

  function avatarColorClass(profilePicture: string | null | undefined, userId: number): string {
    const has = profilePicture !== null && profilePicture !== undefined && profilePicture !== '';
    return has ? '' : `avatar--color-${getAvatarColor(userId)}`;
  }

  function hasProfilePic(value: string | null | undefined): value is string {
    return value !== null && value !== undefined && value !== '';
  }

  function getInitials(first?: string, last?: string): string {
    return `${(first?.[0] ?? 'U').toUpperCase()}${(last?.[0] ?? 'N').toUpperCase()}`;
  }

  function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

<div class="comments-section">
  <h4 class="section-title">
    <i class="fas fa-comments mr-2"></i>
    {MESSAGES.COMMENTS_HEADING}
    {#if total > 0}
      <span class="badge badge--count ml-2">{total}</span>
    {/if}
  </h4>

  <!-- Top-Level Comment Form -->
  <form
    class="comment-form"
    onsubmit={handleSubmitComment}
  >
    <div class="form-field flex-1">
      <textarea
        class="form-field__control"
        placeholder={MESSAGES.COMMENTS_ADD_PH}
        rows="2"
        required
        bind:value={newComment}
        disabled={submittingComment}
      ></textarea>
    </div>
    <button
      type="submit"
      class="btn btn-primary btn--sm"
      disabled={submittingComment || newComment.trim() === ''}
    >
      {#if submittingComment}
        <span class="spinner-ring spinner-ring--sm mr-1"></span>
      {:else}
        <i class="fas fa-paper-plane mr-1"></i>
      {/if}
      {MESSAGES.COMMENTS_SUBMIT}
    </button>
  </form>

  <!-- Comment List -->
  <div class="thread-list">
    {#if allComments.length === 0 && !hasMore}
      <p class="text-muted">{MESSAGES.COMMENTS_EMPTY}</p>
    {:else}
      {#each allComments as comment (comment.id)}
        <!-- Top-Level Comment -->
        <div class="thread-item">
          <div class="thread-item__main">
            <div
              class="avatar avatar--sm {avatarColorClass(comment.profilePicture, comment.userId)}"
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
                  {comment.firstName}
                  {comment.lastName}
                </span>
                <span class="thread-item__date">{formatDateTime(comment.createdAt)}</span>
              </div>
              <p class="thread-item__text">{comment.content}</p>
              <div class="thread-item__actions">
                <button
                  type="button"
                  class="thread-action-btn"
                  onclick={() => {
                    startReply(comment.id);
                  }}
                >
                  <i class="fas fa-reply"></i>
                  {MESSAGES.COMMENTS_REPLY}
                </button>
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
                  placeholder={MESSAGES.COMMENTS_REPLY_PH}
                  rows="2"
                  bind:value={replyText}
                ></textarea>
                <div class="reply-form__actions">
                  <button
                    class="btn btn--sm btn-ghost"
                    type="button"
                    onclick={cancelReply}>{MESSAGES.COMMENTS_REPLY_CANCEL}</button
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
                    {MESSAGES.COMMENTS_REPLY}
                  </button>
                </div>
              </div>
            </div>
          {/if}

          <!-- Replies Thread -->
          {#if loadingReplies.has(comment.id)}
            <div class="replies-thread">
              <div class="load-more-spinner">
                <span class="spinner-ring spinner-ring--sm"></span>
              </div>
            </div>
          {/if}
          {#if expandedReplies.has(comment.id)}
            {@const replies = expandedReplies.get(comment.id) ?? []}
            <div class="replies-thread">
              {#each replies as reply (reply.id)}
                <div class="reply-item">
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
                          {reply.firstName}
                          {reply.lastName}
                        </span>
                        <span class="thread-item__date">{formatDateTime(reply.createdAt)}</span>
                      </div>
                      <p class="thread-item__text">{reply.content}</p>
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
              <span class="text-muted">{MESSAGES.COMMENTS_LOADING_MORE}</span>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  /* ─── Form ──────── */

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
