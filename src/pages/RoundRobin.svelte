<script>
  import { onMount, onDestroy } from 'svelte';
  import PlayerInput from '../components/PlayerInput.svelte';
  import { tournaments, createTournament, updateTournament } from '../stores/tournaments.js';
  import { saveTournaments } from '../lib/storage.js';

  let players = [];
  let tournamentName = '';
  let numTables = 1;
  let framesPerMatch = 1;
  let currentTournament = null;
  let matches = [];
  let activeMatchIds = [];

  // View state
  let view = 'setup';
  let isFullscreen = false;
  let gameContainer;

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      gameContainer?.requestFullscreen();
      isFullscreen = true;
    } else {
      document.exitFullscreen();
      isFullscreen = false;
    }
  }

  // Listen for fullscreen changes (e.g., user presses Escape)
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

  function generateMatches(playerList) {
    const matchList = [];
    let id = 0;
    for (let i = 0; i < playerList.length; i++) {
      for (let j = i + 1; j < playerList.length; j++) {
        matchList.push({
          id: id++,
          player1: playerList[i],
          player2: playerList[j],
          player1Frames: 0,
          player2Frames: 0,
          winner: null,
          completed: false
        });
      }
    }
    return matchList;
  }

  // Calculate frames needed to win (majority)
  function framesToWin() {
    return Math.ceil(framesPerMatch / 2);
  }

  // Get set of players currently in active matches
  function getActivePlayers(matchList, activeIds) {
    const activePlayers = new Set();
    for (const id of activeIds) {
      const match = matchList.find(m => m.id === id);
      if (match) {
        activePlayers.add(match.player1);
        activePlayers.add(match.player2);
      }
    }
    return activePlayers;
  }

  // Find next available matches where neither player is already playing
  function findAvailableMatches(matchList, currentActiveIds, maxMatches) {
    const newActiveIds = [...currentActiveIds];
    const incompleteMatches = matchList.filter(m => !m.completed && !newActiveIds.includes(m.id));

    for (const match of incompleteMatches) {
      if (newActiveIds.length >= maxMatches) break;

      // Check if either player is already in an active match
      const activePlayers = getActivePlayers(matchList, newActiveIds);
      if (!activePlayers.has(match.player1) && !activePlayers.has(match.player2)) {
        newActiveIds.push(match.id);
      }
    }

    return newActiveIds;
  }

  function startTournament() {
    if (players.length < 3) return;

    const name = tournamentName.trim() || `Round Robin - ${new Date().toLocaleDateString()}`;
    matches = generateMatches(players);

    // Set initial active matches - ensure no player is in multiple matches
    activeMatchIds = findAvailableMatches(matches, [], numTables);

    currentTournament = createTournament('round-robin', name, players, { numTables, framesPerMatch });
    updateTournament(currentTournament.id, {
      status: 'in_progress',
      matches,
      activeMatchIds,
      framesPerMatch
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

  // Get frame score for display (from row player's perspective)
  function getFrameScore(rowPlayer, colPlayer) {
    const match = getMatch(rowPlayer, colPlayer);
    if (!match) return { row: 0, col: 0 };

    if (match.player1 === rowPlayer) {
      return { row: match.player1Frames, col: match.player2Frames };
    } else {
      return { row: match.player2Frames, col: match.player1Frames };
    }
  }

  function handleCellClick(rowPlayer, colPlayer) {
    if (rowPlayer === colPlayer) return;

    const match = getMatch(rowPlayer, colPlayer);
    if (!match) return;

    // Allow scoring active matches OR correcting completed matches
    const isActive = activeMatchIds.includes(match.id);
    const isCompleted = match.completed;

    // If it's not active and not completed, can't do anything
    if (!isActive && !isCompleted) return;

    const neededToWin = framesToWin();
    const isPlayer1 = match.player1 === rowPlayer;

    // Update the match - add a frame for the row player
    const newMatches = matches.map(m => {
      if (m.id === match.id) {
        let p1Frames = m.player1Frames;
        let p2Frames = m.player2Frames;

        if (isCompleted) {
          // Correcting a completed match - reset and give frame to clicked player
          p1Frames = isPlayer1 ? 1 : 0;
          p2Frames = isPlayer1 ? 0 : 1;
        } else {
          // Active match - add a frame
          if (isPlayer1) {
            p1Frames++;
          } else {
            p2Frames++;
          }
        }

        // Check if match is now complete
        const matchWon = p1Frames >= neededToWin || p2Frames >= neededToWin;
        const winner = matchWon ? (p1Frames >= neededToWin ? m.player1 : m.player2) : null;

        return {
          ...m,
          player1Frames: p1Frames,
          player2Frames: p2Frames,
          winner,
          completed: matchWon
        };
      }
      return m;
    });

    // Find the updated match
    const updatedMatch = newMatches.find(m => m.id === match.id);

    // Only advance to next match if this match just became completed
    let newActiveIds = activeMatchIds;
    if (isActive && !isCompleted && updatedMatch.completed) {
      // Remove this match from active
      newActiveIds = activeMatchIds.filter(id => id !== match.id);

      // Find next available matches - ensuring no player is double-booked
      newActiveIds = findAvailableMatches(newMatches, newActiveIds, numTables);
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
    framesPerMatch = 1;
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

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Frames Per Match</label>
            <select bind:value={framesPerMatch} class="form-input">
              <option value={1}>1 frame (single game)</option>
              <option value={3}>Best of 3 (first to 2)</option>
              <option value={5}>Best of 5 (first to 3)</option>
              <option value={7}>Best of 7 (first to 4)</option>
            </select>
            <p class="form-hint">
              {#if framesPerMatch === 1}
                Single frame per match - tap once to score winner
              {:else}
                First to {Math.ceil(framesPerMatch / 2)} frames wins - tap to add frames
              {/if}
            </p>
          </div>
          <div class="form-group"></div>
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
    <div class="game-fullscreen" class:is-fullscreen={isFullscreen} bind:this={gameContainer}>
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
                    {@const isClickable = state === 'active' || state === 'win' || state === 'loss'}
                    {@const score = getFrameScore(rowPlayer, colPlayer)}
                    <td
                      class="cell {state}"
                      class:clickable={isClickable}
                      on:click={() => handleCellClick(rowPlayer, colPlayer)}
                    >
                      {#if state === 'self'}
                        <span class="cell-mark">—</span>
                      {:else if state === 'win'}
                        <div class="cell-content">
                          <span class="cell-mark win">W</span>
                          {#if framesPerMatch > 1}
                            <span class="frame-score">{score.row}-{score.col}</span>
                          {/if}
                        </div>
                      {:else if state === 'loss'}
                        <div class="cell-content">
                          <span class="cell-mark loss">L</span>
                          {#if framesPerMatch > 1}
                            <span class="frame-score">{score.row}-{score.col}</span>
                          {/if}
                        </div>
                      {:else if state === 'active'}
                        <div class="cell-content">
                          {#if framesPerMatch > 1 && (score.row > 0 || score.col > 0)}
                            <span class="frame-score active-score">{score.row}-{score.col}</span>
                          {:else}
                            <span class="cell-mark active">TAP</span>
                          {/if}
                        </div>
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
        {#if framesPerMatch > 1}
          Tap cell to add frame for <strong>ROW player</strong> (first to {Math.ceil(framesPerMatch / 2)} wins) • Tap completed match to reset
        {:else}
          Tap highlighted cell to mark <strong>ROW player</strong> as winner • Tap any completed cell to correct
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
    height: calc(100vh - 180px);
    padding: 0.5rem;
    overflow: hidden;
  }

  .game-fullscreen.is-fullscreen {
    height: 100vh;
    padding: 1rem;
    background: #0f172a;
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
    transition: all 0.2s;
  }

  .fullscreen-btn:hover {
    background: rgba(255, 102, 0, 0.4);
    transform: scale(1.05);
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

  /* Completed cells can be clicked to correct */
  .cell.clickable {
    cursor: pointer;
  }

  .cell.win.clickable:hover,
  .cell.loss.clickable:hover {
    outline: 2px dashed rgba(255, 255, 255, 0.5);
    outline-offset: -2px;
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

  /* Cell content for frame scores */
  .cell-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
  }

  .frame-score {
    font-size: 0.75em;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
  }

  .frame-score.active-score {
    font-size: 1.2em;
    color: white;
    text-shadow: 0 0 10px rgba(255, 102, 0, 0.8);
    animation: blink 1s infinite;
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
