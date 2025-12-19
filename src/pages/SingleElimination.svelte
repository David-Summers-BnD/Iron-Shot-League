<script>
  import PlayerInput from '../components/PlayerInput.svelte';
  import { generateSingleElimination, updateMatch, isBracketComplete, getBracketWinner } from '../lib/brackets.js';
  import { tournaments, createTournament, updateTournament } from '../stores/tournaments.js';
  import { saveTournaments } from '../lib/storage.js';

  let players = [];
  let tournamentName = '';
  let seeded = false;
  let bracket = null;
  let currentTournament = null;

  // Modal state
  let modalOpen = false;
  let selectedMatch = null;
  let modalScore1 = 0;
  let modalScore2 = 0;

  // View state
  let view = 'setup';

  function handlePlayersChange(e) {
    players = e.detail;
  }

  function startTournament() {
    if (players.length < 2) return;

    const name = tournamentName.trim() || `Single Elimination - ${new Date().toLocaleDateString()}`;
    bracket = generateSingleElimination(players, seeded);

    currentTournament = createTournament('single-elimination', name, players, { seeded });
    updateTournament(currentTournament.id, {
      status: 'in_progress',
      bracket
    });

    view = 'bracket';
    saveData();
  }

  function openScoreModal(match) {
    if (match.player1 === 'BYE' || match.player2 === 'BYE') return;
    if (!match.player1 || !match.player2) return;

    selectedMatch = match;
    modalScore1 = match.score1 || 0;
    modalScore2 = match.score2 || 0;
    modalOpen = true;
  }

  function closeModal() {
    modalOpen = false;
    selectedMatch = null;
  }

  function submitScore() {
    if (!selectedMatch || modalScore1 === modalScore2) return;

    const winner = modalScore1 > modalScore2 ? 'player1' : 'player2';
    bracket = updateMatch(bracket, selectedMatch.id, modalScore1, modalScore2, winner);

    if (currentTournament) {
      const isComplete = isBracketComplete(bracket);
      updateTournament(currentTournament.id, {
        bracket,
        status: isComplete ? 'completed' : 'in_progress'
      });
    }

    saveData();
    closeModal();
  }

  async function saveData() {
    await saveTournaments($tournaments);
  }

  function resetTournament() {
    players = [];
    tournamentName = '';
    bracket = null;
    currentTournament = null;
    view = 'setup';
  }

  $: winner = bracket ? getBracketWinner(bracket) : null;
</script>

{#if view === 'setup'}
  <!-- Setup Screen -->
  <div class="setup-container">
    <div class="setup-header">
      <h1 class="setup-title">Single Elimination</h1>
      <p class="setup-subtitle">Lose once and you're out - fast bracket competition</p>
    </div>

    <div class="setup-form">
      <div class="form-group">
        <label for="tournamentName">Tournament Name</label>
        <input
          type="text"
          id="tournamentName"
          bind:value={tournamentName}
          placeholder="Championship Showdown"
        />
      </div>

      <div class="form-group checkbox-group">
        <label>
          <input type="checkbox" bind:checked={seeded} />
          <span>Use player order as seeding (top = #1 seed)</span>
        </label>
      </div>

      <PlayerInput
        {players}
        minPlayers={2}
        maxPlayers={64}
        on:change={handlePlayersChange}
      />

      <button
        class="start-btn"
        disabled={players.length < 2}
        on:click={startTournament}
      >
        Generate Bracket
      </button>
    </div>
  </div>
{:else}
  <!-- Bracket Screen -->
  <div class="bracket-screen">
    <div class="bracket-header">
      <div class="bracket-title-section">
        <span class="bracket-title">{currentTournament?.name || 'Single Elimination'}</span>
        <span class="bracket-subtitle">{bracket?.bracketSize} players</span>
      </div>
      <button class="end-btn" on:click={resetTournament}>End</button>
    </div>

    <!-- Winner Banner -->
    {#if winner}
      <div class="winner-banner">
        <span class="winner-trophy">🏆</span>
        <div>
          <div class="winner-label">Champion</div>
          <div class="winner-name">{winner}</div>
        </div>
      </div>
    {/if}

    <!-- Bracket Display -->
    <div class="bracket-container">
      <div class="bracket-rounds">
        {#each bracket.rounds as round, roundIndex}
          <div class="bracket-round">
            <h3 class="round-name">{round.name}</h3>
            <div class="round-matches" style="padding-top: {roundIndex * 40}px;">
              {#each round.matches as match}
                <button
                  class="bracket-match {match.completed ? 'completed' : ''} {!match.player1 || !match.player2 || match.player1 === 'BYE' || match.player2 === 'BYE' ? 'disabled' : ''}"
                  on:click={() => openScoreModal(match)}
                  disabled={!match.player1 || !match.player2 || match.player1 === 'BYE' || match.player2 === 'BYE'}
                >
                  <div class="match-slot {match.winner === 'player1' ? 'winner' : ''} {match.player1 === 'BYE' ? 'bye' : ''}">
                    <span class="slot-name">{match.player1 || 'TBD'}</span>
                    {#if match.completed}<span class="slot-score">{match.score1}</span>{/if}
                  </div>
                  <div class="match-slot {match.winner === 'player2' ? 'winner' : ''} {match.player2 === 'BYE' ? 'bye' : ''}">
                    <span class="slot-name">{match.player2 || 'TBD'}</span>
                    {#if match.completed}<span class="slot-score">{match.score2}</span>{/if}
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Score Modal -->
  {#if modalOpen && selectedMatch}
    <div class="modal-overlay" on:click={closeModal}>
      <div class="modal-content" on:click|stopPropagation>
        <h3 class="modal-title">Enter Score</h3>

        <div class="score-entry">
          <div class="score-player">
            <span class="score-player-name">{selectedMatch.player1}</span>
            <div class="score-controls">
              <button class="score-btn" on:click={() => modalScore1 = Math.max(0, modalScore1 - 1)}>-</button>
              <span class="score-value">{modalScore1}</span>
              <button class="score-btn" on:click={() => modalScore1++}>+</button>
            </div>
          </div>

          <div class="score-vs">vs</div>

          <div class="score-player">
            <span class="score-player-name">{selectedMatch.player2}</span>
            <div class="score-controls">
              <button class="score-btn" on:click={() => modalScore2 = Math.max(0, modalScore2 - 1)}>-</button>
              <span class="score-value">{modalScore2}</span>
              <button class="score-btn" on:click={() => modalScore2++}>+</button>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="cancel-btn" on:click={closeModal}>Cancel</button>
          <button class="submit-btn" on:click={submitScore} disabled={modalScore1 === modalScore2}>Save</button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  /* Setup Screen */
  .setup-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
  }

  .setup-header {
    text-align: center;
    margin-bottom: 3rem;
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

  .form-group input[type="text"] {
    width: 100%;
    padding: 0.75rem;
    background: oklch(var(--b3));
    border: 1px solid oklch(var(--bc) / 0.2);
    border-radius: 10px;
    color: oklch(var(--bc));
    font-size: 1rem;
    transition: all 0.3s;
  }

  .form-group input[type="text"]:focus {
    outline: none;
    border-color: #ff6600;
    box-shadow: 0 0 20px rgba(255, 102, 0, 0.3);
  }

  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    text-transform: none;
  }

  .checkbox-group input[type="checkbox"] {
    width: 20px;
    height: 20px;
    accent-color: #ff6600;
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

  .start-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(255, 102, 0, 0.5);
  }

  .start-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Bracket Screen */
  .bracket-screen {
    max-width: 100%;
  }

  .bracket-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    background: oklch(var(--b2));
    border-radius: 15px;
    margin-bottom: 1rem;
  }

  .bracket-title-section {
    display: flex;
    flex-direction: column;
  }

  .bracket-title {
    font-size: 1.5rem;
    font-weight: bold;
    color: oklch(var(--bc));
  }

  .bracket-subtitle {
    font-size: 0.875rem;
    color: oklch(var(--bc) / 0.6);
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
  }

  /* Winner Banner */
  .winner-banner {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.1));
    border: 2px solid rgba(34, 197, 94, 0.4);
    border-radius: 15px;
    margin-bottom: 1rem;
  }

  .winner-trophy {
    font-size: 3rem;
  }

  .winner-label {
    font-size: 0.875rem;
    color: #22c55e;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .winner-name {
    font-size: 1.5rem;
    font-weight: bold;
    color: white;
  }

  /* Bracket */
  .bracket-container {
    overflow-x: auto;
    padding-bottom: 1rem;
  }

  .bracket-rounds {
    display: flex;
    gap: 2rem;
    min-width: max-content;
  }

  .bracket-round {
    min-width: 200px;
  }

  .round-name {
    text-align: center;
    font-size: 1rem;
    font-weight: bold;
    color: #ff6600;
    margin-bottom: 1rem;
  }

  .round-matches {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    gap: 1rem;
    min-height: 100%;
  }

  .bracket-match {
    background: oklch(var(--b2));
    border: 1px solid oklch(var(--b3));
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s;
  }

  .bracket-match:hover:not(.disabled) {
    border-color: #ff6600;
    transform: translateY(-2px);
  }

  .bracket-match.completed {
    border-color: #22c55e;
  }

  .bracket-match.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .match-slot {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid oklch(var(--b3));
  }

  .match-slot:last-child {
    border-bottom: none;
  }

  .match-slot.winner {
    background: rgba(34, 197, 94, 0.1);
  }

  .match-slot.winner .slot-name {
    color: #22c55e;
    font-weight: bold;
  }

  .match-slot.bye {
    opacity: 0.4;
    font-style: italic;
  }

  .slot-name {
    color: oklch(var(--bc));
  }

  .slot-score {
    font-weight: bold;
    color: oklch(var(--bc));
  }

  /* Modal */
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
    background: oklch(var(--b2));
    border: 1px solid oklch(var(--b3));
    border-radius: 20px;
    padding: 2rem;
    max-width: 400px;
    width: 90%;
  }

  .modal-title {
    text-align: center;
    font-size: 1.5rem;
    font-weight: bold;
    margin-bottom: 2rem;
    background: linear-gradient(135deg, #ff6600, #ff9933);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .score-entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .score-player {
    flex: 1;
    text-align: center;
  }

  .score-player-name {
    display: block;
    font-weight: 600;
    margin-bottom: 1rem;
    color: oklch(var(--bc));
  }

  .score-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  .score-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: linear-gradient(135deg, #ff6600, #ff9933);
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .score-btn:hover {
    transform: scale(1.1);
  }

  .score-value {
    font-size: 2.5rem;
    font-weight: bold;
    min-width: 60px;
    color: oklch(var(--bc));
  }

  .score-vs {
    color: oklch(var(--bc) / 0.4);
    font-size: 1.25rem;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
  }

  .cancel-btn {
    flex: 1;
    padding: 0.75rem;
    background: oklch(var(--b3));
    border: 1px solid oklch(var(--bc) / 0.2);
    border-radius: 10px;
    color: oklch(var(--bc));
    cursor: pointer;
  }

  .submit-btn {
    flex: 1;
    padding: 0.75rem;
    background: linear-gradient(135deg, #ff6600, #ff9933);
    border: none;
    border-radius: 10px;
    color: white;
    font-weight: bold;
    cursor: pointer;
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .score-entry {
      flex-direction: column;
    }

    .score-vs {
      margin: 1rem 0;
    }
  }
</style>
