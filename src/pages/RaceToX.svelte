<script>
  import PlayerInput from '../components/PlayerInput.svelte';
  import ScoreModal from '../components/ScoreModal.svelte';
  import { generateSingleElimination, updateMatch, isBracketComplete, getBracketWinner } from '../lib/brackets.js';
  import { tournaments, createTournament, updateTournament } from '../stores/tournaments.js';
  import { saveTournaments } from '../lib/storage.js';

  let players = [];
  let tournamentName = '';
  let raceTo = 5;
  let bracketType = 'single'; // 'single' | 'double'
  let seeded = false;
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

    const name = tournamentName.trim() || `Race to ${raceTo} - ${new Date().toLocaleDateString()}`;
    bracket = generateSingleElimination(players, seeded);

    currentTournament = createTournament('race-to-x', name, players, { raceTo, bracketType, seeded });
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
</script>

<div class="max-w-6xl mx-auto">
  {#if view === 'setup'}
    <!-- Setup Phase -->
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h2 class="card-title text-2xl text-accent mb-4">
          🏁 Race to X Tournament
        </h2>
        <p class="text-base-content/60 mb-6">
          First player to win X games takes the match. Choose your race format and bracket style.
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
              placeholder="Saturday Night Race"
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text text-lg font-semibold">Race To</span>
            </label>
            <div class="flex gap-2">
              {#each [3, 5, 7, 9, 11] as num}
                <button
                  class="btn flex-1 {raceTo === num ? 'btn-primary' : 'btn-ghost bg-base-300'}"
                  on:click={() => raceTo = num}
                >
                  {num}
                </button>
              {/each}
            </div>
          </div>
        </div>

        <div class="grid md:grid-cols-2 gap-6 mb-6">
          <div class="form-control">
            <label class="label">
              <span class="label-text text-lg font-semibold">Bracket Type</span>
            </label>
            <div class="flex gap-2">
              <button
                class="btn flex-1 {bracketType === 'single' ? 'btn-primary' : 'btn-ghost bg-base-300'}"
                on:click={() => bracketType = 'single'}
              >
                Single Elimination
              </button>
              <button
                class="btn flex-1 {bracketType === 'double' ? 'btn-primary' : 'btn-ghost bg-base-300'}"
                on:click={() => bracketType = 'double'}
              >
                Double Elimination
              </button>
            </div>
          </div>

          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-4">
              <input type="checkbox" bind:checked={seeded} class="checkbox checkbox-primary" />
              <span class="label-text">Use player order as seeding</span>
            </label>
          </div>
        </div>

        <!-- Race Info Card -->
        <div class="alert alert-info mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <div>
            <h3 class="font-bold">Race to {raceTo}</h3>
            <p class="text-sm">First player to win {raceTo} games wins the match. Max games per match: {(raceTo * 2) - 1}</p>
          </div>
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
            Start Race to {raceTo}
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
          <h2 class="text-2xl font-bold text-white">{currentTournament?.name || 'Race Tournament'}</h2>
          <p class="text-base-content/60">
            Race to {raceTo} • {bracket?.bracketSize} players
          </p>
        </div>

        <div class="badge badge-primary badge-lg font-bold text-lg px-4 py-3">
          Race to {raceTo}
        </div>

        <button class="btn btn-sm btn-ghost text-error" on:click={resetTournament}>
          New Tournament
        </button>
      </div>

      <!-- Winner Banner -->
      {#if winner}
        <div class="alert alert-success shadow-lg glow-success">
          <div class="flex items-center gap-4">
            <span class="text-4xl">🏁</span>
            <div>
              <h3 class="font-bold text-xl">Race Champion!</h3>
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
                    class="match-card w-56 {match.completed ? 'completed' : ''}"
                    on:click={() => openScoreModal(match)}
                    disabled={!match.player1 || !match.player2 || match.player1 === 'BYE' || match.player2 === 'BYE'}
                  >
                    <!-- Player 1 -->
                    <div class="flex items-center justify-between mb-2 pb-2 border-b border-base-300">
                      <span class="font-medium truncate {match.winner === 'player1' ? 'text-success' : ''}">
                        {match.player1 || 'TBD'}
                      </span>
                      {#if match.completed || match.score1 > 0}
                        <div class="flex items-center gap-1">
                          {#each Array(raceTo) as _, i}
                            <div class="w-3 h-3 rounded-full {i < (match.score1 || 0) ? 'bg-success' : 'bg-base-300'}"></div>
                          {/each}
                          <span class="font-bold ml-2 {match.winner === 'player1' ? 'text-success' : ''}">
                            {match.score1 || 0}
                          </span>
                        </div>
                      {:else}
                        <span class="text-base-content/40">-</span>
                      {/if}
                    </div>

                    <!-- Player 2 -->
                    <div class="flex items-center justify-between">
                      <span class="font-medium truncate {match.winner === 'player2' ? 'text-success' : ''}">
                        {match.player2 || 'TBD'}
                      </span>
                      {#if match.completed || match.score2 > 0}
                        <div class="flex items-center gap-1">
                          {#each Array(raceTo) as _, i}
                            <div class="w-3 h-3 rounded-full {i < (match.score2 || 0) ? 'bg-success' : 'bg-base-300'}"></div>
                          {/each}
                          <span class="font-bold ml-2 {match.winner === 'player2' ? 'text-success' : ''}">
                            {match.score2 || 0}
                          </span>
                        </div>
                      {:else}
                        <span class="text-base-content/40">-</span>
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
