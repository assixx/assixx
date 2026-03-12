<script lang="ts">
  import '$lib/actions/modal-dropdown-scroll';
  import '../app.css';
  import ToastContainer from '$lib/components/ToastContainer.svelte';

  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  const { children }: Props = $props();
</script>

<svelte:head>
  <!-- Base Meta Tags (Fonts loaded in app.html - no duplication needed) -->
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />
  <meta
    name="theme-color"
    content="#121212"
  />
</svelte:head>

<!-- Global Toast Container (1:1 like legacy #) -->
<ToastContainer />

{@render children()}
