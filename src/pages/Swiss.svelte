<script>
  import PlayerInput from '../components/PlayerInput.svelte';
  import { createSwissTournament, generateNextRound, recordResult, getStandings, isRoundComplete, isTournamentComplete } from '../lib/swiss.js';
  import { tournaments, createTournament, updateTournament } from '../stores/tournaments.js';
  import { saveTournaments } from '../lib/storage.js';

  let players = [];
  let tournamentName = '';
  let numRounds = 0;
  let tournament = null;
  let currentTournament = null;

  // Modal state
  let modalOpen = false;
  let selectedMatch = null;
  let modalScore1 = 0;
  let modalScore2 = 0;

  // View state
  let view = 'setup';
  let activeTab = 'pairings'; // 'pairings' | 'standings'

  function handlePlayersChange(e) {
    players = e.detail;
    // Auto-calculate recommended rounds
    numRounds = Math.ceil(Math.log2(players.length)) + 1;
  }

  function startTournament() {
    if (players.length < 2) return;

    const name = tournamentName.trim() || `Swiss System - ${new Date().toLocaleDateString()}`;
    tournament = createSwissTournament(players, numRounds);
    tournament = generateNextRound(tournament);

    currentTournament = createTournament('swiss', name, players, { numRounds });
    updateTournament(currentTournament.id, {
      status: 'in_progress',
      tournament
    });

    view = 'tournament';
    saveData();
  }

  function openScoreModal(match) {
    if (match.player2 === 'BYE') return;
    if (match.completed) return;

    selectedMatch = match;
    modalScore1 = match.score1 || 0;
    modalScore2 = match.score2 || 0;
    modalOpen = true;
  }

  function closeModal() {
    modalOpen = false;
    selectedMatch = null;
    modalScore1 = 0;
    modalScore2 = 0;
  }

  function submitScore() {
    if (!selectedMatch) return;

    const winner = modalScore1 > modalScore2 ? 'player1' : 'player2';
    tournament = recordResult(tournament, selectedMatch.id, modalScore1, modalScore2, winner);

    if (currentTournament) {
      updateTournament(currentTournament.id, { tournament });
    }

    saveData();
    closeModal();
  }

  function nextRound() {
    tournament = generateNextRound(tournament);

    if (currentTournament) {
      const complete = isTournamentComplete(tournament);
      updateTournament(currentTournament.id, {
        tournament,
        status: complete ? 'completed' : 'in_progress'
      });
    }

    saveData();
  }

  async function saveData() {
    await saveTournaments($tournaments);
  }

  function resetTournament() {
    players = [];
    tournamentName = '';
    tournament = null;
    currentTournament = null;
    view = 'setup';
  }

  $: standings = tournament ? getStandings(tournament) : [];
  $: roundComplete = tournament ? isRoundComplete(tournament) : false;
  $: tournamentComplete = tournament ? isTournamentComplete(tournament) : false;
  $: currentRound = tournament?.rounds[tournament.rounds.length - 1];
</script>

<div class="page-container">
  {#if view === 'setup'}
    <!-- Setup Phase -->
    <div class="setup-screen">
      <h1 class="setup-title">Swiss System</h1>
      <p class="setup-subtitle">Players are paired with opponents of similar skill. No elimination - everyone plays all rounds!</p>

      <div class="setup-form">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Tournament Name</label>
            <input
              type="text"
              bind:value={tournamentName}
              class="form-input"
              placeholder="Swiss Open"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Number of Rounds</label>
            <input
              type="number"
              bind:value={numRounds}
              min="2"
              max="10"
              class="form-input"
            />
            <p class="form-hint">
              Recommended: {Math.ceil(Math.log2(Math.max(players.length, 2))) + 1} rounds for {players.length || 0} players
            </p>
          </div>
        </div>

        <PlayerInput
          {players}
          minPlayers={4}
          maxPlayers={64}
          label="Players"
          on:change={handlePlayersChange}
        />

        <button
          class="start-btn"
          disabled={players.length < 4}
          on:click={startTournament}
        >
          Start Swiss System
        </button>
      </div>
    </div>
  {:else}
    <!-- Tournament In Progress -->
    <div class="tournament-screen">
      <!-- Header -->
      <div class="tournament-header">
        <div class="header-info">
          <h2 class="tournament-name">{currentTournament?.name || 'Swiss Tournament'}</h2>
          <p class="tournament-meta">Round {tournament?.currentRound} of {tournament?.totalRounds}</p>
        </div>

        <div class="header-actions">
          <button
            class="tab-btn {activeTab === 'pairings' ? 'active' : ''}"
            on:click={() => activeTab = 'pairings'}
          >
            Pairings
          </button>
          <button
            class="tab-btn {activeTab === 'standings' ? 'active' : ''}"
            on:click={() => activeTab = 'standings'}
          >
            Standings
          </button>
          <button class="new-btn" on:click={resetTournament}>
            New
          </button>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="progress-container">
        <div class="progress-bar" style="width: {(tournament?.currentRound / tournament?.totalRounds) * 100}%"></div>
      </div>
      <p class="progress-text">Round {tournament?.currentRound} of {tournament?.totalRounds}</p>

      <!-- Tournament Complete Banner -->
      {#if tournamentComplete}
        <div class="winner-banner">
          <span class="winner-icon">🏆</span>
          <div class="winner-info">
            <h3 class="winner-title">Tournament Complete!</h3>
            <p class="winner-name">{standings[0]?.name}</p>
            <p class="winner-stats">{standings[0]?.points} points • {standings[0]?.wins}W - {standings[0]?.losses}L</p>
          </div>
        </div>
      {/if}

      {#if activeTab === 'pairings'}
        <!-- Current Round Pairings -->
        <div class="pairings-section">
          <div class="section-header">
            <h3 class="section-title">Round {tournament?.currentRound} Pairings</h3>
            {#if roundComplete}
              <span class="complete-badge">Complete</span>
            {/if}
          </div>

          <div class="matches-grid">
            {#each currentRound?.matches || [] as match}
              <button
                class="match-card {match.completed ? 'completed' : ''} {match.player2 === 'BYE' ? 'bye' : ''}"
                on:click={() => openScoreModal(match)}
                disabled={match.completed || match.player2 === 'BYE'}
              >
                <div class="match-players">
                  <div class="match-player {match.winner === 'player1' ? 'winner' : ''}">
                    <span class="player-name">{match.player1}</span>
                    {#if match.completed}
                      <span class="player-score">{match.score1}</span>
                    {/if}
                  </div>
                  <div class="match-divider">VS</div>
                  <div class="match-player {match.winner === 'player2' ? 'winner' : ''} {match.player2 === 'BYE' ? 'bye-text' : ''}">
                    <span class="player-name">{match.player2}</span>
                    {#if match.completed}
                      <span class="player-score">{match.score2}</span>
                    {/if}
                  </div>
                </div>
                {#if !match.completed && match.player2 !== 'BYE'}
                  <span class="click-hint">Click to score</span>
                {:else if match.player2 === 'BYE'}
                  <span class="bye-badge">BYE</span>
                {/if}
              </button>
            {/each}
          </div>

          {#if roundComplete && !tournamentComplete}
            <button class="next-round-btn" on:click={nextRound}>
              Generate Round {tournament.currentRound + 1} Pairings
            </button>
          {/if}
        </div>
      {:else}
        <!-- Standings -->
        <div class="standings-section">
          <h3 class="section-title">Standings</h3>
          <div class="standings-table-container">
            <table class="standings-table">
              <thead>
                <tr>
                  <th class="th-rank">#</th>
                  <th class="th-player">Player</th>
                  <th class="th-center">Pts</th>
                  <th class="th-center">W</th>
                  <th class="th-center">L</th>
                  <th class="th-center">D</th>
                  <th class="th-center" title="Buchholz Score (tiebreaker)">Buch</th>
                </tr>
              </thead>
              <tbody>
                {#each standings as player, index}
                  <tr class="{index === 0 ? 'leader-row' : ''}">
                    <td class="td-rank {index === 0 ? 'leader' : ''}">{index + 1}</td>
                    <td class="td-player">{player.name}</td>
                    <td class="td-center td-points">{player.points}</td>
                    <td class="td-center td-wins">{player.wins}</td>
                    <td class="td-center td-losses">{player.losses}</td>
                    <td class="td-center">{player.draws}</td>
                    <td class="td-center td-buchholz">{player.buchholz.toFixed(1)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Score Modal -->
{#if modalOpen && selectedMatch}
  <div class="modal-overlay" on:click={closeModal}>
    <div class="score-modal" on:click|stopPropagation>
      <h3 class="modal-title">Enter Score</h3>

      <div class="modal-players">
        <div class="modal-player player1">
          <p class="modal-player-name">{selectedMatch.player1}</p>
          <div class="score-controls">
            <button class="score-btn minus" on:click={() => modalScore1 = Math.max(0, modalScore1 - 1)}>−</button>
            <span class="score-display">{modalScore1}</span>
            <button class="score-btn plus" on:click={() => modalScore1++}>+</button>
          </div>
        </div>

        <div class="modal-vs">VS</div>

        <div class="modal-player player2">
          <p class="modal-player-name">{selectedMatch.player2}</p>
          <div class="score-controls">
            <button class="score-btn minus" on:click={() => modalScore2 = Math.max(0, modalScore2 - 1)}>−</button>
            <span class="score-display">{modalScore2}</span>
            <button class="score-btn plus" on:click={() => modalScore2++}>+</button>
          </div>
        </div>
      </div>

      <div class="modal-actions">
        <button class="cancel-btn" on:click={closeModal}>Cancel</button>
        <button
          class="submit-btn"
          on:click={submitScore}
          disabled={modalScore1 === modalScore2}
        >
          Submit Score
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .page-container {
    max-width: 1000px;
    margin: 0 auto;
  }

  /* Setup Screen */
  .setup-screen {
    text-align: center;
    padding: 2rem 1rem;
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
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    padding: 2rem;
    max-width: 700px;
    margin: 0 auto;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  @media (max-width: 640px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
  }

  .form-group {
    text-align: left;
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
    transition: all 0.2s;
  }

  .form-input:focus {
    outline: none;
    border-color: #ff6600;
    box-shadow: 0 0 0 3px rgba(255, 102, 0, 0.2);
  }

  .form-hint {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 0.5rem;
  }

  .start-btn {
    width: 100%;
    padding: 1rem 2rem;
    font-size: 1.25rem;
    font-weight: bold;
    color: white;
    background: linear-gradient(135deg, #ff6600, #ff9933);
    border: none;
    border-radius: 0.75rem;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 5px 20px rgba(255, 102, 0, 0.3);
    margin-top: 1.5rem;
  }

  .start-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(255, 102, 0, 0.4);
  }

  .start-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Tournament Screen */
  .tournament-screen {
    padding: 1rem;
  }

  .tournament-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .tournament-name {
    font-size: 1.75rem;
    font-weight: bold;
    color: white;
    margin: 0;
  }

  .tournament-meta {
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .tab-btn {
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.5rem;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .tab-btn.active {
    background: linear-gradient(135deg, #ff6600, #ff9933);
    border-color: #ff6600;
  }

  .new-btn {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid rgba(239, 68, 68, 0.5);
    border-radius: 0.5rem;
    color: #ef4444;
    cursor: pointer;
    transition: all 0.2s;
  }

  .new-btn:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  /* Progress Bar */
  .progress-container {
    height: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #ff6600, #ff9933);
    border-radius: 4px;
    transition: width 0.5s ease;
  }

  .progress-text {
    text-align: center;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }

  /* Winner Banner */
  .winner-banner {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.1));
    border: 2px solid #22c55e;
    border-radius: 1rem;
    margin-bottom: 1.5rem;
  }

  .winner-icon {
    font-size: 3rem;
  }

  .winner-info {
    flex: 1;
  }

  .winner-title {
    font-size: 1.25rem;
    font-weight: bold;
    color: #22c55e;
    margin: 0 0 0.25rem 0;
  }

  .winner-name {
    font-size: 1.75rem;
    font-weight: bold;
    color: white;
    margin: 0;
  }

  .winner-stats {
    color: rgba(255, 255, 255, 0.6);
    margin: 0.25rem 0 0 0;
    font-size: 0.875rem;
  }

  /* Pairings Section */
  .pairings-section {
    background: rgba(30, 41, 59, 0.6);
    border-radius: 1rem;
    padding: 1.5rem;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: bold;
    color: white;
    margin: 0;
  }

  .complete-badge {
    padding: 0.25rem 0.75rem;
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid #22c55e;
    border-radius: 1rem;
    font-size: 0.75rem;
    color: #22c55e;
  }

  .matches-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .match-card {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.75rem;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .match-card:hover:not(:disabled) {
    border-color: #ff6600;
    transform: translateY(-2px);
  }

  .match-card:disabled {
    cursor: default;
  }

  .match-card.completed {
    border-color: #22c55e;
  }

  .match-card.bye {
    opacity: 0.6;
    cursor: default;
  }

  .match-players {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .match-player {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .match-player.winner .player-name {
    color: #22c55e;
  }

  .match-player.bye-text .player-name {
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
  }

  .player-name {
    font-weight: 600;
    color: white;
  }

  .player-score {
    font-size: 1.25rem;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.5);
  }

  .match-player.winner .player-score {
    color: #22c55e;
  }

  .match-divider {
    text-align: center;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.3);
    padding: 0.25rem 0;
  }

  .click-hint {
    display: block;
    text-align: center;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .bye-badge {
    display: block;
    text-align: center;
    font-size: 0.75rem;
    color: #22c55e;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .next-round-btn {
    width: 100%;
    padding: 1rem;
    margin-top: 1.5rem;
    background: linear-gradient(135deg, #ff6600, #ff9933);
    border: none;
    border-radius: 0.75rem;
    color: white;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s;
  }

  .next-round-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 20px rgba(255, 102, 0, 0.3);
  }

  /* Standings Section */
  .standings-section {
    background: rgba(30, 41, 59, 0.6);
    border-radius: 1rem;
    padding: 1.5rem;
  }

  .standings-table-container {
    overflow-x: auto;
  }

  .standings-table {
    width: 100%;
    border-collapse: collapse;
  }

  .standings-table th {
    text-align: left;
    padding: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .standings-table td {
    padding: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    color: white;
  }

  .th-rank {
    width: 50px;
  }

  .th-center {
    text-align: center;
  }

  .td-center {
    text-align: center;
  }

  .td-rank {
    font-weight: bold;
  }

  .td-rank.leader {
    color: #22c55e;
  }

  .td-player {
    font-weight: 600;
  }

  .td-points {
    color: #ff9933;
    font-weight: bold;
  }

  .td-wins {
    color: #22c55e;
  }

  .td-losses {
    color: #ef4444;
  }

  .td-buchholz {
    color: rgba(255, 255, 255, 0.5);
  }

  .leader-row {
    background: rgba(34, 197, 94, 0.1);
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 1rem;
  }

  .score-modal {
    background: linear-gradient(135deg, #1e293b, #0f172a);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    padding: 2rem;
    width: 100%;
    max-width: 500px;
  }

  .modal-title {
    text-align: center;
    font-size: 1.5rem;
    font-weight: bold;
    color: white;
    margin-bottom: 1.5rem;
  }

  .modal-players {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .modal-player {
    flex: 1;
    text-align: center;
    padding: 1rem;
    border-radius: 0.75rem;
  }

  .modal-player.player1 {
    background: linear-gradient(135deg, rgba(66, 165, 245, 0.3), rgba(33, 150, 243, 0.1));
    border: 1px solid rgba(66, 165, 245, 0.5);
  }

  .modal-player.player2 {
    background: linear-gradient(135deg, rgba(239, 83, 80, 0.3), rgba(229, 57, 53, 0.1));
    border: 1px solid rgba(239, 83, 80, 0.5);
  }

  .modal-player-name {
    font-weight: bold;
    font-size: 1.1rem;
    color: white;
    margin-bottom: 1rem;
  }

  .modal-vs {
    font-size: 1.25rem;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.3);
  }

  .score-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }

  .score-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    font-size: 1.5rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
  }

  .score-btn.minus {
    background: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .score-btn.plus {
    background: rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  .score-btn:hover {
    transform: scale(1.1);
  }

  .score-display {
    font-size: 2rem;
    font-weight: bold;
    color: white;
    min-width: 50px;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
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
    transition: all 0.2s;
  }

  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

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
    transition: all 0.2s;
  }

  .submit-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 5px 20px rgba(255, 102, 0, 0.3);
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
