<script>
  import { onMount } from 'svelte';
  import PlayerInput from '../components/PlayerInput.svelte';
  import ScoreModal from '../components/ScoreModal.svelte';
  import { generateRoundRobinSchedule, calculateStandings, isRoundRobinComplete } from '../lib/roundrobin.js';
  import { tournaments, createTournament, updateTournament } from '../stores/tournaments.js';
  import { saveTournaments } from '../lib/storage.js';

  let players = [];
  let tournamentName = '';
  let currentTournament = null;
  let schedule = null;
  let standings = [];

  // Modal state
  let modalOpen = false;
  let selectedMatch = null;

  // View state
  let view = 'setup'; // 'setup' | 'schedule' | 'standings'

  function handlePlayersChange(e) {
    players = e.detail;
  }

  function startTournament() {
    if (players.length < 2) return;

    const name = tournamentName.trim() || `Round Robin - ${new Date().toLocaleDateString()}`;
    schedule = generateRoundRobinSchedule(players);

    currentTournament = createTournament('round-robin', name, players, {});
    updateTournament(currentTournament.id, {
      status: 'in_progress',
      matches: schedule.matches,
      rounds: schedule.rounds
    });

    view = 'schedule';
    saveData();
  }

  function openScoreModal(match) {
    selectedMatch = match;
    modalOpen = true;
  }

  function handleScoreSubmit(e) {
    const { matchId, score1, score2, winner } = e.detail;

    // Update match in schedule
    schedule.matches = schedule.matches.map(m => {
      if (m.id === matchId) {
        return { ...m, score1, score2, winner, completed: true };
      }
      return m;
    });

    // Update rounds
    schedule.rounds = schedule.rounds.map(round => ({
      ...round,
      matches: round.matches.map(m => {
        if (m.id === matchId) {
          return { ...m, score1, score2, winner, completed: true };
        }
        return m;
      })
    }));

    // Recalculate standings
    standings = calculateStandings(players, schedule.matches);

    // Update tournament
    if (currentTournament) {
      const isComplete = isRoundRobinComplete(schedule.matches);
      updateTournament(currentTournament.id, {
        matches: schedule.matches,
        rounds: schedule.rounds,
        standings,
        status: isComplete ? 'completed' : 'in_progress'
      });
    }

    saveData();
  }

  async function saveData() {
    const allTournaments = $tournaments;
    await saveTournaments(allTournaments);
  }

  function resetTournament() {
    players = [];
    tournamentName = '';
    currentTournament = null;
    schedule = null;
    standings = [];
    view = 'setup';
  }

  $: if (schedule) {
    standings = calculateStandings(players, schedule.matches);
  }

  $: completedCount = schedule?.matches?.filter(m => m.completed).length || 0;
  $: totalMatches = schedule?.matches?.length || 0;
  $: progressPercent = totalMatches > 0 ? (completedCount / totalMatches) * 100 : 0;
</script>

<div class="max-w-6xl mx-auto">
  {#if view === 'setup'}
    <!-- Setup Phase -->
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h2 class="card-title text-2xl text-accent mb-4">
          🔄 Round Robin Tournament
        </h2>
        <p class="text-base-content/60 mb-6">
          Every player faces every other player. Best for 4-12 players.
        </p>

        <div class="form-control mb-6">
          <label class="label">
            <span class="label-text text-lg font-semibold">Tournament Name (optional)</span>
          </label>
          <input
            type="text"
            bind:value={tournamentName}
            class="input input-bordered bg-base-300"
            placeholder="Friday Night Showdown"
          />
        </div>

        <PlayerInput
          {players}
          minPlayers={2}
          maxPlayers={16}
          on:change={handlePlayersChange}
        />

        <div class="card-actions justify-end mt-6">
          <button
            class="btn btn-primary btn-lg glow-primary"
            disabled={players.length < 2}
            on:click={startTournament}
          >
            Generate Schedule
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
          <h2 class="text-2xl font-bold text-white">{currentTournament?.name || 'Round Robin'}</h2>
          <p class="text-base-content/60">{players.length} players • {totalMatches} matches</p>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="btn btn-sm {view === 'schedule' ? 'btn-primary' : 'btn-ghost'}"
            on:click={() => view = 'schedule'}
          >Schedule</button>
          <button
            class="btn btn-sm {view === 'standings' ? 'btn-primary' : 'btn-ghost'}"
            on:click={() => view = 'standings'}
          >Standings</button>
          <button class="btn btn-sm btn-ghost text-error" on:click={resetTournament}>
            New Tournament
          </button>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="w-full">
        <div class="flex justify-between text-sm mb-1">
          <span>{completedCount} of {totalMatches} matches completed</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <progress class="progress progress-success w-full" value={progressPercent} max="100"></progress>
      </div>

      {#if view === 'schedule'}
        <!-- Schedule View -->
        <div class="space-y-6">
          {#each schedule.rounds as round}
            <div class="card bg-base-200">
              <div class="card-body">
                <h3 class="card-title text-lg">Round {round.number}</h3>
                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {#each round.matches as match}
                    <button
                      class="match-card text-left cursor-pointer {match.completed ? 'completed' : ''}"
                      on:click={() => openScoreModal(match)}
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex-1">
                          <p class="font-medium {match.winner === 'player1' ? 'text-success' : ''}">
                            {match.player1}
                          </p>
                          <p class="font-medium {match.winner === 'player2' ? 'text-success' : ''}">
                            {match.player2}
                          </p>
                        </div>
                        {#if match.completed}
                          <div class="text-right">
                            <p class="text-xl font-bold {match.winner === 'player1' ? 'text-success' : 'text-base-content/50'}">
                              {match.score1}
                            </p>
                            <p class="text-xl font-bold {match.winner === 'player2' ? 'text-success' : 'text-base-content/50'}">
                              {match.score2}
                            </p>
                          </div>
                        {:else}
                          <span class="badge badge-outline">Pending</span>
                        {/if}
                      </div>
                    </button>
                  {/each}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <!-- Standings View -->
        <div class="card bg-base-200">
          <div class="card-body">
            <h3 class="card-title text-lg">Standings</h3>
            <div class="overflow-x-auto">
              <table class="table table-zebra">
                <thead>
                  <tr>
                    <th class="w-12">#</th>
                    <th>Player</th>
                    <th class="text-center">Played</th>
                    <th class="text-center">W</th>
                    <th class="text-center">L</th>
                    <th class="text-center">PF</th>
                    <th class="text-center">PA</th>
                    <th class="text-center">+/-</th>
                  </tr>
                </thead>
                <tbody>
                  {#each standings as stat, index}
                    <tr class="{index === 0 ? 'bg-success/10' : ''}">
                      <td class="font-bold {index === 0 ? 'text-success' : ''}">{index + 1}</td>
                      <td class="font-medium">{stat.player}</td>
                      <td class="text-center">{stat.played}</td>
                      <td class="text-center text-success font-bold">{stat.wins}</td>
                      <td class="text-center text-error">{stat.losses}</td>
                      <td class="text-center">{stat.pointsFor}</td>
                      <td class="text-center">{stat.pointsAgainst}</td>
                      <td class="text-center {stat.pointDiff > 0 ? 'text-success' : stat.pointDiff < 0 ? 'text-error' : ''}">
                        {stat.pointDiff > 0 ? '+' : ''}{stat.pointDiff}
                      </td>
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
