<script lang="ts">
  import { getAvatarColorClass, getInitials } from '$lib/utils';
  import { getProfilePictureUrl } from '$lib/utils/avatar-helpers';

  import { kvpDetailState } from './state.svelte';
  import { canAddComments, formatDate } from './utils';

  /**
   * Check if a profile picture exists (non-null, non-undefined, non-empty)
   */
  function hasProfilePicture(pic: string | null | undefined): boolean {
    return pic !== null && pic !== undefined && pic !== '';
  }

  interface Props {
    onaddcomment: () => void;
  }

  const { onaddcomment }: Props = $props();

  // Comment input ref - exposed for parent access
  let commentInput: HTMLTextAreaElement | undefined = $state();

  /**
   * Get the textarea element for external access
   */
  export function getCommentInput(): HTMLTextAreaElement | undefined {
    return commentInput;
  }

  /**
   * Clear the comment input
   */
  export function clearInput(): void {
    if (commentInput !== undefined) {
      commentInput.value = '';
    }
  }
</script>

<div class="comments-section">
  <h3 class="section-title">
    <i class="fas fa-comments"></i>
    Kommentare
    <span class="badge badge--count ml-2">{kvpDetailState.comments.length}</span
    >
  </h3>

  <!-- Comment Form (Admin only) -->
  {#if canAddComments(kvpDetailState.effectiveRole)}
    <form
      class="mb-6 flex gap-4"
      onsubmit={(e) => {
        e.preventDefault();
        onaddcomment();
      }}
    >
      <div class="form-field flex-1">
        <textarea
          class="form-field__control"
          placeholder="Kommentar hinzufügen..."
          rows="3"
          bind:this={commentInput}
          required
        ></textarea>
      </div>
      <div class="flex items-start">
        <button
          type="submit"
          class="btn btn-primary"
          disabled={kvpDetailState.isAddingComment}
        >
          {#if kvpDetailState.isAddingComment}
            <i class="fas fa-spinner fa-spin"></i>
          {:else}
            <i class="fas fa-paper-plane"></i>
          {/if}
          Senden
        </button>
      </div>
    </form>
  {/if}

  <!-- Comment List -->
  <div class="comment-list">
    {#each kvpDetailState.comments as comment (comment.id)}
      <div
        class="comment-item"
        class:comment-internal={comment.isInternal}
      >
        <div class="comment-header">
          <div class="comment-author">
            <div
              class="avatar avatar--sm {(
                hasProfilePicture(comment.profilePicture)
              ) ?
                ''
              : getAvatarColorClass(comment.createdBy)}"
            >
              {#if hasProfilePicture(comment.profilePicture)}
                <img
                  src={getProfilePictureUrl(comment.profilePicture)}
                  alt="{comment.createdByName} {comment.createdByLastname}"
                  class="avatar__image"
                />
              {:else}
                <span class="avatar__initials">
                  {getInitials(
                    comment.createdByName,
                    comment.createdByLastname,
                  )}
                </span>
              {/if}
            </div>
            <span>{comment.createdByName} {comment.createdByLastname}</span>
          </div>
          <div class="flex items-center gap-2">
            {#if comment.isInternal}
              <span class="internal-badge">Intern</span>
            {/if}
            <span class="text-sm text-gray-400"
              >{formatDate(comment.createdAt)}</span
            >
          </div>
        </div>
        <div class="mt-2">{comment.comment}</div>
      </div>
    {:else}
      <p class="text-gray-400">Noch keine Kommentare vorhanden.</p>
    {/each}
  </div>
</div>
