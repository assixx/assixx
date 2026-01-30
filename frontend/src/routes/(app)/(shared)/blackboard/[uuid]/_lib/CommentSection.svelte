<script lang="ts">
  /**
   * CommentSection - Comment Form & List
   *
   * Renders comment form (hidden for archived entries) and scrollable comment list.
   * Handles comment submission internally with invalidateAll() for SSR data refresh.
   *
   * Pattern: Smart component (owns form state + API calls)
   */
  import { invalidateAll } from '$app/navigation';

  import { showErrorAlert, showSuccessAlert } from '$lib/utils';
  import { getProfilePictureUrl } from '$lib/utils/avatar-helpers';

  import { addComment } from './api';
  import { formatDateTime, getAvatarColor } from './utils';

  import type { Comment } from './types';

  interface Props {
    comments: Comment[];
    isArchived: boolean;
    uuid: string;
  }

  const { comments, isArchived, uuid }: Props = $props();

  // Form State
  let newComment = $state('');
  let submittingComment = $state(false);

  /** Submit new comment, refresh SSR data on success */
  async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    const commentText = newComment.trim();
    if (commentText === '') return;
    submittingComment = true;
    const success = await addComment(uuid, commentText);
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

  /**
   * Determines the avatar color class based on profile picture availability.
   * Uses userId for consistent color per user.
   */
  function getAvatarColorClass(
    profilePicture: string | null | undefined,
    userId: number,
  ): string {
    const hasProfilePic =
      profilePicture !== null &&
      profilePicture !== undefined &&
      profilePicture !== '';
    return hasProfilePic ? '' : `avatar--color-${getAvatarColor(userId)}`;
  }

  /** Type-safe check for non-empty string value */
  function hasProfilePicture(
    value: string | null | undefined,
  ): value is string {
    return value !== null && value !== undefined && value !== '';
  }
</script>

<div class="comments-section">
  <h3 class="section-title">
    <i class="fas fa-comments"></i> Kommentare
    <span class="badge badge--count ml-2">{comments.length}</span>
  </h3>

  <!-- Comment Form - Hidden for archived entries -->
  {#if !isArchived}
    <form
      class="mb-6 flex gap-4"
      onsubmit={handleSubmit}
    >
      <div class="form-field flex-1">
        <textarea
          class="form-field__control"
          placeholder="Kommentar hinzufügen..."
          rows="3"
          required
          bind:value={newComment}
        ></textarea>
      </div>
      <div class="flex items-start">
        <button
          type="submit"
          class="btn btn-primary"
          disabled={submittingComment}
        >
          {#if submittingComment}<span
              class="spinner-ring spinner-ring--sm mr-2"
            ></span>{:else}<i class="fas fa-paper-plane mr-2"></i>{/if}
          Senden
        </button>
      </div>
    </form>
  {/if}

  <!-- Comment List -->
  <div class="comment-list">
    {#if comments.length === 0}
      <p class="text-muted">Keine Kommentare vorhanden.</p>
    {:else}
      {#each comments as comment (comment.id)}
        <div
          class="comment-item"
          class:comment-internal={comment.isInternal}
        >
          <div class="comment-header">
            <div class="comment-author">
              <div
                class="avatar avatar--sm {getAvatarColorClass(
                  comment.profilePicture,
                  comment.userId,
                )}"
              >
                {#if hasProfilePicture(comment.profilePicture)}
                  <img
                    src={getProfilePictureUrl(comment.profilePicture)}
                    alt="{comment.firstName} {comment.lastName}"
                    class="avatar__image"
                  />
                {:else}
                  <span class="avatar__initials"
                    >{(comment.firstName?.[0] ?? 'U').toUpperCase()}{(
                      comment.lastName?.[0] ?? 'N'
                    ).toUpperCase()}</span
                  >
                {/if}
              </div>
              <div>
                <strong
                  >{comment.firstName ?? 'Unbekannt'}
                  {comment.lastName ?? ''}</strong
                >
                {#if comment.isInternal}<span class="internal-badge"
                    >Intern</span
                  >{/if}
              </div>
            </div>
            <span class="comment-date">{formatDateTime(comment.createdAt)}</span
            >
          </div>
          <div class="comment-content">{comment.comment}</div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .comment-date {
    font-size: 0.85rem;
    color: rgb(255 255 255 / 50%);
  }
</style>
