<script>
  import PlayerInput from '../components/PlayerInput.svelte';
  import { generateDoubleElimination, updateMatch, getBracketWinner } from '../lib/brackets.js';
  import { tournaments, createTournament, updateTournament } from '../stores/tournaments.js';
  import { saveTournaments } from '../lib/storage.js';

  let players = [];
  let tournamentName = '';
  let seeded = false;
  let raceTo = 0;
  let bracket = null;
  let currentTournament = null;
  let activeView = 'winners'; // 'winners' | 'losers'

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

    const name = tournamentName.trim() || `Double Elimination - ${new Date().toLocaleDateString()}`;
    bracket = generateDoubleElimination(players, seeded);

    currentTournament = createTournament('double-elimination', name, players, { seeded, raceTo });
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
    modalScore1 = 0;
    modalScore2 = 0;
  }

  function submitScore() {
    if (!selectedMatch) return;

    const winner = modalScore1 > modalScore2 ? 'player1' : 'player2';

    // Update match in winners bracket
    for (const round of bracket.winners) {
      for (const match of round.matches) {
        if (match.id === selectedMatch.id) {
          match.score1 = modalScore1;
          match.score2 = modalScore2;
          match.winner = winner;
          match.completed = true;

          // Advance winner
          const winnerName = winner === 'player1' ? match.player1 : match.player2;
          const loserName = winner === 'player1' ? match.player2 : match.player1;

          if (match.nextMatchId) {
            advancePlayer(bracket.winners, match.nextMatchId, winnerName, match.position);
          }

          // TODO: Send loser to losers bracket
          break;
        }
      }
    }

    // Handle grand final
    if (selectedMatch.id === 'grand-final') {
      bracket.grandFinal.score1 = modalScore1;
      bracket.grandFinal.score2 = modalScore2;
      bracket.grandFinal.winner = winner;
      bracket.grandFinal.completed = true;
    }

    if (currentTournament) {
      updateTournament(currentTournament.id, { bracket });
    }

    saveData();
    closeModal();
  }

  function advancePlayer(rounds, matchId, playerName, sourcePosition) {
    for (const round of rounds) {
      for (const match of round.matches) {
        if (match.id === matchId) {
          if (sourcePosition % 2 === 0) {
            match.player1 = playerName;
          } else {
            match.player2 = playerName;
          }
          return;
        }
      }
    }
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

  $: winnersChamp = bracket ? getBracketWinner({ rounds: bracket.winners }) : null;
  $: completedMatches = bracket ? bracket.winners.reduce((acc, round) => acc + round.matches.filter(m => m.completed).length, 0) : 0;
  $: totalMatches = bracket ? bracket.winners.reduce((acc, round) => acc + round.matches.length, 0) : 0;
</script>

<div class="page-container">
  {#if view === 'setup'}
    <!-- Setup Phase -->
    <div class="setup-screen">
      <h1 class="setup-title">Double Elimination</h1>
      <p class="setup-subtitle">Two chances to prove yourself. Win your way back from the losers bracket!</p>

      <div class="setup-form">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Tournament Name</label>
            <input
              type="text"
              bind:value={tournamentName}
              class="form-input"
              placeholder="Grand Championship"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Race To (optional)</label>
            <select bind:value={raceTo} class="form-input">
              <option value={0}>Single game per match</option>
              <option value={3}>Race to 3</option>
              <option value={5}>Race to 5</option>
              <option value={7}>Race to 7</option>
            </select>
          </div>
        </div>

        <div class="checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={seeded} class="form-checkbox" />
            <span>Use player order as seeding</span>
          </label>
        </div>

        <PlayerInput
          {players}
          minPlayers={2}
          maxPlayers={32}
          on:change={handlePlayersChange}
        />

        <button
          class="start-btn"
          disabled={players.length < 2}
          on:click={startTournament}
        >
          Generate Brackets
        </button>
      </div>
    </div>
  {:else}
    <!-- Tournament In Progress -->
    <div class="tournament-screen">
      <!-- Header -->
      <div class="tournament-header">
        <div class="header-info">
          <h2 class="tournament-name">{currentTournament?.name || 'Double Elimination'}</h2>
          <p class="tournament-meta">{bracket?.bracketSize} players • Double Elimination</p>
        </div>

        <div class="header-actions">
          <button
            class="view-btn {activeView === 'winners' ? 'active winners' : ''}"
            on:click={() => activeView = 'winners'}
          >
            🏆 Winners
          </button>
          <button
            class="view-btn {activeView === 'losers' ? 'active losers' : ''}"
            on:click={() => activeView = 'losers'}
          >
            💀 Losers
          </button>
          <button class="new-btn" on:click={resetTournament}>
            New
          </button>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="progress-container">
        <div class="progress-bar" style="width: {(completedMatches / totalMatches) * 100}%"></div>
      </div>
      <p class="progress-text">{completedMatches} of {totalMatches} matches complete</p>

      <!-- Winners Bracket -->
      {#if activeView === 'winners'}
        <div class="bracket-section winners-section">
          <h3 class="bracket-title winners-title">
            <span class="bracket-icon">🏆</span> Winners Bracket
          </h3>

          <div class="bracket-scroll">
            <div class="bracket-rounds">
              {#each bracket.winners as round, roundIndex}
                <div class="bracket-round">
                  <h4 class="round-name winners-round">{round.name}</h4>
                  <div class="round-matches" style="padding-top: {roundIndex * 30}px;">
                    {#each round.matches as match}
                      <button
                        class="match-card {match.completed ? 'completed' : ''}"
                        on:click={() => openScoreModal(match)}
                        disabled={!match.player1 || !match.player2 || match.player1 === 'BYE' || match.player2 === 'BYE'}
                      >
                        <div class="match-player">
                          <span class="player-name {match.winner === 'player1' ? 'winner' : ''}">
                            {match.player1 || 'TBD'}
                          </span>
                          {#if match.completed}
                            <span class="player-score {match.winner === 'player1' ? 'winner' : ''}">{match.score1}</span>
                          {/if}
                        </div>
                        <div class="match-divider"></div>
                        <div class="match-player">
                          <span class="player-name {match.winner === 'player2' ? 'winner' : ''}">
                            {match.player2 || 'TBD'}
                          </span>
                          {#if match.completed}
                            <span class="player-score {match.winner === 'player2' ? 'winner' : ''}">{match.score2}</span>
                          {/if}
                        </div>
                      </button>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {:else}
        <!-- Losers Bracket -->
        <div class="bracket-section losers-section">
          <h3 class="bracket-title losers-title">
            <span class="bracket-icon">💀</span> Losers Bracket
          </h3>

          {#if bracket.losers.some(r => r.matches.length > 0)}
            <div class="bracket-scroll">
              <div class="bracket-rounds">
                {#each bracket.losers.filter(r => r.matches.length > 0) as round}
                  <div class="bracket-round">
                    <h4 class="round-name losers-round">{round.name}</h4>
                    <div class="round-matches">
                      {#each round.matches as match}
                        <button
                          class="match-card"
                          on:click={() => openScoreModal(match)}
                          disabled={!match.player1 || !match.player2}
                        >
                          <div class="match-player">
                            <span class="player-name">{match.player1 || 'TBD'}</span>
                          </div>
                          <div class="match-divider"></div>
                          <div class="match-player">
                            <span class="player-name">{match.player2 || 'TBD'}</span>
                          </div>
                        </button>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {:else}
            <div class="empty-bracket">
              <p>No losers bracket matches yet</p>
              <p class="empty-hint">Players will appear here after losing in the winners bracket</p>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Grand Final -->
      {#if winnersChamp}
        <div class="grand-final">
          <h3 class="grand-final-title">
            <span class="final-icon">👑</span> Grand Final
          </h3>
          <div class="grand-final-matchup">
            <div class="finalist winners-finalist">
              <p class="finalist-label">Winners Champion</p>
              <p class="finalist-name">{winnersChamp}</p>
            </div>
            <span class="vs-text">VS</span>
            <div class="finalist losers-finalist">
              <p class="finalist-label">Losers Champion</p>
              <p class="finalist-name">{bracket.grandFinal.player2 || 'TBD'}</p>
            </div>
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

      {#if raceTo > 0}
        <p class="race-info">Race to {raceTo}</p>
      {/if}

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
    max-width: 1400px;
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

  .checkbox-group {
    margin-bottom: 1.5rem;
    text-align: left;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
  }

  .form-checkbox {
    width: 1.25rem;
    height: 1.25rem;
    accent-color: #ff6600;
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

  .view-btn {
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.5rem;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
  }

  .view-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .view-btn.active.winners {
    background: rgba(34, 197, 94, 0.3);
    border-color: #22c55e;
    color: #22c55e;
  }

  .view-btn.active.losers {
    background: rgba(239, 68, 68, 0.3);
    border-color: #ef4444;
    color: #ef4444;
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

  /* Bracket Sections */
  .bracket-section {
    background: rgba(30, 41, 59, 0.6);
    border-radius: 1rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .bracket-title {
    font-size: 1.5rem;
    font-weight: bold;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .winners-title {
    color: #22c55e;
  }

  .losers-title {
    color: #ef4444;
  }

  .bracket-icon {
    font-size: 1.75rem;
  }

  .bracket-scroll {
    overflow-x: auto;
    padding-bottom: 1rem;
  }

  .bracket-rounds {
    display: flex;
    gap: 2rem;
    min-width: max-content;
  }

  .bracket-round {
    display: flex;
    flex-direction: column;
  }

  .round-name {
    text-align: center;
    font-weight: bold;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .winners-round {
    color: #22c55e;
  }

  .losers-round {
    color: #ef4444;
  }

  .round-matches {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    flex: 1;
    gap: 1rem;
  }

  .match-card {
    width: 200px;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    padding: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .match-card:hover:not(:disabled) {
    border-color: #ff6600;
    transform: translateY(-2px);
  }

  .match-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .match-card.completed {
    border-color: #22c55e;
  }

  .match-player {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0;
  }

  .player-name {
    font-weight: 500;
    font-size: 0.9rem;
    color: white;
  }

  .player-name.winner {
    color: #22c55e;
  }

  .player-score {
    font-weight: bold;
    font-size: 1.1rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .player-score.winner {
    color: #22c55e;
  }

  .match-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 0.25rem 0;
  }

  .empty-bracket {
    text-align: center;
    padding: 3rem;
    color: rgba(255, 255, 255, 0.4);
  }

  .empty-hint {
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }

  /* Grand Final */
  .grand-final {
    background: linear-gradient(135deg, rgba(255, 102, 0, 0.2), rgba(255, 153, 51, 0.1));
    border: 2px solid #ff6600;
    border-radius: 1rem;
    padding: 2rem;
    text-align: center;
  }

  .grand-final-title {
    font-size: 1.75rem;
    font-weight: bold;
    color: #ff9933;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .final-icon {
    font-size: 2rem;
  }

  .grand-final-matchup {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .finalist {
    padding: 1rem 2rem;
    border-radius: 0.75rem;
  }

  .winners-finalist {
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid #22c55e;
  }

  .losers-finalist {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid #ef4444;
  }

  .finalist-label {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 0.25rem;
  }

  .finalist-name {
    font-size: 1.5rem;
    font-weight: bold;
    color: white;
  }

  .winners-finalist .finalist-name {
    color: #22c55e;
  }

  .losers-finalist .finalist-name {
    color: #ef4444;
  }

  .vs-text {
    font-size: 1.5rem;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.3);
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

  .race-info {
    text-align: center;
    color: #ff9933;
    font-weight: 600;
    margin-bottom: 1rem;
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
