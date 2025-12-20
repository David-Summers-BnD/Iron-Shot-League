<script>
  import { onMount, onDestroy } from 'svelte';
  import PlayerInput from '../components/PlayerInput.svelte';
  import { generateDoubleElimination, updateMatch, getBracketWinner } from '../lib/brackets.js';
  import { tournaments, createTournament, updateTournament } from '../stores/tournaments.js';
  import { saveTournaments } from '../lib/storage.js';

  let players = [];
  let tournamentName = '';
  let seeded = false;
  let bracket = null;
  let currentTournament = null;
  let activeView = 'winners';

  // View state
  let view = 'setup';
  let isFullscreen = false;
  let gameContainer;

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

  function handlePlayersChange(e) {
    players = e.detail;
  }

  function startTournament() {
    if (players.length < 2) return;

    const name = tournamentName.trim() || `Double Elimination - ${new Date().toLocaleDateString()}`;
    bracket = generateDoubleElimination(players, seeded);

    currentTournament = createTournament('double-elimination', name, players, { seeded });
    updateTournament(currentTournament.id, {
      status: 'in_progress',
      bracket
    });

    view = 'bracket';
    saveData();
  }

  function selectWinner(match, winnerSlot, bracketType) {
    if (!match.player1 || !match.player2) return;
    if (match.player1 === 'BYE' || match.player2 === 'BYE') return;

    const score1 = winnerSlot === 'player1' ? 1 : 0;
    const score2 = winnerSlot === 'player2' ? 1 : 0;

    // Find and update the match in the correct bracket
    const rounds = bracketType === 'winners' ? bracket.winners : bracket.losers;
    for (const round of rounds) {
      for (const m of round.matches) {
        if (m.id === match.id) {
          m.score1 = score1;
          m.score2 = score2;
          m.winner = winnerSlot;
          m.completed = true;

          // Advance winner
          const winnerName = winnerSlot === 'player1' ? m.player1 : m.player2;
          if (m.nextMatchId) {
            advancePlayer(rounds, m.nextMatchId, winnerName, m.position);
          }
          break;
        }
      }
    }

    // Trigger reactivity
    bracket = bracket;

    if (currentTournament) {
      updateTournament(currentTournament.id, { bracket });
    }

    saveData();
  }

  function selectGrandFinalWinner(winnerSlot) {
    if (!bracket.grandFinal?.player1 || !bracket.grandFinal?.player2) return;

    bracket.grandFinal.score1 = winnerSlot === 'player1' ? 1 : 0;
    bracket.grandFinal.score2 = winnerSlot === 'player2' ? 1 : 0;
    bracket.grandFinal.winner = winnerSlot;
    bracket.grandFinal.completed = true;

    // Trigger reactivity
    bracket = bracket;

    if (currentTournament) {
      updateTournament(currentTournament.id, { bracket, status: 'completed' });
    }

    saveData();
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
  $: progressPercent = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0;
</script>

<div class="page-container">
  {#if view === 'setup'}
    <!-- Setup Screen -->
    <div class="setup-screen">
      <h1 class="setup-title">Double Elimination</h1>
      <p class="setup-subtitle">Two chances to prove yourself - Win your way back from the losers bracket!</p>

      <div class="setup-form">
        <div class="form-group">
          <label class="form-label">Tournament Name</label>
          <input
            type="text"
            bind:value={tournamentName}
            class="form-input"
            placeholder="Grand Championship"
          />
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
    <!-- Bracket Screen - Full Screen -->
    <div class="game-fullscreen" class:is-fullscreen={isFullscreen} bind:this={gameContainer}>
      <!-- Top Bar -->
      <div class="top-bar">
        <div class="top-left">
          <h1 class="game-title">{currentTournament?.name || 'Double Elimination'}</h1>
          <span class="game-meta">{bracket?.bracketSize} players</span>
        </div>

        <div class="top-center">
          <div class="bracket-toggle">
            <button
              class="toggle-btn"
              class:active={activeView === 'winners'}
              on:click={() => activeView = 'winners'}
            >
              Winners
            </button>
            <button
              class="toggle-btn losers"
              class:active={activeView === 'losers'}
              on:click={() => activeView = 'losers'}
            >
              Losers
            </button>
          </div>
        </div>

        <div class="top-right">
          <div class="progress-info">
            <span class="progress-num">{completedMatches}/{totalMatches}</span>
            <div class="progress-mini">
              <div class="progress-fill-mini" style="width: {progressPercent}%"></div>
            </div>
          </div>
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
        {#if activeView === 'winners'}
          <div class="bracket-section winners">
            <h2 class="section-title winners">Winners Bracket</h2>
            <div class="bracket-container">
              {#each bracket.winners as round, roundIndex}
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
                            <path d="M30 50 L15 50 L15 0" class="connector-line winners-line" />
                            <path d="M30 50 L15 50 L15 100" class="connector-line winners-line" />
                          </svg>
                        {/if}
                        {#if roundIndex < bracket.winners.length - 1}
                          <svg class="connector connector-right" viewBox="0 0 30 100" preserveAspectRatio="none">
                            <path d="M0 50 L30 50" class="connector-line winners-line" />
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
                            on:click={() => isPlayable && selectWinner(match, 'player1', 'winners')}
                            disabled={!isPlayable}
                          >
                            <span class="slot-name">{match.player1 === 'BYE' ? 'BYE' : (match.player1 || 'TBD')}</span>
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
                            on:click={() => isPlayable && selectWinner(match, 'player2', 'winners')}
                            disabled={!isPlayable}
                          >
                            <span class="slot-name">{match.player2 === 'BYE' ? 'BYE' : (match.player2 || 'TBD')}</span>
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
        {:else}
          <div class="bracket-section losers">
            <h2 class="section-title losers">Losers Bracket</h2>
            {#if bracket.losers.some(r => r.matches.length > 0)}
              <div class="bracket-container">
                {#each bracket.losers.filter(r => r.matches.length > 0) as round, roundIndex}
                  <div class="bracket-round">
                    <h3 class="round-name losers">{round.name}</h3>
                    <div class="round-matches">
                      {#each round.matches as match}
                        {@const isPlayable = match.player1 && match.player2 && match.player1 !== 'BYE' && match.player2 !== 'BYE'}
                        <div class="match-wrapper" style="--match-spacing: {Math.pow(1.5, roundIndex)};">
                          {#if roundIndex > 0}
                            <svg class="connector connector-left" viewBox="0 0 30 100" preserveAspectRatio="none">
                              <path d="M30 50 L15 50 L15 0" class="connector-line losers-line" />
                              <path d="M30 50 L15 50 L15 100" class="connector-line losers-line" />
                            </svg>
                          {/if}
                          {#if roundIndex < bracket.losers.filter(r => r.matches.length > 0).length - 1}
                            <svg class="connector connector-right" viewBox="0 0 30 100" preserveAspectRatio="none">
                              <path d="M0 50 L30 50" class="connector-line losers-line" />
                            </svg>
                          {/if}

                          <div
                            class="bracket-match"
                            class:completed={match.completed}
                            class:playable={isPlayable && !match.completed}
                          >
                            <button
                              class="match-slot"
                              class:winner={match.winner === 'player1'}
                              class:clickable={isPlayable}
                              on:click={() => isPlayable && selectWinner(match, 'player1', 'losers')}
                              disabled={!isPlayable}
                            >
                              <span class="slot-name">{match.player1 || 'TBD'}</span>
                              {#if isPlayable && !match.completed}
                                <span class="tap-label">TAP</span>
                              {/if}
                            </button>
                            <div class="match-divider"></div>
                            <button
                              class="match-slot"
                              class:winner={match.winner === 'player2'}
                              class:clickable={isPlayable}
                              on:click={() => isPlayable && selectWinner(match, 'player2', 'losers')}
                              disabled={!isPlayable}
                            >
                              <span class="slot-name">{match.player2 || 'TBD'}</span>
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
            {:else}
              <div class="empty-bracket">
                <p>No losers bracket matches yet</p>
                <p class="empty-hint">Players will appear here after losing in the winners bracket</p>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Grand Final -->
        {#if winnersChamp && bracket.grandFinal}
          {@const gf = bracket.grandFinal}
          {@const isGrandFinalReady = gf.player1 && gf.player2}
          <div class="grand-final" class:playable={isGrandFinalReady && !gf.completed} class:completed={gf.completed}>
            <h3 class="grand-title">Grand Final</h3>
            <div class="grand-matchup">
              <button
                class="finalist winners-champ"
                class:winner={gf.winner === 'player1'}
                class:clickable={isGrandFinalReady && !gf.completed}
                on:click={() => isGrandFinalReady && selectGrandFinalWinner('player1')}
                disabled={!isGrandFinalReady}
              >
                <span class="finalist-label">Winners Champion</span>
                <span class="finalist-name">{gf.player1 || winnersChamp}</span>
                {#if isGrandFinalReady && !gf.completed}
                  <span class="tap-label">TAP TO WIN</span>
                {/if}
              </button>
              <span class="vs-text">VS</span>
              <button
                class="finalist losers-champ"
                class:winner={gf.winner === 'player2'}
                class:clickable={isGrandFinalReady && !gf.completed}
                on:click={() => isGrandFinalReady && selectGrandFinalWinner('player2')}
                disabled={!isGrandFinalReady}
              >
                <span class="finalist-label">Losers Champion</span>
                <span class="finalist-name">{gf.player2 || 'TBD'}</span>
                {#if isGrandFinalReady && !gf.completed}
                  <span class="tap-label">TAP TO WIN</span>
                {/if}
              </button>
            </div>
            {#if gf.completed}
              <div class="champion-banner">
                <span class="champ-icon">🏆</span>
                <span class="champ-text">Champion: {gf.winner === 'player1' ? gf.player1 : gf.player2}</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Footer hint -->
      <div class="footer-hint">
        Tap a player name to select them as winner
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
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
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
    text-align: left;
  }

  .form-group {
    margin-bottom: 1.5rem;
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
  }

  .checkbox-group {
    margin-bottom: 1.5rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.8);
  }

  .form-checkbox {
    width: 1.25rem;
    height: 1.25rem;
    accent-color: #ff6600;
  }

  .start-btn {
    width: 100%;
    padding: 1rem;
    margin-top: 1rem;
    background: linear-gradient(135deg, #ff6600, #ff9933);
    border: none;
    border-radius: 0.75rem;
    color: white;
    font-size: 1.2rem;
    font-weight: bold;
    cursor: pointer;
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

  .game-meta {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.9rem;
  }

  .top-center {
    display: flex;
    justify-content: center;
  }

  .bracket-toggle {
    display: flex;
    gap: 0.5rem;
  }

  .toggle-btn {
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.5rem;
    color: white;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .toggle-btn.active {
    background: rgba(34, 197, 94, 0.3);
    border-color: #22c55e;
    color: #22c55e;
  }

  .toggle-btn.losers.active {
    background: rgba(239, 68, 68, 0.3);
    border-color: #ef4444;
    color: #ef4444;
  }

  .top-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .progress-info { text-align: center; }
  .progress-num { font-size: 1rem; font-weight: bold; color: white; }
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
    flex-direction: column;
  }

  .bracket-section {
    flex: 1;
  }

  .section-title {
    font-size: 1.1rem;
    font-weight: bold;
    margin-bottom: 1rem;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    display: inline-block;
  }

  .section-title.winners {
    color: #22c55e;
    background: rgba(34, 197, 94, 0.1);
  }

  .section-title.losers {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .bracket-container {
    display: flex;
    align-items: stretch;
    gap: 0;
    min-height: 300px;
    padding: 1rem 0;
  }

  .bracket-round {
    display: flex;
    flex-direction: column;
    min-width: 180px;
  }

  .round-name {
    text-align: center;
    font-size: 0.9rem;
    font-weight: bold;
    color: #22c55e;
    margin-bottom: 0.75rem;
    padding: 0.4rem;
    background: rgba(34, 197, 94, 0.1);
    border-radius: 0.5rem;
  }

  .round-name.losers {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
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
    padding: 0.4rem 0;
    margin: calc(var(--match-spacing) * 8px - 8px) 0;
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
    width: 25px;
    height: 100%;
    pointer-events: none;
  }

  .connector-left {
    left: -25px;
  }

  .connector-right {
    right: -25px;
  }

  .connector-line {
    fill: none;
    stroke-width: 2;
  }

  .connector-line.winners-line {
    stroke: rgba(34, 197, 94, 0.4);
  }

  .connector-line.losers-line {
    stroke: rgba(239, 68, 68, 0.4);
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
    box-shadow: 0 0 15px rgba(255, 102, 0, 0.3);
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
    padding: 0.6rem 0.75rem;
    background: transparent;
    border: none;
    color: white;
    font-size: 0.9rem;
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

  .slot-name {
    font-weight: 500;
    color: #ff9933;
  }

  .match-slot.winner .slot-name {
    color: #22c55e;
  }

  .match-slot.bye-slot .slot-name {
    color: rgba(255, 255, 255, 0.4);
  }

  .tap-label {
    font-size: 0.65rem;
    font-weight: bold;
    color: #ff6600;
    padding: 0.1rem 0.3rem;
    background: rgba(255, 102, 0, 0.2);
    border-radius: 0.2rem;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
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
    background: rgba(30, 41, 59, 0.8);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 1rem;
    padding: 1.5rem;
    text-align: center;
    margin-top: 1rem;
  }

  .grand-final.playable {
    border-color: #ff6600;
    box-shadow: 0 0 20px rgba(255, 102, 0, 0.3);
  }

  .grand-final.completed {
    border-color: #22c55e;
  }

  .grand-title {
    font-size: 1.25rem;
    font-weight: bold;
    color: #ff9933;
    margin-bottom: 1rem;
  }

  .grand-matchup {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .finalist {
    padding: 1rem 1.5rem;
    border-radius: 0.75rem;
    border: none;
    cursor: default;
    transition: all 0.2s;
    text-align: center;
  }

  .finalist.clickable {
    cursor: pointer;
  }

  .finalist.clickable:hover {
    transform: translateY(-2px);
  }

  .winners-champ {
    background: rgba(34, 197, 94, 0.2);
    border: 2px solid rgba(34, 197, 94, 0.5);
  }

  .winners-champ.winner {
    background: rgba(34, 197, 94, 0.4);
    border-color: #22c55e;
  }

  .losers-champ {
    background: rgba(239, 68, 68, 0.2);
    border: 2px solid rgba(239, 68, 68, 0.5);
  }

  .losers-champ.winner {
    background: rgba(239, 68, 68, 0.4);
    border-color: #ef4444;
  }

  .finalist-label {
    display: block;
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 0.25rem;
  }

  .finalist-name {
    display: block;
    font-size: 1.1rem;
    font-weight: bold;
    color: white;
    margin-bottom: 0.5rem;
  }

  .winners-champ .finalist-name { color: #22c55e; }
  .losers-champ .finalist-name { color: #ef4444; }

  .vs-text {
    font-size: 1.25rem;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.3);
  }

  .champion-banner {
    margin-top: 1rem;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(22, 163, 74, 0.2));
    border: 2px solid #22c55e;
    border-radius: 1rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .champ-icon {
    font-size: 1.5rem;
  }

  .champ-text {
    font-size: 1.25rem;
    font-weight: bold;
    color: #22c55e;
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
      min-width: 150px;
    }

    .match-slot {
      padding: 0.5rem 0.6rem;
      font-size: 0.85rem;
    }

    .top-bar {
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .game-title {
      font-size: 1rem;
    }

    .grand-matchup {
      flex-direction: column;
      gap: 0.75rem;
    }

    .vs-text {
      padding: 0;
    }
  }
</style>
