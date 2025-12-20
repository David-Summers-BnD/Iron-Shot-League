<script>
  import { onMount } from 'svelte';
  import Header from './components/Header.svelte';
  import RoundRobin from './pages/RoundRobin.svelte';
  import SingleElimination from './pages/SingleElimination.svelte';
  import DoubleElimination from './pages/DoubleElimination.svelte';
  import RaceToX from './pages/RaceToX.svelte';
  import Ladder from './pages/Ladder.svelte';
  import Swiss from './pages/Swiss.svelte';
  import ScotchDoubles from './pages/ScotchDoubles.svelte';
  import Killer from './pages/Killer.svelte';
  import History from './pages/History.svelte';
  import { currentTab, tournaments } from './stores/tournaments.js';
  import { loadTournaments } from './lib/storage.js';

  let mounted = false;

  onMount(async () => {
    // Load saved tournaments on startup
    const saved = await loadTournaments();
    tournaments.set(saved);
    mounted = true;
  });
</script>

<div class="min-h-screen flex flex-col">
  <Header />

  <main class="flex-1 container mx-auto px-4 py-8">
    {#if mounted}
      {#if $currentTab === 'round-robin'}
        <RoundRobin />
      {:else if $currentTab === 'single-elimination'}
        <SingleElimination />
      {:else if $currentTab === 'double-elimination'}
        <DoubleElimination />
      {:else if $currentTab === 'race-to-x'}
        <RaceToX />
      {:else if $currentTab === 'ladder'}
        <Ladder />
      {:else if $currentTab === 'swiss'}
        <Swiss />
      {:else if $currentTab === 'scotch-doubles'}
        <ScotchDoubles />
      {:else if $currentTab === 'killer'}
        <Killer />
      {:else if $currentTab === 'history'}
        <History />
      {:else}
        <RoundRobin />
      {/if}
    {:else}
      <div class="flex items-center justify-center py-24">
        <div class="text-center">
          <span class="loading loading-spinner loading-lg text-primary"></span>
          <p class="mt-4 text-base-content/60">Loading Iron Shot League...</p>
        </div>
      </div>
    {/if}
  </main>

  <footer class="bg-base-200 border-t border-base-300 py-6">
    <div class="container mx-auto px-4">
      <div class="flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <img src="./logo.png" alt="Iron Shot League" class="h-10 w-auto" />
          <p class="text-xs text-base-content/50">Hosted by Rusty</p>
        </div>

        <p class="text-sm text-base-content/50">
          Steel Your Nerves, Sink Your Shots
        </p>

        <div class="flex items-center gap-4">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-ghost btn-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  </footer>
</div>
