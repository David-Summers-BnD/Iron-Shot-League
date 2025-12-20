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

  function handleCellClick(rowPlayer, colPlayer) {
    if (rowPlayer === colPlayer) return;

    const match = getMatch(rowPlayer, colPlayer);
    if (!match) return;
    if (match.completed) return;
    if (!activeMatchIds.includes(match.id)) return;

    // Update the match - row player wins
    const newMatches = matches.map(m => {
      if (m.id === match.id) {
        return { ...m, winner: rowPlayer, completed: true };
      }
      return m;
    });

    // Remove this match from active
    let newActiveIds = activeMatchIds.filter(id => id !== match.id);

    // Find next incomplete matches to fill tables
    const incompleteMatches = newMatches.filter(m => !m.completed && !newActiveIds.includes(m.id));
    while (newActiveIds.length < numTables && incompleteMatches.length > 0) {
      const nextMatch = incompleteMatches.shift();
      if (nextMatch) {
        newActiveIds = [...newActiveIds, nextMatch.id];
      }
    }

    // Update state - force full reassignment for reactivity
    matches = newMatches;
    activeMatchIds = newActiveIds;

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

  // REACTIVE: Compute cell states so they update when matches/activeMatchIds change
  $: cellStates = (() => {
    const states = {};
    players.forEach(rowPlayer => {
      states[rowPlayer] = {};
      players.forEach(colPlayer => {
        if (rowPlayer === colPlayer) {
          states[rowPlayer][colPlayer] = 'self';
        } else {
          const match = getMatch(rowPlayer, colPlayer);
          if (!match) {
            states[rowPlayer][colPlayer] = 'none';
          } else if (!match.completed) {
            states[rowPlayer][colPlayer] = activeMatchIds.includes(match.id) ? 'active' : 'pending';
          } else {
            states[rowPlayer][colPlayer] = match.winner === rowPlayer ? 'win' : 'loss';
          }
        }
      });
    });
    return states;
  })();

  // Other reactive statements
  $: standings = matches.length > 0 ? getStandings() : [];
  $: completedCount = matches.filter(m => m.completed).length;
  $: totalMatches = matches.length;
  $: progressPercent = totalMatches > 0 ? (completedCount / totalMatches) * 100 : 0;
  $: tournamentComplete = matches.length > 0 && matches.every(m => m.completed);
  $: activeMatches = matches.filter(m => activeMatchIds.includes(m.id));

  // Dynamic sizing based on player count
  $: cellSize = players.length <= 6 ? 'large' : players.length <= 9 ? 'medium' : 'small';
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
    <!-- FULL SCREEN Game Display -->
    <div class="game-fullscreen">
      <!-- Top Bar -->
      <div class="top-bar">
        <div class="top-left">
          <h1 class="game-title">{currentTournament?.name || 'Round Robin'}</h1>
          <span class="game-meta">{players.length} players</span>
        </div>

        <div class="top-center">
          {#if !tournamentComplete}
            <div class="now-playing">
              <span class="now-label">NOW PLAYING</span>
              <div class="now-matches">
                {#each activeMatches as match, idx}
                  <span class="now-match">
                    <span class="table-num">T{idx + 1}</span>
                    {match.player1} vs {match.player2}
                  </span>
                {/each}
              </div>
            </div>
          {:else if standings[0]}
            <div class="champion-bar">
              <span class="champ-trophy">🏆</span>
              <span class="champ-name">{standings[0].player}</span>
              <span class="champ-label">CHAMPION</span>
            </div>
          {/if}
        </div>

        <div class="top-right">
          <div class="progress-info">
            <span class="progress-num">{completedCount}/{totalMatches}</span>
            <div class="progress-mini">
              <div class="progress-fill-mini" style="width: {progressPercent}%"></div>
            </div>
          </div>
          <button class="end-btn" on:click={resetTournament}>Exit</button>
        </div>
      </div>

      <!-- Main Grid Area -->
      <div class="grid-area">
        <div class="matrix-wrapper" class:size-large={cellSize === 'large'} class:size-medium={cellSize === 'medium'} class:size-small={cellSize === 'small'}>
          <table class="matrix">
            <thead>
              <tr>
                <th class="corner"></th>
                {#each players as player}
                  <th class="col-header">
                    <div class="col-name">{player}</div>
                  </th>
                {/each}
                <th class="stats-header">W</th>
                <th class="stats-header">L</th>
              </tr>
            </thead>
            <tbody>
              {#each players as rowPlayer, rowIdx}
                {@const playerStats = standings.find(s => s.player === rowPlayer) || { wins: 0, losses: 0 }}
                <tr>
                  <td class="row-header">
                    <span class="row-rank">{rowIdx + 1}</span>
                    <span class="row-name">{rowPlayer}</span>
                  </td>
                  {#each players as colPlayer}
                    {@const state = cellStates[rowPlayer]?.[colPlayer] || 'none'}
                    <td
                      class="cell {state}"
                      on:click={() => handleCellClick(rowPlayer, colPlayer)}
                    >
                      {#if state === 'self'}
                        <span class="cell-mark">—</span>
                      {:else if state === 'win'}
                        <span class="cell-mark win">W</span>
                      {:else if state === 'loss'}
                        <span class="cell-mark loss">L</span>
                      {:else if state === 'active'}
                        <span class="cell-mark active">TAP</span>
                      {:else}
                        <span class="cell-mark pending">·</span>
                      {/if}
                    </td>
                  {/each}
                  <td class="stats-cell wins">{playerStats.wins}</td>
                  <td class="stats-cell losses">{playerStats.losses}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Footer hint -->
      <div class="footer-hint">
        Tap the highlighted cell to mark the <strong>ROW player</strong> as winner
      </div>
    </div>
  {/if}
</div>

<style>
  .page-container {
    min-height: 100vh;
  }

  /* Setup Screen */
  .setup-screen {
    text-align: center;
    padding: 2rem 1rem;
    max-width: 700px;
    margin: 0 auto;
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
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  @media (max-width: 640px) {
    .form-row { grid-template-columns: 1fr; }
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
    margin-top: 1rem;
  }

  .start-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ========== FULL SCREEN GAME ========== */
  .game-fullscreen {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 120px);
    padding: 0.5rem;
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
    font-size: 1rem;
  }

  .top-center {
    flex: 1;
    display: flex;
    justify-content: center;
  }

  .now-playing {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .now-label {
    font-size: 0.8rem;
    font-weight: bold;
    color: #ff6600;
    padding: 0.25rem 0.75rem;
    background: rgba(255, 102, 0, 0.2);
    border-radius: 1rem;
    animation: pulse-glow 2s infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 5px rgba(255, 102, 0, 0.5); }
    50% { box-shadow: 0 0 20px rgba(255, 102, 0, 0.8); }
  }

  .now-matches {
    display: flex;
    gap: 1.5rem;
  }

  .now-match {
    font-size: 1.1rem;
    font-weight: 600;
    color: white;
  }

  .table-num {
    font-size: 0.75rem;
    padding: 0.125rem 0.4rem;
    background: #ff6600;
    border-radius: 0.25rem;
    margin-right: 0.5rem;
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

  .champ-trophy {
    font-size: 1.5rem;
  }

  .champ-name {
    font-size: 1.5rem;
    font-weight: bold;
    color: #22c55e;
  }

  .champ-label {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .top-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .progress-info {
    text-align: right;
  }

  .progress-num {
    font-size: 1.25rem;
    font-weight: bold;
    color: white;
  }

  .progress-mini {
    width: 80px;
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

  .end-btn {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid rgba(239, 68, 68, 0.5);
    border-radius: 0.5rem;
    color: #ef4444;
    cursor: pointer;
    font-size: 0.9rem;
  }

  /* ========== GRID AREA ========== */
  .grid-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
    padding: 1rem;
  }

  .matrix-wrapper {
    display: flex;
    justify-content: center;
  }

  .matrix {
    border-collapse: collapse;
    background: rgba(15, 23, 42, 0.8);
    border-radius: 1rem;
    overflow: hidden;
  }

  /* Size variants */
  .size-large .cell,
  .size-large .row-header,
  .size-large .col-header,
  .size-large .stats-cell {
    min-width: 100px;
    height: 80px;
  }
  .size-large .row-name,
  .size-large .col-name {
    font-size: 1.4rem;
  }
  .size-large .cell-mark {
    font-size: 2rem;
  }
  .size-large .stats-cell {
    font-size: 1.5rem;
  }

  .size-medium .cell,
  .size-medium .row-header,
  .size-medium .col-header,
  .size-medium .stats-cell {
    min-width: 80px;
    height: 65px;
  }
  .size-medium .row-name,
  .size-medium .col-name {
    font-size: 1.1rem;
  }
  .size-medium .cell-mark {
    font-size: 1.5rem;
  }
  .size-medium .stats-cell {
    font-size: 1.25rem;
  }

  .size-small .cell,
  .size-small .row-header,
  .size-small .col-header,
  .size-small .stats-cell {
    min-width: 60px;
    height: 50px;
  }
  .size-small .row-name,
  .size-small .col-name {
    font-size: 0.9rem;
  }
  .size-small .cell-mark {
    font-size: 1.2rem;
  }
  .size-small .stats-cell {
    font-size: 1rem;
  }

  /* Headers */
  .corner {
    min-width: 150px;
    background: rgba(0, 0, 0, 0.3);
  }

  .col-header {
    text-align: center;
    vertical-align: bottom;
    padding: 0.75rem 0.5rem;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 3px solid #ff6600;
  }

  .col-name {
    font-weight: 700;
    color: #ff9933;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    transform: rotate(180deg);
    white-space: nowrap;
  }

  .stats-header {
    min-width: 60px;
    padding: 0.75rem;
    text-align: center;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.6);
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 3px solid #ff6600;
  }

  .row-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0 1rem;
    background: rgba(0, 0, 0, 0.2);
    border-right: 3px solid #ff6600;
  }

  .row-rank {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 102, 0, 0.3);
    border-radius: 50%;
    font-weight: bold;
    color: #ff9933;
    flex-shrink: 0;
  }

  .row-name {
    font-weight: 700;
    color: #ff9933;
    white-space: nowrap;
  }

  /* Cells */
  .cell {
    text-align: center;
    vertical-align: middle;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.15s;
    cursor: default;
  }

  .cell.self {
    background: rgba(255, 255, 255, 0.02);
  }

  .cell.pending {
    background: rgba(255, 255, 255, 0.03);
  }

  .cell.win {
    background: rgba(34, 197, 94, 0.4);
  }

  .cell.loss {
    background: rgba(239, 68, 68, 0.3);
  }

  .cell.active {
    background: linear-gradient(135deg, rgba(255, 102, 0, 0.5), rgba(255, 153, 51, 0.4));
    border: 3px solid #ff6600;
    cursor: pointer;
    animation: cell-pulse 1.5s infinite;
  }

  .cell.active:hover {
    background: linear-gradient(135deg, rgba(255, 102, 0, 0.7), rgba(255, 153, 51, 0.6));
    transform: scale(1.05);
  }

  @keyframes cell-pulse {
    0%, 100% { box-shadow: inset 0 0 15px rgba(255, 102, 0, 0.4); }
    50% { box-shadow: inset 0 0 30px rgba(255, 102, 0, 0.7); }
  }

  .cell-mark {
    font-weight: bold;
  }

  .cell-mark.win {
    color: #22c55e;
  }

  .cell-mark.loss {
    color: #ef4444;
  }

  .cell-mark.active {
    color: white;
    text-shadow: 0 0 10px rgba(255, 102, 0, 0.8);
    animation: blink 1s infinite;
  }

  .cell-mark.pending {
    color: rgba(255, 255, 255, 0.2);
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* Stats columns */
  .stats-cell {
    text-align: center;
    vertical-align: middle;
    font-weight: bold;
    padding: 0.5rem;
    background: rgba(0, 0, 0, 0.2);
  }

  .stats-cell.wins {
    color: #22c55e;
    border-left: 2px solid rgba(255, 255, 255, 0.1);
  }

  .stats-cell.losses {
    color: #ef4444;
  }

  /* Footer */
  .footer-hint {
    text-align: center;
    padding: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    font-size: 1rem;
    flex-shrink: 0;
  }

  .footer-hint strong {
    color: #ff9933;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .top-bar {
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .now-matches {
      flex-wrap: wrap;
      justify-content: center;
    }
    .game-title {
      font-size: 1.2rem;
    }
  }
</style>
