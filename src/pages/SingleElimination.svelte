<script>
  import PlayerInput from '../components/PlayerInput.svelte';
  import ScoreModal from '../components/ScoreModal.svelte';
  import { generateSingleElimination, updateMatch, isBracketComplete, getBracketWinner } from '../lib/brackets.js';
  import { tournaments, createTournament, updateTournament } from '../stores/tournaments.js';
  import { saveTournaments } from '../lib/storage.js';

  let players = [];
  let tournamentName = '';
  let seeded = false;
  let raceTo = 0;
  let bracket = null;
  let currentTournament = null;

  // Modal state
  let modalOpen = false;
  let selectedMatch = null;

  // View state
  let view = 'setup';

  function handlePlayersChange(e) {
    players = e.detail;
  }

  function startTournament() {
    if (players.length < 2) return;

    const name = tournamentName.trim() || `Single Elimination - ${new Date().toLocaleDateString()}`;
    bracket = generateSingleElimination(players, seeded);

    currentTournament = createTournament('single-elimination', name, players, { seeded, raceTo });
    updateTournament(currentTournament.id, {
      status: 'in_progress',
      bracket
    });

    view = 'bracket';
    saveData();
  }

  function openScoreModal(match) {
    if (match.player1 === 'BYE' || match.player2 === 'BYE') return;
    if (!match.player1 || !match.player2) return; // Wait for players to advance

    selectedMatch = match;
    modalOpen = true;
  }

  function handleScoreSubmit(e) {
    const { matchId, score1, score2, winner } = e.detail;

    bracket = updateMatch(bracket, matchId, score1, score2, winner);

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
    players = [];
    tournamentName = '';
    bracket = null;
    currentTournament = null;
    view = 'setup';
  }

  $: winner = bracket ? getBracketWinner(bracket) : null;
  $: completedMatches = bracket?.rounds.reduce((acc, r) =>
    acc + r.matches.filter(m => m.completed && m.player1 !== 'BYE' && m.player2 !== 'BYE').length, 0) || 0;
  $: totalMatches = bracket?.rounds.reduce((acc, r) =>
    acc + r.matches.filter(m => m.player1 !== 'BYE' && m.player2 !== 'BYE').length, 0) || 0;
</script>

<div class="max-w-6xl mx-auto">
  {#if view === 'setup'}
    <!-- Setup Phase -->
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h2 class="card-title text-2xl text-accent mb-4">
          🏆 Single Elimination Tournament
        </h2>
        <p class="text-base-content/60 mb-6">
          Lose once and you're out. Fast-paced bracket competition.
        </p>

        <div class="grid md:grid-cols-2 gap-6 mb-6">
          <div class="form-control">
            <label class="label">
              <span class="label-text text-lg font-semibold">Tournament Name</span>
            </label>
            <input
              type="text"
              bind:value={tournamentName}
              class="input input-bordered bg-base-300"
              placeholder="Championship Showdown"
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text text-lg font-semibold">Race To (optional)</span>
            </label>
            <select bind:value={raceTo} class="select select-bordered bg-base-300">
              <option value={0}>Single game per match</option>
              <option value={3}>Race to 3</option>
              <option value={5}>Race to 5</option>
              <option value={7}>Race to 7</option>
              <option value={9}>Race to 9</option>
            </select>
          </div>
        </div>

        <div class="form-control mb-6">
          <label class="label cursor-pointer justify-start gap-4">
            <input type="checkbox" bind:checked={seeded} class="checkbox checkbox-primary" />
            <span class="label-text">Use player order as seeding (top players are #1 seeds)</span>
          </label>
        </div>

        <PlayerInput
          {players}
          minPlayers={2}
          maxPlayers={64}
          on:change={handlePlayersChange}
        />

        <div class="card-actions justify-end mt-6">
          <button
            class="btn btn-primary btn-lg glow-primary"
            disabled={players.length < 2}
            on:click={startTournament}
          >
            Generate Bracket
          </button>
        </div>
      </div>
    </div>
  {:else}
    <!-- Tournament In Progress -->
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 class="text-2xl font-bold text-white">{currentTournament?.name || 'Single Elimination'}</h2>
          <p class="text-base-content/60">
            {bracket?.bracketSize} player bracket • {completedMatches} / {totalMatches} matches
          </p>
        </div>

        <button class="btn btn-sm btn-ghost text-error" on:click={resetTournament}>
          New Tournament
        </button>
      </div>

      <!-- Winner Banner -->
      {#if winner}
        <div class="alert alert-success shadow-lg glow-success">
          <div class="flex items-center gap-4">
            <span class="text-4xl">🏆</span>
            <div>
              <h3 class="font-bold text-xl">Champion!</h3>
              <p class="text-2xl font-bold">{winner}</p>
            </div>
          </div>
        </div>
      {/if}

      <!-- Bracket Display -->
      <div class="overflow-x-auto pb-4">
        <div class="flex gap-8 min-w-max">
          {#each bracket.rounds as round, roundIndex}
            <div class="flex flex-col">
              <h3 class="text-center font-bold text-lg mb-4 text-primary">{round.name}</h3>
              <div class="flex flex-col justify-around flex-1 gap-4" style="padding-top: {roundIndex * 30}px;">
                {#each round.matches as match}
                  <button
                    class="match-card w-52 {match.completed ? 'completed' : ''} {!match.player1 || !match.player2 || match.player1 === 'BYE' || match.player2 === 'BYE' ? 'opacity-60 cursor-not-allowed' : ''}"
                    on:click={() => openScoreModal(match)}
                    disabled={!match.player1 || !match.player2 || match.player1 === 'BYE' || match.player2 === 'BYE'}
                  >
                    <!-- Player 1 -->
                    <div class="flex items-center justify-between mb-2 pb-2 border-b border-base-300">
                      <span class="font-medium truncate {match.winner === 'player1' ? 'text-success' : ''} {match.player1 === 'BYE' ? 'text-base-content/30 italic' : ''}">
                        {match.player1 || 'TBD'}
                      </span>
                      {#if match.completed}
                        <span class="font-bold ml-2 {match.winner === 'player1' ? 'text-success' : 'text-base-content/40'}">
                          {match.score1}
                        </span>
                      {/if}
                    </div>

                    <!-- Player 2 -->
                    <div class="flex items-center justify-between">
                      <span class="font-medium truncate {match.winner === 'player2' ? 'text-success' : ''} {match.player2 === 'BYE' ? 'text-base-content/30 italic' : ''}">
                        {match.player2 || 'TBD'}
                      </span>
                      {#if match.completed}
                        <span class="font-bold ml-2 {match.winner === 'player2' ? 'text-success' : 'text-base-content/40'}">
                          {match.score2}
                        </span>
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
  {/if}
</div>

<ScoreModal
  bind:isOpen={modalOpen}
  player1={selectedMatch?.player1 || ''}
  player2={selectedMatch?.player2 || ''}
  score1={selectedMatch?.score1 || 0}
  score2={selectedMatch?.score2 || 0}
  matchId={selectedMatch?.id || ''}
  {raceTo}
  on:submit={handleScoreSubmit}
/>
