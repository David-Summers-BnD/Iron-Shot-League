<script>
  import PlayerInput from '../components/PlayerInput.svelte';
  import ScoreModal from '../components/ScoreModal.svelte';
  import { generateDoubleElimination, updateMatch, getBracketWinner } from '../lib/brackets.js';
  import { tournaments, createTournament, updateTournament } from '../stores/tournaments.js';
  import { saveTournaments } from '../lib/storage.js';

  let players = [];
  let tournamentName = '';
  let seeded = false;
  let raceTo = 0;
  let bracket = null;
  let currentTournament = null;
  let activeView = 'winners'; // 'winners' | 'losers'

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

    const name = tournamentName.trim() || `Double Elimination - ${new Date().toLocaleDateString()}`;
    bracket = generateDoubleElimination(players, seeded);

    currentTournament = createTournament('double-elimination', name, players, { seeded, raceTo });
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

    // Update match in winners bracket
    for (const round of bracket.winners) {
      for (const match of round.matches) {
        if (match.id === matchId) {
          match.score1 = score1;
          match.score2 = score2;
          match.winner = winner;
          match.completed = true;

          // Advance winner
          const winnerName = winner === 'player1' ? match.player1 : match.player2;
          const loserName = winner === 'player1' ? match.player2 : match.player1;

          if (match.nextMatchId) {
            advancePlayer(bracket.winners, match.nextMatchId, winnerName, match.position);
          }

          // TODO: Send loser to losers bracket
          break;
        }
      }
    }

    // Handle grand final
    if (matchId === 'grand-final') {
      bracket.grandFinal.score1 = score1;
      bracket.grandFinal.score2 = score2;
      bracket.grandFinal.winner = winner;
      bracket.grandFinal.completed = true;
    }

    if (currentTournament) {
      updateTournament(currentTournament.id, { bracket });
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
</script>

<div class="max-w-6xl mx-auto">
  {#if view === 'setup'}
    <!-- Setup Phase -->
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h2 class="card-title text-2xl text-accent mb-4">
          🎯 Double Elimination Tournament
        </h2>
        <p class="text-base-content/60 mb-6">
          Two chances to win. Lose twice and you're out. Winners and losers brackets.
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
              placeholder="Grand Championship"
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

        <div class="form-control mb-6">
          <label class="label cursor-pointer justify-start gap-4">
            <input type="checkbox" bind:checked={seeded} class="checkbox checkbox-primary" />
            <span class="label-text">Use player order as seeding</span>
          </label>
        </div>

        <PlayerInput
          {players}
          minPlayers={2}
          maxPlayers={32}
          on:change={handlePlayersChange}
        />

        <div class="card-actions justify-end mt-6">
          <button
            class="btn btn-primary btn-lg glow-primary"
            disabled={players.length < 2}
            on:click={startTournament}
          >
            Generate Brackets
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
          <h2 class="text-2xl font-bold text-white">{currentTournament?.name || 'Double Elimination'}</h2>
          <p class="text-base-content/60">{bracket?.bracketSize} player bracket</p>
        </div>

        <div class="flex gap-2">
          <button
            class="btn btn-sm {activeView === 'winners' ? 'btn-success' : 'btn-ghost'}"
            on:click={() => activeView = 'winners'}
          >Winners</button>
          <button
            class="btn btn-sm {activeView === 'losers' ? 'btn-error' : 'btn-ghost'}"
            on:click={() => activeView = 'losers'}
          >Losers</button>
          <button class="btn btn-sm btn-ghost text-error" on:click={resetTournament}>
            New
          </button>
        </div>
      </div>

      <!-- Winners Bracket -->
      {#if activeView === 'winners'}
        <div class="card bg-base-200">
          <div class="card-body">
            <h3 class="card-title text-success">
              <span class="text-2xl">🏆</span> Winners Bracket
            </h3>

            <div class="overflow-x-auto pb-4">
              <div class="flex gap-8 min-w-max">
                {#each bracket.winners as round, roundIndex}
                  <div class="flex flex-col">
                    <h4 class="text-center font-bold text-sm mb-4 text-success">{round.name}</h4>
                    <div class="flex flex-col justify-around flex-1 gap-4" style="padding-top: {roundIndex * 30}px;">
                      {#each round.matches as match}
                        <button
                          class="match-card w-48 {match.completed ? 'border-success' : ''}"
                          on:click={() => openScoreModal(match)}
                          disabled={!match.player1 || !match.player2 || match.player1 === 'BYE' || match.player2 === 'BYE'}
                        >
                          <div class="flex items-center justify-between mb-1">
                            <span class="font-medium text-sm truncate {match.winner === 'player1' ? 'text-success' : ''}">
                              {match.player1 || 'TBD'}
                            </span>
                            {#if match.completed}
                              <span class="font-bold {match.winner === 'player1' ? 'text-success' : 'text-base-content/40'}">
                                {match.score1}
                              </span>
                            {/if}
                          </div>
                          <div class="flex items-center justify-between">
                            <span class="font-medium text-sm truncate {match.winner === 'player2' ? 'text-success' : ''}">
                              {match.player2 || 'TBD'}
                            </span>
                            {#if match.completed}
                              <span class="font-bold {match.winner === 'player2' ? 'text-success' : 'text-base-content/40'}">
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
        </div>
      {:else}
        <!-- Losers Bracket -->
        <div class="card bg-base-200">
          <div class="card-body">
            <h3 class="card-title text-error">
              <span class="text-2xl">💀</span> Losers Bracket
            </h3>
            <p class="text-base-content/60">
              Losers bracket matches will appear here as players are eliminated from the winners bracket.
            </p>

            {#if bracket.losers.some(r => r.matches.length > 0)}
              <div class="overflow-x-auto pb-4">
                <div class="flex gap-8 min-w-max">
                  {#each bracket.losers.filter(r => r.matches.length > 0) as round}
                    <div class="flex flex-col">
                      <h4 class="text-center font-bold text-sm mb-4 text-error">{round.name}</h4>
                      <div class="flex flex-col gap-4">
                        {#each round.matches as match}
                          <button
                            class="match-card w-48"
                            on:click={() => openScoreModal(match)}
                            disabled={!match.player1 || !match.player2}
                          >
                            <div class="flex items-center justify-between mb-1">
                              <span class="font-medium text-sm truncate">{match.player1 || 'TBD'}</span>
                            </div>
                            <div class="flex items-center justify-between">
                              <span class="font-medium text-sm truncate">{match.player2 || 'TBD'}</span>
                            </div>
                          </button>
                        {/each}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {:else}
              <div class="py-8 text-center text-base-content/40">
                No losers bracket matches yet
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Grand Final -->
      {#if winnersChamp}
        <div class="card bg-gradient-to-r from-primary/20 to-accent/20 border-2 border-primary">
          <div class="card-body">
            <h3 class="card-title text-primary text-xl">
              <span class="text-3xl">👑</span> Grand Final
            </h3>
            <div class="flex items-center justify-center gap-8">
              <div class="text-center">
                <p class="text-sm text-base-content/60">Winners Champion</p>
                <p class="text-xl font-bold text-success">{winnersChamp}</p>
              </div>
              <span class="text-2xl font-bold text-base-content/30">vs</span>
              <div class="text-center">
                <p class="text-sm text-base-content/60">Losers Champion</p>
                <p class="text-xl font-bold text-error">{bracket.grandFinal.player2 || 'TBD'}</p>
              </div>
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
  {raceTo}
  on:submit={handleScoreSubmit}
/>
