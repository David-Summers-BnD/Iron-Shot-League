<script>
  import { onMount, onDestroy } from 'svelte';
  import PlayerInput from '../components/PlayerInput.svelte';
  import { createLadder, processChallenge, getAvailableTargets } from '../lib/ladder.js';
  import { tournaments, createTournament, updateTournament } from '../stores/tournaments.js';
  import { saveTournaments } from '../lib/storage.js';

  let players = [];
  let tournamentName = '';
  let maxRungs = 3;
  let randomizeStart = true;
  let ladder = null;
  let currentTournament = null;
  let challenges = [];

  // Challenge modal state
  let showChallenge = false;
  let challenger = null;
  let defender = null;
  let challengeWinner = null;

  // View state
  let view = 'setup';
  let isFullscreen = false;
  let gameContainer;

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      gameContainer?.requestFullscreen();
      isFullscreen = true;
    } else {
      document.exitFullscreen();
      isFullscreen = false;
    }
  }

  function handleFullscreenChange() {
    isFullscreen = !!document.fullscreenElement;
  }

  onMount(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
  });

  onDestroy(() => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
  });

  function handlePlayersChange(e) {
    players = e.detail;
  }

  function startTournament() {
    if (players.length < 2) return;

    const name = tournamentName.trim() || `Ladder - ${new Date().toLocaleDateString()}`;
    ladder = createLadder(players, randomizeStart);

    currentTournament = createTournament('ladder', name, players, { maxRungs });
    updateTournament(currentTournament.id, {
      status: 'in_progress',
      ladder,
      challenges: []
    });

    view = 'ladder';
    saveData();
  }

  function initiateChallenge(challengerPlayer) {
    challenger = challengerPlayer;
    showChallenge = true;
  }

  function selectDefender(defenderPlayer) {
    defender = defenderPlayer;
  }

  function submitChallenge() {
    if (!challenger || !defender || !challengeWinner) return;

    const challengerWins = challengeWinner === 'challenger';

    ladder = processChallenge(ladder, challenger.rank, defender.rank, challengerWins);

    challenges = [...challenges, {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      challenger: challenger.player,
      defender: defender.player,
      winner: challengeWinner === 'challenger' ? challenger.player : defender.player,
      challengerRank: challenger.rank,
      defenderRank: defender.rank,
      swapped: challengerWins
    }];

    updateTournament(currentTournament.id, {
      ladder,
      challenges
    });

    saveData();
    closeChallenge();
  }

  function closeChallenge() {
    showChallenge = false;
    challenger = null;
    defender = null;
    challengeWinner = null;
  }

  async function saveData() {
    await saveTournaments($tournaments);
  }

  function resetTournament() {
    players = [];
    tournamentName = '';
    ladder = null;
    currentTournament = null;
    challenges = [];
    view = 'setup';
  }

  $: availableTargets = challenger ? getAvailableTargets(ladder, challenger.rank, maxRungs) : [];
</script>

<div class="page-container">
  {#if view === 'setup'}
    <!-- Setup Screen -->
    <div class="setup-screen">
      <h1 class="setup-title">Ladder Tournament</h1>
      <p class="setup-subtitle">Climb the ranks by challenging players above you. Win to swap positions!</p>

      <div class="setup-form">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Tournament Name</label>
            <input
              type="text"
              bind:value={tournamentName}
              class="form-input"
              placeholder="King of the Hill"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Max Rungs to Challenge</label>
            <select bind:value={maxRungs} class="form-input">
              <option value={2}>2 rungs</option>
              <option value={3}>3 rungs (recommended)</option>
              <option value={4}>4 rungs</option>
              <option value={5}>5 rungs</option>
            </select>
          </div>
        </div>

        <div class="checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={randomizeStart} class="form-checkbox" />
            <span>Randomize starting positions</span>
          </label>
        </div>

        <PlayerInput
          {players}
          minPlayers={2}
          maxPlayers={50}
          on:change={handlePlayersChange}
        />

        <button
          class="start-btn"
          disabled={players.length < 2}
          on:click={startTournament}
        >
          Create Ladder
        </button>
      </div>
    </div>
  {:else}
    <!-- Ladder Screen - Full Screen -->
    <div class="game-fullscreen" class:is-fullscreen={isFullscreen} bind:this={gameContainer}>
      <!-- Top Bar -->
      <div class="top-bar">
        <div class="top-left">
          <h1 class="game-title">{currentTournament?.name || 'Ladder'}</h1>
          <span class="game-meta">{ladder?.length} players • {maxRungs} rungs max</span>
        </div>

        <div class="top-center">
          <div class="challenges-count">
            <span class="count-num">{challenges.length}</span>
            <span class="count-label">matches played</span>
          </div>
        </div>

        <div class="top-right">
          <button class="fullscreen-btn" on:click={toggleFullscreen}>
            {#if isFullscreen}
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
              </svg>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
            {/if}
          </button>
          <button class="end-btn" on:click={resetTournament}>Exit</button>
        </div>
      </div>

      <!-- Ladder Display -->
      <div class="ladder-area">
        <div class="ladder-list">
          {#each ladder as entry, index}
            <button
              class="ladder-entry"
              class:leader={index === 0}
              class:can-challenge={entry.rank < ladder.length}
              on:click={() => entry.rank < ladder.length && initiateChallenge(entry)}
              disabled={entry.rank === 1}
            >
              <div class="rank-badge" class:leader={index === 0}>
                {#if index === 0}
                  👑
                {:else}
                  {entry.rank}
                {/if}
              </div>

              <div class="player-info">
                <span class="player-name" class:leader={index === 0}>{entry.player}</span>
                <div class="player-stats">
                  <span class="stat win">{entry.wins}W</span>
                  <span class="stat loss">{entry.losses}L</span>
                  {#if entry.challenges > 0}
                    <span class="stat challenges">{entry.challenges} challenges</span>
                  {/if}
                </div>
              </div>

              {#if entry.rank < ladder.length}
                <div class="challenge-badge">Challenge ↑</div>
              {/if}
            </button>
          {/each}
        </div>

        <!-- Recent Challenges -->
        {#if challenges.length > 0}
          <div class="history-section">
            <h3 class="history-title">Recent Matches</h3>
            <div class="history-list">
              {#each challenges.slice().reverse().slice(0, 8) as challenge}
                <div class="history-entry">
                  <span class="history-players">
                    <span class="h-challenger">{challenge.challenger}</span>
                    <span class="h-vs">vs</span>
                    <span class="h-defender">{challenge.defender}</span>
                  </span>
                  <span class="history-result" class:swapped={challenge.swapped}>
                    {challenge.winner} won {challenge.swapped ? '⇅' : ''}
                  </span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer hint -->
      <div class="footer-hint">
        Tap a player to challenge someone above them (within {maxRungs} rungs)
      </div>
    </div>

    <!-- Challenge Modal -->
    {#if showChallenge}
      <div class="modal-overlay" on:click={closeChallenge}>
        <div class="modal-content" on:click|stopPropagation>
          <h3 class="modal-title">Challenge Match</h3>

          {#if !defender}
            <div class="challenger-info">
              <span class="challenger-name">{challenger?.player}</span>
              <span class="challenger-rank">(Rank #{challenger?.rank})</span>
              <span class="challenger-text">is challenging...</span>
            </div>

            <p class="target-hint">Select opponent (up to {maxRungs} rungs above):</p>

            <div class="target-list">
              {#each availableTargets as target}
                <button class="target-btn" on:click={() => selectDefender(target)}>
                  <span class="target-name">{target.player}</span>
                  <span class="target-rank">Rank #{target.rank}</span>
                </button>
              {/each}
            </div>
          {:else}
            <div class="matchup-display">
              <span class="m-challenger">{challenger.player}</span>
              <span class="m-vs">vs</span>
              <span class="m-defender">{defender.player}</span>
            </div>

            <p class="winner-prompt">Who won the match?</p>

            <div class="winner-buttons">
              <button
                class="winner-btn challenger"
                class:selected={challengeWinner === 'challenger'}
                on:click={() => challengeWinner = 'challenger'}
              >
                <span class="w-name">{challenger.player}</span>
                <span class="w-hint">(Swap positions)</span>
              </button>
              <button
                class="winner-btn defender"
                class:selected={challengeWinner === 'defender'}
                on:click={() => challengeWinner = 'defender'}
              >
                <span class="w-name">{defender.player}</span>
                <span class="w-hint">(Stay in place)</span>
              </button>
            </div>
          {/if}

          <div class="modal-actions">
            <button class="cancel-btn" on:click={closeChallenge}>Cancel</button>
            {#if defender && challengeWinner}
              <button class="submit-btn" on:click={submitChallenge}>Submit Result</button>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .page-container {
    height: 100%;
    overflow: hidden;
  }

  /* Setup Screen */
  .setup-screen {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
  }

  .setup-title {
    font-size: 3rem;
    font-weight: bold;
    background: linear-gradient(135deg, #ff6600, #ff9933);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 0.5rem;
  }

  .setup-subtitle {
    color: rgba(255, 255, 255, 0.6);
    font-size: 1.1rem;
    margin-bottom: 2rem;
  }

  .setup-form {
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    padding: 2rem;
    text-align: left;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  @media (max-width: 640px) {
    .form-grid { grid-template-columns: 1fr; }
  }

  .form-group { text-align: left; }

  .form-label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: white;
  }

  .form-input {
    width: 100%;
    padding: 0.75rem 1rem;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.5rem;
    color: white;
    font-size: 1rem;
  }

  .form-input:focus {
    outline: none;
    border-color: #ff6600;
  }

  .checkbox-group { margin-bottom: 1.5rem; }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.8);
  }

  .form-checkbox {
    width: 1.25rem;
    height: 1.25rem;
    accent-color: #ff6600;
  }

  .start-btn {
    width: 100%;
    padding: 1rem;
    margin-top: 1rem;
    background: linear-gradient(135deg, #ff6600, #ff9933);
    border: none;
    border-radius: 0.75rem;
    color: white;
    font-size: 1.2rem;
    font-weight: bold;
    cursor: pointer;
  }

  .start-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ========== FULL SCREEN GAME ========== */
  .game-fullscreen {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 180px);
    padding: 0.5rem;
    overflow: hidden;
  }

  .game-fullscreen.is-fullscreen {
    height: 100vh;
    padding: 1rem;
    background: #0f172a;
  }

  /* Top Bar */
  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 0.75rem;
    margin-bottom: 0.5rem;
    flex-shrink: 0;
  }

  .top-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .game-title {
    font-size: 1.5rem;
    font-weight: bold;
    color: #ff9933;
    margin: 0;
  }

  .game-meta {
    color: rgba(255, 255, 255, 0.5);
  }

  .top-center {
    display: flex;
    justify-content: center;
  }

  .challenges-count {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .count-num {
    font-size: 1.5rem;
    font-weight: bold;
    color: #ff9933;
  }

  .count-label {
    color: rgba(255, 255, 255, 0.5);
  }

  .top-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .fullscreen-btn {
    padding: 0.5rem;
    background: rgba(255, 102, 0, 0.2);
    border: 1px solid rgba(255, 102, 0, 0.5);
    border-radius: 0.5rem;
    color: #ff9933;
    cursor: pointer;
    display: flex;
  }

  .fullscreen-btn:hover {
    background: rgba(255, 102, 0, 0.4);
  }

  .end-btn {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid rgba(239, 68, 68, 0.5);
    border-radius: 0.5rem;
    color: #ef4444;
    cursor: pointer;
  }

  /* ========== LADDER AREA ========== */
  .ladder-area {
    flex: 1;
    overflow: auto;
    padding: 0.5rem;
    display: flex;
    gap: 1rem;
  }

  .ladder-list {
    flex: 2;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .ladder-entry {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: rgba(30, 41, 59, 0.8);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }

  .ladder-entry:hover:not(:disabled) {
    border-color: #ff6600;
    transform: translateX(5px);
  }

  .ladder-entry:disabled {
    cursor: default;
  }

  .ladder-entry.leader {
    background: linear-gradient(135deg, rgba(255, 102, 0, 0.2), rgba(255, 153, 51, 0.1));
    border-color: #ff6600;
  }

  .rank-badge {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 1.25rem;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    flex-shrink: 0;
  }

  .rank-badge.leader {
    background: linear-gradient(135deg, #ff6600, #ff9933);
    font-size: 1.5rem;
  }

  .player-info {
    flex: 1;
  }

  .player-name {
    font-weight: bold;
    font-size: 1.2rem;
    color: white;
    display: block;
    margin-bottom: 0.25rem;
  }

  .player-name.leader {
    color: #ff9933;
  }

  .player-stats {
    display: flex;
    gap: 0.75rem;
    font-size: 0.875rem;
  }

  .stat { color: rgba(255, 255, 255, 0.5); }
  .stat.win { color: #22c55e; }
  .stat.loss { color: #ef4444; }

  .challenge-badge {
    padding: 0.375rem 0.75rem;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 1rem;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.6);
  }

  /* History Section */
  .history-section {
    flex: 1;
    background: rgba(30, 41, 59, 0.6);
    border-radius: 1rem;
    padding: 1rem;
    max-width: 350px;
  }

  .history-title {
    font-size: 1rem;
    font-weight: bold;
    color: white;
    margin-bottom: 0.75rem;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .history-entry {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 0.5rem;
    font-size: 0.85rem;
  }

  .history-players {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .h-challenger { color: #42a5f5; font-weight: 600; }
  .h-vs { color: rgba(255, 255, 255, 0.3); }
  .h-defender { color: #ef5350; font-weight: 600; }

  .history-result {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.75rem;
  }

  .history-result.swapped {
    color: #ff9933;
  }

  /* Footer */
  .footer-hint {
    text-align: center;
    padding: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  /* ========== MODAL ========== */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .modal-content {
    background: linear-gradient(135deg, #1e293b, #0f172a);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    padding: 2rem;
    max-width: 450px;
    width: 90%;
  }

  .modal-title {
    text-align: center;
    font-size: 1.5rem;
    font-weight: bold;
    color: white;
    margin-bottom: 1.5rem;
  }

  .challenger-info {
    text-align: center;
    margin-bottom: 1rem;
  }

  .challenger-name {
    font-weight: bold;
    color: #ff9933;
    font-size: 1.25rem;
  }

  .challenger-rank {
    color: rgba(255, 255, 255, 0.6);
    margin-left: 0.5rem;
  }

  .challenger-text {
    display: block;
    color: rgba(255, 255, 255, 0.6);
    margin-top: 0.25rem;
  }

  .target-hint {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.875rem;
    margin-bottom: 1rem;
    text-align: center;
  }

  .target-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .target-btn {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: rgba(15, 23, 42, 0.8);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
  }

  .target-btn:hover {
    border-color: #ff6600;
    background: rgba(255, 102, 0, 0.1);
  }

  .target-name {
    font-weight: 600;
    color: white;
  }

  .target-rank {
    padding: 0.25rem 0.5rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 0.25rem;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .matchup-display {
    text-align: center;
    font-size: 1.25rem;
    font-weight: bold;
    margin-bottom: 1rem;
  }

  .m-challenger { color: #42a5f5; }
  .m-vs { color: rgba(255, 255, 255, 0.3); margin: 0 0.5rem; }
  .m-defender { color: #ef5350; }

  .winner-prompt {
    text-align: center;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .winner-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .winner-btn {
    padding: 1rem;
    border-radius: 0.75rem;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
  }

  .winner-btn.challenger {
    background: rgba(66, 165, 245, 0.2);
    border-color: rgba(66, 165, 245, 0.3);
  }

  .winner-btn.defender {
    background: rgba(239, 83, 80, 0.2);
    border-color: rgba(239, 83, 80, 0.3);
  }

  .winner-btn.challenger.selected {
    border-color: #42a5f5;
    background: rgba(66, 165, 245, 0.3);
  }

  .winner-btn.defender.selected {
    border-color: #ef5350;
    background: rgba(239, 83, 80, 0.3);
  }

  .w-name {
    display: block;
    font-weight: bold;
    color: white;
    margin-bottom: 0.25rem;
  }

  .w-hint {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
  }

  .cancel-btn {
    flex: 1;
    padding: 0.75rem;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 0.5rem;
    color: white;
    font-size: 1rem;
    cursor: pointer;
  }

  .cancel-btn:hover { background: rgba(255, 255, 255, 0.1); }

  .submit-btn {
    flex: 1;
    padding: 0.75rem;
    background: linear-gradient(135deg, #ff6600, #ff9933);
    border: none;
    border-radius: 0.5rem;
    color: white;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .ladder-area { flex-direction: column; }
    .history-section { max-width: none; }
    .top-bar { flex-wrap: wrap; gap: 0.5rem; }
  }
</style>
