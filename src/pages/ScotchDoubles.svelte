<script>
  import { onMount, onDestroy } from 'svelte';
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

  // View state
  let view = 'setup';

  // Fullscreen state
  let isFullscreen = false;
  let gameContainer;

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

  function selectWinner(match, winnerSlot) {
    if (!match.player1 || !match.player2) return;
    if (match.player1 === 'BYE' || match.player2 === 'BYE') return;

    const score1 = winnerSlot === 'player1' ? 1 : 0;
    const score2 = winnerSlot === 'player2' ? 1 : 0;

    bracket = updateMatch(bracket, match.id, score1, score2, winnerSlot);

    if (currentTournament) {
      const isComplete = isBracketComplete(bracket);
      updateTournament(currentTournament.id, {
        bracket,
        status: isComplete ? 'completed' : 'in_progress'
      });
    }

    saveData();
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

  $: winner = bracket ? getBracketWinner(bracket) : null;
  $: completedMatches = bracket ? bracket.rounds.reduce((acc, round) => acc + round.matches.filter(m => m.completed).length, 0) : 0;
  $: totalMatches = bracket ? bracket.rounds.reduce((acc, round) => acc + round.matches.length, 0) : 0;
  $: progressPercent = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0;
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
    <div class="game-fullscreen" class:is-fullscreen={isFullscreen} bind:this={gameContainer}>
      <!-- Top Bar -->
      <div class="top-bar">
        <div class="top-left">
          <h1 class="game-title">{currentTournament?.name || 'Scotch Doubles'}</h1>
          <span class="teams-badge">{teams.length} Teams</span>
        </div>

        <div class="top-center">
          {#if winner}
            <div class="champion-bar">
              <span class="champ-trophy">🏆</span>
              <span class="champ-name">{winner}</span>
            </div>
          {:else}
            <div class="progress-info">
              <span class="progress-num">{completedMatches}/{totalMatches}</span>
              <div class="progress-mini">
                <div class="progress-fill-mini" style="width: {progressPercent}%"></div>
              </div>
            </div>
          {/if}
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

      <!-- Bracket Display -->
      <div class="bracket-area">
        <div class="bracket-container">
          {#each bracket.rounds as round, roundIndex}
            <div class="bracket-round">
              <h3 class="round-name">{round.name}</h3>
              <div class="round-matches">
                {#each round.matches as match}
                  {@const isPlayable = match.player1 && match.player2 && match.player1 !== 'BYE' && match.player2 !== 'BYE'}
                  {@const isBye = match.player1 === 'BYE' || match.player2 === 'BYE'}
                  <div class="match-wrapper" style="--match-spacing: {Math.pow(2, roundIndex)};">
                    <!-- Connector lines -->
                    {#if roundIndex > 0}
                      <svg class="connector connector-left" viewBox="0 0 30 100" preserveAspectRatio="none">
                        <path d="M30 50 L15 50 L15 0" class="connector-line" />
                        <path d="M30 50 L15 50 L15 100" class="connector-line" />
                      </svg>
                    {/if}
                    {#if roundIndex < bracket.rounds.length - 1}
                      <svg class="connector connector-right" viewBox="0 0 30 100" preserveAspectRatio="none">
                        <path d="M0 50 L30 50" class="connector-line" />
                      </svg>
                    {/if}

                    <div
                      class="bracket-match"
                      class:completed={match.completed}
                      class:playable={isPlayable && !match.completed}
                      class:bye={isBye}
                    >
                      <button
                        class="match-slot"
                        class:winner={match.winner === 'player1'}
                        class:bye-slot={match.player1 === 'BYE'}
                        class:clickable={isPlayable}
                        on:click={() => isPlayable && selectWinner(match, 'player1')}
                        disabled={!isPlayable}
                      >
                        <div class="team-slot-info">
                          <span class="slot-name">{match.player1 === 'BYE' ? 'BYE' : (match.player1 || 'TBD')}</span>
                          {#if match.player1 && match.player1 !== 'TBD' && match.player1 !== 'BYE'}
                            <span class="slot-players">{getTeamPlayers(match.player1)}</span>
                          {/if}
                        </div>
                        {#if isPlayable && !match.completed}
                          <span class="tap-label">TAP</span>
                        {/if}
                      </button>
                      <div class="match-divider"></div>
                      <button
                        class="match-slot"
                        class:winner={match.winner === 'player2'}
                        class:bye-slot={match.player2 === 'BYE'}
                        class:clickable={isPlayable}
                        on:click={() => isPlayable && selectWinner(match, 'player2')}
                        disabled={!isPlayable}
                      >
                        <div class="team-slot-info">
                          <span class="slot-name">{match.player2 === 'BYE' ? 'BYE' : (match.player2 || 'TBD')}</span>
                          {#if match.player2 && match.player2 !== 'TBD' && match.player2 !== 'BYE'}
                            <span class="slot-players">{getTeamPlayers(match.player2)}</span>
                          {/if}
                        </div>
                        {#if isPlayable && !match.completed}
                          <span class="tap-label">TAP</span>
                        {/if}
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Winner Banner (when tournament complete) -->
      {#if winner}
        <div class="winner-footer">
          <span class="winner-icon">🏆</span>
          <div class="winner-details">
            <span class="winner-label">Champions:</span>
            <span class="winner-name">{winner}</span>
            <span class="winner-players">{getTeamPlayers(winner)}</span>
          </div>
        </div>
      {:else}
        <!-- Footer hint -->
        <div class="footer-hint">
          Tap a team name to select them as winner
        </div>
      {/if}
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
    text-align: center;
    padding: 2rem 1rem;
    overflow-y: auto;
    max-height: 100%;
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

  /* ========== FULL SCREEN GAME ========== */
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
    color: #ff9933;
    margin: 0;
  }

  .teams-badge {
    padding: 0.25rem 0.75rem;
    background: linear-gradient(135deg, #ff6600, #ff9933);
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
  }

  .top-center {
    flex: 1;
    display: flex;
    justify-content: center;
  }

  .champion-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1.5rem;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(22, 163, 74, 0.2));
    border: 2px solid #22c55e;
    border-radius: 1rem;
  }

  .champ-trophy { font-size: 1.5rem; }
  .champ-name { font-size: 1.25rem; font-weight: bold; color: #22c55e; }

  .progress-info { text-align: center; }
  .progress-num { font-size: 1.25rem; font-weight: bold; color: white; }
  .progress-mini {
    width: 120px;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    margin-top: 0.25rem;
  }
  .progress-fill-mini {
    height: 100%;
    background: linear-gradient(90deg, #ff6600, #ff9933);
    border-radius: 3px;
    transition: width 0.3s;
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
    align-items: center;
    justify-content: center;
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

  /* ========== BRACKET AREA ========== */
  .bracket-area {
    flex: 1;
    overflow: auto;
    padding: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bracket-container {
    display: flex;
    align-items: stretch;
    gap: 0;
    min-height: 100%;
    padding: 1rem 0;
  }

  .bracket-round {
    display: flex;
    flex-direction: column;
    min-width: 220px;
  }

  .round-name {
    text-align: center;
    font-size: 1rem;
    font-weight: bold;
    color: #ff6600;
    margin-bottom: 1rem;
    padding: 0.5rem;
    background: rgba(255, 102, 0, 0.1);
    border-radius: 0.5rem;
  }

  .round-matches {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
  }

  .match-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    padding: 0.5rem 0;
    margin: calc(var(--match-spacing) * 12px - 12px) 0;
  }

  .match-wrapper:first-child {
    margin-top: 0;
  }

  .match-wrapper:last-child {
    margin-bottom: 0;
  }

  /* Connector lines */
  .connector {
    position: absolute;
    width: 30px;
    height: 100%;
    pointer-events: none;
  }

  .connector-left {
    left: -30px;
  }

  .connector-right {
    right: -30px;
  }

  .connector-line {
    fill: none;
    stroke: rgba(255, 102, 0, 0.4);
    stroke-width: 2;
  }

  /* Match card */
  .bracket-match {
    flex: 1;
    background: rgba(30, 41, 59, 0.95);
    border: 2px solid rgba(255, 255, 255, 0.15);
    border-radius: 0.5rem;
    overflow: hidden;
    transition: all 0.2s;
  }

  .bracket-match.completed {
    border-color: #22c55e;
  }

  .bracket-match.playable {
    border-color: #ff6600;
    box-shadow: 0 0 20px rgba(255, 102, 0, 0.3);
  }

  .bracket-match.bye {
    opacity: 0.5;
    border-style: dashed;
  }

  .match-slot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    color: white;
    font-size: 1rem;
    text-align: left;
    cursor: default;
    transition: all 0.15s;
  }

  .match-slot.clickable {
    cursor: pointer;
  }

  .match-slot.clickable:hover {
    background: rgba(255, 102, 0, 0.2);
  }

  .match-slot.winner {
    background: rgba(34, 197, 94, 0.3);
  }

  .match-slot.winner .slot-name {
    color: #22c55e;
    font-weight: bold;
  }

  .match-slot.bye-slot {
    font-style: italic;
    color: rgba(255, 255, 255, 0.4);
  }

  .match-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
  }

  .team-slot-info {
    flex: 1;
  }

  .slot-name {
    font-weight: 500;
    color: #ff9933;
    display: block;
  }

  .match-slot.winner .slot-name {
    color: #22c55e;
  }

  .match-slot.bye-slot .slot-name {
    color: rgba(255, 255, 255, 0.4);
  }

  .slot-players {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.5);
    display: block;
    margin-top: 0.125rem;
  }

  .tap-label {
    font-size: 0.65rem;
    font-weight: bold;
    color: #ff6600;
    padding: 0.1rem 0.35rem;
    background: rgba(255, 102, 0, 0.2);
    border-radius: 0.2rem;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  /* Winner Footer */
  .winner-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(22, 163, 74, 0.2));
    border-top: 2px solid #22c55e;
    flex-shrink: 0;
  }

  .winner-icon {
    font-size: 2rem;
  }

  .winner-details {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .winner-label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.9rem;
  }

  .winner-name {
    font-size: 1.25rem;
    font-weight: bold;
    color: #22c55e;
  }

  .winner-players {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.85rem;
  }

  /* Footer */
  .footer-hint {
    text-align: center;
    padding: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.9rem;
    background: rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .bracket-round {
      min-width: 180px;
    }

    .match-slot {
      padding: 0.6rem 0.75rem;
      font-size: 0.9rem;
    }

    .top-bar {
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .game-title {
      font-size: 1rem;
    }

    .winner-details {
      flex-direction: column;
      gap: 0.25rem;
      align-items: flex-start;
    }
  }
</style>
