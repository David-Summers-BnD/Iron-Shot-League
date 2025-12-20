<script>
  import PlayerInput from '../components/PlayerInput.svelte';
  import { tournaments, createTournament, updateTournament } from '../stores/tournaments.js';
  import { saveTournaments } from '../lib/storage.js';

  let players = [];
  let tournamentName = '';
  let numTables = 1;
  let currentTournament = null;
  let matches = [];
  let activeMatchIds = [];

  // View state
  let view = 'setup';

  function handlePlayersChange(e) {
    players = e.detail;
  }

  function generateMatches(playerList) {
    const matchList = [];
    let id = 0;
    for (let i = 0; i < playerList.length; i++) {
      for (let j = i + 1; j < playerList.length; j++) {
        matchList.push({
          id: id++,
          player1: playerList[i],
          player2: playerList[j],
          winner: null,
          completed: false
        });
      }
    }
    return matchList;
  }

  function startTournament() {
    if (players.length < 3) return;

    const name = tournamentName.trim() || `Round Robin - ${new Date().toLocaleDateString()}`;
    matches = generateMatches(players);

    // Set initial active matches based on table count
    activeMatchIds = [];
    for (let i = 0; i < Math.min(numTables, matches.length); i++) {
      activeMatchIds.push(matches[i].id);
    }

    currentTournament = createTournament('round-robin', name, players, { numTables });
    updateTournament(currentTournament.id, {
      status: 'in_progress',
      matches,
      activeMatchIds
    });

    view = 'game';
    saveData();
  }

  function getMatch(p1, p2) {
    return matches.find(m =>
      (m.player1 === p1 && m.player2 === p2) ||
      (m.player1 === p2 && m.player2 === p1)
    );
  }

  function getCellState(rowPlayer, colPlayer) {
    if (rowPlayer === colPlayer) return 'self';

    const match = getMatch(rowPlayer, colPlayer);
    if (!match) return 'none';

    if (!match.completed) {
      if (activeMatchIds.includes(match.id)) return 'active';
      return 'pending';
    }

    if (match.winner === rowPlayer) return 'win';
    return 'loss';
  }

  function handleCellClick(rowPlayer, colPlayer) {
    if (rowPlayer === colPlayer) return;

    const match = getMatch(rowPlayer, colPlayer);
    if (!match) return;
    if (match.completed) return;
    if (!activeMatchIds.includes(match.id)) return;

    // Update the match - row player wins
    matches = matches.map(m => {
      if (m.id === match.id) {
        return { ...m, winner: rowPlayer, completed: true };
      }
      return m;
    });

    // Remove this match from active and add next ones
    activeMatchIds = activeMatchIds.filter(id => id !== match.id);

    // Find next incomplete matches to fill tables
    const incompleteMatches = matches.filter(m => !m.completed && !activeMatchIds.includes(m.id));
    while (activeMatchIds.length < numTables && incompleteMatches.length > 0) {
      const nextMatch = incompleteMatches.shift();
      if (nextMatch) {
        activeMatchIds = [...activeMatchIds, nextMatch.id];
      }
    }

    // Force reactivity
    matches = [...matches];
    activeMatchIds = [...activeMatchIds];

    // Update tournament
    if (currentTournament) {
      const isComplete = matches.every(m => m.completed);
      updateTournament(currentTournament.id, {
        matches,
        activeMatchIds,
        status: isComplete ? 'completed' : 'in_progress'
      });
    }

    saveData();
  }

  function getStandings() {
    return players.map(player => {
      const wins = matches.filter(m => m.completed && m.winner === player).length;
      const losses = matches.filter(m =>
        m.completed &&
        (m.player1 === player || m.player2 === player) &&
        m.winner !== player
      ).length;
      return { player, wins, losses, played: wins + losses };
    }).sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  }

  async function saveData() {
    await saveTournaments($tournaments);
  }

  function resetTournament() {
    players = [];
    tournamentName = '';
    numTables = 1;
    currentTournament = null;
    matches = [];
    activeMatchIds = [];
    view = 'setup';
  }

  // Reactive statements
  $: standings = matches.length > 0 ? getStandings() : [];
  $: completedCount = matches.filter(m => m.completed).length;
  $: totalMatches = matches.length;
  $: progressPercent = totalMatches > 0 ? (completedCount / totalMatches) * 100 : 0;
  $: tournamentComplete = matches.length > 0 && matches.every(m => m.completed);
  $: activeMatches = matches.filter(m => activeMatchIds.includes(m.id));
</script>

<div class="page-container">
  {#if view === 'setup'}
    <!-- Setup Screen -->
    <div class="setup-screen">
      <h1 class="setup-title">Round Robin</h1>
      <p class="setup-subtitle">Everyone plays everyone - classic tournament format</p>

      <div class="setup-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tournament Name</label>
            <input
              type="text"
              bind:value={tournamentName}
              class="form-input"
              placeholder="Friday Night Showdown"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Number of Tables</label>
            <select bind:value={numTables} class="form-input">
              <option value={1}>1 table (sequential)</option>
              <option value={2}>2 tables</option>
              <option value={3}>3 tables</option>
              <option value={4}>4 tables</option>
              <option value={5}>5 tables</option>
              <option value={6}>6 tables</option>
            </select>
            <p class="form-hint">{numTables} match{numTables > 1 ? 'es' : ''} play simultaneously</p>
          </div>
        </div>

        <PlayerInput
          {players}
          minPlayers={3}
          maxPlayers={12}
          on:change={handlePlayersChange}
        />

        {#if players.length >= 3}
          <p class="match-preview">
            {players.length} players = {(players.length * (players.length - 1)) / 2} total matches
          </p>
        {/if}

        <button
          class="start-btn"
          disabled={players.length < 3}
          on:click={startTournament}
        >
          Start Tournament
        </button>
      </div>
    </div>
  {:else}
    <!-- Game Screen -->
    <div class="game-screen">
      <!-- Header -->
      <div class="game-header">
        <div class="header-info">
          <h2 class="tournament-name">{currentTournament?.name || 'Round Robin'}</h2>
          <p class="tournament-meta">{players.length} players • {numTables} table{numTables > 1 ? 's' : ''}</p>
        </div>
        <button class="end-btn" on:click={resetTournament}>End Tournament</button>
      </div>

      <!-- Progress -->
      <div class="progress-section">
        <div class="progress-bar">
          <div class="progress-fill" style="width: {progressPercent}%"></div>
        </div>
        <p class="progress-text">{completedCount} of {totalMatches} matches complete</p>
      </div>

      <!-- Winner Banner -->
      {#if tournamentComplete && standings[0]}
        <div class="winner-banner">
          <span class="winner-icon">🏆</span>
          <div class="winner-info">
            <p class="winner-label">Champion</p>
            <p class="winner-name">{standings[0].player}</p>
            <p class="winner-stats">{standings[0].wins} wins, {standings[0].losses} losses</p>
          </div>
        </div>
      {/if}

      <!-- Active Matches -->
      {#if activeMatches.length > 0 && !tournamentComplete}
        <div class="active-section">
          <h3 class="section-title">
            <span class="pulse-dot"></span>
            Now Playing ({activeMatches.length} match{activeMatches.length > 1 ? 'es' : ''})
          </h3>
          <div class="active-matches">
            {#each activeMatches as match, idx}
              <div class="active-match">
                <span class="table-badge">Table {idx + 1}</span>
                <span class="match-player">{match.player1}</span>
                <span class="match-vs">vs</span>
                <span class="match-player">{match.player2}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Main Content: Grid + Standings -->
      <div class="main-content">
        <!-- Matrix Grid -->
        <div class="grid-section">
          <h3 class="section-title">Results Grid</h3>
          <p class="grid-hint">Tap a highlighted cell to mark the ROW player as winner</p>

          <div class="matrix-container">
            <table class="matrix-table">
              <thead>
                <tr>
                  <th class="corner-cell"></th>
                  {#each players as player}
                    <th class="header-cell">
                      <div class="header-name-wrapper">
                        <span class="header-name">{player}</span>
                      </div>
                    </th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each players as rowPlayer}
                  <tr>
                    <td class="row-header">
                      <span class="row-name">{rowPlayer}</span>
                    </td>
                    {#each players as colPlayer}
                      {@const cellState = getCellState(rowPlayer, colPlayer)}
                      <td
                        class="matrix-cell {cellState}"
                        on:click={() => handleCellClick(rowPlayer, colPlayer)}
                      >
                        {#if cellState === 'self'}
                          <span class="cell-icon">—</span>
                        {:else if cellState === 'win'}
                          <span class="cell-icon win">✓</span>
                        {:else if cellState === 'loss'}
                          <span class="cell-icon loss">✗</span>
                        {:else if cellState === 'active'}
                          <span class="cell-icon active">●</span>
                        {:else}
                          <span class="cell-icon pending"></span>
                        {/if}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <div class="legend">
            <span class="legend-item"><span class="leg-icon win">✓</span> Win</span>
            <span class="legend-item"><span class="leg-icon loss">✗</span> Loss</span>
            <span class="legend-item"><span class="leg-icon active">●</span> Tap to Score</span>
          </div>
        </div>

        <!-- Standings -->
        <div class="standings-section">
          <h3 class="section-title">Standings</h3>
          <div class="standings-list">
            {#each standings as stat, index}
              <div class="standing-row" class:leader={index === 0 && stat.played > 0}>
                <span class="standing-rank">{index + 1}</span>
                <span class="standing-name">{stat.player}</span>
                <div class="standing-stats">
                  <span class="stat-wins">{stat.wins}W</span>
                  <span class="stat-losses">{stat.losses}L</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .page-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 1rem;
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

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  @media (max-width: 640px) {
    .form-row {
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

  .match-preview {
    text-align: center;
    color: #ff9933;
    font-weight: 600;
    margin: 1rem 0;
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
    margin-top: 1rem;
  }

  .start-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(255, 102, 0, 0.4);
  }

  .start-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Game Screen */
  .game-screen {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .game-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .tournament-name {
    font-size: 1.5rem;
    font-weight: bold;
    color: white;
    margin: 0;
  }

  .tournament-meta {
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
  }

  .end-btn {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid rgba(239, 68, 68, 0.5);
    border-radius: 0.5rem;
    color: #ef4444;
    cursor: pointer;
  }

  .end-btn:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  /* Progress */
  .progress-section {
    margin-bottom: 0.5rem;
  }

  .progress-bar {
    height: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #ff6600, #ff9933);
    border-radius: 4px;
    transition: width 0.3s;
  }

  .progress-text {
    text-align: center;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.875rem;
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
  }

  .winner-icon {
    font-size: 3rem;
  }

  .winner-label {
    font-size: 0.875rem;
    color: #22c55e;
    margin: 0;
  }

  .winner-name {
    font-size: 1.75rem;
    font-weight: bold;
    color: white;
    margin: 0;
  }

  .winner-stats {
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
  }

  /* Active Section */
  .active-section {
    background: rgba(255, 102, 0, 0.1);
    border: 1px solid rgba(255, 102, 0, 0.3);
    border-radius: 1rem;
    padding: 1rem 1.5rem;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: bold;
    color: white;
    margin: 0 0 0.75rem 0;
  }

  .pulse-dot {
    width: 10px;
    height: 10px;
    background: #ff6600;
    border-radius: 50%;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.2); }
  }

  .active-matches {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .active-match {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(255, 102, 0, 0.2);
    border-radius: 0.5rem;
  }

  .table-badge {
    padding: 0.125rem 0.5rem;
    background: #ff6600;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: bold;
    color: white;
  }

  .match-player {
    font-weight: 600;
    color: white;
  }

  .match-vs {
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.875rem;
  }

  /* Main Content */
  .main-content {
    display: grid;
    grid-template-columns: 1fr 250px;
    gap: 1.5rem;
  }

  @media (max-width: 900px) {
    .main-content {
      grid-template-columns: 1fr;
    }
  }

  /* Grid Section */
  .grid-section {
    background: rgba(30, 41, 59, 0.6);
    border-radius: 1rem;
    padding: 1.5rem;
    overflow: hidden;
  }

  .grid-hint {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.5);
    margin: 0 0 1rem 0;
  }

  .matrix-container {
    overflow-x: auto;
    padding-top: 60px;
  }

  .matrix-table {
    border-collapse: collapse;
    min-width: max-content;
  }

  .corner-cell {
    width: 100px;
    min-width: 100px;
  }

  .header-cell {
    position: relative;
    width: 55px;
    min-width: 55px;
    height: 30px;
    padding: 0;
  }

  .header-name-wrapper {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform-origin: bottom left;
    transform: rotate(-45deg);
    white-space: nowrap;
  }

  .header-name {
    display: block;
    font-size: 0.9rem;
    font-weight: 700;
    color: #ff9933;
    padding-left: 5px;
  }

  .row-header {
    padding: 0.75rem 1rem;
    text-align: right;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .row-name {
    font-weight: 700;
    color: #ff9933;
    font-size: 1rem;
  }

  .matrix-cell {
    width: 55px;
    height: 55px;
    text-align: center;
    vertical-align: middle;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.2s;
  }

  .matrix-cell.self {
    background: rgba(255, 255, 255, 0.02);
  }

  .matrix-cell.win {
    background: rgba(34, 197, 94, 0.3);
  }

  .matrix-cell.loss {
    background: rgba(239, 68, 68, 0.2);
  }

  .matrix-cell.pending {
    background: rgba(255, 255, 255, 0.02);
  }

  .matrix-cell.active {
    background: rgba(255, 102, 0, 0.4);
    border: 2px solid #ff6600;
    cursor: pointer;
    animation: glow 1.5s infinite;
  }

  .matrix-cell.active:hover {
    background: rgba(255, 102, 0, 0.6);
    transform: scale(1.05);
  }

  @keyframes glow {
    0%, 100% { box-shadow: inset 0 0 10px rgba(255, 102, 0, 0.3); }
    50% { box-shadow: inset 0 0 20px rgba(255, 102, 0, 0.6); }
  }

  .cell-icon {
    font-size: 1.5rem;
    font-weight: bold;
  }

  .cell-icon.win {
    color: #22c55e;
  }

  .cell-icon.loss {
    color: #ef4444;
  }

  .cell-icon.active {
    color: #ff6600;
    animation: blink 1s infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .legend {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .leg-icon {
    font-weight: bold;
    font-size: 1rem;
  }

  .leg-icon.win {
    color: #22c55e;
  }

  .leg-icon.loss {
    color: #ef4444;
  }

  .leg-icon.active {
    color: #ff6600;
  }

  /* Standings Section */
  .standings-section {
    background: rgba(30, 41, 59, 0.6);
    border-radius: 1rem;
    padding: 1.5rem;
    height: fit-content;
  }

  .standings-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .standing-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 0.5rem;
    border: 1px solid transparent;
  }

  .standing-row.leader {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.4);
  }

  .standing-rank {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    font-weight: bold;
    font-size: 0.875rem;
    color: white;
  }

  .standing-row.leader .standing-rank {
    background: #22c55e;
  }

  .standing-name {
    flex: 1;
    font-weight: 600;
    color: white;
    font-size: 1rem;
  }

  .standing-stats {
    display: flex;
    gap: 0.5rem;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .stat-wins {
    color: #22c55e;
  }

  .stat-losses {
    color: #ef4444;
  }
</style>
