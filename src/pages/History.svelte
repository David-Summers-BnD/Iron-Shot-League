<script>
  import { onMount } from 'svelte';
  import { tournaments, deleteTournament } from '../stores/tournaments.js';
  import { loadTournaments, saveTournaments } from '../lib/storage.js';
  import ExportImport from '../components/ExportImport.svelte';

  let loading = true;

  onMount(async () => {
    const saved = await loadTournaments();
    tournaments.set(saved);
    loading = false;
  });

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getTypeIcon(type) {
    const icons = {
      'round-robin': '🔄',
      'single-elimination': '🏆',
      'double-elimination': '🎯',
      'race-to-x': '🏁',
      'ladder': '📊',
      'swiss': '🎲',
      'scotch-doubles': '👥'
    };
    return icons[type] || '🎱';
  }

  function getTypeName(type) {
    const names = {
      'round-robin': 'Round Robin',
      'single-elimination': 'Single Elimination',
      'double-elimination': 'Double Elimination',
      'race-to-x': 'Race to X',
      'ladder': 'Ladder',
      'swiss': 'Swiss System',
      'scotch-doubles': 'Scotch Doubles'
    };
    return names[type] || type;
  }

  async function handleDelete(id) {
    if (confirm('Are you sure you want to delete this tournament?')) {
      deleteTournament(id);
      await saveTournaments($tournaments);
    }
  }

  async function handleImport(e) {
    tournaments.set(e.detail);
  }

  $: completedTournaments = $tournaments.filter(t => t.status === 'completed');
  $: activeTournaments = $tournaments.filter(t => t.status !== 'completed');
</script>

<div class="max-w-4xl mx-auto space-y-8">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-2xl font-bold text-white">📜 Tournament History</h2>
      <p class="text-base-content/60">{$tournaments.length} total tournaments</p>
    </div>

    <ExportImport on:imported={handleImport} />
  </div>

  {#if loading}
    <div class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else if $tournaments.length === 0}
    <div class="card bg-base-200">
      <div class="card-body text-center py-16">
        <p class="text-6xl mb-4">🎱</p>
        <h3 class="text-xl font-bold mb-2">No Tournaments Yet</h3>
        <p class="text-base-content/60">
          Create your first tournament using the tabs above!
        </p>
      </div>
    </div>
  {:else}
    <!-- Active Tournaments -->
    {#if activeTournaments.length > 0}
      <div class="space-y-4">
        <h3 class="text-lg font-bold text-primary flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-primary animate-pulse"></span>
          Active Tournaments ({activeTournaments.length})
        </h3>

        <div class="grid gap-4">
          {#each activeTournaments as tournament}
            <div class="card bg-base-200 card-hover border border-primary/30">
              <div class="card-body p-4">
                <div class="flex items-start justify-between">
                  <div class="flex items-start gap-4">
                    <span class="text-3xl">{getTypeIcon(tournament.type)}</span>
                    <div>
                      <h4 class="font-bold text-lg">{tournament.name}</h4>
                      <div class="flex flex-wrap gap-2 mt-1">
                        <span class="badge badge-outline">{getTypeName(tournament.type)}</span>
                        <span class="badge badge-primary">{tournament.players?.length || 0} players</span>
                        <span class="badge badge-warning">In Progress</span>
                      </div>
                      <p class="text-sm text-base-content/60 mt-2">
                        Started: {formatDate(tournament.createdAt)}
                      </p>
                    </div>
                  </div>

                  <button
                    class="btn btn-ghost btn-sm text-error"
                    on:click={() => handleDelete(tournament.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Completed Tournaments -->
    {#if completedTournaments.length > 0}
      <div class="space-y-4">
        <h3 class="text-lg font-bold text-success flex items-center gap-2">
          <span>🏆</span>
          Completed ({completedTournaments.length})
        </h3>

        <div class="grid gap-4">
          {#each completedTournaments as tournament}
            <div class="card bg-base-200 card-hover">
              <div class="card-body p-4">
                <div class="flex items-start justify-between">
                  <div class="flex items-start gap-4">
                    <span class="text-3xl">{getTypeIcon(tournament.type)}</span>
                    <div>
                      <h4 class="font-bold text-lg">{tournament.name}</h4>
                      <div class="flex flex-wrap gap-2 mt-1">
                        <span class="badge badge-outline">{getTypeName(tournament.type)}</span>
                        <span class="badge">{tournament.players?.length || 0} players</span>
                        <span class="badge badge-success">Completed</span>
                      </div>
                      <p class="text-sm text-base-content/60 mt-2">
                        {formatDate(tournament.createdAt)}
                      </p>
                      {#if tournament.standings && tournament.standings[0]}
                        <p class="text-sm mt-2">
                          <span class="text-success font-bold">Winner:</span>
                          {tournament.standings[0].player}
                        </p>
                      {/if}
                    </div>
                  </div>

                  <button
                    class="btn btn-ghost btn-sm text-error"
                    on:click={() => handleDelete(tournament.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}

  <!-- Data Management Info -->
  <div class="alert">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-info shrink-0 w-6 h-6">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>
    <div>
      <h4 class="font-bold">Data Storage</h4>
      <p class="text-sm">
        Tournament data is stored locally in your browser. Use Export to backup your data,
        or Import to restore from a backup file.
      </p>
    </div>
  </div>
</div>
