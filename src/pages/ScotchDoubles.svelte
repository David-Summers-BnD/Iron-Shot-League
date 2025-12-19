<script>
  import ScoreModal from '../components/ScoreModal.svelte';
  import { generateSingleElimination, updateMatch, isBracketComplete, getBracketWinner } from '../lib/brackets.js';
  import { tournaments, createTournament, updateTournament } from '../stores/tournaments.js';
  import { saveTournaments } from '../lib/storage.js';

  let teams = [];
  let tournamentName = '';
  let raceTo = 0;
  let bracket = null;
  let currentTournament = null;

  // Team input state
  let newTeamName = '';
  let player1Name = '';
  let player2Name = '';

  // Modal state
  let modalOpen = false;
  let selectedMatch = null;

  // View state
  let view = 'setup';

  function addTeam() {
    if (!newTeamName.trim() || !player1Name.trim() || !player2Name.trim()) return;

    teams = [...teams, {
      name: newTeamName.trim(),
      player1: player1Name.trim(),
      player2: player2Name.trim()
    }];

    newTeamName = '';
    player1Name = '';
    player2Name = '';
  }

  function removeTeam(index) {
    teams = teams.filter((_, i) => i !== index);
  }

  function startTournament() {
    if (teams.length < 2) return;

    const name = tournamentName.trim() || `Scotch Doubles - ${new Date().toLocaleDateString()}`;
    const teamNames = teams.map(t => t.name);

    bracket = generateSingleElimination(teamNames, false);

    currentTournament = createTournament('scotch-doubles', name, teamNames, {
      teams,
      raceTo
    });
    updateTournament(currentTournament.id, {
      status: 'in_progress',
      bracket,
      teams
    });

    view = 'bracket';
    saveData();
  }

  function getTeamPlayers(teamName) {
    const team = teams.find(t => t.name === teamName);
    return team ? `${team.player1} & ${team.player2}` : '';
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
    teams = [];
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
          👥 Scotch Doubles Tournament
        </h2>
        <p class="text-base-content/60 mb-6">
          Team pairs alternate shots. Each team of two competes in bracket format.
        </p>

        <!-- Rules Reminder -->
        <div class="alert mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-info shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <div>
            <h4 class="font-bold">Scotch Doubles Rules</h4>
            <ul class="text-sm mt-1 list-disc list-inside">
              <li>Players alternate shots during their team's inning</li>
              <li>Either player may break</li>
              <li>Order must be maintained between innings</li>
            </ul>
          </div>
        </div>

        <div class="grid md:grid-cols-2 gap-6 mb-6">
          <div class="form-control">
            <label class="label">
              <span class="label-text text-lg font-semibold">Tournament Name</span>
            </label>
            <input
              type="text"
              bind:value={tournamentName}
              class="input input-bordered bg-base-300"
              placeholder="Partners Championship"
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
            </select>
          </div>
        </div>

        <!-- Team Input -->
        <div class="space-y-4 mb-6">
          <div class="flex items-center justify-between">
            <label class="text-lg font-semibold text-white">Teams</label>
            <span class="badge {teams.length >= 2 ? 'badge-success' : 'badge-warning'}">
              {teams.length} teams
            </span>
          </div>

          <!-- Add Team Form -->
          <div class="grid md:grid-cols-4 gap-3">
            <input
              type="text"
              bind:value={newTeamName}
              class="input input-bordered bg-base-300"
              placeholder="Team Name"
            />
            <input
              type="text"
              bind:value={player1Name}
              class="input input-bordered bg-base-300"
              placeholder="Player 1"
            />
            <input
              type="text"
              bind:value={player2Name}
              class="input input-bordered bg-base-300"
              placeholder="Player 2"
            />
            <button
              class="btn btn-primary"
              on:click={addTeam}
              disabled={!newTeamName.trim() || !player1Name.trim() || !player2Name.trim()}
            >
              Add Team
            </button>
          </div>

          <!-- Team List -->
          {#if teams.length > 0}
            <div class="bg-base-300 rounded-lg p-3 space-y-2">
              {#each teams as team, index}
                <div class="flex items-center justify-between p-3 bg-base-200 rounded-lg">
                  <div>
                    <p class="font-bold text-primary">{team.name}</p>
                    <p class="text-sm text-base-content/60">{team.player1} & {team.player2}</p>
                  </div>
                  <button class="btn btn-ghost btn-sm text-error" on:click={() => removeTeam(index)}>
                    ✕
                  </button>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center py-8 text-base-content/40 bg-base-300 rounded-lg">
              <p>No teams added yet</p>
              <p class="text-sm">Add at least 2 teams to start</p>
            </div>
          {/if}
        </div>

        <div class="card-actions justify-end">
          <button
            class="btn btn-primary btn-lg glow-primary"
            disabled={teams.length < 2}
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
          <h2 class="text-2xl font-bold text-white">{currentTournament?.name || 'Scotch Doubles'}</h2>
          <p class="text-base-content/60">{teams.length} teams competing</p>
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
              <h3 class="font-bold text-xl">Champions!</h3>
              <p class="text-2xl font-bold">{winner}</p>
              <p class="text-base-content/80">{getTeamPlayers(winner)}</p>
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
                    class="match-card w-64 {match.completed ? 'completed' : ''}"
                    on:click={() => openScoreModal(match)}
                    disabled={!match.player1 || !match.player2 || match.player1 === 'BYE' || match.player2 === 'BYE'}
                  >
                    <!-- Team 1 -->
                    <div class="mb-3 pb-3 border-b border-base-300">
                      <div class="flex items-center justify-between">
                        <span class="font-bold {match.winner === 'player1' ? 'text-success' : ''}">
                          {match.player1 || 'TBD'}
                        </span>
                        {#if match.completed}
                          <span class="text-xl font-bold {match.winner === 'player1' ? 'text-success' : ''}">
                            {match.score1}
                          </span>
                        {/if}
                      </div>
                      {#if match.player1 && match.player1 !== 'TBD' && match.player1 !== 'BYE'}
                        <p class="text-xs text-base-content/50 mt-1">{getTeamPlayers(match.player1)}</p>
                      {/if}
                    </div>

                    <!-- Team 2 -->
                    <div>
                      <div class="flex items-center justify-between">
                        <span class="font-bold {match.winner === 'player2' ? 'text-success' : ''} {match.player2 === 'BYE' ? 'italic text-base-content/40' : ''}">
                          {match.player2 || 'TBD'}
                        </span>
                        {#if match.completed}
                          <span class="text-xl font-bold {match.winner === 'player2' ? 'text-success' : ''}">
                            {match.score2}
                          </span>
                        {/if}
                      </div>
                      {#if match.player2 && match.player2 !== 'TBD' && match.player2 !== 'BYE'}
                        <p class="text-xs text-base-content/50 mt-1">{getTeamPlayers(match.player2)}</p>
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
