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

<div class="max-w-4xl mx-auto">
  {#if view === 'setup'}
    <!-- Setup Phase -->
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h2 class="card-title text-2xl text-accent mb-4">
          📊 Ladder Tournament
        </h2>
        <p class="text-base-content/60 mb-6">
          Climb the ranks by challenging players above you. Win to swap positions!
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
              placeholder="King of the Hill"
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text text-lg font-semibold">Max Rungs to Challenge</span>
            </label>
            <select bind:value={maxRungs} class="select select-bordered bg-base-300">
              <option value={2}>2 rungs</option>
              <option value={3}>3 rungs (recommended)</option>
              <option value={4}>4 rungs</option>
              <option value={5}>5 rungs</option>
            </select>
          </div>
        </div>

        <div class="form-control mb-6">
          <label class="label cursor-pointer justify-start gap-4">
            <input type="checkbox" bind:checked={randomizeStart} class="checkbox checkbox-primary" />
            <span class="label-text">Randomize starting positions</span>
          </label>
        </div>

        <PlayerInput
          {players}
          minPlayers={2}
          maxPlayers={50}
          on:change={handlePlayersChange}
        />

        <div class="card-actions justify-end mt-6">
          <button
            class="btn btn-primary btn-lg glow-primary"
            disabled={players.length < 2}
            on:click={startTournament}
          >
            Create Ladder
          </button>
        </div>
      </div>
    </div>
  {:else}
    <!-- Ladder In Progress -->
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 class="text-2xl font-bold text-white">{currentTournament?.name || 'Ladder'}</h2>
          <p class="text-base-content/60">{ladder?.length} players • Challenge up to {maxRungs} rungs</p>
        </div>

        <button class="btn btn-sm btn-ghost text-error" on:click={resetTournament}>
          New Ladder
        </button>
      </div>

      <!-- Instructions -->
      <div class="alert">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-info shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <span>Click on a player to challenge someone above them (within {maxRungs} rungs)</span>
      </div>

      <!-- Ladder Display -->
      <div class="space-y-2">
        {#each ladder as entry, index}
          <button
            class="w-full flex items-center gap-4 p-4 bg-base-200 rounded-lg hover:bg-base-300 transition-all
                   {index === 0 ? 'ring-2 ring-primary bg-gradient-to-r from-primary/10 to-transparent' : ''}"
            on:click={() => entry.rank < ladder.length && initiateChallenge(entry)}
          >
            <!-- Rank Badge -->
            <div class="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl
                        {index === 0 ? 'bg-primary text-primary-content' : 'bg-base-300'}">
              {#if index === 0}
                👑
              {:else}
                {entry.rank}
              {/if}
            </div>

            <!-- Player Info -->
            <div class="flex-1 text-left">
              <p class="font-bold text-lg {index === 0 ? 'text-primary' : ''}">{entry.player}</p>
              <div class="flex gap-4 text-sm text-base-content/60">
                <span class="text-success">{entry.wins}W</span>
                <span class="text-error">{entry.losses}L</span>
                {#if entry.challenges > 0}
                  <span>{entry.challenges} challenges</span>
                {/if}
              </div>
            </div>

            <!-- Challenge Indicator -->
            {#if entry.rank < ladder.length}
              <div class="badge badge-outline">Challenge ↑</div>
            {/if}
          </button>
        {/each}
      </div>

      <!-- Recent Challenges -->
      {#if challenges.length > 0}
        <div class="card bg-base-200">
          <div class="card-body">
            <h3 class="card-title text-lg">Recent Challenges</h3>
            <div class="space-y-2 max-h-48 overflow-y-auto">
              {#each challenges.slice().reverse().slice(0, 10) as challenge}
                <div class="flex items-center justify-between p-2 bg-base-300 rounded text-sm">
                  <div>
                    <span class="font-medium">{challenge.challenger}</span>
                    <span class="text-base-content/60"> challenged </span>
                    <span class="font-medium">{challenge.defender}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="badge {challenge.winner === challenge.challenger ? 'badge-success' : 'badge-error'}">
                      {challenge.winner} won
                    </span>
                    {#if challenge.swapped}
                      <span class="text-accent">⇅</span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Challenge Modal -->
    {#if showChallenge}
      <div class="modal modal-open">
        <div class="modal-box bg-base-200">
          <h3 class="font-bold text-xl mb-4">Challenge Match</h3>

          {#if !defender}
            <p class="mb-4">
              <span class="font-bold text-primary">{challenger?.player}</span>
              <span class="text-base-content/60"> (Rank #{challenger?.rank}) is challenging...</span>
            </p>

            <p class="text-sm text-base-content/60 mb-4">Select opponent (up to {maxRungs} rungs above):</p>

            <div class="space-y-2">
              {#each availableTargets as target}
                <button
                  class="w-full p-3 bg-base-300 rounded-lg hover:bg-primary/20 flex items-center justify-between"
                  on:click={() => selectDefender(target)}
                >
                  <span class="font-medium">{target.player}</span>
                  <span class="badge">Rank #{target.rank}</span>
                </button>
              {/each}
            </div>
          {:else}
            <div class="text-center mb-6">
              <p class="text-xl font-bold mb-4">
                <span class="text-primary">{challenger.player}</span>
                <span class="text-base-content/60 mx-2">vs</span>
                <span class="text-secondary">{defender.player}</span>
              </p>
              <p class="text-sm text-base-content/60">Who won the match?</p>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <button
                class="btn btn-lg {challengeWinner === 'challenger' ? 'btn-primary' : 'btn-ghost bg-base-300'}"
                on:click={() => challengeWinner = 'challenger'}
              >
                {challenger.player}
                <br><span class="text-xs opacity-60">(Swap positions)</span>
              </button>
              <button
                class="btn btn-lg {challengeWinner === 'defender' ? 'btn-secondary' : 'btn-ghost bg-base-300'}"
                on:click={() => challengeWinner = 'defender'}
              >
                {defender.player}
                <br><span class="text-xs opacity-60">(Stay in place)</span>
              </button>
            </div>
          {/if}

          <div class="modal-action">
            <button class="btn btn-ghost" on:click={closeChallenge}>Cancel</button>
            {#if defender && challengeWinner}
              <button class="btn btn-primary" on:click={submitChallenge}>
                Submit Result
              </button>
            {/if}
          </div>
        </div>
        <div class="modal-backdrop bg-black/50" on:click={closeChallenge}></div>
      </div>
    {/if}
  {/if}
</div>
