<script>
  import { currentTab, tournamentTypes } from '../stores/tournaments.js';

  function selectTab(id) {
    currentTab.set(id);
  }
</script>

<header class="bg-base-200 border-b border-base-300 sticky top-0 z-50">
  <div class="container mx-auto px-4">
    <div class="header-layout">
      <!-- Logo - spans full height -->
      <div class="logo-container">
        <img src="./logo.png" alt="Iron Shot League" class="header-logo" />
      </div>

      <!-- Right side content -->
      <div class="header-content">
        <!-- Top row: tagline and hosted by -->
        <div class="header-top">
          <p class="tagline">Steel Your Nerves, Sink Your Shots</p>
          <div class="hosted-by">
            <span class="hosted-text">Hosted by</span>
            <span class="badge badge-accent badge-lg font-bold">Rusty</span>
          </div>
        </div>

        <!-- Tab Navigation -->
        <nav class="tab-nav">
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
      </div>
    </div>
  </div>
</header>

<style>
  .header-layout {
    display: flex;
    align-items: stretch;
    gap: 1.5rem;
  }

  .logo-container {
    display: flex;
    align-items: center;
    padding: 0.5rem 0;
  }

  .header-logo {
    height: 90px;
    width: auto;
  }

  .header-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 0.75rem;
  }

  .tagline {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.5);
    font-style: italic;
  }

  .hosted-by {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .hosted-text {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .tab-nav {
    margin-top: auto;
  }

  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  @media (max-width: 640px) {
    .header-layout {
      flex-direction: column;
      gap: 0.5rem;
    }

    .logo-container {
      justify-content: center;
    }

    .header-logo {
      height: 60px;
    }

    .header-top {
      flex-direction: column;
      gap: 0.5rem;
      text-align: center;
    }

    .tagline {
      display: none;
    }
  }
</style>
