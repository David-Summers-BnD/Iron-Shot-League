<script>
  import { onMount } from 'svelte';
  import PlayerInput from '../components/PlayerInput.svelte';
  import { generateRoundRobinSchedule, calculateStandings, isRoundRobinComplete } from '../lib/roundrobin.js';
  import { tournaments, createTournament, updateTournament } from '../stores/tournaments.js';
  import { saveTournaments } from '../lib/storage.js';

  let players = [];
  let tournamentName = '';
  let currentTournament = null;
  let schedule = null;
  let standings = [];

  // Modal state
  let modalOpen = false;
  let selectedMatch = null;
  let modalScore1 = 0;
  let modalScore2 = 0;

  // View state
  let view = 'setup'; // 'setup' | 'schedule' | 'standings'
  let gameView = 'schedule'; // 'schedule' | 'standings'

  function handlePlayersChange(e) {
    players = e.detail;
  }

  function startTournament() {
    if (players.length < 2) return;

    const name = tournamentName.trim() || `Round Robin - ${new Date().toLocaleDateString()}`;
    schedule = generateRoundRobinSchedule(players);

    currentTournament = createTournament('round-robin', name, players, {});
    updateTournament(currentTournament.id, {
      status: 'in_progress',
      matches: schedule.matches,
      rounds: schedule.rounds
    });

    view = 'game';
    saveData();
  }

  function openScoreModal(match) {
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
    if (!selectedMatch) return;

    const winner = modalScore1 > modalScore2 ? 'player1' : modalScore2 > modalScore1 ? 'player2' : null;

    // Update match in schedule
    schedule.matches = schedule.matches.map(m => {
      if (m.id === selectedMatch.id) {
        return { ...m, score1: modalScore1, score2: modalScore2, winner, completed: true };
      }
      return m;
    });

    // Update rounds
    schedule.rounds = schedule.rounds.map(round => ({
      ...round,
      matches: round.matches.map(m => {
        if (m.id === selectedMatch.id) {
          return { ...m, score1: modalScore1, score2: modalScore2, winner, completed: true };
        }
        return m;
      })
    }));

    // Recalculate standings
    standings = calculateStandings(players, schedule.matches);

    // Update tournament
    if (currentTournament) {
      const isComplete = isRoundRobinComplete(schedule.matches);
      updateTournament(currentTournament.id, {
        matches: schedule.matches,
        rounds: schedule.rounds,
        standings,
        status: isComplete ? 'completed' : 'in_progress'
      });
    }

    saveData();
    closeModal();
  }

  async function saveData() {
    const allTournaments = $tournaments;
    await saveTournaments(allTournaments);
  }

  function resetTournament() {
    players = [];
    tournamentName = '';
    currentTournament = null;
    schedule = null;
    standings = [];
    view = 'setup';
  }

  $: if (schedule) {
    standings = calculateStandings(players, schedule.matches);
  }

  $: completedCount = schedule?.matches?.filter(m => m.completed).length || 0;
  $: totalMatches = schedule?.matches?.length || 0;
  $: progressPercent = totalMatches > 0 ? (completedCount / totalMatches) * 100 : 0;
  $: tournamentComplete = schedule ? isRoundRobinComplete(schedule.matches) : false;
</script>

{#if view === 'setup'}
  <!-- Setup Screen -->
  <div class="setup-container">
    <div class="setup-header">
      <h1 class="setup-title">Round Robin</h1>
      <p class="setup-subtitle">Everyone plays everyone - best for 4-12 players</p>
    </div>

    <div class="setup-form">
      <div class="form-group">
        <label for="tournamentName">Tournament Name</label>
        <input
          type="text"
          id="tournamentName"
          bind:value={tournamentName}
          placeholder="Friday Night Showdown"
        />
      </div>

      <PlayerInput
        {players}
        minPlayers={2}
        maxPlayers={16}
        on:change={handlePlayersChange}
      />

      <button
        class="start-btn"
        disabled={players.length < 2}
        on:click={startTournament}
      >
        Generate Schedule
      </button>
    </div>
  </div>
{:else}
  <!-- Game Screen -->
  <div class="game-screen">
    <div class="game-header">
      <div class="game-title-section">
        <span class="game-title">{currentTournament?.name || 'Round Robin'}</span>
        <span class="game-subtitle">{players.length} players</span>
      </div>
      <div class="game-actions">
        <button
          class="view-btn {gameView === 'schedule' ? 'active' : ''}"
          on:click={() => gameView = 'schedule'}
        >Matches</button>
        <button
          class="view-btn {gameView === 'standings' ? 'active' : ''}"
          on:click={() => gameView = 'standings'}
        >Standings</button>
        <button class="end-btn" on:click={resetTournament}>End</button>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="progress-section">
      <div class="progress-text">
        <span>{completedCount} of {totalMatches} matches</span>
        <span>{Math.round(progressPercent)}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {progressPercent}%"></div>
      </div>
    </div>

    <!-- Winner Banner -->
    {#if tournamentComplete && standings[0]}
      <div class="winner-banner">
        <span class="winner-trophy">🏆</span>
        <div>
          <div class="winner-label">Champion</div>
          <div class="winner-name">{standings[0].player}</div>
        </div>
      </div>
    {/if}

    {#if gameView === 'schedule'}
      <!-- Schedule View -->
      <div class="rounds-container">
        {#each schedule.rounds as round}
          <div class="round-card">
            <h3 class="round-title">Round {round.number}</h3>
            <div class="matches-grid">
              {#each round.matches as match}
                <button
                  class="match-card {match.completed ? 'completed' : ''}"
                  on:click={() => openScoreModal(match)}
                >
                  <div class="match-players">
                    <span class="player-name {match.winner === 'player1' ? 'winner' : ''}">{match.player1}</span>
                    <span class="vs">vs</span>
                    <span class="player-name {match.winner === 'player2' ? 'winner' : ''}">{match.player2}</span>
                  </div>
                  {#if match.completed}
                    <div class="match-score">
                      <span class="{match.winner === 'player1' ? 'winner' : ''}">{match.score1}</span>
                      <span>-</span>
                      <span class="{match.winner === 'player2' ? 'winner' : ''}">{match.score2}</span>
                    </div>
                  {:else}
                    <div class="match-pending">Tap to score</div>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <!-- Standings View -->
      <div class="standings-card">
        <table class="standings-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>P</th>
              <th>W</th>
              <th>L</th>
              <th>+/-</th>
            </tr>
          </thead>
          <tbody>
            {#each standings as stat, index}
              <tr class="{index === 0 ? 'leader' : ''}">
                <td class="rank">{index + 1}</td>
                <td class="player">{stat.player}</td>
                <td>{stat.played}</td>
                <td class="wins">{stat.wins}</td>
                <td class="losses">{stat.losses}</td>
                <td class="diff {stat.pointDiff > 0 ? 'positive' : stat.pointDiff < 0 ? 'negative' : ''}">{stat.pointDiff > 0 ? '+' : ''}{stat.pointDiff}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
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
          <button class="submit-btn" on:click={submitScore}>Save</button>
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

  /* Game Screen */
  .game-screen {
    max-width: 1200px;
    margin: 0 auto;
  }

  .game-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    background: oklch(var(--b2));
    border-radius: 15px;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .game-title-section {
    display: flex;
    flex-direction: column;
  }

  .game-title {
    font-size: 1.5rem;
    font-weight: bold;
    color: oklch(var(--bc));
  }

  .game-subtitle {
    font-size: 0.875rem;
    color: oklch(var(--bc) / 0.6);
  }

  .game-actions {
    display: flex;
    gap: 0.5rem;
  }

  .view-btn {
    padding: 0.5rem 1rem;
    background: oklch(var(--b3));
    border: 1px solid oklch(var(--bc) / 0.2);
    border-radius: 10px;
    color: oklch(var(--bc));
    cursor: pointer;
    transition: all 0.3s;
  }

  .view-btn.active {
    background: linear-gradient(135deg, #ff6600, #ff9933);
    border-color: transparent;
    color: white;
  }

  .end-btn {
    padding: 0.5rem 1rem;
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

  /* Progress */
  .progress-section {
    margin-bottom: 1rem;
  }

  .progress-text {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
    color: oklch(var(--bc) / 0.6);
    margin-bottom: 0.5rem;
  }

  .progress-bar {
    height: 8px;
    background: oklch(var(--b3));
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    border-radius: 4px;
    transition: width 0.3s;
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

  /* Rounds */
  .rounds-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .round-card {
    background: oklch(var(--b2));
    border-radius: 15px;
    padding: 1.5rem;
  }

  .round-title {
    font-size: 1.25rem;
    font-weight: bold;
    margin-bottom: 1rem;
    color: oklch(var(--bc));
  }

  .matches-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .match-card {
    background: oklch(var(--b3));
    border: 1px solid oklch(var(--bc) / 0.1);
    border-radius: 12px;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.3s;
    text-align: left;
  }

  .match-card:hover {
    transform: translateY(-2px);
    border-color: #ff6600;
  }

  .match-card.completed {
    border-color: #22c55e;
  }

  .match-players {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .match-players .player-name {
    font-weight: 600;
    color: oklch(var(--bc));
  }

  .match-players .player-name.winner {
    color: #22c55e;
  }

  .match-players .vs {
    color: oklch(var(--bc) / 0.4);
    font-size: 0.875rem;
  }

  .match-score {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    font-size: 1.5rem;
    font-weight: bold;
  }

  .match-score .winner {
    color: #22c55e;
  }

  .match-pending {
    text-align: center;
    color: oklch(var(--bc) / 0.4);
    font-size: 0.875rem;
  }

  /* Standings */
  .standings-card {
    background: oklch(var(--b2));
    border-radius: 15px;
    padding: 1.5rem;
    overflow-x: auto;
  }

  .standings-table {
    width: 100%;
    border-collapse: collapse;
  }

  .standings-table th,
  .standings-table td {
    padding: 0.75rem;
    text-align: center;
  }

  .standings-table th {
    color: oklch(var(--bc) / 0.6);
    font-size: 0.875rem;
    text-transform: uppercase;
    border-bottom: 1px solid oklch(var(--bc) / 0.1);
  }

  .standings-table td {
    color: oklch(var(--bc));
  }

  .standings-table .rank {
    font-weight: bold;
  }

  .standings-table .player {
    text-align: left;
    font-weight: 600;
  }

  .standings-table .wins {
    color: #22c55e;
  }

  .standings-table .losses {
    color: #ef4444;
  }

  .standings-table .diff.positive {
    color: #22c55e;
  }

  .standings-table .diff.negative {
    color: #ef4444;
  }

  .standings-table tr.leader {
    background: rgba(34, 197, 94, 0.1);
  }

  .standings-table tr.leader .rank {
    color: #22c55e;
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
    transition: all 0.2s;
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
    transition: all 0.2s;
  }

  .submit-btn:hover {
    transform: translateY(-2px);
  }

  @media (max-width: 640px) {
    .game-header {
      flex-direction: column;
      align-items: stretch;
    }

    .game-actions {
      justify-content: center;
    }

    .score-entry {
      flex-direction: column;
    }

    .score-vs {
      margin: 1rem 0;
    }
  }
</style>
