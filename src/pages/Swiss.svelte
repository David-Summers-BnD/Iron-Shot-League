<script>
  import PlayerInput from '../components/PlayerInput.svelte';
  import ScoreModal from '../components/ScoreModal.svelte';
  import { createSwissTournament, generateNextRound, recordResult, getStandings, isRoundComplete, isTournamentComplete } from '../lib/swiss.js';
  import { tournaments, createTournament, updateTournament } from '../stores/tournaments.js';
  import { saveTournaments } from '../lib/storage.js';

  let players = [];
  let tournamentName = '';
  let numRounds = 0;
  let tournament = null;
  let currentTournament = null;

  // Modal state
  let modalOpen = false;
  let selectedMatch = null;

  // View state
  let view = 'setup';
  let activeTab = 'pairings'; // 'pairings' | 'standings'

  function handlePlayersChange(e) {
    players = e.detail;
    // Auto-calculate recommended rounds
    numRounds = Math.ceil(Math.log2(players.length)) + 1;
  }

  function startTournament() {
    if (players.length < 2) return;

    const name = tournamentName.trim() || `Swiss System - ${new Date().toLocaleDateString()}`;
    tournament = createSwissTournament(players, numRounds);
    tournament = generateNextRound(tournament);

    currentTournament = createTournament('swiss', name, players, { numRounds });
    updateTournament(currentTournament.id, {
      status: 'in_progress',
      tournament
    });

    view = 'tournament';
    saveData();
  }

  function openScoreModal(match) {
    if (match.player2 === 'BYE') return;
    if (match.completed) return;

    selectedMatch = match;
    modalOpen = true;
  }

  function handleScoreSubmit(e) {
    const { matchId, score1, score2, winner } = e.detail;

    tournament = recordResult(tournament, matchId, score1, score2, winner);

    if (currentTournament) {
      updateTournament(currentTournament.id, { tournament });
    }

    saveData();
  }

  function nextRound() {
    tournament = generateNextRound(tournament);

    if (currentTournament) {
      const complete = isTournamentComplete(tournament);
      updateTournament(currentTournament.id, {
        tournament,
        status: complete ? 'completed' : 'in_progress'
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
    tournament = null;
    currentTournament = null;
    view = 'setup';
  }

  $: standings = tournament ? getStandings(tournament) : [];
  $: roundComplete = tournament ? isRoundComplete(tournament) : false;
  $: tournamentComplete = tournament ? isTournamentComplete(tournament) : false;
  $: currentRound = tournament?.rounds[tournament.rounds.length - 1];
</script>

<div class="max-w-5xl mx-auto">
  {#if view === 'setup'}
    <!-- Setup Phase -->
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h2 class="card-title text-2xl text-accent mb-4">
          🎲 Swiss System Tournament
        </h2>
        <p class="text-base-content/60 mb-6">
          Players are paired with opponents of similar skill each round. No elimination - everyone plays all rounds.
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
              placeholder="Swiss Open"
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text text-lg font-semibold">Number of Rounds</span>
            </label>
            <input
              type="number"
              bind:value={numRounds}
              min="2"
              max="10"
              class="input input-bordered bg-base-300"
            />
            <label class="label">
              <span class="label-text-alt text-base-content/60">
                Recommended: {Math.ceil(Math.log2(Math.max(players.length, 2))) + 1} rounds for {players.length || 0} players
              </span>
            </label>
          </div>
        </div>

        <PlayerInput
          {players}
          minPlayers={4}
          maxPlayers={64}
          label="Players"
          on:change={handlePlayersChange}
        />

        <div class="card-actions justify-end mt-6">
          <button
            class="btn btn-primary btn-lg glow-primary"
            disabled={players.length < 4}
            on:click={startTournament}
          >
            Start Swiss System
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
          <h2 class="text-2xl font-bold text-white">{currentTournament?.name || 'Swiss Tournament'}</h2>
          <p class="text-base-content/60">
            Round {tournament?.currentRound} of {tournament?.totalRounds}
          </p>
        </div>

        <div class="flex gap-2">
          <button
            class="btn btn-sm {activeTab === 'pairings' ? 'btn-primary' : 'btn-ghost'}"
            on:click={() => activeTab = 'pairings'}
          >Pairings</button>
          <button
            class="btn btn-sm {activeTab === 'standings' ? 'btn-primary' : 'btn-ghost'}"
            on:click={() => activeTab = 'standings'}
          >Standings</button>
          <button class="btn btn-sm btn-ghost text-error" on:click={resetTournament}>
            New
          </button>
        </div>
      </div>

      <!-- Progress -->
      <div class="w-full">
        <progress
          class="progress progress-primary w-full"
          value={tournament?.currentRound}
          max={tournament?.totalRounds}
        ></progress>
      </div>

      <!-- Tournament Complete Banner -->
      {#if tournamentComplete}
        <div class="alert alert-success shadow-lg glow-success">
          <div class="flex items-center gap-4">
            <span class="text-4xl">🏆</span>
            <div>
              <h3 class="font-bold text-xl">Tournament Complete!</h3>
              <p class="text-2xl font-bold">Winner: {standings[0]?.name}</p>
            </div>
          </div>
        </div>
      {/if}

      {#if activeTab === 'pairings'}
        <!-- Current Round Pairings -->
        <div class="card bg-base-200">
          <div class="card-body">
            <h3 class="card-title">
              Round {tournament?.currentRound} Pairings
              {#if roundComplete}
                <span class="badge badge-success">Complete</span>
              {/if}
            </h3>

            <div class="grid sm:grid-cols-2 gap-3">
              {#each currentRound?.matches || [] as match}
                <button
                  class="match-card {match.completed ? 'completed' : ''}"
                  on:click={() => openScoreModal(match)}
                  disabled={match.completed || match.player2 === 'BYE'}
                >
                  <div class="flex items-center justify-between">
                    <div class="flex-1">
                      <p class="font-medium {match.winner === 'player1' ? 'text-success' : ''}">
                        {match.player1}
                      </p>
                      <p class="font-medium {match.winner === 'player2' ? 'text-success' : ''} {match.player2 === 'BYE' ? 'italic text-base-content/40' : ''}">
                        {match.player2}
                      </p>
                    </div>
                    {#if match.completed}
                      <div class="text-right">
                        <p class="font-bold {match.winner === 'player1' ? 'text-success' : ''}">{match.score1}</p>
                        <p class="font-bold {match.winner === 'player2' ? 'text-success' : ''}">{match.score2}</p>
                      </div>
                    {:else if match.player2 !== 'BYE'}
                      <span class="badge badge-outline">Click to score</span>
                    {:else}
                      <span class="badge badge-success">BYE</span>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>

            {#if roundComplete && !tournamentComplete}
              <div class="mt-4">
                <button class="btn btn-primary w-full" on:click={nextRound}>
                  Generate Round {tournament.currentRound + 1} Pairings
                </button>
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <!-- Standings -->
        <div class="card bg-base-200">
          <div class="card-body">
            <h3 class="card-title">Standings</h3>
            <div class="overflow-x-auto">
              <table class="table table-zebra">
                <thead>
                  <tr>
                    <th class="w-12">#</th>
                    <th>Player</th>
                    <th class="text-center">Pts</th>
                    <th class="text-center">W</th>
                    <th class="text-center">L</th>
                    <th class="text-center">D</th>
                    <th class="text-center" title="Buchholz Score (tiebreaker)">Buch</th>
                  </tr>
                </thead>
                <tbody>
                  {#each standings as player, index}
                    <tr class="{index === 0 ? 'bg-success/10' : ''}">
                      <td class="font-bold {index === 0 ? 'text-success' : ''}">{index + 1}</td>
                      <td class="font-medium">{player.name}</td>
                      <td class="text-center font-bold text-primary">{player.points}</td>
                      <td class="text-center text-success">{player.wins}</td>
                      <td class="text-center text-error">{player.losses}</td>
                      <td class="text-center">{player.draws}</td>
                      <td class="text-center text-base-content/60">{player.buchholz.toFixed(1)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      {/if}
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
  on:submit={handleScoreSubmit}
/>
