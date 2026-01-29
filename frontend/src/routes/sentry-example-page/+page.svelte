<script lang="ts">
  /**
   * Sentry Test Page
   * Tests both frontend AND server-side (API route) error capturing
   *
   * @see https://docs.sentry.io/platforms/javascript/guides/sveltekit/
   */
  import * as Sentry from '@sentry/sveltekit';

  let loading = $state(false);
  let result = $state('');

  /**
   * Throws a sample error to test Sentry
   * Triggers BOTH frontend and API route errors
   */
  async function throwSampleError() {
    loading = true;
    result = '';

    // Start a Sentry span for tracing
    await Sentry.startSpan(
      {
        name: 'Example Frontend Span',
        op: 'test',
      },
      async () => {
        // 1. Call API route (server-side error)
        try {
          const response = await fetch('/sentry-example-api');
          if (!response.ok) {
            result = `API Error: ${response.status}`;
          }
        } catch (e) {
          result = `Network Error: ${e instanceof Error ? e.message : String(e)}`;
        }

        // 2. Throw frontend error
        throw new Error('This is a test error from the Sentry example page');
      },
    );

    loading = false;
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-100 p-4">
  <div class="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
    <h1 class="mb-4 text-2xl font-bold text-gray-800">Sentry Test Page</h1>

    <p class="mb-6 text-gray-600">
      Click the button below to trigger test errors. This will:
    </p>

    <ul class="mb-6 list-inside list-disc space-y-1 text-gray-600">
      <li>Call an API route (server-side error)</li>
      <li>Throw a frontend error</li>
      <li>Create a Sentry trace/span</li>
    </ul>

    <button
      type="button"
      onclick={throwSampleError}
      disabled={loading}
      class="w-full rounded bg-red-500 px-4
        py-3 font-bold text-white transition-colors hover:bg-red-600 disabled:bg-gray-400"
    >
      {loading ? 'Loading...' : 'Throw Sample Error'}
    </button>

    {#if result}
      <p class="mt-4 text-sm text-gray-500">{result}</p>
    {/if}

    <div class="mt-6 border-t border-gray-200 pt-4">
      <p class="text-sm text-gray-500">
        After clicking, check your
        <a
          href="https://assixx.sentry.io/issues/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-blue-500 hover:underline"
        >
          Sentry Dashboard
        </a>
      </p>

      <p class="mt-2 text-xs text-gray-400">
        Note: Errors from browser DevTools console are sandboxed and won't be
        captured.
      </p>
    </div>
  </div>
</div>
