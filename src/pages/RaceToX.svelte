<script>
  import { tournaments, createTournament, updateTournament } from '../stores/tournaments.js';
  import { saveTournaments } from '../lib/storage.js';

  // Setup state
  let player1Name = 'Player 1';
  let player2Name = 'Player 2';
  let raceTo = 11;
  let raceOptions = [5, 7, 9, 11, 13, 15];

  // Game state
  let gameActive = false;
  let score1 = 0;
  let score2 = 0;
  let winner = null;
  let showWinner = false;

  // Animation state
  let panel1Pulse = false;
  let panel2Pulse = false;

  function startRace() {
    gameActive = true;
    score1 = 0;
    score2 = 0;
    winner = null;
    showWinner = false;
  }

  function incrementScore(player) {
    if (winner) return;

    if (player === 1) {
      score1++;
      panel1Pulse = true;
      setTimeout(() => panel1Pulse = false, 300);

      if (score1 >= raceTo) {
        winner = player1Name;
        showWinner = true;
      }
    } else {
      score2++;
      panel2Pulse = true;
      setTimeout(() => panel2Pulse = false, 300);

      if (score2 >= raceTo) {
        winner = player2Name;
        showWinner = true;
      }
    }
  }

  function decrementScore(player, event) {
    event.stopPropagation();
    if (winner) return;

    if (player === 1 && score1 > 0) {
      score1--;
    } else if (player === 2 && score2 > 0) {
      score2--;
    }
  }

  function endRace() {
    gameActive = false;
    score1 = 0;
    score2 = 0;
    winner = null;
    showWinner = false;
  }

  function newRace() {
    score1 = 0;
    score2 = 0;
    winner = null;
    showWinner = false;
  }
</script>

{#if !gameActive}
  <!-- Setup Screen -->
  <div class="race-setup">
    <div class="setup-header">
      <h1 class="race-title">Race to <span class="race-number">{raceTo}</span></h1>
      <p class="race-subtitle">Tap player panels to increment score</p>
    </div>

    <div class="setup-form">
      <div class="form-row">
        <div class="form-group">
          <label for="player1">Player 1</label>
          <input
            type="text"
            id="player1"
            bind:value={player1Name}
            placeholder="Enter name"
          />
        </div>
        <div class="form-group">
          <label for="player2">Player 2</label>
          <input
            type="text"
            id="player2"
            bind:value={player2Name}
            placeholder="Enter name"
          />
        </div>
      </div>

      <div class="form-group">
        <label>Race to</label>
        <div class="race-selector">
          {#each raceOptions as option}
            <button
              class="race-btn {raceTo === option ? 'active' : ''}"
              on:click={() => raceTo = option}
            >
              {option}
            </button>
          {/each}
        </div>
      </div>

      <button class="start-btn" on:click={startRace}>
        Start Race
      </button>
    </div>
  </div>
{:else}
  <!-- Game Screen -->
  <div class="race-game">
    <div class="race-header">
      <span class="race-title-small">Race to {raceTo}</span>
      <button class="end-btn" on:click={endRace}>End</button>
    </div>

    <div class="score-panels">
      <!-- Player 1 Panel -->
      <button
        class="player-panel player1 {panel1Pulse ? 'pulse' : ''} {winner === player1Name ? 'winner' : ''} {winner && winner !== player1Name ? 'loser' : ''}"
        on:click={() => incrementScore(1)}
      >
        <div class="player-name">{player1Name}</div>
        <div class="player-score">{score1}</div>
        <div class="player-target">of {raceTo}</div>
        {#if score1 > 0 && !winner}
          <button class="undo-btn" on:click={(e) => decrementScore(1, e)}>-1</button>
        {/if}
      </button>

      <!-- Player 2 Panel -->
      <button
        class="player-panel player2 {panel2Pulse ? 'pulse' : ''} {winner === player2Name ? 'winner' : ''} {winner && winner !== player2Name ? 'loser' : ''}"
        on:click={() => incrementScore(2)}
      >
        <div class="player-name">{player2Name}</div>
        <div class="player-score">{score2}</div>
        <div class="player-target">of {raceTo}</div>
        {#if score2 > 0 && !winner}
          <button class="undo-btn" on:click={(e) => decrementScore(2, e)}>-1</button>
        {/if}
      </button>
    </div>

    <!-- Winner Modal -->
    {#if showWinner}
      <div class="winner-overlay">
        <div class="winner-content">
          <div class="winner-trophy">🏆</div>
          <div class="winner-label">Winner!</div>
          <div class="winner-name">{winner}</div>
          <div class="winner-score">{score1} - {score2}</div>
          <button class="new-race-btn" on:click={newRace}>New Race</button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Setup Screen */
  .race-setup {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
  }

  .setup-header {
    text-align: center;
    margin-bottom: 3rem;
  }

  .race-title {
    font-size: 3rem;
    font-weight: bold;
    background: linear-gradient(135deg, #ff6600, #ff9933);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 0.5rem;
  }

  .race-number {
    background: linear-gradient(135deg, #ff6600, #ff9933);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .race-subtitle {
    color: oklch(var(--bc) / 0.6);
    font-size: 1.1rem;
  }

  .setup-form {
    background: oklch(var(--b2));
    border: 1px solid oklch(var(--b3));
    border-radius: 20px;
    padding: 2rem;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: oklch(var(--bc) / 0.6);
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .form-group input {
    width: 100%;
    padding: 0.75rem;
    background: oklch(var(--b3));
    border: 1px solid oklch(var(--bc) / 0.2);
    border-radius: 10px;
    color: oklch(var(--bc));
    font-size: 1rem;
    transition: all 0.3s;
  }

  .form-group input:focus {
    outline: none;
    border-color: #ff6600;
    box-shadow: 0 0 20px rgba(255, 102, 0, 0.3);
  }

  .race-selector {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.5rem;
  }

  .race-btn {
    padding: 0.75rem;
    background: oklch(var(--b3));
    border: 1px solid oklch(var(--bc) / 0.2);
    border-radius: 10px;
    color: oklch(var(--bc));
    font-size: 1.1rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s;
  }

  .race-btn:hover {
    background: oklch(var(--b3) / 0.8);
    transform: translateY(-2px);
  }

  .race-btn.active {
    background: linear-gradient(135deg, #ff6600, #ff9933);
    border-color: transparent;
    color: white;
    box-shadow: 0 5px 20px rgba(255, 102, 0, 0.4);
  }

  .start-btn {
    width: 100%;
    padding: 1rem;
    margin-top: 1rem;
    background: linear-gradient(135deg, #ff6600, #ff9933);
    border: none;
    border-radius: 15px;
    color: white;
    font-size: 1.2rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 5px 20px rgba(255, 102, 0, 0.3);
  }

  .start-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(255, 102, 0, 0.5);
  }

  /* Game Screen */
  .race-game {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 20px;
    box-sizing: border-box;
    background: oklch(var(--b1));
    z-index: 100;
  }

  .race-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1.5rem;
    background: oklch(var(--b2));
    border-radius: 15px;
    margin-bottom: 1rem;
    flex-shrink: 0;
  }

  .race-title-small {
    font-size: 1.5rem;
    font-weight: bold;
    color: oklch(var(--bc));
  }

  .end-btn {
    padding: 0.5rem 1.5rem;
    background: rgba(255, 0, 0, 0.2);
    border: 1px solid rgba(255, 0, 0, 0.3);
    border-radius: 10px;
    color: #ff6666;
    cursor: pointer;
    transition: all 0.3s;
  }

  .end-btn:hover {
    background: rgba(255, 0, 0, 0.3);
    transform: scale(1.05);
  }

  /* Score Panels */
  .score-panels {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    width: 100%;
    min-height: 0;
  }

  .player-panel {
    position: relative;
    border: none;
    border-radius: 30px;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    transition: all 0.3s;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .player-panel.player1 {
    background: linear-gradient(135deg,
      rgba(66, 165, 245, 0.4),
      rgba(33, 150, 243, 0.2),
      rgba(13, 71, 161, 0.3));
    border: 2px solid rgba(66, 165, 245, 0.4);
    box-shadow:
      0 10px 40px rgba(66, 165, 245, 0.2),
      inset 0 2px 10px rgba(255, 255, 255, 0.1);
  }

  .player-panel.player2 {
    background: linear-gradient(135deg,
      rgba(239, 83, 80, 0.4),
      rgba(229, 57, 53, 0.2),
      rgba(183, 28, 28, 0.3));
    border: 2px solid rgba(239, 83, 80, 0.4);
    box-shadow:
      0 10px 40px rgba(239, 83, 80, 0.2),
      inset 0 2px 10px rgba(255, 255, 255, 0.1);
  }

  .player-panel:hover {
    transform: translateY(-5px) scale(1.02);
  }

  .player-panel:active {
    transform: translateY(-2px) scale(1.01);
  }

  .player-panel.pulse {
    animation: scorePulse 0.3s ease;
  }

  @keyframes scorePulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }

  .player-name {
    font-size: 2.5rem;
    font-weight: 900;
    color: #ffffff;
    margin-bottom: 1rem;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 3px;
    text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.7);
  }

  .player-score {
    font-size: 8rem;
    font-weight: bold;
    line-height: 1;
    margin: 1rem 0;
    background: linear-gradient(135deg, #ff6600, #ff9933);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .player-target {
    font-size: 1.5rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .undo-btn {
    position: absolute;
    bottom: 1rem;
    right: 1rem;
    padding: 0.5rem 1rem;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .undo-btn:hover {
    background: rgba(0, 0, 0, 0.5);
    color: white;
  }

  .player-panel.winner {
    background: linear-gradient(135deg,
      rgba(76, 175, 80, 0.5),
      rgba(56, 142, 60, 0.3),
      rgba(27, 94, 32, 0.4)) !important;
    border-color: rgba(76, 175, 80, 0.6) !important;
    animation: winnerGlow 1s ease infinite alternate;
  }

  @keyframes winnerGlow {
    from { box-shadow: 0 10px 40px rgba(76, 175, 80, 0.3); }
    to { box-shadow: 0 15px 60px rgba(76, 175, 80, 0.6); }
  }

  .player-panel.loser {
    opacity: 0.5;
    filter: grayscale(0.5);
  }

  /* Winner Modal */
  .winner-overlay {
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
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .winner-content {
    background: linear-gradient(135deg, rgba(30, 35, 45, 0.95), rgba(20, 25, 30, 0.95));
    border: 2px solid rgba(255, 102, 0, 0.3);
    border-radius: 30px;
    padding: 3rem;
    text-align: center;
    max-width: 500px;
    animation: slideUp 0.5s ease;
  }

  @keyframes slideUp {
    from {
      transform: translateY(50px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .winner-trophy {
    font-size: 5rem;
    margin-bottom: 1rem;
  }

  .winner-label {
    font-size: 2rem;
    background: linear-gradient(135deg, #ffd700, #ffed4e);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 0.5rem;
    font-weight: bold;
  }

  .winner-name {
    font-size: 2.5rem;
    color: white;
    font-weight: bold;
    margin-bottom: 0.5rem;
  }

  .winner-score {
    font-size: 1.5rem;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 2rem;
  }

  .new-race-btn {
    padding: 1rem 3rem;
    background: linear-gradient(135deg, #ff6600, #ff9933);
    border: none;
    border-radius: 15px;
    color: white;
    font-size: 1.1rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s;
  }

  .new-race-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 5px 20px rgba(255, 102, 0, 0.5);
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
    }

    .race-selector {
      grid-template-columns: repeat(3, 1fr);
    }

    .score-panels {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 10px;
    }

    .player-panel {
      padding: 1.5rem;
    }

    .player-score {
      font-size: 5rem;
    }

    .player-name {
      font-size: 1.8rem;
      letter-spacing: 2px;
    }

    .race-title {
      font-size: 2.5rem;
    }
  }
</style>
