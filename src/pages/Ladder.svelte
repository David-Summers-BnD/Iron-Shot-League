<script>
  import PlayerInput from '../components/PlayerInput.svelte';
  import { createLadder, processChallenge, getAvailableTargets, isValidChallenge } from '../lib/ladder.js';
  import { tournaments, createTournament, updateTournament } from '../stores/tournaments.js';
  import { saveTournaments } from '../lib/storage.js';

  let players = [];
  let tournamentName = '';
  let maxRungs = 3;
  let randomizeStart = true;
  let ladder = null;
  let currentTournament = null;
  let challenges = [];

  // Challenge modal state
  let showChallenge = false;
  let challenger = null;
  let defender = null;
  let challengeWinner = null;

  // View state
  let view = 'setup';

  function handlePlayersChange(e) {
    players = e.detail;
  }

  function startTournament() {
    if (players.length < 2) return;

    const name = tournamentName.trim() || `Ladder - ${new Date().toLocaleDateString()}`;
    ladder = createLadder(players, randomizeStart);

    currentTournament = createTournament('ladder', name, players, { maxRungs });
    updateTournament(currentTournament.id, {
      status: 'in_progress',
      ladder,
      challenges: []
    });

    view = 'ladder';
    saveData();
  }

  function initiateChallenge(challengerPlayer) {
    challenger = challengerPlayer;
    showChallenge = true;
  }

  function selectDefender(defenderPlayer) {
    defender = defenderPlayer;
  }

  function submitChallenge() {
    if (!challenger || !defender || !challengeWinner) return;

    const challengerWins = challengeWinner === 'challenger';

    ladder = processChallenge(ladder, challenger.rank, defender.rank, challengerWins);

    // Record challenge
    challenges = [...challenges, {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      challenger: challenger.player,
      defender: defender.player,
      winner: challengeWinner === 'challenger' ? challenger.player : defender.player,
      challengerRank: challenger.rank,
      defenderRank: defender.rank,
      swapped: challengerWins
    }];

    updateTournament(currentTournament.id, {
      ladder,
      challenges
    });

    saveData();
    closeChallenge();
  }

  function closeChallenge() {
    showChallenge = false;
    challenger = null;
    defender = null;
    challengeWinner = null;
  }

  async function saveData() {
    await saveTournaments($tournaments);
  }

  function resetTournament() {
    players = [];
    tournamentName = '';
    ladder = null;
    currentTournament = null;
    challenges = [];
    view = 'setup';
  }

  $: availableTargets = challenger ? getAvailableTargets(ladder, challenger.rank, maxRungs) : [];
</script>

<div class="page-container">
  {#if view === 'setup'}
    <!-- Setup Phase -->
    <div class="setup-screen">
      <h1 class="setup-title">Ladder Tournament</h1>
      <p class="setup-subtitle">Climb the ranks by challenging players above you. Win to swap positions!</p>

      <div class="setup-form">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Tournament Name</label>
            <input
              type="text"
              bind:value={tournamentName}
              class="form-input"
              placeholder="King of the Hill"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Max Rungs to Challenge</label>
            <select bind:value={maxRungs} class="form-input">
              <option value={2}>2 rungs</option>
              <option value={3}>3 rungs (recommended)</option>
              <option value={4}>4 rungs</option>
              <option value={5}>5 rungs</option>
            </select>
          </div>
        </div>

        <div class="checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={randomizeStart} class="form-checkbox" />
            <span>Randomize starting positions</span>
          </label>
        </div>

        <PlayerInput
          {players}
          minPlayers={2}
          maxPlayers={50}
          on:change={handlePlayersChange}
        />

        <button
          class="start-btn"
          disabled={players.length < 2}
          on:click={startTournament}
        >
          Create Ladder
        </button>
      </div>
    </div>
  {:else}
    <!-- Ladder In Progress -->
    <div class="tournament-screen">
      <!-- Header -->
      <div class="tournament-header">
        <div class="header-info">
          <h2 class="tournament-name">{currentTournament?.name || 'Ladder'}</h2>
          <p class="tournament-meta">{ladder?.length} players • Challenge up to {maxRungs} rungs</p>
        </div>

        <button class="new-btn" on:click={resetTournament}>
          New Ladder
        </button>
      </div>

      <!-- Instructions -->
      <div class="instructions-box">
        <span class="instructions-icon">💡</span>
        <span>Click on a player to challenge someone above them (within {maxRungs} rungs)</span>
      </div>

      <!-- Ladder Display -->
      <div class="ladder-container">
        {#each ladder as entry, index}
          <button
            class="ladder-entry {index === 0 ? 'leader' : ''}"
            on:click={() => entry.rank < ladder.length && initiateChallenge(entry)}
            disabled={entry.rank === 1}
          >
            <!-- Rank Badge -->
            <div class="rank-badge {index === 0 ? 'leader' : ''}">
              {#if index === 0}
                👑
              {:else}
                {entry.rank}
              {/if}
            </div>

            <!-- Player Info -->
            <div class="player-info">
              <p class="player-name {index === 0 ? 'leader' : ''}">{entry.player}</p>
              <div class="player-stats">
                <span class="stat win">{entry.wins}W</span>
                <span class="stat loss">{entry.losses}L</span>
                {#if entry.challenges > 0}
                  <span class="stat challenges">{entry.challenges} challenges</span>
                {/if}
              </div>
            </div>

            <!-- Challenge Indicator -->
            {#if entry.rank < ladder.length}
              <div class="challenge-badge">
                Challenge ↑
              </div>
            {/if}
          </button>
        {/each}
      </div>

      <!-- Recent Challenges -->
      {#if challenges.length > 0}
        <div class="challenges-section">
          <h3 class="section-title">Recent Challenges</h3>
          <div class="challenges-list">
            {#each challenges.slice().reverse().slice(0, 10) as challenge}
              <div class="challenge-entry">
                <div class="challenge-players">
                  <span class="challenger-name">{challenge.challenger}</span>
                  <span class="challenge-vs"> challenged </span>
                  <span class="defender-name">{challenge.defender}</span>
                </div>
                <div class="challenge-result">
                  <span class="result-badge {challenge.winner === challenge.challenger ? 'won' : 'lost'}">
                    {challenge.winner} won
                  </span>
                  {#if challenge.swapped}
                    <span class="swap-indicator">⇅</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Challenge Modal -->
    {#if showChallenge}
      <div class="modal-overlay" on:click={closeChallenge}>
        <div class="challenge-modal" on:click|stopPropagation>
          <h3 class="modal-title">Challenge Match</h3>

          {#if !defender}
            <div class="challenger-info">
              <span class="challenger-name-modal">{challenger?.player}</span>
              <span class="challenger-rank"> (Rank #{challenger?.rank}) is challenging...</span>
            </div>

            <p class="target-hint">Select opponent (up to {maxRungs} rungs above):</p>

            <div class="target-list">
              {#each availableTargets as target}
                <button
                  class="target-btn"
                  on:click={() => selectDefender(target)}
                >
                  <span class="target-name">{target.player}</span>
                  <span class="target-rank">Rank #{target.rank}</span>
                </button>
              {/each}
            </div>
          {:else}
            <div class="matchup-display">
              <span class="matchup-challenger">{challenger.player}</span>
              <span class="matchup-vs">vs</span>
              <span class="matchup-defender">{defender.player}</span>
            </div>
            <p class="winner-prompt">Who won the match?</p>

            <div class="winner-buttons">
              <button
                class="winner-btn challenger {challengeWinner === 'challenger' ? 'selected' : ''}"
                on:click={() => challengeWinner = 'challenger'}
              >
                <span class="winner-name">{challenger.player}</span>
                <span class="winner-hint">(Swap positions)</span>
              </button>
              <button
                class="winner-btn defender {challengeWinner === 'defender' ? 'selected' : ''}"
                on:click={() => challengeWinner = 'defender'}
              >
                <span class="winner-name">{defender.player}</span>
                <span class="winner-hint">(Stay in place)</span>
              </button>
            </div>
          {/if}

          <div class="modal-actions">
            <button class="cancel-btn" on:click={closeChallenge}>Cancel</button>
            {#if defender && challengeWinner}
              <button class="submit-btn" on:click={submitChallenge}>
                Submit Result
              </button>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .page-container {
    max-width: 800px;
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

  /* Instructions */
  .instructions-box {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 0.75rem;
    margin-bottom: 1.5rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .instructions-icon {
    font-size: 1.25rem;
  }

  /* Ladder Display */
  .ladder-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 2rem;
  }

  .ladder-entry {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }

  .ladder-entry:hover:not(:disabled) {
    border-color: #ff6600;
    transform: translateX(5px);
  }

  .ladder-entry:disabled {
    cursor: default;
  }

  .ladder-entry.leader {
    background: linear-gradient(135deg, rgba(255, 102, 0, 0.2), rgba(255, 153, 51, 0.1));
    border-color: #ff6600;
  }

  .rank-badge {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 1.25rem;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    flex-shrink: 0;
  }

  .rank-badge.leader {
    background: linear-gradient(135deg, #ff6600, #ff9933);
    font-size: 1.5rem;
  }

  .player-info {
    flex: 1;
  }

  .player-name {
    font-weight: bold;
    font-size: 1.1rem;
    color: white;
    margin: 0 0 0.25rem 0;
  }

  .player-name.leader {
    color: #ff9933;
  }

  .player-stats {
    display: flex;
    gap: 0.75rem;
    font-size: 0.875rem;
  }

  .stat {
    color: rgba(255, 255, 255, 0.5);
  }

  .stat.win {
    color: #22c55e;
  }

  .stat.loss {
    color: #ef4444;
  }

  .challenge-badge {
    padding: 0.375rem 0.75rem;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 1rem;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
  }

  /* Challenges Section */
  .challenges-section {
    background: rgba(30, 41, 59, 0.6);
    border-radius: 1rem;
    padding: 1.5rem;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: bold;
    color: white;
    margin-bottom: 1rem;
  }

  .challenges-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 300px;
    overflow-y: auto;
  }

  .challenge-entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 0.5rem;
    font-size: 0.875rem;
  }

  .challenge-players {
    color: rgba(255, 255, 255, 0.8);
  }

  .challenger-name, .defender-name {
    font-weight: 600;
    color: white;
  }

  .challenge-vs {
    color: rgba(255, 255, 255, 0.5);
  }

  .challenge-result {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .result-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .result-badge.won {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .result-badge.lost {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .swap-indicator {
    color: #ff9933;
    font-weight: bold;
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

  .challenge-modal {
    background: linear-gradient(135deg, #1e293b, #0f172a);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    padding: 2rem;
    width: 100%;
    max-width: 450px;
  }

  .modal-title {
    text-align: center;
    font-size: 1.5rem;
    font-weight: bold;
    color: white;
    margin-bottom: 1.5rem;
  }

  .challenger-info {
    margin-bottom: 1rem;
  }

  .challenger-name-modal {
    font-weight: bold;
    color: #ff9933;
    font-size: 1.1rem;
  }

  .challenger-rank {
    color: rgba(255, 255, 255, 0.6);
  }

  .target-hint {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .target-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .target-btn {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
  }

  .target-btn:hover {
    border-color: #ff6600;
    background: rgba(255, 102, 0, 0.1);
  }

  .target-name {
    font-weight: 600;
    color: white;
  }

  .target-rank {
    padding: 0.25rem 0.5rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 0.25rem;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .matchup-display {
    text-align: center;
    font-size: 1.25rem;
    font-weight: bold;
    margin-bottom: 1rem;
  }

  .matchup-challenger {
    color: #42a5f5;
  }

  .matchup-vs {
    color: rgba(255, 255, 255, 0.3);
    margin: 0 0.5rem;
  }

  .matchup-defender {
    color: #ef5350;
  }

  .winner-prompt {
    text-align: center;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .winner-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .winner-btn {
    padding: 1rem;
    border-radius: 0.75rem;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
  }

  .winner-btn.challenger {
    background: rgba(66, 165, 245, 0.2);
    border-color: rgba(66, 165, 245, 0.3);
  }

  .winner-btn.defender {
    background: rgba(239, 83, 80, 0.2);
    border-color: rgba(239, 83, 80, 0.3);
  }

  .winner-btn.challenger.selected {
    border-color: #42a5f5;
    background: rgba(66, 165, 245, 0.3);
  }

  .winner-btn.defender.selected {
    border-color: #ef5350;
    background: rgba(239, 83, 80, 0.3);
  }

  .winner-name {
    display: block;
    font-weight: bold;
    color: white;
    margin-bottom: 0.25rem;
  }

  .winner-hint {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
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

  .submit-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 20px rgba(255, 102, 0, 0.3);
  }
</style>
