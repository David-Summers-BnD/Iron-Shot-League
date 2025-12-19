<script>
  import { createEventDispatcher } from 'svelte';

  export let players = [];
  export let minPlayers = 2;
  export let maxPlayers = 64;
  export let label = 'Players';
  export let placeholder = 'Enter player names (one per line)';

  const dispatch = createEventDispatcher();

  let bulkInput = '';
  let newPlayerName = '';

  function handleBulkInput() {
    const names = bulkInput
      .split('\n')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (names.length > 0) {
      players = [...new Set([...players, ...names])].slice(0, maxPlayers);
      bulkInput = '';
      dispatch('change', players);
    }
  }

  function addPlayer() {
    if (newPlayerName.trim() && players.length < maxPlayers) {
      if (!players.includes(newPlayerName.trim())) {
        players = [...players, newPlayerName.trim()];
        dispatch('change', players);
      }
      newPlayerName = '';
    }
  }

  function removePlayer(index) {
    players = players.filter((_, i) => i !== index);
    dispatch('change', players);
  }

  function movePlayer(index, direction) {
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < players.length) {
      const newPlayers = [...players];
      [newPlayers[index], newPlayers[newIndex]] = [newPlayers[newIndex], newPlayers[index]];
      players = newPlayers;
      dispatch('change', players);
    }
  }

  function clearAll() {
    players = [];
    dispatch('change', players);
  }

  $: isValid = players.length >= minPlayers && players.length <= maxPlayers;
  $: validationMessage = players.length < minPlayers
    ? `Need at least ${minPlayers} players`
    : players.length > maxPlayers
    ? `Maximum ${maxPlayers} players allowed`
    : '';
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <label class="text-lg font-semibold text-white">{label}</label>
    <div class="flex items-center gap-2">
      <span class="badge {isValid ? 'badge-success' : 'badge-warning'}">
        {players.length} / {maxPlayers}
      </span>
      {#if players.length > 0}
        <button class="btn btn-ghost btn-xs text-error" on:click={clearAll}>
          Clear All
        </button>
      {/if}
    </div>
  </div>

  <!-- Bulk Input -->
  <div class="form-control">
    <textarea
      bind:value={bulkInput}
      on:blur={handleBulkInput}
      class="textarea textarea-bordered bg-base-300 h-24 resize-none"
      {placeholder}
    ></textarea>
    <label class="label">
      <span class="label-text-alt text-base-content/60">Paste multiple names, one per line</span>
      <button class="btn btn-xs btn-primary" on:click={handleBulkInput}>Add Names</button>
    </label>
  </div>

  <!-- Single Player Add -->
  <div class="join w-full">
    <input
      type="text"
      bind:value={newPlayerName}
      on:keydown={(e) => e.key === 'Enter' && addPlayer()}
      class="input input-bordered join-item flex-1 bg-base-300"
      placeholder="Add single player..."
    />
    <button class="btn btn-primary join-item" on:click={addPlayer} disabled={!newPlayerName.trim()}>
      Add
    </button>
  </div>

  <!-- Player List -->
  {#if players.length > 0}
    <div class="bg-base-300 rounded-lg p-2 max-h-64 overflow-y-auto">
      <ul class="space-y-1">
        {#each players as player, index}
          <li class="flex items-center gap-2 p-2 bg-base-200 rounded hover:bg-base-100 group">
            <span class="text-base-content/40 w-6 text-center font-mono text-sm">{index + 1}</span>
            <span class="flex-1 font-medium">{player}</span>
            <div class="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <button
                class="btn btn-ghost btn-xs"
                on:click={() => movePlayer(index, -1)}
                disabled={index === 0}
                title="Move up"
              >↑</button>
              <button
                class="btn btn-ghost btn-xs"
                on:click={() => movePlayer(index, 1)}
                disabled={index === players.length - 1}
                title="Move down"
              >↓</button>
              <button
                class="btn btn-ghost btn-xs text-error"
                on:click={() => removePlayer(index)}
                title="Remove"
              >✕</button>
            </div>
          </li>
        {/each}
      </ul>
    </div>
  {:else}
    <div class="text-center py-8 text-base-content/40">
      <p>No players added yet</p>
      <p class="text-sm">Add players above to get started</p>
    </div>
  {/if}

  <!-- Validation Message -->
  {#if validationMessage}
    <p class="text-warning text-sm">{validationMessage}</p>
  {/if}
</div>
