<script>
  import { currentTab, tournamentTypes } from '../stores/tournaments.js';

  function selectTab(id) {
    currentTab.set(id);
  }
</script>

<header class="bg-base-200 border-b border-base-300 sticky top-0 z-50">
  <!-- Logo and Title Bar -->
  <div class="container mx-auto px-4 py-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <img src="/logo.png" alt="Iron Shot League" class="h-14 w-auto" />
        <div>
          <p class="text-xs text-base-content/60 italic">Steel Your Nerves, Sink Your Shots</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-sm text-base-content/60">Hosted by</span>
        <span class="badge badge-accent badge-lg font-bold">Rusty</span>
      </div>
    </div>
  </div>

  <!-- Tab Navigation -->
  <nav class="container mx-auto px-4">
    <div class="flex overflow-x-auto scrollbar-hide -mb-px">
      {#each tournamentTypes as type}
        <button
          class="tab-btn px-4 py-3 whitespace-nowrap font-medium transition-all relative
                 {$currentTab === type.id
                   ? 'text-accent border-b-2 border-accent'
                   : 'text-base-content/60 hover:text-base-content hover:bg-base-300/30'}"
          on:click={() => selectTab(type.id)}
        >
          <span class="mr-2">{type.icon}</span>
          <span>{type.name}</span>
        </button>
      {/each}
    </div>
  </nav>
</header>

<style>
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
</style>
