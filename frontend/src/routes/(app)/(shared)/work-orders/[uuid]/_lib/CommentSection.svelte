<script lang="ts">
  /**
   * CommentSection — Comment list + add comment form.
   * Differentiates manual comments from auto-generated status change entries.
   * Uses invalidateAll() after adding a comment to refresh SSR data.
   */
  import { invalidateAll } from '$app/navigation';

  import { addComment, logApiError } from '../../_lib/api';
  import { MESSAGES, STATUS_LABELS } from '../../_lib/constants';

  import type { WorkOrderComment } from '../../_lib/types';

  interface Props {
    comments: WorkOrderComment[];
    total: number;
    uuid: string;
  }

  const { comments, total, uuid }: Props = $props();

  let newComment = $state('');
  let submitting = $state(false);

  function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** Extract initials from a full name */
  function getInitials(name: string): string {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /** Build status change description */
  function statusChangeText(comment: WorkOrderComment): string {
    const oldLabel =
      comment.oldStatus !== null ? STATUS_LABELS[comment.oldStatus] : '?';
    const newLabel =
      comment.newStatus !== null ? STATUS_LABELS[comment.newStatus] : '?';
    return `${oldLabel} → ${newLabel}`;
  }

  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const trimmed = newComment.trim();
    if (trimmed === '') return;

    newComment = '';
    submitting = true;
    try {
      await addComment(uuid, { content: trimmed });
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('addComment', err);
    } finally {
      submitting = false;
    }
  }
</script>

<div class="comment-section">
  <h4 class="section-title">
    <i class="fas fa-comments mr-2"></i>
    {MESSAGES.COMMENTS_HEADING}
    {#if total > 0}
      <span class="badge badge--count ml-2">{total}</span>
    {/if}
  </h4>

  <!-- Add comment form -->
  <form
    class="comment-form"
    onsubmit={handleSubmit}
  >
    <div class="comment-form__input">
      <textarea
        class="form-field__control"
        placeholder={MESSAGES.COMMENTS_ADD_PH}
        rows="2"
        bind:value={newComment}
        disabled={submitting}
      ></textarea>
    </div>
    <button
      type="submit"
      class="btn btn-primary btn--sm"
      disabled={submitting || newComment.trim() === ''}
    >
      {#if submitting}
        <i class="fas fa-spinner fa-spin"></i>
        {MESSAGES.COMMENTS_SUBMITTING}
      {:else}
        <i class="fas fa-paper-plane"></i>
        {MESSAGES.COMMENTS_SUBMIT}
      {/if}
    </button>
  </form>

  <!-- Comment list -->
  {#if comments.length === 0}
    <p class="comment-empty">{MESSAGES.COMMENTS_EMPTY}</p>
  {:else}
    <div class="comment-list">
      {#each comments as comment (comment.uuid)}
        <div
          class="comment-item"
          class:comment-item--status-change={comment.isStatusChange}
        >
          {#if comment.isStatusChange}
            <!-- Status change entry -->
            <div class="comment-item__status">
              <i class="fas fa-exchange-alt"></i>
              <span class="comment-item__status-text">
                <strong>{comment.userName}</strong>
                — {MESSAGES.COMMENTS_STATUS_CHANGE}: {statusChangeText(comment)}
              </span>
              <span class="comment-item__date">
                {formatDateTime(comment.createdAt)}
              </span>
            </div>
          {:else}
            <!-- Manual comment -->
            <div class="comment-item__main">
              <div class="avatar avatar--sm">
                <span class="avatar__initials">
                  {getInitials(comment.userName)}
                </span>
              </div>
              <div class="comment-item__content">
                <div class="comment-item__meta">
                  <span class="comment-item__author">{comment.userName}</span>
                  <span class="comment-item__date">
                    {formatDateTime(comment.createdAt)}
                  </span>
                </div>
                <p class="comment-item__text">{comment.content}</p>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .comment-form {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    margin-bottom: 1.5rem;
  }

  .comment-form__input {
    flex: 1;
  }

  .comment-empty {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    font-style: italic;
  }

  .comment-list {
    display: flex;
    flex-direction: column;
  }

  .comment-item {
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--color-border-light, var(--color-border));
  }

  .comment-item:last-child {
    border-bottom: none;
  }

  .comment-item--status-change {
    background: var(--color-bg-secondary, #f8f9fa);
    border-radius: var(--radius-sm, 0.25rem);
    padding: 0.5rem 0.75rem;
    margin: 0.25rem 0;
  }

  .comment-item__status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.813rem;
    color: var(--color-text-secondary);
  }

  .comment-item__status-text {
    flex: 1;
  }

  .comment-item__main {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .comment-item__content {
    flex: 1;
    min-width: 0;
  }

  .comment-item__meta {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .comment-item__author {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .comment-item__date {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .comment-item__text {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }
</style>
