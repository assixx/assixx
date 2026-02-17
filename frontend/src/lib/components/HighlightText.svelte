<script lang="ts">
  /**
   * HighlightText - XSS-safe text highlighting without {@html}
   * @module lib/components/HighlightText
   *
   * Renders text with highlighted search matches using pure Svelte template syntax.
   * No raw HTML injection - completely safe from XSS attacks.
   *
   * @example
   * <HighlightText text={user.name} query={searchTerm} />
   */

  interface Props {
    /** The text to display and highlight within */
    text: string;
    /** The search query to highlight (case-insensitive) */
    query: string;
  }

  const { text, query }: Props = $props();

  /** Split text into segments with match indicators */
  const segments = $derived.by(() => {
    if (query.trim() === '') {
      return [{ text, isMatch: false }];
    }

    // Escape regex special characters to prevent ReDoS
    const escapedQuery = query.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');

    const parts: { text: string; isMatch: boolean }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // Reset regex state
    regex.lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      // Add non-matching text before this match
      if (match.index > lastIndex) {
        parts.push({
          text: text.slice(lastIndex, match.index),
          isMatch: false,
        });
      }

      // Add the matching text
      parts.push({
        text: match[1],
        isMatch: true,
      });

      lastIndex = regex.lastIndex;

      // Prevent infinite loop on zero-length matches
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }

    // Add remaining non-matching text
    if (lastIndex < text.length) {
      parts.push({
        text: text.slice(lastIndex),
        isMatch: false,
      });
    }

    return parts.length > 0 ? parts : [{ text, isMatch: false }];
  });
</script>

{#each segments as segment, i (i)}
  {#if segment.isMatch}
    <strong>{segment.text}</strong>
  {:else}
    {segment.text}
  {/if}
{/each}
