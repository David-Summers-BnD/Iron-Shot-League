<script>
  import { generateSingleElimination, updateMatch, isBracketComplete, getBracketWinner } from '../lib/brackets.js';
  import { tournaments, createTournament, updateTournament } from '../stores/tournaments.js';
  import { saveTournaments } from '../lib/storage.js';

  let teams = [];
  let tournamentName = '';
  let raceTo = 0;
  let bracket = null;
  let currentTournament = null;

  // Team input state
  let newTeamName = '';
  let player1Name = '';
  let player2Name = '';

  // Modal state
  let modalOpen = false;
  let selectedMatch = null;
  let modalScore1 = 0;
  let modalScore2 = 0;

  // View state
  let view = 'setup';

  function addTeam() {
    if (!newTeamName.trim() || !player1Name.trim() || !player2Name.trim()) return;

    teams = [...teams, {
      name: newTeamName.trim(),
      player1: player1Name.trim(),
      player2: player2Name.trim()
    }];

    newTeamName = '';
    player1Name = '';
    player2Name = '';
  }

  function removeTeam(index) {
    teams = teams.filter((_, i) => i !== index);
  }

  function startTournament() {
    if (teams.length < 2) return;

    const name = tournamentName.trim() || `Scotch Doubles - ${new Date().toLocaleDateString()}`;
    const teamNames = teams.map(t => t.name);

    bracket = generateSingleElimination(teamNames, false);

    currentTournament = createTournament('scotch-doubles', name, teamNames, {
      teams,
      raceTo
    });
    updateTournament(currentTournament.id, {
      status: 'in_progress',
      bracket,
      teams
    });

    view = 'bracket';
    saveData();
  }

  function getTeamPlayers(teamName) {
    const team = teams.find(t => t.name === teamName);
    return team ? `${team.player1} & ${team.player2}` : '';
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
    teams = [];
    tournamentName = '';
    bracket = null;
    currentTournament = null;
    view = 'setup';
  }

  $: winner = bracket ? getBracketWinner(bracket) : null;
  $: completedMatches = bracket ? bracket.rounds.reduce((acc, round) => acc + round.matches.filter(m => m.completed).length, 0) : 0;
  $: totalMatches = bracket ? bracket.rounds.reduce((acc, round) => acc + round.matches.length, 0) : 0;
</script>

<div class="page-container">
  {#if view === 'setup'}
    <!-- Setup Phase -->
    <div class="setup-screen">
      <h1 class="setup-title">Scotch Doubles</h1>
      <p class="setup-subtitle">Team pairs alternate shots. Work together to sink the win!</p>

      <!-- Rules Reminder -->
      <div class="rules-box">
        <div class="rules-icon">📋</div>
        <div class="rules-content">
          <h4 class="rules-title">Scotch Doubles Rules</h4>
          <ul class="rules-list">
            <li>Players alternate shots during their team's inning</li>
            <li>Either player may break</li>
            <li>Order must be maintained between innings</li>
          </ul>
        </div>
      </div>

      <div class="setup-form">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Tournament Name</label>
            <input
              type="text"
              bind:value={tournamentName}
              class="form-input"
              placeholder="Partners Championship"
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

        <!-- Team Input -->
        <div class="teams-section">
          <div class="teams-header">
            <label class="form-label">Teams</label>
            <span class="teams-count {teams.length >= 2 ? 'valid' : 'invalid'}">
              {teams.length} teams
            </span>
          </div>

          <!-- Add Team Form -->
          <div class="add-team-form">
            <input
              type="text"
              bind:value={newTeamName}
              class="form-input"
              placeholder="Team Name"
            />
            <input
              type="text"
              bind:value={player1Name}
              class="form-input"
              placeholder="Player 1"
            />
            <input
              type="text"
              bind:value={player2Name}
              class="form-input"
              placeholder="Player 2"
            />
            <button
              class="add-team-btn"
              on:click={addTeam}
              disabled={!newTeamName.trim() || !player1Name.trim() || !player2Name.trim()}
            >
              Add Team
            </button>
          </div>

          <!-- Team List -->
          {#if teams.length > 0}
            <div class="teams-list">
              {#each teams as team, index}
                <div class="team-card">
                  <div class="team-info">
                    <p class="team-name">{team.name}</p>
                    <p class="team-players">{team.player1} & {team.player2}</p>
                  </div>
                  <button class="remove-team-btn" on:click={() => removeTeam(index)}>
                    ✕
                  </button>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-teams">
              <p>No teams added yet</p>
              <p class="empty-hint">Add at least 2 teams to start</p>
            </div>
          {/if}
        </div>

        <button
          class="start-btn"
          disabled={teams.length < 2}
          on:click={startTournament}
        >
          Generate Bracket
        </button>
      </div>
    </div>
  {:else}
    <!-- Tournament In Progress -->
    <div class="tournament-screen">
      <!-- Header -->
      <div class="tournament-header">
        <div class="header-info">
          <h2 class="tournament-name">{currentTournament?.name || 'Scotch Doubles'}</h2>
          <p class="tournament-meta">{teams.length} teams competing</p>
        </div>

        <button class="new-btn" on:click={resetTournament}>
          New Tournament
        </button>
      </div>

      <!-- Progress Bar -->
      <div class="progress-container">
        <div class="progress-bar" style="width: {(completedMatches / totalMatches) * 100}%"></div>
      </div>
      <p class="progress-text">{completedMatches} of {totalMatches} matches complete</p>

      <!-- Winner Banner -->
      {#if winner}
        <div class="winner-banner">
          <span class="winner-icon">🏆</span>
          <div class="winner-info">
            <h3 class="winner-title">Champions!</h3>
            <p class="winner-name">{winner}</p>
            <p class="winner-players">{getTeamPlayers(winner)}</p>
          </div>
        </div>
      {/if}

      <!-- Bracket Display -->
      <div class="bracket-scroll">
        <div class="bracket-rounds">
          {#each bracket.rounds as round, roundIndex}
            <div class="bracket-round">
              <h3 class="round-name">{round.name}</h3>
              <div class="round-matches" style="padding-top: {roundIndex * 30}px;">
                {#each round.matches as match}
                  <button
                    class="match-card {match.completed ? 'completed' : ''}"
                    on:click={() => openScoreModal(match)}
                    disabled={!match.player1 || !match.player2 || match.player1 === 'BYE' || match.player2 === 'BYE'}
                  >
                    <!-- Team 1 -->
                    <div class="team-matchup">
                      <div class="team-row {match.winner === 'player1' ? 'winner' : ''}">
                        <div class="team-details">
                          <span class="team-matchup-name">{match.player1 || 'TBD'}</span>
                          {#if match.player1 && match.player1 !== 'TBD' && match.player1 !== 'BYE'}
                            <span class="team-matchup-players">{getTeamPlayers(match.player1)}</span>
                          {/if}
                        </div>
                        {#if match.completed}
                          <span class="team-score">{match.score1}</span>
                        {/if}
                      </div>

                      <div class="match-divider"></div>

                      <!-- Team 2 -->
                      <div class="team-row {match.winner === 'player2' ? 'winner' : ''} {match.player2 === 'BYE' ? 'bye' : ''}">
                        <div class="team-details">
                          <span class="team-matchup-name">{match.player2 || 'TBD'}</span>
                          {#if match.player2 && match.player2 !== 'TBD' && match.player2 !== 'BYE'}
                            <span class="team-matchup-players">{getTeamPlayers(match.player2)}</span>
                          {/if}
                        </div>
                        {#if match.completed}
                          <span class="team-score">{match.score2}</span>
                        {/if}
                      </div>
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Score Modal -->
{#if modalOpen && selectedMatch}
  <div class="modal-overlay" on:click={closeModal}>
    <div class="score-modal" on:click|stopPropagation>
      <h3 class="modal-title">Enter Score</h3>

      <div class="modal-teams">
        <div class="modal-team team1">
          <p class="modal-team-name">{selectedMatch.player1}</p>
          <p class="modal-team-players">{getTeamPlayers(selectedMatch.player1)}</p>
          <div class="score-controls">
            <button class="score-btn minus" on:click={() => modalScore1 = Math.max(0, modalScore1 - 1)}>−</button>
            <span class="score-display">{modalScore1}</span>
            <button class="score-btn plus" on:click={() => modalScore1++}>+</button>
          </div>
        </div>

        <div class="modal-vs">VS</div>

        <div class="modal-team team2">
          <p class="modal-team-name">{selectedMatch.player2}</p>
          <p class="modal-team-players">{getTeamPlayers(selectedMatch.player2)}</p>
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
    max-width: 1200px;
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

  /* Rules Box */
  .rules-box {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.25rem;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 0.75rem;
    max-width: 700px;
    margin: 0 auto 2rem;
    text-align: left;
  }

  .rules-icon {
    font-size: 1.5rem;
  }

  .rules-content {
    flex: 1;
  }

  .rules-title {
    font-weight: bold;
    color: white;
    margin: 0 0 0.5rem 0;
  }

  .rules-list {
    margin: 0;
    padding-left: 1.25rem;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
  }

  .rules-list li {
    margin-bottom: 0.25rem;
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

  /* Teams Section */
  .teams-section {
    margin-bottom: 1.5rem;
    text-align: left;
  }

  .teams-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .teams-count {
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
  }

  .teams-count.valid {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .teams-count.invalid {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
  }

  .add-team-form {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr auto;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  @media (max-width: 768px) {
    .add-team-form {
      grid-template-columns: 1fr;
    }
  }

  .add-team-btn {
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #ff6600, #ff9933);
    border: none;
    border-radius: 0.5rem;
    color: white;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
  }

  .add-team-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 5px 20px rgba(255, 102, 0, 0.3);
  }

  .add-team-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .teams-list {
    background: rgba(15, 23, 42, 0.6);
    border-radius: 0.75rem;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .team-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: rgba(30, 41, 59, 0.8);
    border-radius: 0.5rem;
  }

  .team-info {
    flex: 1;
  }

  .team-name {
    font-weight: bold;
    color: #ff9933;
    margin: 0;
  }

  .team-players {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
  }

  .remove-team-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    cursor: pointer;
    transition: all 0.2s;
  }

  .remove-team-btn:hover {
    background: rgba(239, 68, 68, 0.4);
  }

  .empty-teams {
    text-align: center;
    padding: 2rem;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
  }

  .empty-hint {
    font-size: 0.875rem;
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

  .winner-players {
    color: rgba(255, 255, 255, 0.6);
    margin: 0.25rem 0 0 0;
  }

  /* Bracket */
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
    font-size: 1rem;
    color: #ff9933;
    margin-bottom: 1rem;
  }

  .round-matches {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    flex: 1;
    gap: 1rem;
  }

  .match-card {
    width: 260px;
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
    opacity: 0.5;
    cursor: not-allowed;
  }

  .match-card.completed {
    border-color: #22c55e;
  }

  .team-matchup {
    display: flex;
    flex-direction: column;
  }

  .team-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
  }

  .team-row.winner .team-matchup-name {
    color: #22c55e;
  }

  .team-row.bye .team-matchup-name {
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
  }

  .team-details {
    flex: 1;
  }

  .team-matchup-name {
    font-weight: bold;
    color: white;
    display: block;
  }

  .team-matchup-players {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    display: block;
    margin-top: 0.125rem;
  }

  .team-score {
    font-size: 1.5rem;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.5);
  }

  .team-row.winner .team-score {
    color: #22c55e;
  }

  .match-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
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
    max-width: 550px;
  }

  .modal-title {
    text-align: center;
    font-size: 1.5rem;
    font-weight: bold;
    color: white;
    margin-bottom: 1.5rem;
  }

  .modal-teams {
    display: flex;
    align-items: stretch;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .modal-team {
    flex: 1;
    text-align: center;
    padding: 1.25rem;
    border-radius: 0.75rem;
  }

  .modal-team.team1 {
    background: linear-gradient(135deg, rgba(66, 165, 245, 0.3), rgba(33, 150, 243, 0.1));
    border: 1px solid rgba(66, 165, 245, 0.5);
  }

  .modal-team.team2 {
    background: linear-gradient(135deg, rgba(239, 83, 80, 0.3), rgba(229, 57, 53, 0.1));
    border: 1px solid rgba(239, 83, 80, 0.5);
  }

  .modal-team-name {
    font-weight: bold;
    font-size: 1.1rem;
    color: white;
    margin: 0 0 0.25rem 0;
  }

  .modal-team-players {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.5);
    margin: 0 0 1rem 0;
  }

  .modal-vs {
    display: flex;
    align-items: center;
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
