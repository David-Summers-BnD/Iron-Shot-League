<script>
  import { createEventDispatcher } from 'svelte';
  import { exportData, importData } from '../lib/storage.js';

  const dispatch = createEventDispatcher();

  let fileInput;
  let importing = false;
  let error = '';

  async function handleExport() {
    try {
      await exportData();
    } catch (e) {
      error = 'Failed to export data';
    }
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    importing = true;
    error = '';

    try {
      const tournaments = await importData(file);
      dispatch('imported', tournaments);
    } catch (e) {
      error = e.message || 'Failed to import data';
    } finally {
      importing = false;
      if (fileInput) fileInput.value = '';
    }
  }
</script>

<div class="flex items-center gap-4 flex-wrap">
  <button class="btn btn-outline btn-sm gap-2" on:click={handleExport}>
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
    Export Data
  </button>

  <label class="btn btn-outline btn-sm gap-2 {importing ? 'loading' : ''}">
    {#if !importing}
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    {/if}
    Import Data
    <input
      bind:this={fileInput}
      type="file"
      accept=".json"
      class="hidden"
      on:change={handleImport}
    />
  </label>

  {#if error}
    <span class="text-error text-sm">{error}</span>
  {/if}
</div>
