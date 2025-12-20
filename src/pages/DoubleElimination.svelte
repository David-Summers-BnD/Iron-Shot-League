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

  // Modal state
  let modalOpen = false;
  let selectedMatch = null;
  let modalScore1 = 0;
  let modalScore2 = 0;

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

  function openScoreModal(match, bracketType) {
    if (match.player1 === 'BYE' || match.player2 === 'BYE') return;
    if (!match.player1 || !match.player2) return;

    selectedMatch = { ...match, bracketType };
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
    const bracketType = selectedMatch.bracketType;

    // Find and update the match in the correct bracket
    const rounds = bracketType === 'winners' ? bracket.winners : bracket.losers;
    for (const round of rounds) {
      for (const match of round.matches) {
        if (match.id === selectedMatch.id) {
          match.score1 = modalScore1;
          match.score2 = modalScore2;
          match.winner = winner;
          match.completed = true;

          // Advance winner
          const winnerName = winner === 'player1' ? match.player1 : match.player2;
          if (match.nextMatchId) {
            advancePlayer(rounds, match.nextMatchId, winnerName, match.position);
          }
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
              🏆 Winners
            </button>
            <button
              class="toggle-btn losers"
              class:active={activeView === 'losers'}
              on:click={() => activeView = 'losers'}
            >
              💀 Losers
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
            <h2 class="section-title winners">🏆 Winners Bracket</h2>
            <div class="bracket-scroll">
              <div class="bracket-rounds">
                {#each bracket.winners as round, roundIndex}
                  <div class="bracket-round">
                    <h3 class="round-name">{round.name}</h3>
                    <div class="round-matches" style="padding-top: {roundIndex * 50}px;">
                      {#each round.matches as match}
                        {@const isPlayable = match.player1 && match.player2 && match.player1 !== 'BYE' && match.player2 !== 'BYE'}
                        <button
                          class="bracket-match"
                          class:completed={match.completed}
                          class:playable={isPlayable && !match.completed}
                          class:disabled={!isPlayable}
                          on:click={() => isPlayable && openScoreModal(match, 'winners')}
                        >
                          <div class="match-slot" class:winner={match.winner === 'player1'} class:bye={match.player1 === 'BYE'}>
                            <span class="slot-name">{match.player1 || 'TBD'}</span>
                            {#if match.completed}<span class="slot-score">{match.score1}</span>{/if}
                          </div>
                          <div class="match-slot" class:winner={match.winner === 'player2'} class:bye={match.player2 === 'BYE'}>
                            <span class="slot-name">{match.player2 || 'TBD'}</span>
                            {#if match.completed}<span class="slot-score">{match.score2}</span>{/if}
                          </div>
                          {#if isPlayable && !match.completed}
                            <span class="tap-hint">TAP</span>
                          {/if}
                        </button>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {:else}
          <div class="bracket-section losers">
            <h2 class="section-title losers">💀 Losers Bracket</h2>
            {#if bracket.losers.some(r => r.matches.length > 0)}
              <div class="bracket-scroll">
                <div class="bracket-rounds">
                  {#each bracket.losers.filter(r => r.matches.length > 0) as round}
                    <div class="bracket-round">
                      <h3 class="round-name losers">{round.name}</h3>
                      <div class="round-matches">
                        {#each round.matches as match}
                          {@const isPlayable = match.player1 && match.player2}
                          <button
                            class="bracket-match"
                            class:completed={match.completed}
                            class:playable={isPlayable && !match.completed}
                            class:disabled={!isPlayable}
                            on:click={() => isPlayable && openScoreModal(match, 'losers')}
                          >
                            <div class="match-slot" class:winner={match.winner === 'player1'}>
                              <span class="slot-name">{match.player1 || 'TBD'}</span>
                              {#if match.completed}<span class="slot-score">{match.score1}</span>{/if}
                            </div>
                            <div class="match-slot" class:winner={match.winner === 'player2'}>
                              <span class="slot-name">{match.player2 || 'TBD'}</span>
                              {#if match.completed}<span class="slot-score">{match.score2}</span>{/if}
                            </div>
                            {#if isPlayable && !match.completed}
                              <span class="tap-hint">TAP</span>
                            {/if}
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
            <h3 class="grand-title">👑 Grand Final</h3>
            <div class="grand-matchup">
              <div class="finalist winners-champ">
                <span class="finalist-label">Winners Champion</span>
                <span class="finalist-name">{winnersChamp}</span>
              </div>
              <span class="vs-text">VS</span>
              <div class="finalist losers-champ">
                <span class="finalist-label">Losers Champion</span>
                <span class="finalist-name">{bracket.grandFinal?.player2 || 'TBD'}</span>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer hint -->
      <div class="footer-hint">
        Tap any match to enter score • Tap completed matches to correct
      </div>
    </div>

    <!-- Score Modal -->
    {#if modalOpen && selectedMatch}
      <div class="modal-overlay" on:click={closeModal}>
        <div class="modal-content" on:click|stopPropagation>
          <h3 class="modal-title">Enter Score</h3>

          <div class="score-entry">
            <div class="score-player player1">
              <span class="score-player-name">{selectedMatch.player1}</span>
              <div class="score-controls">
                <button class="score-btn minus" on:click={() => modalScore1 = Math.max(0, modalScore1 - 1)}>−</button>
                <span class="score-value">{modalScore1}</span>
                <button class="score-btn plus" on:click={() => modalScore1++}>+</button>
              </div>
            </div>

            <div class="score-vs">VS</div>

            <div class="score-player player2">
              <span class="score-player-name">{selectedMatch.player2}</span>
              <div class="score-controls">
                <button class="score-btn minus" on:click={() => modalScore2 = Math.max(0, modalScore2 - 1)}>−</button>
                <span class="score-value">{modalScore2}</span>
                <button class="score-btn plus" on:click={() => modalScore2++}>+</button>
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
    font-size: 1rem;
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
  .progress-num { font-size: 1.1rem; font-weight: bold; color: white; }
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
    padding: 0.5rem;
  }

  .bracket-section {
    background: rgba(30, 41, 59, 0.6);
    border-radius: 1rem;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: bold;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .section-title.winners { color: #22c55e; }
  .section-title.losers { color: #ef4444; }

  .bracket-scroll {
    overflow-x: auto;
    padding-bottom: 0.5rem;
  }

  .bracket-rounds {
    display: flex;
    gap: 1.5rem;
    min-width: max-content;
  }

  .bracket-round {
    min-width: 200px;
  }

  .round-name {
    text-align: center;
    font-size: 1rem;
    font-weight: bold;
    color: #22c55e;
    margin-bottom: 0.75rem;
  }

  .round-name.losers { color: #ef4444; }

  .round-matches {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    gap: 0.75rem;
  }

  .bracket-match {
    background: rgba(15, 23, 42, 0.9);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.75rem;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .bracket-match:hover:not(.disabled) {
    border-color: #ff6600;
    transform: translateY(-2px);
  }

  .bracket-match.completed { border-color: #22c55e; }
  .bracket-match.playable {
    border-color: #ff6600;
    animation: match-pulse 2s infinite;
  }

  @keyframes match-pulse {
    0%, 100% { box-shadow: 0 0 10px rgba(255, 102, 0, 0.3); }
    50% { box-shadow: 0 0 25px rgba(255, 102, 0, 0.6); }
  }

  .bracket-match.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .match-slot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .match-slot:last-child { border-bottom: none; }

  .match-slot.winner {
    background: rgba(34, 197, 94, 0.2);
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
    font-size: 1rem;
    color: white;
  }

  .slot-score {
    font-size: 1.1rem;
    font-weight: bold;
    color: white;
  }

  .match-slot.winner .slot-score { color: #22c55e; }

  .tap-hint {
    position: absolute;
    top: 50%;
    right: 0.5rem;
    transform: translateY(-50%);
    font-size: 0.65rem;
    font-weight: bold;
    color: #ff6600;
    padding: 0.15rem 0.4rem;
    background: rgba(255, 102, 0, 0.2);
    border-radius: 0.25rem;
    animation: blink 1s infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
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
    padding: 1.5rem;
    text-align: center;
    margin-top: 1rem;
  }

  .grand-title {
    font-size: 1.5rem;
    font-weight: bold;
    color: #ff9933;
    margin-bottom: 1rem;
  }

  .grand-matchup {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .finalist {
    padding: 1rem 1.5rem;
    border-radius: 0.75rem;
  }

  .winners-champ {
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid #22c55e;
  }

  .losers-champ {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid #ef4444;
  }

  .finalist-label {
    display: block;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 0.25rem;
  }

  .finalist-name {
    font-size: 1.25rem;
    font-weight: bold;
    color: white;
  }

  .winners-champ .finalist-name { color: #22c55e; }
  .losers-champ .finalist-name { color: #ef4444; }

  .vs-text {
    font-size: 1.25rem;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.3);
  }

  /* Footer */
  .footer-hint {
    text-align: center;
    padding: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  /* ========== MODAL ========== */
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
    background: linear-gradient(135deg, #1e293b, #0f172a);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    padding: 2rem;
    max-width: 500px;
    width: 90%;
  }

  .modal-title {
    text-align: center;
    font-size: 1.5rem;
    font-weight: bold;
    color: white;
    margin-bottom: 1.5rem;
  }

  .score-entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .score-player {
    flex: 1;
    text-align: center;
    padding: 1rem;
    border-radius: 0.75rem;
  }

  .score-player.player1 {
    background: linear-gradient(135deg, rgba(66, 165, 245, 0.3), rgba(33, 150, 243, 0.1));
    border: 1px solid rgba(66, 165, 245, 0.5);
  }

  .score-player.player2 {
    background: linear-gradient(135deg, rgba(239, 83, 80, 0.3), rgba(229, 57, 53, 0.1));
    border: 1px solid rgba(239, 83, 80, 0.5);
  }

  .score-player-name {
    display: block;
    font-weight: 600;
    font-size: 1rem;
    margin-bottom: 1rem;
    color: white;
  }

  .score-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
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

  .score-btn:hover { transform: scale(1.1); }

  .score-value {
    font-size: 2rem;
    font-weight: bold;
    min-width: 50px;
    color: white;
  }

  .score-vs {
    font-size: 1.25rem;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.3);
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
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
  }

  .cancel-btn:hover { background: rgba(255, 255, 255, 0.1); }

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
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .score-entry { flex-direction: column; }
    .score-vs { margin: 0.5rem 0; }
    .top-bar { flex-wrap: wrap; gap: 0.5rem; }
  }
</style>
