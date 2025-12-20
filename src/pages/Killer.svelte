<script>
  import { onMount, onDestroy } from 'svelte';
  import PlayerInput from '../components/PlayerInput.svelte';
  import { createKillerGame, processTurn, getCurrentPlayer, getGameStats } from '../lib/killer.js';
  import { tournaments, createTournament, updateTournament } from '../stores/tournaments.js';
  import { saveTournaments } from '../lib/storage.js';

  let players = [];
  let tournamentName = '';
  let startingLives = 3;
  let gameState = null;
  let currentTournament = null;

  // View state
  let view = 'setup';
  let isFullscreen = false;
  let gameContainer;

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      gameContainer?.requestFullscreen();
    } else {
      document.exitFullscreen();
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

  function startGame() {
    if (players.length < 2) return;

    const name = tournamentName.trim() || `Killer - ${new Date().toLocaleDateString()}`;
    gameState = createKillerGame(players, startingLives);

    currentTournament = createTournament('killer', name, players, { startingLives });
    updateTournament(currentTournament.id, {
      status: 'in_progress',
      gameState
    });

    view = 'game';
    saveData();
  }

  function handleAction(action) {
    if (!gameState || gameState.gameOver) return;

    gameState = processTurn(gameState, action);

    updateTournament(currentTournament.id, {
      gameState,
      status: gameState.gameOver ? 'completed' : 'in_progress'
    });

    saveData();
  }

  async function saveData() {
    await saveTournaments($tournaments);
  }

  function resetGame() {
    players = [];
    tournamentName = '';
    gameState = null;
    currentTournament = null;
    view = 'setup';
  }

  function playAgain() {
    // Restart with same players
    gameState = createKillerGame(players, startingLives);
    updateTournament(currentTournament.id, {
      status: 'in_progress',
      gameState
    });
    saveData();
  }

  $: currentPlayer = gameState ? getCurrentPlayer(gameState) : null;
  $: stats = gameState ? getGameStats(gameState) : null;
</script>

<div class="page-container">
  {#if view === 'setup'}
    <!-- Setup Screen -->
    <div class="setup-screen">
      <h1 class="setup-title">Killer</h1>
      <p class="setup-subtitle">Last player standing wins! Miss a shot or foul to lose a life.</p>

      <div class="setup-form">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Game Name</label>
            <input
              type="text"
              bind:value={tournamentName}
              class="form-input"
              placeholder="Friday Night Killer"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Starting Lives</label>
            <select bind:value={startingLives} class="form-input">
              <option value={2}>2 lives</option>
              <option value={3}>3 lives (standard)</option>
              <option value={4}>4 lives</option>
              <option value={5}>5 lives</option>
            </select>
          </div>
        </div>

        <div class="rules-box">
          <h3>Rules</h3>
          <ul>
            <li><span class="rule-icon">❌</span> Miss a pot = Lose 1 life</li>
            <li><span class="rule-icon">⚠️</span> Foul = Lose 1 life</li>
            <li><span class="rule-icon">🎱</span> Pot the black = Gain 1 life</li>
            <li><span class="rule-icon">💀</span> 0 lives = Eliminated</li>
            <li><span class="rule-icon">🏆</span> Last standing = Winner!</li>
          </ul>
        </div>

        <PlayerInput
          {players}
          minPlayers={2}
          maxPlayers={20}
          on:change={handlePlayersChange}
        />

        <button
          class="start-btn"
          disabled={players.length < 2}
          on:click={startGame}
        >
          Start Game
        </button>
      </div>
    </div>
  {:else}
    <!-- Game Screen -->
    <div class="game-fullscreen" class:is-fullscreen={isFullscreen} bind:this={gameContainer}>
      <!-- Top Bar -->
      <div class="top-bar">
        <div class="top-left">
          <h1 class="game-title">{currentTournament?.name || 'Killer'}</h1>
          <span class="game-meta">💀 {stats?.activePlayers} alive • {stats?.turnsPlayed} turns</span>
        </div>

        <div class="top-center">
          {#if gameState?.gameOver}
            <div class="winner-badge">
              <span class="trophy">🏆</span>
              <span class="winner-name">{gameState.winner} WINS!</span>
            </div>
          {:else if currentPlayer}
            <div class="current-turn">
              <span class="turn-label">Current Turn</span>
              <span class="turn-name">{currentPlayer.name}</span>
            </div>
          {/if}
        </div>

        <div class="top-right">
          <button class="fullscreen-btn" on:click={toggleFullscreen} title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}>
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
          <button class="end-btn" on:click={resetGame}>Exit</button>
        </div>
      </div>

      <!-- Player List -->
      <div class="game-area">
        <div class="players-list">
          {#each gameState?.players || [] as player, index}
            <div
              class="player-card"
              class:current={currentPlayer?.name === player.name}
              class:eliminated={player.eliminated}
              class:winner={gameState?.winner === player.name}
            >
              <div class="player-info">
                <span class="player-rank">#{index + 1}</span>
                <span class="player-name">{player.name}</span>
              </div>
              <div class="player-lives">
                {#if player.eliminated}
                  <span class="eliminated-text">💀 ELIMINATED</span>
                {:else}
                  {#each Array(player.lives) as _}
                    <span class="life">❤️</span>
                  {/each}
                  {#if player.lives === 0}
                    <span class="no-lives">No lives</span>
                  {/if}
                {/if}
              </div>
              {#if currentPlayer?.name === player.name && !gameState?.gameOver}
                <div class="turn-indicator">▶ YOUR TURN</div>
              {/if}
            </div>
          {/each}
        </div>

        <!-- Action Buttons -->
        {#if !gameState?.gameOver}
          <div class="action-buttons">
            <button class="action-btn pot" on:click={() => handleAction('pot')}>
              <span class="action-icon">✓</span>
              <span class="action-label">Potted</span>
              <span class="action-desc">Next player</span>
            </button>

            <button class="action-btn miss" on:click={() => handleAction('miss')}>
              <span class="action-icon">❌</span>
              <span class="action-label">Missed / Foul</span>
              <span class="action-desc">-1 Life</span>
            </button>

            <button class="action-btn black" on:click={() => handleAction('black')}>
              <span class="action-icon">🎱</span>
              <span class="action-label">Potted Black</span>
              <span class="action-desc">+1 Life</span>
            </button>
          </div>
        {:else}
          <div class="game-over-actions">
            <button class="action-btn play-again" on:click={playAgain}>
              <span class="action-icon">🔄</span>
              <span class="action-label">Play Again</span>
              <span class="action-desc">Same players</span>
            </button>
          </div>
        {/if}
      </div>

      <!-- Footer hint -->
      <div class="footer-hint">
        {#if gameState?.gameOver}
          Game Over! {gameState.winner} is the last player standing!
        {:else}
          Tap an action after {currentPlayer?.name}'s shot
        {/if}
      </div>
    </div>
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
    background: linear-gradient(135deg, #ef4444, #f97316);
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
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .form-group {
    margin-bottom: 0;
  }

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
    border-color: #ef4444;
  }

  .rules-box {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 0.75rem;
    padding: 1rem 1.5rem;
    margin-bottom: 1.5rem;
  }

  .rules-box h3 {
    color: #ef4444;
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .rules-box ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .rules-box li {
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .rule-icon {
    font-size: 1rem;
  }

  .start-btn {
    width: 100%;
    padding: 1rem;
    margin-top: 1rem;
    background: linear-gradient(135deg, #ef4444, #f97316);
    border: none;
    border-radius: 0.75rem;
    color: white;
    font-size: 1.2rem;
    font-weight: bold;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .start-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);
  }

  .start-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ========== GAME SCREEN ========== */
  .game-fullscreen {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 180px);
    overflow: hidden;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  }

  .game-fullscreen.is-fullscreen {
    height: 100vh;
    padding: 0.5rem;
  }

  /* Top Bar */
  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: rgba(0, 0, 0, 0.4);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .top-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .game-title {
    font-size: 1.25rem;
    font-weight: bold;
    color: #ef4444;
    margin: 0;
  }

  .game-meta {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.9rem;
  }

  .top-center {
    flex: 1;
    display: flex;
    justify-content: center;
  }

  .current-turn {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5rem 1.5rem;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 0.75rem;
  }

  .turn-label {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .turn-name {
    font-size: 1.25rem;
    font-weight: bold;
    color: white;
  }

  .winner-badge {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(22, 163, 74, 0.2));
    border: 2px solid #22c55e;
    border-radius: 1rem;
    animation: pulse-winner 1s infinite;
  }

  @keyframes pulse-winner {
    0%, 100% { box-shadow: 0 0 10px rgba(34, 197, 94, 0.4); }
    50% { box-shadow: 0 0 25px rgba(34, 197, 94, 0.6); }
  }

  .trophy { font-size: 1.5rem; }
  .winner-name { font-size: 1.25rem; font-weight: bold; color: #22c55e; }

  .top-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .fullscreen-btn {
    padding: 0.5rem;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.5);
    border-radius: 0.5rem;
    color: #f87171;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .fullscreen-btn:hover {
    background: rgba(239, 68, 68, 0.4);
  }

  .end-btn {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 0.5rem;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
  }

  .end-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  /* Game Area */
  .game-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 1rem;
    overflow: auto;
    gap: 1rem;
  }

  /* Players List */
  .players-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 500px;
    margin: 0 auto;
    width: 100%;
  }

  .player-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.75rem;
    transition: all 0.2s;
    position: relative;
  }

  .player-card.current {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.15);
    box-shadow: 0 0 20px rgba(239, 68, 68, 0.3);
  }

  .player-card.eliminated {
    opacity: 0.4;
    border-style: dashed;
    border-color: rgba(255, 255, 255, 0.1);
  }

  .player-card.winner {
    border-color: #22c55e;
    background: rgba(34, 197, 94, 0.2);
    box-shadow: 0 0 20px rgba(34, 197, 94, 0.4);
  }

  .player-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .player-rank {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.4);
    width: 2rem;
  }

  .player-name {
    font-weight: 600;
    color: white;
    font-size: 1rem;
  }

  .player-lives {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }

  .life {
    font-size: 1.25rem;
  }

  .eliminated-text {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .no-lives {
    font-size: 0.8rem;
    color: #ef4444;
  }

  .turn-indicator {
    position: absolute;
    right: 1rem;
    font-size: 0.7rem;
    font-weight: bold;
    color: #ef4444;
    animation: blink 1s infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Action Buttons */
  .action-buttons, .game-over-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: auto;
    padding: 1rem 0;
  }

  .action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem 2rem;
    border-radius: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    border: 2px solid;
    min-width: 140px;
  }

  .action-btn.pot {
    background: rgba(34, 197, 94, 0.2);
    border-color: #22c55e;
    color: #86efac;
  }

  .action-btn.pot:hover {
    background: rgba(34, 197, 94, 0.3);
    transform: translateY(-2px);
  }

  .action-btn.miss {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
    color: #fca5a5;
  }

  .action-btn.miss:hover {
    background: rgba(239, 68, 68, 0.3);
    transform: translateY(-2px);
  }

  .action-btn.black {
    background: rgba(59, 130, 246, 0.2);
    border-color: #3b82f6;
    color: #93c5fd;
  }

  .action-btn.black:hover {
    background: rgba(59, 130, 246, 0.3);
    transform: translateY(-2px);
  }

  .action-btn.play-again {
    background: rgba(249, 115, 22, 0.2);
    border-color: #f97316;
    color: #fdba74;
  }

  .action-btn.play-again:hover {
    background: rgba(249, 115, 22, 0.3);
    transform: translateY(-2px);
  }

  .action-icon {
    font-size: 2rem;
    margin-bottom: 0.25rem;
  }

  .action-label {
    font-weight: bold;
    font-size: 1rem;
  }

  .action-desc {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  /* Footer */
  .footer-hint {
    text-align: center;
    padding: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.85rem;
    background: rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .form-grid {
      grid-template-columns: 1fr;
    }

    .rules-box ul {
      grid-template-columns: 1fr;
    }

    .action-btn {
      min-width: 100px;
      padding: 0.75rem 1rem;
    }

    .action-icon {
      font-size: 1.5rem;
    }

    .action-label {
      font-size: 0.85rem;
    }

    .top-bar {
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .game-title {
      font-size: 1rem;
    }
  }

  @media (max-width: 480px) {
    .setup-title {
      font-size: 2rem;
    }

    .action-buttons {
      flex-direction: column;
      align-items: stretch;
    }

    .action-btn {
      flex-direction: row;
      justify-content: flex-start;
      gap: 1rem;
      padding: 1rem;
    }

    .action-icon {
      font-size: 1.5rem;
      margin-bottom: 0;
    }
  }
</style>
