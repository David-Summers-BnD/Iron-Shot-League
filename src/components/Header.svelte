<script>
  import { currentTab, tournamentTypes } from '../stores/tournaments.js';

  function selectTab(id) {
    currentTab.set(id);
  }
</script>

<header class="bg-base-200 border-b border-base-300 sticky top-0 z-50">
  <div class="header-wrapper">
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
          <div class="tabs-scroll">
            {#each tournamentTypes as type}
              <button
                class="tab-btn"
                class:active={$currentTab === type.id}
                on:click={() => selectTab(type.id)}
              >
                <span class="tab-icon">{type.icon}</span>
                <span class="tab-name">{type.name}</span>
              </button>
            {/each}
          </div>
        </nav>
      </div>
    </div>
  </div>
</header>

<style>
  .header-wrapper {
    width: 100%;
    padding: 0 1rem;
  }

  .header-layout {
    display: flex;
    align-items: stretch;
    gap: 1rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .logo-container {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    padding: 0.5rem 0;
  }

  .header-logo {
    height: 80px;
    width: auto;
    object-fit: contain;
  }

  .header-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 0;
  }

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 0.5rem;
    gap: 1rem;
  }

  .tagline {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.5);
    font-style: italic;
    white-space: nowrap;
  }

  .hosted-by {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .hosted-text {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .tab-nav {
    margin-top: auto;
  }

  .tabs-scroll {
    display: flex;
    overflow-x: auto;
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .tabs-scroll::-webkit-scrollbar {
    display: none;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    white-space: nowrap;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    color: white;
    background: rgba(255, 255, 255, 0.05);
  }

  .tab-btn.active {
    color: #f97316;
    border-bottom-color: #f97316;
  }

  .tab-icon {
    font-size: 1rem;
  }

  .tab-name {
    font-size: 0.9rem;
  }

  /* Large screens */
  @media (min-width: 1200px) {
    .header-logo {
      height: 90px;
    }
  }

  /* Medium screens */
  @media (max-width: 1024px) {
    .header-logo {
      height: 70px;
    }

    .tab-btn {
      padding: 0.6rem 0.75rem;
    }

    .tab-name {
      font-size: 0.85rem;
    }
  }

  /* Small screens */
  @media (max-width: 768px) {
    .header-layout {
      gap: 0.75rem;
    }

    .header-logo {
      height: 60px;
    }

    .tagline {
      display: none;
    }

    .tab-btn {
      padding: 0.5rem 0.6rem;
    }

    .tab-name {
      font-size: 0.8rem;
    }

    .tab-icon {
      font-size: 0.9rem;
    }
  }

  /* Extra small screens */
  @media (max-width: 480px) {
    .header-layout {
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }

    .header-logo {
      height: 50px;
    }

    .header-top {
      justify-content: center;
    }

    .hosted-by {
      display: none;
    }

    .tab-btn {
      padding: 0.5rem;
    }

    .tab-name {
      display: none;
    }

    .tab-icon {
      font-size: 1.2rem;
    }
  }
</style>
